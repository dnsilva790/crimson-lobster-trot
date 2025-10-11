"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { useTodoist } from "@/context/TodoistContext";
import { TodoistTask } from "@/lib/types";
import LoadingSpinner from "@/components/ui/loading-spinner";
import { toast } from "sonner";
import { Check, Trash2, ExternalLink, Users, MessageSquare, CalendarIcon } from "lucide-react";
import { cn, getDelegateNameFromLabels } from "@/lib/utils";
import { format, isPast, parseISO, isToday, isTomorrow } from "date-fns";
import { ptBR } from "date-fns/locale";

const PRIORITY_COLORS: Record<1 | 2 | 3 | 4, string> = {
  4: "bg-red-500", // P1 - Urgente
  3: "bg-orange-500", // P2 - Alto
  2: "bg-yellow-500", // P3 - Médio
  1: "bg-gray-400", // P4 - Baixo
};

const PRIORITY_LABELS: Record<1 | 2 | 3 | 4, string> = {
  4: "P1",
  3: "P2",
  2: "P3",
  1: "P4",
};

const FollowUp = () => {
  const { fetchTasks, closeTask, updateTask, isLoading: isLoadingTodoist } = useTodoist();
  const [delegatedTasks, setDelegatedTasks] = useState<TodoistTask[]>([]);
  const [tasksByDelegate, setTasksByDelegate] = useState<Record<string, TodoistTask[]>>({});
  const [allDelegates, setAllDelegates] = useState<string[]>([]);
  const [selectedDelegateFilter, setSelectedDelegateFilter] = useState<string>("all");
  const [filterStatus, setFilterStatus] = useState<"all" | "overdue" | "today" | "tomorrow">("all");
  const [isFetchingDelegatedTasks, setIsFetchingDelegatedTasks] = useState(false);

  const fetchDelegatedTasks = useCallback(async () => {
    setIsFetchingDelegatedTasks(true);
    try {
      // Fetch tasks that have any 'espera_de_' label
      const tasks = await fetchTasks("label:espera_de_*", { includeSubtasks: false, includeRecurring: false });
      
      const grouped: Record<string, TodoistTask[]> = {};
      const delegates: Set<string> = new Set();

      tasks.forEach(task => {
        const delegateName = getDelegateNameFromLabels(task.labels);
        if (delegateName) {
          delegates.add(delegateName);
          if (!grouped[delegateName]) {
            grouped[delegateName] = [];
          }
          grouped[delegateName].push(task);
        }
      });

      // Sort tasks within each delegate group by priority and then due date
      Object.keys(grouped).forEach(delegate => {
        grouped[delegate].sort((a, b) => {
          // Priority: P1 (4) > P2 (3) > P3 (2) > P4 (1)
          if (b.priority !== a.priority) {
            return b.priority - a.priority;
          }
          // Due date: earliest first
          const getDateValue = (task: TodoistTask) => {
            if (task.due?.datetime) return parseISO(task.due.datetime).getTime();
            if (task.due?.date) return parseISO(task.due.date).getTime();
            return Infinity; // Tasks without a due date go last
          };
          const dateA = getDateValue(a);
          const dateB = getDateValue(b);
          return dateA - dateB;
        });
      });

      setDelegatedTasks(tasks);
      setTasksByDelegate(grouped);
      setAllDelegates(Array.from(delegates).sort());
      toast.success(`Carregadas ${tasks.length} tarefas delegadas.`);
    } catch (error) {
      console.error("Failed to fetch delegated tasks:", error);
      toast.error("Falha ao carregar tarefas delegadas.");
    } finally {
      setIsFetchingDelegatedTasks(false);
    }
  }, [fetchTasks]);

  useEffect(() => {
    fetchDelegatedTasks();
  }, [fetchDelegatedTasks]);

  const handleCompleteTask = useCallback(async (taskId: string) => {
    const success = await closeTask(taskId);
    if (success !== undefined) {
      toast.success("Tarefa delegada concluída!");
      fetchDelegatedTasks(); // Refresh the list
    }
  }, [closeTask, fetchDelegatedTasks]);

  const handleRemoveDelegation = useCallback(async (task: TodoistTask) => {
    const delegateLabel = task.labels.find(label => label.startsWith("espera_de_"));
    if (!delegateLabel) {
      toast.error("Etiqueta de delegação não encontrada.");
      return;
    }
    const updatedLabels = task.labels.filter(label => label !== delegateLabel);
    const updated = await updateTask(task.id, { labels: updatedLabels });
    if (updated) {
      toast.success("Delegação removida da tarefa!");
      fetchDelegatedTasks(); // Refresh the list
    } else {
      toast.error("Falha ao remover delegação.");
    }
  }, [updateTask, fetchDelegatedTasks]);

  const filteredTasksToDisplay = useMemo(() => {
    let tasks = delegatedTasks;

    if (selectedDelegateFilter !== "all") {
      tasks = tasks.filter(task => getDelegateNameFromLabels(task.labels) === selectedDelegateFilter);
    }

    const now = new Date();
    return tasks.filter(task => {
      if (filterStatus === "all") return true;

      if (!task.due?.date && !task.due?.datetime) return false; // Only tasks with due dates for status filters

      const dueDate = task.due.datetime ? parseISO(task.due.datetime) : parseISO(task.due.date);

      if (filterStatus === "overdue") {
        return isPast(dueDate) && !isToday(dueDate); // Overdue but not today (today's past hours are handled by 'today')
      }
      if (filterStatus === "today") {
        return isToday(dueDate);
      }
      if (filterStatus === "tomorrow") {
        return isTomorrow(dueDate);
      }
      return true;
    }).sort((a, b) => {
      // Sort by status first: overdue > today > tomorrow > others
      const getStatusRank = (task: TodoistTask) => {
        if (!task.due?.date && !task.due?.datetime) return 4; // No due date last
        const dueDate = task.due.datetime ? parseISO(task.due.datetime) : parseISO(task.due.date);
        if (isPast(dueDate) && !isToday(dueDate)) return 0; // Overdue first
        if (isToday(dueDate)) return 1;
        if (isTomorrow(dueDate)) return 2;
        return 3; // Future dates
      };

      const rankA = getStatusRank(a);
      const rankB = getStatusRank(b);
      if (rankA !== rankB) return rankA - rankB;

      // Then by priority
      if (b.priority !== a.priority) {
        return b.priority - a.priority;
      }

      // Then by due date
      const getDateValue = (task: TodoistTask) => {
        if (task.due?.datetime) return parseISO(task.due.datetime).getTime();
        if (task.due?.date) return parseISO(task.due.date).getTime();
        return Infinity;
      };
      const dateA = getDateValue(a);
      const dateB = getDateValue(b);
      return dateA - dateB;
    });
  }, [delegatedTasks, selectedDelegateFilter, filterStatus]);

  const groupedFilteredTasks = useMemo(() => {
    const grouped: Record<string, TodoistTask[]> = {};
    filteredTasksToDisplay.forEach(task => {
      const delegateName = getDelegateNameFromLabels(task.labels) || "Sem Responsável";
      if (!grouped[delegateName]) {
        grouped[delegateName] = [];
      }
      grouped[delegateName].push(task);
    });
    return grouped;
  }, [filteredTasksToDisplay]);

  const renderTaskItem = (task: TodoistTask) => (
    <div key={task.id} className="p-4 border-b border-gray-200 last:border-b-0">
      <div className="flex items-start justify-between">
        <div className="flex-grow pr-4">
          <h4 className="text-lg font-semibold text-gray-800">{task.content}</h4>
          {task.description && <p className="text-sm text-gray-600 mt-1 whitespace-pre-wrap">{task.description}</p>}
          <div className="flex items-center gap-3 text-xs text-gray-500 mt-2">
            {task.due?.datetime && (
              <span className="flex items-center gap-1">
                <CalendarIcon className="h-3 w-3" /> {format(parseISO(task.due.datetime), "dd/MM/yyyy HH:mm", { locale: ptBR })}
              </span>
            )}
            {task.due?.date && !task.due?.datetime && (
              <span className="flex items-center gap-1">
                <CalendarIcon className="h-3 w-3" /> {format(parseISO(task.due.date), "dd/MM/yyyy", { locale: ptBR })}
              </span>
            )}
            {!task.due && <span>Sem prazo</span>}
            <span
              className={cn(
                "px-2 py-0.5 rounded-full text-white text-xs font-medium",
                PRIORITY_COLORS[task.priority],
              )}
            >
              {PRIORITY_LABELS[task.priority]}
            </span>
          </div>
        </div>
        <div className="flex flex-col gap-2 ml-4">
          <Button variant="ghost" size="icon" onClick={() => handleCompleteTask(task.id)} disabled={isLoadingTodoist}>
            <Check className="h-4 w-4 text-green-500" />
          </Button>
          <Button variant="ghost" size="icon" onClick={() => handleRemoveDelegation(task)} disabled={isLoadingTodoist}>
            <Trash2 className="h-4 w-4 text-red-500" />
          </Button>
          <a href={task.url} target="_blank" rel="noopener noreferrer">
            <Button variant="ghost" size="icon">
              <ExternalLink className="h-4 w-4 text-blue-500" />
            </Button>
          </a>
        </div>
      </div>
    </div>
  );

  const renderAgenda = () => {
    if (selectedDelegateFilter === "all" || !groupedFilteredTasks[selectedDelegateFilter]) {
      return (
        <p className="text-gray-600 italic">
          Selecione um responsável para gerar a pauta da reunião 1:1.
        </p>
      );
    }

    const tasksForAgenda = groupedFilteredTasks[selectedDelegateFilter];

    return (
      <div className="prose prose-sm max-w-none">
        <h3 className="text-xl font-bold mb-2">Pauta 1:1 com {selectedDelegateFilter}</h3>
        <p className="text-sm text-gray-600 mb-4">Data: {format(new Date(), "dd/MM/yyyy", { locale: ptBR })}</p>
        
        <h4 className="text-lg font-semibold mb-2">Tarefas em Aberto:</h4>
        {tasksForAgenda.length > 0 ? (
          <ul className="list-disc list-inside space-y-3">
            {tasksForAgenda.map(task => (
              <li key={task.id}>
                <p className="font-medium text-gray-800">
                  <span className={cn(
                    "px-2 py-0.5 rounded-full text-white text-xs font-medium mr-2",
                    PRIORITY_COLORS[task.priority],
                  )}>
                    {PRIORITY_LABELS[task.priority]}
                  </span>
                  {task.content}
                  {task.due?.datetime && (
                    <span className="ml-2 text-gray-500 text-xs">
                      (Vencimento: {format(parseISO(task.due.datetime), "dd/MM HH:mm", { locale: ptBR })})
                    </span>
                  )}
                  {task.due?.date && !task.due?.datetime && (
                    <span className="ml-2 text-gray-500 text-xs">
                      (Vencimento: {format(parseISO(task.due.date), "dd/MM", { locale: ptBR })})
                    </span>
                  )}
                </p>
                {task.description && <p className="text-sm text-gray-600 ml-6 mt-1 whitespace-pre-wrap">Descrição: {task.description}</p>}
                <p className="text-xs text-blue-600 ml-6">
                  <a href={task.url} target="_blank" rel="noopener noreferrer">Abrir no Todoist</a>
                </p>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-gray-600 italic">Nenhuma tarefa delegada para {selectedDelegateFilter} com o filtro atual.</p>
        )}
      </div>
    );
  };

  const isLoading = isLoadingTodoist || isFetchingDelegatedTasks;

  return (
    <div className="p-4 grid grid-cols-1 lg:grid-cols-3 gap-6">
      <div className="lg:col-span-2">
        <h2 className="text-3xl font-bold mb-2 text-gray-800">
          <Users className="inline-block h-8 w-8 mr-2 text-indigo-600" /> ACOMPANHAMENTO DELEGADOS
        </h2>
        <p className="text-lg text-gray-600 mb-6">
          Gerencie e faça follow-up das tarefas que você delegou.
        </p>

        <Card className="mb-6 p-6">
          <CardTitle className="text-xl font-bold mb-4 flex items-center gap-2">
            <MessageSquare className="h-5 w-5 text-indigo-600" /> Filtros e Pauta
          </CardTitle>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="delegate-filter">Filtrar por Responsável</Label>
              <Select value={selectedDelegateFilter} onValueChange={setSelectedDelegateFilter} disabled={isLoading}>
                <SelectTrigger className="w-full mt-1">
                  <SelectValue placeholder="Todos os Responsáveis" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os Responsáveis</SelectItem>
                  {allDelegates.map(delegate => (
                    <SelectItem key={delegate} value={delegate}>{delegate}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="status-filter">Filtrar por Status</Label>
              <Select value={filterStatus} onValueChange={(value: "all" | "overdue" | "today" | "tomorrow") => setFilterStatus(value)} disabled={isLoading}>
                <SelectTrigger className="w-full mt-1">
                  <SelectValue placeholder="Todos os Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas as Tarefas</SelectItem>
                  <SelectItem value="overdue">Atrasadas</SelectItem>
                  <SelectItem value="today">Vencem Hoje</SelectItem>
                  <SelectItem value="tomorrow">Vencem Amanhã</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="mt-6 p-4 border rounded-md bg-gray-50">
            {renderAgenda()}
          </div>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-xl font-bold text-gray-800 flex items-center gap-2">
              <ListTodo className="h-5 w-5 text-indigo-600" /> Lista de Tarefas Delegadas
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="flex justify-center items-center h-48">
                <LoadingSpinner size={40} />
              </div>
            ) : Object.keys(groupedFilteredTasks).length > 0 ? (
              <div className="divide-y divide-gray-200">
                {Object.entries(groupedFilteredTasks).map(([delegateName, tasks]) => (
                  <div key={delegateName} className="mb-4">
                    <h3 className="text-xl font-bold bg-gray-100 p-4 sticky top-0 z-10 border-b border-gray-200">
                      {delegateName} ({tasks.length})
                    </h3>
                    {tasks.map(renderTaskItem)}
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-6 text-center text-gray-600">
                Nenhuma tarefa delegada encontrada com os filtros atuais.
              </div>
            )}
          </CardContent>
        </Card>
      </div>
      <div className="lg:col-span-1">
        {/* Placeholder for future AI Assistant or other sidebar content */}
        <Card className="h-full">
          <CardHeader>
            <CardTitle className="text-xl font-bold text-gray-800">
              Informações Adicionais
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-gray-600">
              Esta área pode ser usada para um assistente de IA ou outras ferramentas de apoio no futuro.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default FollowUp;