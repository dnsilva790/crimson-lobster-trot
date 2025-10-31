"use client";

import React, { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CalendarIcon, ListTodo, Edit, Save, XCircle, Clock, MessageSquare, ExternalLink, Filter } from "lucide-react"; // Importar MessageSquare, ExternalLink e Filter
import { format, parseISO, isValid, startOfDay, addMinutes, parse, setHours, setMinutes } from "date-fns";
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
import { ScrollArea } from "@/components/ui/scroll-area"; // Importar ScrollArea
import { Textarea } from "@/components/ui/textarea"; // Importar Textarea

const DEFAULT_AGENDA_FILTER = `(#📅 Reuniões|@📆 Cronograma de hoje) & (p1|p2|p3|p4) & due before: in 168 hour & !@⚡ Rápida`;
const AGENDA_FILTER_INPUT_STORAGE_KEY = "agenda_filter_input"; // Nova chave para o localStorage
const DEFAULT_TASK_DURATION_MINUTES = 30; // Duração padrão para tarefas sem duração definida

const Agenda = () => {
  const { fetchTasks, updateTask, closeTask, isLoading: isLoadingTodoist } = useTodoist(); // Adicionado closeTask
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

  // Estados para o popover de edição
  const [isEditPopoverOpen, setIsEditPopoverOpen] = useState(false);
  const [editingScheduledTask, setEditingScheduledTask] = useState<ScheduledTask | null>(null);
  const [editedDueDate, setEditedDueDate] = useState<Date | undefined>(undefined);
  const [editedDueTime, setEditedDueTime] = useState<string>("");
  const [editedPriority, setEditedPriority] = useState<1 | 2 | 3 | 4>(1);
  const [editedDuration, setEditedDuration] = useState<string>("30");
  const [editedDeadline, setEditedDeadline] = useState<Date | undefined>(undefined);
  const [observationInput, setObservationInput] = useState(""); // Novo estado para observação

  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem(AGENDA_FILTER_INPUT_STORAGE_KEY, agendaFilterInput);
    }
  }, [agendaFilterInput]);

  const loadAgendaTasks = useCallback(async () => {
    setIsLoadingAgenda(true);
    try {
      const filterToUse = agendaFilterInput.trim() || undefined; // Usar o filtro customizado
      const fetchedTodoistTasks = await fetchTasks(filterToUse, { includeSubtasks: false, includeRecurring: false });
      
      const tasksForSelectedDay: ScheduledTask[] = [];
      const selectedDateKey = format(selectedDate, "yyyy-MM-dd");

      fetchedTodoistTasks.forEach(task => {
        if (task.due?.datetime && isValid(parseISO(task.due.datetime))) {
          const taskDueDateTime = parseISO(task.due.datetime);
          const taskDueDate = startOfDay(taskDueDateTime);

          if (format(taskDueDate, "yyyy-MM-dd") === selectedDateKey) {
            const startTime = format(taskDueDateTime, "HH:mm");
            const durationMinutes = task.duration?.amount && task.duration.unit === "minute"
              ? task.duration.amount
              : DEFAULT_TASK_DURATION_MINUTES;
            const endTime = format(addMinutes(taskDueDateTime, durationMinutes), "HH:mm");

            tasksForSelectedDay.push({
              id: task.id,
              taskId: task.id,
              content: task.content,
              description: task.description,
              start: startTime,
              end: endTime,
              priority: task.priority,
              category: getTaskCategory(task) || "profissional", // Default to professional if no category label
              estimatedDurationMinutes: durationMinutes,
              originalTask: task,
              isMeeting: task.content.startsWith('📅') || task.labels.includes('reunião'), // Simple meeting detection
            });
          }
        }
      });

      setAgendaSchedule({
        date: selectedDateKey,
        timeBlocks: [], // No custom time blocks for this view
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
  }, [fetchTasks, selectedDate, agendaFilterInput]); // Adicionado agendaFilterInput como dependência

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
    // Preencher estados do popover com dados da tarefa
    if (task.originalTask && 'due' in task.originalTask && task.originalTask.due) {
      setEditedDueDate(task.originalTask.due.date ? parseISO(task.originalTask.due.date) : undefined);
      setEditedDueTime(task.originalTask.due.datetime ? format(parseISO(task.originalTask.due.datetime), "HH:mm") : "");
    } else {
      // Fallback para a data agendada se não houver originalTask ou due date
      const scheduledStart = parse(task.start, "HH:mm", selectedDate);
      if (isValid(scheduledStart)) {
        setEditedDueDate(selectedDate);
        setEditedDueTime(task.start);
      } else {
        setEditedDueDate(undefined);
        setEditedDueTime("");
      }
    }
    setEditedPriority(task.priority);
    setEditedDuration(String(task.estimatedDurationMinutes || DEFAULT_TASK_DURATION_MINUTES));
    if (task.originalTask && 'deadline' in task.originalTask) {
      setEditedDeadline(task.originalTask.deadline ? parseISO(task.originalTask.deadline) : undefined);
    } else {
      setEditedDeadline(undefined);
    }
    setObservationInput(""); // Limpar o campo de observação ao abrir o popover
    console.log("DEBUG: handleOpenEditPopover - editedDuration:", String(task.estimatedDurationMinutes || DEFAULT_TASK_DURATION_MINUTES));
    setIsEditPopoverOpen(true);
  }, [selectedDate]);

  const handleSaveEditedTask = useCallback(async () => {
    if (!editingScheduledTask || !editingScheduledTask.originalTask) {
      toast.error("Nenhuma tarefa selecionada para edição ou tarefa original não encontrada.");
      return;
    }

    const originalTodoistTask = editingScheduledTask.originalTask as TodoistTask; // Assumindo que é uma TodoistTask

    const updateData: {
      priority?: 1 | 2 | 3 | 4;
      due_date?: string | null;
      due_datetime?: string | null;
      duration?: number;
      duration_unit?: "minute" | "day";
      deadline?: string | null;
      description?: string; // Adicionado para a descrição
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

    // Handle Priority
    if (editedPriority !== originalTodoistTask.priority) {
      updateData.priority = editedPriority;
      changed = true;
    }

    // Handle Duration
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

    // Handle Deadline
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

    // Handle Observation
    if (observationInput.trim()) {
      const timestamp = format(new Date(), "dd/MM/yyyy HH:mm", { locale: ptBR });
      const newObservation = `\n\n[${timestamp}] - ${observationInput.trim()}`;
      updateData.description = (originalTodoistTask.description || "") + newObservation;
      changed = true;
    }

    if (changed) {
      await updateTask(originalTodoistTask.id, updateData);
      toast.success("Tarefa agendada atualizada no Todoist!");
      loadAgendaTasks(); // Recarregar a agenda para refletir as mudanças
    } else {
      toast.info("Nenhuma alteração detectada.");
    }
    setIsEditPopoverOpen(false);
    setEditingScheduledTask(null);
    setObservationInput(""); // Limpar o campo de observação após salvar
  }, [editingScheduledTask, editedDueDate, editedDueTime, editedPriority, editedDuration, editedDeadline, observationInput, updateTask, loadAgendaTasks, selectedDate]);

  const handleCompleteScheduledTask = useCallback(async (taskId: string) => {
    const success = await closeTask(taskId);
    if (success !== undefined) {
      toast.success("Tarefa concluída com sucesso!");
      loadAgendaTasks(); // Recarregar a agenda para remover a tarefa concluída
    }
  }, [closeTask, loadAgendaTasks]);

  const isLoadingCombined = isLoadingTodoist || isLoadingAgenda;

  return (
    <div className="p-4">
      <h2 className="text-3xl font-bold mb-2 text-gray-800">
        <ListTodo className="inline-block h-8 w-8 mr-2 text-indigo-600" /> AGENDA - Visão Diária
      </h2>
      <p className="text-lg text-gray-600 mb-6">
        Visualize suas reuniões e tarefas prioritárias em um calendário diário. Clique em uma tarefa para editá-la.
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
          onSelectTask={handleOpenEditPopover} // Passar o handler para abrir o popover de edição
          onCompleteTask={handleCompleteScheduledTask} // Passar a nova função
        />
      )}

      {/* Popover de Edição de Tarefa */}
      <Popover open={isEditPopoverOpen} onOpenChange={setIsEditPopoverOpen}>
        <PopoverTrigger asChild>
          {/* Um trigger invisível, pois o popover é aberto programaticamente */}
          <Button variant="ghost" className="hidden"></Button>
        </PopoverTrigger>
        <PopoverContent className="w-80 p-4">
          <ScrollArea className="h-[500px] pr-4"> {/* Aumentado a altura para acomodar a observação */}
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
  );
};

export default Agenda;