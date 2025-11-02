"use client";

import React, { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CalendarIcon, ListTodo, Edit, Save, XCircle, Clock, MessageSquare, ExternalLink, Filter } from "lucide-react";
import { format, parseISO, isValid, startOfDay, addMinutes, parse, setHours, setMinutes, isPast, isToday, isSameDay, isBefore } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn, getTaskCategory } from "@/lib/utils";
import { useTodoist } from "@/context/TodoistContext";
import { TodoistTask, ScheduledTask, DaySchedule } from "@/lib/types";
import TimeSlotPlanner from "@/components/TimeSlot/TimeSlotPlanner";
import LoadingSpinner from "@/components/ui/loading-spinner";
import { toast } from "sonner";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import { DndProvider } from 'react-dnd';
import { HTML5Backend } from 'react-dnd-html5-backend';
import { CRONOGRAMA_HOJE_LABEL } from "@/lib/constants";

const DEFAULT_AGENDA_FILTER = `(#📅 Reuniões | @${CRONOGRAMA_HOJE_LABEL}) & (p1|p2|p3|p4) & due before: in 168 hour & !@⚡ Rápida`;
const AGENDA_FILTER_INPUT_STORAGE_KEY = "agenda_filter_input";
const DEFAULT_TASK_DURATION_MINUTES = 30;

const Agenda = () => {
  const { fetchTasks, updateTask, closeTask, isLoading: isLoadingTodoist } = useTodoist();
  const [selectedDate, setSelectedDate] = useState<Date>(startOfDay(new Date()));
  const [agendaSchedule, setAgendaSchedule] = useState<DaySchedule>({
    date: format(selectedDate, "yyyy-MM-dd"),
    timeBlocks: [],
    scheduledTasks: [],
  });
  const [isLoadingAgenda, setIsLoadingAgenda] = useState(false);
  const [agendaFilterInput, setAgendaFilterInput] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem(AGENDA_FILTER_INPUT_STORAGE_KEY) || DEFAULT_AGENDA_FILTER;
    }
    return DEFAULT_AGENDA_FILTER;
  });

  const [isEditPopoverOpen, setIsEditPopoverOpen] = useState(false);
  const [editingScheduledTask, setEditingScheduledTask] = useState<ScheduledTask | null>(null);
  const [editedDueDate, setEditedDueDate] = useState<Date | undefined>(undefined);
  const [editedDueTime, setEditedDueTime] = useState<string>("");
  const [editedPriority, setEditedPriority] = useState<1 | 2 | 3 | 4>(1);
  const [editedDuration, setEditedDuration] = useState<string>("30");
  const [editedDeadline, setEditedDeadline] = useState<Date | undefined>(undefined);
  const [editedRecurrenceString, setEditedRecurrenceString] = useState<string>(""); // Novo estado para recorrência
  const [observationInput, setObservationInput] = useState("");

  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem(AGENDA_FILTER_INPUT_STORAGE_KEY, agendaFilterInput);
    }
  }, [agendaFilterInput]);

  const loadAgendaTasks = useCallback(async () => {
    setIsLoadingAgenda(true);
    try {
      const filterToUse = agendaFilterInput.trim() || undefined;
      const selectedDateKey = format(selectedDate, "yyyy-MM-dd");
      const startOfSelectedDay = startOfDay(selectedDate);
      const startOfToday = startOfDay(new Date());
      
      console.log("Agenda: Filter sent to Todoist API:", filterToUse, "for date:", selectedDateKey);
      const fetchedTodoistTasks = await fetchTasks(filterToUse, { includeSubtasks: false, includeRecurring: true });
      console.log(`Agenda: Fetched ${fetchedTodoistTasks.length} tasks from Todoist API.`);
      
      const tasksForSelectedDay: ScheduledTask[] = [];

      fetchedTodoistTasks.forEach(task => {
        const taskDueDateTime = task.due?.datetime ? parseISO(task.due.datetime) : null;
        const taskDueDate = task.due?.date ? parseISO(task.due.date) : null;

        let effectiveDueDateTime: Date | null = null;
        if (taskDueDateTime && isValid(taskDueDateTime)) {
          effectiveDueDateTime = taskDueDateTime;
        } else if (taskDueDate && isValid(taskDueDate)) {
          // Se for apenas data, consideramos o início do dia para comparação
          effectiveDueDateTime = startOfDay(taskDueDate);
        }

        // 1. Check if the task has the CRONOGRAMA_HOJE_LABEL
        const hasCronogramaLabel = task.labels.includes(CRONOGRAMA_HOJE_LABEL);

        // 2. Determine if the task should be included for the selected day
        let shouldInclude = false;

        if (effectiveDueDateTime && isValid(effectiveDueDateTime)) {
          const isDueOnSelectedDay = isSameDay(effectiveDueDateTime, startOfSelectedDay);
          
          // Uma tarefa é considerada "atrasada" se o prazo final for anterior ao início do dia selecionado.
          // Se a data selecionada for hoje, tarefas atrasadas (isPast) são incluídas.
          const isOverdue = isPast(effectiveDueDateTime) && isSameDay(startOfSelectedDay, startOfToday);
          
          // Se a data selecionada for no futuro, não incluímos tarefas atrasadas de dias anteriores.
          const isOverdueBeforeSelectedDay = isPast(effectiveDueDateTime) && isBefore(effectiveDueDateTime, startOfSelectedDay);

          if (isDueOnSelectedDay || isOverdueBeforeSelectedDay) {
            shouldInclude = true;
          }
        } 
        
        // Se a tarefa tem a etiqueta de cronograma, ela deve ser incluída APENAS se a data selecionada for HOJE.
        if (hasCronogramaLabel && isSameDay(selectedDate, startOfToday)) {
            shouldInclude = true;
        }

        if (shouldInclude) {
          // Determine start/end times based on due_datetime or default duration
          let startTime = "00:00";
          let durationMinutes = task.duration?.amount && task.duration.unit === "minute"
            ? task.duration.amount
            : DEFAULT_TASK_DURATION_MINUTES;
          
          if (taskDueDateTime && isValid(taskDueDateTime)) {
            startTime = format(taskDueDateTime, "HH:mm");
          } else if (hasCronogramaLabel && isSameDay(selectedDate, startOfToday)) {
            // Se tem a etiqueta de cronograma mas não tem hora, use 9 AM como padrão
            startTime = "09:00"; 
          } else if (taskDueDate && isValid(taskDueDate) && !taskDueDateTime) {
            // Se tem apenas data de vencimento, use 9 AM como padrão
            startTime = "09:00";
          }

          const endTime = format(addMinutes(parse(startTime, "HH:mm", selectedDate), durationMinutes), "HH:mm");

          tasksForSelectedDay.push({
            id: task.id,
            taskId: task.id,
            content: task.content,
            description: task.description,
            start: startTime,
            end: endTime,
            priority: task.priority,
            category: getTaskCategory(task) || "profissional",
            estimatedDurationMinutes: durationMinutes,
            originalTask: task,
            isMeeting: task.content.startsWith('📅') || task.labels.includes('reunião'),
          });
        } else {
          console.log(`Agenda: Task "${task.content}" (ID: ${task.id}) NOT added to selected day's schedule.`);
        }
      });

      setAgendaSchedule({
        date: selectedDateKey,
        timeBlocks: [],
        scheduledTasks: tasksForSelectedDay.sort((a, b) => a.start.localeCompare(b.start)),
      });

      if (tasksForSelectedDay.length === 0) {
        toast.info(`Nenhuma tarefa encontrada para ${format(selectedDate, "dd/MM/yyyy", { locale: ptBR })} com o filtro da agenda.`);
      } else {
        toast.success(`Carregadas ${tasksForSelectedDay.length} tarefas para ${format(selectedDate, "dd/MM/yyyy", { locale: ptBR })}.`);
      }

    } catch (error) {
      console.error("Failed to load agenda tasks:", error);
      toast.error("Falha ao carregar tarefas da agenda.");
    } finally {
      setIsLoadingAgenda(false);
    }
  }, [fetchTasks, selectedDate, agendaFilterInput]);

  useEffect(() => {
    loadAgendaTasks();
  }, [selectedDate, loadAgendaTasks]);

  const handleDateChange = (date: Date | undefined) => {
    if (date) {
      setSelectedDate(startOfDay(date));
    }
  };

  const handleOpenEditPopover = useCallback((task: ScheduledTask) => {
    setEditingScheduledTask(task);
    if (task.originalTask && 'due' in task.originalTask && task.originalTask.due) {
      setEditedDueDate(task.originalTask.due.date ? parseISO(task.originalTask.due.date) : undefined);
      setEditedDueTime(task.originalTask.due.datetime ? format(parseISO(task.originalTask.due.datetime), "HH:mm") : "");
      setEditedRecurrenceString(task.originalTask.recurrence_string || ""); // Carregar recorrência
    } else {
      const scheduledStart = parse(task.start, "HH:mm", selectedDate);
      if (isValid(scheduledStart)) {
        setEditedDueDate(selectedDate);
        setEditedDueTime(task.start);
      } else {
        setEditedDueDate(undefined);
        setEditedDueTime("");
      }
      setEditedRecurrenceString(""); // Limpar recorrência para tarefas sem originalTask ou sem recorrência
    }
    setEditedPriority(task.priority);
    setEditedDuration(String(task.estimatedDurationMinutes || DEFAULT_TASK_DURATION_MINUTES));
    if (task.originalTask && 'deadline' in task.originalTask) {
      setEditedDeadline(task.originalTask.deadline ? parseISO(task.originalTask.deadline) : undefined);
    } else {
      setEditedDeadline(undefined);
    }
    setObservationInput("");
    console.log("DEBUG: handleOpenEditPopover - editedDuration:", String(task.estimatedDurationMinutes || DEFAULT_TASK_DURATION_MINUTES));
    setIsEditPopoverOpen(true);
  }, [selectedDate]);

  const handleSaveEditedTask = useCallback(async () => {
    if (!editingScheduledTask || !editingScheduledTask.originalTask) {
      toast.error("Nenhuma tarefa selecionada para edição ou tarefa original não encontrada.");
      return;
    }

    const originalTodoistTask = editingScheduledTask.originalTask as TodoistTask;

    const updateData: {
      priority?: 1 | 2 | 3 | 4;
      due_date?: string | null;
      due_datetime?: string | null;
      duration?: number;
      duration_unit?: "minute" | "day";
      deadline?: string | null;
      description?: string;
      recurrence_string?: string | null; // Adicionado
    } = {};
    let changed = false;

    // Handle Recurrence String
    if (editedRecurrenceString !== (originalTodoistTask.recurrence_string || "")) {
      updateData.recurrence_string = editedRecurrenceString.trim() === "" ? null : editedRecurrenceString.trim();
      changed = true;
      // If recurrence_string is set, clear due_date and due_datetime
      updateData.due_date = null;
      updateData.due_datetime = null;
    } else if (editedRecurrenceString.trim() === "" && originalTodoistTask.recurrence_string) {
      // If recurrence_string was present but now cleared
      updateData.recurrence_string = null;
      changed = true;
    }

    // Handle Due Date and Time (only if recurrence_string is NOT being set/updated)
    if (updateData.recurrence_string === undefined) { // Only process if recurrence_string wasn't explicitly handled
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

        const currentTaskDueDateTime = originalTodoistTask.due?.datetime ? format(parseISO(originalTodoistTask.due.datetime), "yyyy-MM-dd'T'HH:mm:ss") : null;
        const currentTaskDueDate = originalTodoistTask.due?.date ? format(parseISO(originalTodoistTask.due.date), "yyyy-MM-dd") : null;

        if (updateData.due_datetime && updateData.due_datetime !== currentTaskDueDateTime) {
          changed = true;
        } else if (updateData.due_date && updateData.due_date !== currentTaskDueDate && !currentTaskDueDateTime) {
          changed = true;
        } else if (!updateData.due_date && !updateData.due_datetime && (currentTaskDueDate || currentTaskDueDateTime)) {
          changed = true;
        }
      } else if (!editedDueDate && (originalTodoistTask.due?.date || originalTodoistTask.due?.datetime)) {
        updateData.due_date = null;
        updateData.due_datetime = null;
        changed = true;
      }
    }

    if (editedPriority !== originalTodoistTask.priority) {
      updateData.priority = editedPriority;
      changed = true;
    }

    const newDurationAmount = parseInt(editedDuration, 10);
    const currentDurationAmount = originalTodoistTask.duration?.amount;
    const currentDurationUnit = originalTodoistTask.duration?.unit;

    if (!isNaN(newDurationAmount) && newDurationAmount > 0) {
      if (newDurationAmount !== currentDurationAmount || currentDurationUnit !== "minute") {
        updateData.duration = newDurationAmount;
        updateData.duration_unit = "minute";
        changed = true;
      }
    } else if (currentDurationAmount !== undefined || currentDurationUnit !== undefined) {
      updateData.duration = null;
      changed = true;
    }

    if (editedDeadline && isValid(editedDeadline)) {
      const formattedDeadline = format(editedDeadline, "yyyy-MM-dd");
      if (formattedDeadline !== originalTodoistTask.deadline) {
        updateData.deadline = formattedDeadline;
        changed = true;
      }
    } else if (!editedDeadline && originalTodoistTask.deadline) {
      updateData.deadline = null;
      changed = true;
    }

    if (observationInput.trim()) {
      const timestamp = format(new Date(), "dd/MM/yyyy HH:mm", { locale: ptBR });
      const newObservation = `\n\n[${timestamp}] - ${observationInput.trim()}`;
      updateData.description = (originalTodoistTask.description || "") + newObservation;
      changed = true;
    }

    if (changed) {
      await updateTask(originalTodoistTask.id, updateData);
      toast.success("Tarefa agendada atualizada no Todoist!");
      loadAgendaTasks();
    } else {
      toast.info("Nenhuma alteração detectada.");
    }
    setIsEditPopoverOpen(false);
    setEditingScheduledTask(null);
    setObservationInput("");
  }, [editingScheduledTask, editedDueDate, editedDueTime, editedPriority, editedDuration, editedDeadline, editedRecurrenceString, observationInput, updateTask, loadAgendaTasks, selectedDate]);

  const handleCompleteScheduledTask = useCallback(async (taskId: string) => {
    const success = await closeTask(taskId);
    if (success !== undefined) {
      toast.success("Tarefa concluída com sucesso!");
      loadAgendaTasks();
    }
  }, [closeTask, loadAgendaTasks]);

  const handleDropTask = useCallback(async (draggedTask: ScheduledTask, newStartTime: string) => {
    console.log("Agenda: handleDropTask called.", { draggedTask, newStartTime });

    if (!draggedTask.originalTask) {
      toast.error("Não foi possível mover a tarefa: dados originais ausentes.");
      return;
    }

    const originalTodoistTask = draggedTask.originalTask as TodoistTask;
    const durationMinutes = draggedTask.estimatedDurationMinutes || DEFAULT_TASK_DURATION_MINUTES;
    const newEndTime = format(addMinutes(parse(newStartTime, "HH:mm", selectedDate), durationMinutes), "HH:mm");

    // Check for conflicts with existing tasks in the target slot
    const targetStartDateTime = parse(newStartTime, "HH:mm", selectedDate);
    const targetEndDateTime = parse(newEndTime, "HH:mm", selectedDate);

    const hasConflict = agendaSchedule.scheduledTasks.some(st => {
      if (st.id === draggedTask.id) return false; // Don't check conflict with itself

      const stStart = parse(st.start, "HH:mm", selectedDate);
      const stEnd = parse(st.end, "HH:mm", selectedDate);
      if (!isValid(stStart) || !isValid(stEnd)) return false;

      return (targetStartDateTime < stEnd && targetEndDateTime > stStart);
    });

    if (hasConflict) {
      toast.error("Não foi possível mover: o slot de tempo já está ocupado por outra tarefa agendada.");
      return;
    }

    // AQUI ESTÁ A CORREÇÃO: Não passamos a recurrence_string para updateTask
    // quando estamos apenas movendo uma instância de tarefa.
    // A API do Todoist entende que, se não houver recurrence_string,
    // mas houver due_datetime, é para atualizar a instância.
    const updated = await updateTask(originalTodoistTask.id, {
      due_date: null, // Clear due_date if due_datetime is set
      due_datetime: format(targetStartDateTime, "yyyy-MM-dd'T'HH:mm:ss"),
      duration: durationMinutes,
      duration_unit: "minute",
      // recurrence_string: originalTodoistTask.recurrence_string, // REMOVIDO: Não passar recurrence_string aqui
    });

    if (updated) {
      toast.success(`Tarefa "${draggedTask.content}" movida para ${newStartTime} - ${newEndTime}!`);
      loadAgendaTasks(); // Reload to reflect changes
    } else {
      toast.error("Falha ao atualizar a tarefa no Todoist.");
    }
  }, [selectedDate, agendaSchedule.scheduledTasks, updateTask, loadAgendaTasks]);

  const isLoadingCombined = isLoadingTodoist || isLoadingAgenda;

  return (
    <DndProvider backend={HTML5Backend}>
      <div className="p-4">
        <h2 className="text-3xl font-bold mb-2 text-gray-800">
          <ListTodo className="inline-block h-8 w-8 mr-2 text-indigo-600" /> AGENDA - Visão Diária
        </h2>
        <p className="text-lg text-gray-600 mb-6">
          Visualize suas reuniões e tarefas prioritárias em um calendário diário. Clique em uma tarefa para editá-la ou arraste-a para um novo horário.
        </p>

        <div className="mb-6 flex flex-wrap items-center gap-4">
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant={"outline"}
                className={cn(
                  "w-[240px] justify-start text-left font-normal",
                  !selectedDate && "text-muted-foreground"
                )}
              >
                <CalendarIcon className="mr-2 h-4 w-4" />
                {selectedDate && isValid(selectedDate) ? format(selectedDate, "PPP", { locale: ptBR }) : <span>Selecione uma data</span>}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0">
              <Calendar
                mode="single"
                selected={selectedDate}
                onSelect={handleDateChange}
                initialFocus
                locale={ptBR}
              />
            </PopoverContent>
          </Popover>
          <div className="relative flex-grow max-w-md">
            <Label htmlFor="agenda-filter-input" className="sr-only">Filtro da Agenda</Label>
            <Input
              id="agenda-filter-input"
              type="text"
              placeholder="Filtro do Todoist (ex: 'hoje', '#reunioes')"
              value={agendaFilterInput}
              onChange={(e) => setAgendaFilterInput(e.target.value)}
              onKeyPress={(e) => {
                if (e.key === "Enter") {
                  loadAgendaTasks();
                }
              }}
              className="pr-10"
              disabled={isLoadingCombined}
            />
            <Button
              variant="ghost"
              size="icon"
              onClick={loadAgendaTasks}
              className="absolute right-0 top-0 h-full px-3"
              disabled={isLoadingCombined}
            >
              <Filter className="h-4 w-4" />
            </Button>
          </div>
          <Button onClick={loadAgendaTasks} disabled={isLoadingCombined} className="flex items-center gap-2">
            <ListTodo className="h-4 w-4" /> Recarregar Agenda
          </Button>
        </div>

        {isLoadingCombined ? (
          <div className="flex justify-center items-center h-[calc(100vh-300px)]">
            <LoadingSpinner size={40} />
          </div>
        ) : (
          <TimeSlotPlanner
            daySchedule={agendaSchedule}
            onSelectTask={handleOpenEditPopover}
            onCompleteTask={handleCompleteScheduledTask}
            onDropTask={handleDropTask}
            currentDate={selectedDate}
          />
        )}

        <Popover open={isEditPopoverOpen} onOpenChange={setIsEditPopoverOpen}>
          <PopoverTrigger asChild>
            <Button variant="ghost" className="hidden"></Button>
          </PopoverTrigger>
          <PopoverContent className="w-80 p-4">
            <ScrollArea className="h-[500px] pr-4">
              <h4 className="font-semibold text-lg mb-3 flex items-center gap-2">
                <Edit className="h-5 w-5" /> Editar Tarefa
              </h4>
              {editingScheduledTask && (
                <div className="grid gap-4">
                  <p className="text-sm font-medium text-gray-700">{editingScheduledTask.content}</p>
                  {editingScheduledTask.originalTask && 'url' in editingScheduledTask.originalTask && editingScheduledTask.originalTask.url && (
                    <a 
                      href={editingScheduledTask.originalTask.url} 
                      target="_blank" 
                      rel="noopener noreferrer" 
                      className="w-full"
                    >
                      <Button variant="outline" className="w-full flex items-center gap-2">
                        <ExternalLink className="h-4 w-4" /> Abrir no Todoist
                      </Button>
                    </a>
                  )}
                  <div>
                    <Label htmlFor="edit-due-date">Data de Vencimento</Label>
                    <Calendar
                      mode="single"
                      selected={editedDueDate}
                      onSelect={setEditedDueDate}
                      initialFocus
                      locale={ptBR}
                      className="rounded-md border shadow"
                    />
                  </div>
                  <div>
                    <Label htmlFor="edit-due-time">Hora de Vencimento (Opcional)</Label>
                    <Input
                      id="edit-due-time"
                      type="time"
                      value={editedDueTime}
                      onChange={(e) => setEditedDueTime(e.target.value)}
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <Label htmlFor="edit-deadline">Deadline (Opcional)</Label>
                    <Calendar
                      mode="single"
                      selected={editedDeadline}
                      onSelect={setEditedDeadline}
                      initialFocus
                      locale={ptBR}
                      className="rounded-md border shadow"
                    />
                  </div>
                  <div>
                    <Label htmlFor="edit-recurrence-string">Recorrência (Todoist string)</Label>
                    <Input
                      id="edit-recurrence-string"
                      type="text"
                      value={editedRecurrenceString}
                      onChange={(e) => setEditedRecurrenceString(e.target.value)}
                      placeholder="Ex: 'every day', 'every mon'"
                      className="mt-1"
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      Use a sintaxe de recorrência do Todoist. Ex: "every day", "every mon", "every 2 weeks".
                    </p>
                  </div>
                  <div>
                    <Label htmlFor="edit-priority">Prioridade</Label>
                    <Select
                      value={String(editedPriority)}
                      onValueChange={(value) => setEditedPriority(Number(value) as 1 | 2 | 3 | 4)}
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
                    <Label htmlFor="edit-duration">Duração Estimada (minutos)</Label>
                    <Input
                      id="edit-duration"
                      type="number"
                      value={editedDuration}
                      onChange={(e) => setEditedDuration(e.target.value)}
                      min="1"
                      placeholder="Ex: 30"
                      className="mt-1"
                    />
                  </div>
                  <div className="mt-2">
                    <Label htmlFor="agenda-observation-input">Adicionar Observação</Label>
                    <Textarea
                      id="agenda-observation-input"
                      value={observationInput}
                      onChange={(e) => setObservationInput(e.target.value)}
                      placeholder="Adicione uma nota rápida à descrição da tarefa..."
                      rows={3}
                      className="mt-1"
                    />
                  </div>
                  <Button onClick={handleSaveEditedTask} className="w-full flex items-center gap-2">
                    <Save className="h-4 w-4" /> Salvar Alterações
                  </Button>
                  <Button onClick={() => setIsEditPopoverOpen(false)} variant="outline" className="w-full flex items-center gap-2">
                    <XCircle className="h-4 w-4" /> Cancelar
                  </Button>
                </div>
              )}
            </ScrollArea>
          </PopoverContent>
        </Popover>
      </div>
    </DndProvider>
  );
};

export default Agenda;