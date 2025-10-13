"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { useTodoist } from "@/context/TodoistContext";
import { TodoistTask } from "@/lib/types";
import LoadingSpinner from "@/components/ui/loading-spinner";
import { toast } from "sonner";
import { Check, Trash2, ExternalLink, Users, MessageSquare, CalendarIcon, Edit, Clock, XCircle, ListTodo } from "lucide-react";
import { cn, getDelegateNameFromLabels } from "@/lib/utils";
import { format, isPast, parseISO, isToday, isTomorrow, setHours, setMinutes, isValid } from "date-fns";
import { ptBR } from "date-fns/locale";
import FollowUpAIAssistant from "@/components/FollowUpAIAssistant";

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
  const [selectedTaskForAI, setSelectedTaskForAI] = useState<TodoistTask | null>(null);

  // Estados para edição rápida
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [editedDueDate, setEditedDueDate] = useState<Date | undefined>(undefined);
  const [editedDueTime, setEditedDueTime] = useState<string>("");
  const [editedPriority, setEditedPriority] = useState<1 | 2 | 3 | 4>(1);
  const [editedDeadline, setEditedDeadline] = useState<Date | undefined>(undefined); // Adicionado

  const fetchDelegatedTasks = useCallback(async () => {
    setIsFetchingDelegatedTasks(true);
    try {
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

      Object.keys(grouped).forEach(delegate => {
        grouped[delegate].sort((a, b) => {
          // Prioritize by deadline first
          const getDeadlineValue = (task: TodoistTask) => {
            if (typeof task.deadline === 'string' && task.deadline) return parseISO(task.deadline).getTime();
            return Infinity;
          };
          const deadlineA = getDeadlineValue(a);
          const deadlineB = getDeadlineValue(b);
          if (deadlineA !== deadlineB) {
            return deadlineA - deadlineB;
          }

          if (b.priority !== a.priority) {
            return b.priority - a.priority;
          }
          const getDateValue = (task: TodoistTask) => {
            if (typeof task.due?.datetime === 'string' && task.due.datetime) return parseISO(task.due.datetime).getTime();
            if (typeof task.due?.date === 'string' && task.due.date) return parseISO(task.due.date).getTime();
            return Infinity;
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
      fetchDelegatedTasks();
      if (selectedTaskForAI?.id === taskId) {
        setSelectedTaskForAI(null);
      }
    }
  }, [closeTask, fetchDelegatedTasks, selectedTaskForAI]);

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
      fetchDelegatedTasks();
      if (selectedTaskForAI?.id === task.id) {
        setSelectedTaskForAI(null);
      }
    } else {
      toast.error("Falha ao remover delegação.");
    }
  }, [updateTask, fetchDelegatedTasks, selectedTaskForAI]);

  const filteredTasksToDisplay = useMemo(() => {
    let tasks = delegatedTasks;

    if (selectedDelegateFilter !== "all") {
      tasks = tasks.filter(task => getDelegateNameFromLabels(task.labels) === selectedDelegateFilter);
    }

    const now = new Date();
    return tasks.filter(task => {
      if (filterStatus === "all") return true;

      // Check due date/datetime
      let dueDate: Date | null = null;
      if (typeof task.due?.datetime === 'string' && task.due.datetime) {
        dueDate = parseISO(task.due.datetime);
      } else if (typeof task.due?.date === 'string' && task.due.date) {
        dueDate = parseISO(task.due.date);
      }

      // Check deadline
      let deadlineDate: Date | null = null;
      if (typeof task.deadline === 'string' && task.deadline) {
        deadlineDate = parseISO(task.deadline);
      }

      // If neither due date nor deadline exists, filter out if not 'all' status
      if (!dueDate && !deadlineDate) return false;

      // Prioritize deadline for status checks if both exist
      const effectiveDate = deadlineDate || dueDate;
      if (!effectiveDate || !isValid(effectiveDate)) return false;

      if (filterStatus === "overdue") {
        return isPast(effectiveDate) && !isToday(effectiveDate);
      }
      if (filterStatus === "today") {
        return isToday(effectiveDate);
      }
      if (filterStatus === "tomorrow") {
        return isTomorrow(effectiveDate);
      }
      return true;
    }).sort((a, b) => {
      const getStatusRank = (task: TodoistTask) => {
        let dueDate: Date | null = null;
        if (typeof task.due?.datetime === 'string' && task.due.datetime) {
          dueDate = parseISO(task.due.datetime);
        } else if (typeof task.due?.date === 'string' && task.due.date) {
          dueDate = parseISO(task.due.date);
        }
        let deadlineDate: Date | null = null;
        if (typeof task.deadline === 'string' && task.deadline) {
          deadlineDate = parseISO(task.deadline);
        }

        const effectiveDate = deadlineDate || dueDate;
        if (!effectiveDate || !isValid(effectiveDate)) return 4; // No date, lowest rank
        if (isPast(effectiveDate) && !isToday(effectiveDate)) return 0; // Overdue, highest rank
        if (isToday(effectiveDate)) return 1;
        if (isTomorrow(effectiveDate)) return 2;
        return 3; // Future date
      };

      const rankA = getStatusRank(a);
      const rankB = getStatusRank(b);
      if (rankA !== rankB) return rankA - rankB;

      // Then by deadline
      const getDeadlineValue = (task: TodoistTask) => {
        if (typeof task.deadline === 'string' && task.deadline) return parseISO(task.deadline).getTime();
        return Infinity;
      };
      const deadlineA = getDeadlineValue(a);
      const deadlineB = getDeadlineValue(b);
      if (deadlineA !== deadlineB) {
        return deadlineA - deadlineB;
      }

      // Then by priority
      if (b.priority !== a.priority) {
        return b.priority - a.priority;
      }

      // Finally by due date/time
      const getDateValue = (task: TodoistTask) => {
        if (typeof task.due?.datetime === 'string' && task.due.datetime) return parseISO(task.due.datetime).getTime();
        if (typeof task.due?.date === 'string' && task.due.date) return parseISO(task.due.date).getTime();
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

  const handleSelectTaskForAI = useCallback((task: TodoistTask) => {
    setSelectedTaskForAI(prev => (prev?.id === task.id ? null : task));
  }, []);

  const handleStartEditing = useCallback((task: TodoistTask) => {
    setEditingTaskId(task.id);
    setEditedDueDate((typeof task.due?.date === 'string' && task.due.date) ? parseISO(task.due.date) : undefined);
    setEditedDueTime((typeof task.due?.datetime === 'string' && task.due.datetime) ? format(parseISO(task.due.datetime), "HH:mm") : "");
    setEditedPriority(task.priority);
    setEditedDeadline((typeof task.deadline === 'string' && task.deadline) ? parseISO(task.deadline) : undefined); // Adicionado
  }, []);

  const handleCancelEditing = useCallback(() => {
    setEditingTaskId(null);
    setEditedDueDate(undefined);
    setEditedDueTime("");
    setEditedPriority(1);
    setEditedDeadline(undefined); // Adicionado
  }, []);

  const handleSaveEdit = useCallback(async () => {
    if (!editingTaskId) return;

    const taskToEdit = delegatedTasks.find(t => t.id === editingTaskId);
    if (!taskToEdit) return;

    const updateData: {
      priority?: 1 | 2 | 3 | 4;
      due_date?: string | null;
      due_datetime?: string | null;
      duration?: number | null;
      duration_unit?: "minute" | "day" | undefined;
      deadline?: string | null; // Adicionado
    } = {};
    let changed = false;

    // Handle Due Date and Time
    if (editedDueDate && isValid(editedDueDate)) {
      let finalDate = editedDueDate;
      if (editedDueTime) {
        const [hours, minutes] = (editedDueTime || '').split(":").map(Number);
        finalDate = setMinutes(setHours(editedDueDate, hours), minutes);
        updateData.due_datetime = format(finalDate, "yyyy-MM-dd'T'HH:mm:ss");
        updateData.due_date = null;
      } else {
        updateData.due_date = format(finalDate, "yyyy-MM-dd");
        updateData.due_datetime = null;
      }

      const currentTaskDueDateTime = (typeof taskToEdit.due?.datetime === 'string' && taskToEdit.due.datetime) ? format(parseISO(taskToEdit.due.datetime), "yyyy-MM-dd'T'HH:mm:ss") : null;
      const currentTaskDueDate = (typeof taskToEdit.due?.date === 'string' && taskToEdit.due.date) ? format(parseISO(taskToEdit.due.date), "yyyy-MM-dd") : null;

      if (updateData.due_datetime && updateData.due_datetime !== currentTaskDueDateTime) {
        changed = true;
      } else if (updateData.due_date && updateData.due_date !== currentTaskDueDate && !currentTaskDueDateTime) {
        changed = true;
      } else if (!updateData.due_date && !updateData.due_datetime && (currentTaskDueDate || currentTaskDueDateTime)) {
        changed = true;
      }
    } else if (!editedDueDate && (taskToEdit.due?.date || taskToEdit.due?.datetime)) {
      updateData.due_date = null;
      updateData.due_datetime = null;
      changed = true;
    }

    // Handle Priority
    if (editedPriority !== taskToEdit.priority) {
      updateData.priority = editedPriority;
      changed = true;
    }

    // Handle Deadline (Adicionado)
    if (editedDeadline && isValid(editedDeadline)) {
      const formattedDeadline = format(editedDeadline, "yyyy-MM-dd");
      if (formattedDeadline !== taskToEdit.deadline) {
        updateData.deadline = formattedDeadline;
        changed = true;
      }
    } else if (!editedDeadline && taskToEdit.deadline) {
      updateData.deadline = null;
      changed = true;
    }

    if (changed) {
      await updateTask(editingTaskId, updateData);
      toast.success("Tarefa delegada atualizada!");
      fetchDelegatedTasks();
    } else {
      toast.info("Nenhuma alteração detectada.");
    }
    handleCancelEditing();
  }, [editingTaskId, editedDueDate, editedDueTime, editedPriority, editedDeadline, delegatedTasks, updateTask, fetchDelegatedTasks, handleCancelEditing]);


  const renderTaskItem = (task: TodoistTask) => (
    <div 
      key={task.id} 
      className={cn(
        "p-4 border-b border-gray-200 last:border-b-0 cursor-pointer hover:bg-gray-50 transition-colors",
        selectedTaskForAI?.id === task.id && "bg-indigo-50 border-indigo-400 ring-1 ring-indigo-400"
      )}
      onClick={() => handleSelectTaskForAI(task)}
    >
      {editingTaskId === task.id ? (
        <div className="grid gap-2 p-2 bg-white rounded-md shadow-inner">
          <h4 className="text-lg font-semibold text-gray-800">{task.content}</h4>
          <div>
            <Label htmlFor={`edit-due-date-${task.id}`} className="text-sm">Data de Vencimento</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant={"outline"}
                  className={cn(
                    "w-full justify-start text-left font-normal mt-1",
                    !editedDueDate && "text-muted-foreground"
                  )}
                  disabled={isLoadingTodoist}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {editedDueDate && isValid(editedDueDate) ? format(editedDueDate, "PPP", { locale: ptBR }) : <span>Escolha uma data</span>}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0">
                <Calendar
                  mode="single"
                  selected={editedDueDate}
                  onSelect={setEditedDueDate}
                  initialFocus
                  locale={ptBR}
                />
              </PopoverContent>
            </Popover>
          </div>
          <div>
            <Label htmlFor={`edit-due-time-${task.id}`} className="text-sm">Hora de Vencimento (Opcional)</Label>
            <Input
              id={`edit-due-time-${task.id}`}
              type="time"
              value={editedDueTime}
              onChange={(e) => setEditedDueTime(e.target.value)}
              className="mt-1"
              disabled={isLoadingTodoist}
            />
          </div>
          <div>
            <Label htmlFor={`edit-deadline-${task.id}`} className="text-sm">Deadline (Opcional)</Label> {/* Adicionado */}
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant={"outline"}
                  className={cn(
                    "w-full justify-start text-left font-normal mt-1",
                    !editedDeadline && "text-muted-foreground"
                  )}
                  disabled={isLoadingTodoist}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {editedDeadline && isValid(editedDeadline) ? format(editedDeadline, "PPP", { locale: ptBR }) : <span>Escolha uma data</span>}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0">
                <Calendar
                  mode="single"
                  selected={editedDeadline}
                  onSelect={setEditedDeadline}
                  initialFocus
                  locale={ptBR}
                />
              </PopoverContent>
            </Popover>
          </div>
          <div>
            <Label htmlFor={`edit-priority-${task.id}`} className="text-sm">Prioridade</Label>
            <Select
              value={String(editedPriority)}
              onValueChange={(value) => setEditedPriority(Number(value) as 1 | 2 | 3 | 4)}
              disabled={isLoadingTodoist}
            >
              <SelectTrigger className="w-full mt-1">
                <SelectValue placeholder="Selecione a prioridade" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="4">P1 - Urgente</SelectItem>
                <SelectItem value="3">P2 - Alto</SelectItem>
                <SelectItem value="2">P3 - Médio</SelectItem>
                <SelectItem value="1">P4 - Baixo</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex gap-2 mt-2">
            <Button onClick={handleSaveEdit} size="sm" className="flex-1" disabled={isLoadingTodoist}>
              Salvar
            </Button>
            <Button onClick={handleCancelEditing} variant="outline" size="sm" className="flex-1" disabled={isLoadingTodoist}>
              Cancelar
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex items-start justify-between">
          <div className="flex-grow pr-4">
            <h4 className="text-lg font-semibold text-gray-800">{task.content}</h4>
            {task.description && <p className="text-sm text-gray-600 mt-1 whitespace-pre-wrap">{task.description}</p>}
            <div className="flex items-center gap-3 text-xs text-gray-500 mt-2">
              {(typeof task.due?.datetime === 'string' && task.due.datetime) && isValid(parseISO(task.due.datetime)) && (
                <span className="flex items-center gap-1">
                  <CalendarIcon className="h-3 w-3" /> {format(parseISO(task.due.datetime), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                </span>
              )}
              {(typeof task.due?.date === 'string' && task.due.date) && !(typeof task.due?.datetime === 'string' && task.due.datetime) && isValid(parseISO(task.due.date)) && (
                <span className="flex items-center gap-1">
                  <CalendarIcon className="h-3 w-3" /> {format(parseISO(task.due.date), "dd/MM/yyyy", { locale: ptBR })}
                </span>
              )}
              {(typeof task.deadline === 'string' && task.deadline) && isValid(parseISO(task.deadline)) && ( // Adicionado
                <span className="flex items-center gap-1 text-red-600 font-semibold">
                  <CalendarIcon className="h-3 w-3" /> Deadline: {format(parseISO(task.deadline), "dd/MM/yyyy", { locale: ptBR })}
                </span>
              )}
              {!(typeof task.due?.date === 'string' && task.due.date) && !(typeof task.due?.datetime === 'string' && task.due.datetime) && !(typeof task.deadline === 'string' && task.deadline) && <span>Sem prazo</span>} {/* Adicionado */}
              {task.duration?.amount && task.duration.unit === "minute" && (
                <span className="flex items-center gap-1">
                  <Clock className="h-3 w-3" /> {task.duration.amount} min
                </span>
              )}
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
            <Button variant="ghost" size="icon" onClick={(e) => { e.stopPropagation(); handleStartEditing(task); }} disabled={isLoadingTodoist}>
              <Edit className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon" onClick={(e) => { e.stopPropagation(); handleCompleteTask(task.id); }} disabled={isLoadingTodoist}>
              <Check className="h-4 w-4 text-green-500" />
            </Button>
            <Button variant="ghost" size="icon" onClick={(e) => { e.stopPropagation(); handleRemoveDelegation(task); }} disabled={isLoadingTodoist}>
              <Trash2 className="h-4 w-4 text-red-500" />
            </Button>
            <a href={task.url} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()}>
              <Button variant="ghost" size="icon">
                <ExternalLink className="h-4 w-4 text-blue-500" />
              </Button>
            </a>
          </div>
        </div>
      )}
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
                  {(typeof task.deadline === 'string' && task.deadline) && isValid(parseISO(task.deadline)) && ( // Adicionado
                    <span className="ml-2 text-red-600 text-xs font-semibold">
                      (Deadline: {format(parseISO(task.deadline), "dd/MM", { locale: ptBR })})
                    </span>
                  )}
                  {(typeof task.due?.datetime === 'string' && task.due.datetime) && isValid(parseISO(task.due.datetime)) && (
                    <span className="ml-2 text-gray-500 text-xs">
                      (Vencimento: {format(parseISO(task.due.datetime), "dd/MM HH:mm", { locale: ptBR })})
                    </span>
                  )}
                  {(typeof task.due?.date === 'string' && task.due.date) && !(typeof task.due?.datetime === 'string' && task.due.datetime) && isValid(parseISO(task.due.date)) && (
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
        <FollowUpAIAssistant 
          currentTask={selectedTaskForAI} 
          updateTask={updateTask} 
          isLoading={isLoadingTodoist}
        />
      </div>
    </div>
  );
};

export default FollowUp;