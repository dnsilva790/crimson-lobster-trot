"use client";

import React, { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useTodoist } from "@/context/TodoistContext";
import { TodoistTask } from "@/lib/types";
import LoadingSpinner from "@/components/ui/loading-spinner";
import { toast } from "sonner";
import { cn, getTaskCategory } from "@/lib/utils";
import { format, parseISO, isValid, isPast, isToday, setHours, setMinutes } from "date-fns";
import { ptBR } from "date-fns/locale";
import { CalendarIcon, Clock, ExternalLink, Check, Edit, XCircle, Save, ListTodo } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const PRIORITY_COLORS: Record<1 | 2 | 3 | 4, string> = {
  4: "bg-red-500", // P1 - Urgente
  3: "bg-orange-500", // P2 - Alto
  2: "bg-yellow-500", // P3 - Médio
  1: "bg-gray-400", // P4 - Baixo
};

const PRIORITY_LABELS: Record<1 | 2 | 3 | 4, string> = {
  4: "P1 - Urgente",
  3: "P2 - Alto",
  2: "P3 - Médio",
  1: "P4 - Baixo",
};

const Deadlines = () => {
  const { fetchTasks, closeTask, updateTask, isLoading: isLoadingTodoist } = useTodoist();
  const [deadlineTasks, setDeadlineTasks] = useState<TodoistTask[]>([]);
  const [isLoadingDeadlines, setIsLoadingDeadlines] = useState(false);

  // State for quick editing
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [editedDueDate, setEditedDueDate] = useState<Date | undefined>(undefined);
  const [editedDueTime, setEditedDueTime] = useState<string>("");
  const [editedPriority, setEditedPriority] = useState<1 | 2 | 3 | 4>(1);
  const [editedDeadlineDate, setEditedDeadlineDate] = useState<Date | undefined>(undefined);

  const fetchDeadlineTasks = useCallback(async () => {
    setIsLoadingDeadlines(true);
    try {
      // Fetch all active tasks (TodoistContext already filters out completed and subtasks by default)
      const allTasks = await fetchTasks(undefined, { includeSubtasks: false, includeRecurring: false });
      
      const filtered = allTasks.filter(task => typeof task.deadline === 'string' && task.deadline && isValid(parseISO(task.deadline)));

      // Sort by deadline (earliest first), then by priority (highest first)
      const sorted = filtered.sort((a, b) => {
        const deadlineA = a.deadline ? parseISO(a.deadline).getTime() : Infinity;
        const deadlineB = b.deadline ? parseISO(b.deadline).getTime() : Infinity;
        if (deadlineA !== deadlineB) {
          return deadlineA - deadlineB;
        }
        return b.priority - a.priority;
      });

      setDeadlineTasks(sorted);
      toast.success(`Carregadas ${sorted.length} tarefas com deadline.`);
    } catch (error) {
      console.error("Failed to fetch deadline tasks:", error);
      toast.error("Falha ao carregar tarefas com deadline.");
    } finally {
      setIsLoadingDeadlines(false);
    }
  }, [fetchTasks]);

  useEffect(() => {
    fetchDeadlineTasks();
  }, [fetchDeadlineTasks]);

  const handleCompleteTask = useCallback(async (taskId: string) => {
    const success = await closeTask(taskId);
    if (success !== undefined) {
      toast.success("Tarefa concluída!");
      fetchDeadlineTasks(); // Re-fetch to update the list
    }
  }, [closeTask, fetchDeadlineTasks]);

  const handleStartEditing = useCallback((task: TodoistTask) => {
    setEditingTaskId(task.id);
    setEditedDueDate((typeof task.due?.date === 'string' && task.due.date) ? parseISO(task.due.date) : undefined);
    setEditedDueTime((typeof task.due?.datetime === 'string' && task.due.datetime) ? format(parseISO(task.due.datetime), "HH:mm") : "");
    setEditedPriority(task.priority);
    setEditedDeadlineDate((typeof task.deadline === 'string' && task.deadline) ? parseISO(task.deadline) : undefined);
  }, []);

  const handleCancelEditing = useCallback(() => {
    setEditingTaskId(null);
    setEditedDueDate(undefined);
    setEditedDueTime("");
    setEditedPriority(1);
    setEditedDeadlineDate(undefined);
  }, []);

  const handleSaveEdit = useCallback(async () => {
    if (!editingTaskId) return;

    const updateData: {
      priority?: 1 | 2 | 3 | 4;
      due_date?: string | null;
      due_datetime?: string | null;
      deadline?: string | null;
    } = {};
    let changed = false;

    const currentTask = deadlineTasks.find(t => t.id === editingTaskId);
    if (!currentTask) return;

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

      const currentTaskDueDateTime = (typeof currentTask.due?.datetime === 'string' && currentTask.due.datetime) ? format(parseISO(currentTask.due.datetime), "yyyy-MM-dd'T'HH:mm:ss") : null;
      const currentTaskDueDate = (typeof currentTask.due?.date === 'string' && currentTask.due.date) ? format(parseISO(currentTask.due.date), "yyyy-MM-dd") : null;

      if (updateData.due_datetime && updateData.due_datetime !== currentTaskDueDateTime) {
        changed = true;
      } else if (updateData.due_date && updateData.due_date !== currentTaskDueDate && !currentTaskDueDateTime) {
        changed = true;
      } else if (!updateData.due_date && !updateData.due_datetime && (currentTaskDueDate || currentTaskDueDateTime)) {
        changed = true;
      }
    } else if (!editedDueDate && (currentTask.due?.date || currentTask.due?.datetime)) {
      updateData.due_date = null;
      updateData.due_datetime = null;
      changed = true;
    }

    // Handle Priority
    if (editedPriority !== currentTask.priority) {
      updateData.priority = editedPriority;
      changed = true;
    }

    // Handle Deadline
    const newDeadlineFormatted = editedDeadlineDate && isValid(editedDeadlineDate) ? format(editedDeadlineDate, "yyyy-MM-dd") : null;
    const currentDeadlineFormatted = currentTask.deadline; // Already YYYY-MM-DD or null

    if (newDeadlineFormatted !== currentDeadlineFormatted) {
      updateData.deadline = newDeadlineFormatted;
      changed = true;
    }

    if (changed) {
      await updateTask(editingTaskId, updateData);
      toast.success("Tarefa atualizada!");
      fetchDeadlineTasks();
    } else {
      toast.info("Nenhuma alteração detectada.");
    }
    handleCancelEditing();
  }, [editingTaskId, editedDueDate, editedDueTime, editedPriority, editedDeadlineDate, deadlineTasks, updateTask, fetchDeadlineTasks, handleCancelEditing]);

  const renderTaskItem = (task: TodoistTask) => {
    const category = getTaskCategory(task);
    const isDeadlineOverdue = task.deadline && isValid(parseISO(task.deadline)) && isPast(parseISO(task.deadline)) && !isToday(parseISO(task.deadline));
    const isDeadlineToday = task.deadline && isValid(parseISO(task.deadline)) && isToday(parseISO(task.deadline));

    return (
      <div 
        key={task.id} 
        className={cn(
          "p-4 border-b border-gray-200 last:border-b-0",
          isDeadlineOverdue && "bg-red-50 border-red-300",
          isDeadlineToday && "bg-yellow-50 border-yellow-300"
        )}
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
            <div>
              <Label htmlFor={`edit-deadline-date-${task.id}`} className="text-sm">Deadline</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant={"outline"}
                    className={cn(
                      "w-full justify-start text-left font-normal mt-1",
                      !editedDeadlineDate && "text-muted-foreground"
                    )}
                    disabled={isLoadingTodoist}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {editedDeadlineDate && isValid(editedDeadlineDate) ? format(editedDeadlineDate, "PPP", { locale: ptBR }) : <span>Escolha um deadline</span>}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <Calendar
                    mode="single"
                    selected={editedDeadlineDate}
                    onSelect={setEditedDeadlineDate}
                    initialFocus
                    locale={ptBR}
                  />
                </PopoverContent>
              </Popover>
            </div>
            <div className="flex gap-2 mt-2">
              <Button onClick={handleSaveEdit} size="sm" className="flex-1" disabled={isLoadingTodoist}>
                <Save className="h-4 w-4 mr-2" /> Salvar
              </Button>
              <Button onClick={handleCancelEditing} variant="outline" size="sm" className="flex-1" disabled={isLoadingTodoist}>
                <XCircle className="h-4 w-4 mr-2" /> Cancelar
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
                    <CalendarIcon className="h-3 w-3" /> Vencimento: {format(parseISO(task.due.datetime), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                  </span>
                )}
                {(typeof task.due?.date === 'string' && task.due.date) && !(typeof task.due?.datetime === 'string' && task.due.datetime) && isValid(parseISO(task.due.date)) && (
                  <span className="flex items-center gap-1">
                    <CalendarIcon className="h-3 w-3" /> Vencimento: {format(parseISO(task.due.date), "dd/MM/yyyy", { locale: ptBR })}
                  </span>
                )}
                {!(typeof task.due?.date === 'string' && task.due.date) && !(typeof task.due?.datetime === 'string' && task.due.datetime) && <span>Sem prazo</span>}
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
                {category && (
                  <Badge
                    className={cn(
                      "text-xs font-medium",
                      category === "pessoal" ? "bg-blue-100 text-blue-800" : "bg-green-100 text-green-800"
                    )}
                  >
                    {category === "pessoal" ? "Pessoal" : "Profissional"}
                  </Badge>
                )}
              </div>
              {task.deadline && isValid(parseISO(task.deadline)) && (
                <div className="flex items-center gap-1 text-sm font-semibold mt-2">
                  <CalendarIcon className="h-4 w-4 text-red-600" />
                  <span className={cn(
                    isDeadlineOverdue && "text-red-600",
                    isDeadlineToday && "text-yellow-600"
                  )}>
                    Deadline: {format(parseISO(task.deadline), "dd/MM/yyyy", { locale: ptBR })}
                    {isDeadlineOverdue && " (Atrasado!)"}
                    {isDeadlineToday && " (Hoje!)"}
                  </span>
                </div>
              )}
            </div>
            <div className="flex flex-col gap-2 ml-4">
              <Button variant="ghost" size="icon" onClick={(e) => { e.stopPropagation(); handleStartEditing(task); }} disabled={isLoadingTodoist}>
                <Edit className="h-4 w-4" />
              </Button>
              <Button variant="ghost" size="icon" onClick={(e) => { e.stopPropagation(); handleCompleteTask(task.id); }} disabled={isLoadingTodoist}>
                <Check className="h-4 w-4 text-green-500" />
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
  };

  const isLoading = isLoadingTodoist || isLoadingDeadlines;

  return (
    <div className="p-4">
      <h2 className="text-3xl font-bold mb-2 text-gray-800">
        <CalendarIcon className="inline-block h-8 w-8 mr-2 text-red-600" /> DEADLINES
      </h2>
      <p className="text-lg text-gray-600 mb-6">
        Visualize e gerencie todas as tarefas com um deadline definido.
      </p>

      <Card>
        <CardHeader>
          <CardTitle className="text-xl font-bold text-gray-800 flex items-center gap-2">
            <ListTodo className="h-5 w-5 text-red-600" /> Tarefas com Deadline
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex justify-center items-center h-48">
              <LoadingSpinner size={40} />
            </div>
          ) : deadlineTasks.length > 0 ? (
            <div className="divide-y divide-gray-200">
              {deadlineTasks.map(renderTaskItem)}
            </div>
          ) : (
            <div className="p-6 text-center text-gray-600">
              Nenhuma tarefa com deadline encontrada.
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default Deadlines;