"use client";

import React, { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CalendarIcon, PlusCircle, Trash2, Clock, Briefcase, Home, ListTodo, XCircle, Lightbulb, Filter } from "lucide-react";
import { format, parseISO, startOfDay, addMinutes, isWithinInterval, parse, setHours, setMinutes, addHours, addDays } from "date-fns";
import { ptBR } from "date-fns/locale";
import { DaySchedule, TimeBlock, TimeBlockType, ScheduledTask, TodoistTask, InternalTask } from "@/lib/types";
import TimeSlotPlanner from "@/components/TimeSlotPlanner";
import { toast } from "sonner";
import { cn, getTaskCategory } from "@/lib/utils"; // Importar getTaskCategory
import { useTodoist } from "@/context/TodoistContext";
import { getInternalTasks } from "@/utils/internalTaskStorage";
import LoadingSpinner from "@/components/ui/loading-spinner";

const PLANNER_STORAGE_KEY = "planner_schedules";

const Planejador = () => {
  const { fetchTasks, isLoading: isLoadingTodoist } = useTodoist();
  const [selectedDate, setSelectedDate] = useState<Date>(startOfDay(new Date()));
  const [schedules, setSchedules] = useState<Record<string, DaySchedule>>({}); // Key: YYYY-MM-DD
  const [newBlockStart, setNewBlockStart] = useState("09:00");
  const [newBlockEnd, setNewBlockEnd] = useState("17:00");
  const [newBlockType, setNewBlockType] = useState<TimeBlockType>("work");
  const [newBlockLabel, setNewBlockLabel] = useState("");
  const [backlogTasks, setBacklogTasks] = useState<(TodoistTask | InternalTask)[]>([]);
  const [selectedTaskToSchedule, setSelectedTaskToSchedule] = useState<(TodoistTask | InternalTask) | null>(null);
  const [isLoadingBacklog, setIsLoadingBacklog] = useState(false);
  const [suggestedSlot, setSuggestedSlot] = useState<{ start: string; end: string } | null>(null);
  const [tempEstimatedDuration, setTempEstimatedDuration] = useState<string>("15"); // Para ajustar a duração da tarefa selecionada
  const [filterInput, setFilterInput] = useState<string>(""); // Novo estado para o filtro

  const currentDaySchedule = schedules[format(selectedDate, "yyyy-MM-dd")] || {
    date: format(selectedDate, "yyyy-MM-dd"),
    timeBlocks: [],
    scheduledTasks: [],
  };

  useEffect(() => {
    // Load schedules from localStorage
    try {
      const storedSchedules = localStorage.getItem(PLANNER_STORAGE_KEY);
      if (storedSchedules) {
        setSchedules(JSON.parse(storedSchedules));
      }
    } catch (error) {
      console.error("Failed to load planner schedules from localStorage", error);
      toast.error("Erro ao carregar agendamentos do planejador.");
    }
  }, []);

  useEffect(() => {
    // Save schedules to localStorage whenever they change
    localStorage.setItem(PLANNER_STORAGE_KEY, JSON.stringify(schedules));
  }, [schedules]);

  const fetchBacklogTasks = useCallback(async () => {
    setIsLoadingBacklog(true);
    try {
      // Passar `true` para includeSubtasksAndRecurring para o Planejador
      const todoistTasks = await fetchTasks(filterInput.trim() || undefined, true); 
      const internalTasks = getInternalTasks();

      const combinedBacklog = [
        ...(todoistTasks || []),
        ...internalTasks.filter(task => !task.isCompleted) // Apenas tarefas internas não concluídas
      ];

      // Ordenar o backlog (ex: por prioridade, depois por data de vencimento)
      const sortedBacklog = combinedBacklog.sort((a, b) => {
        const priorityA = 'priority' in a ? a.priority : 1; // Internal tasks default to P4
        const priorityB = 'priority' in b ? b.priority : 1;
        if (priorityA !== priorityB) return priorityB - priorityA; // Higher priority first

        const dateA = 'due' in a && a.due?.datetime ? parseISO(a.due.datetime).getTime() : Infinity;
        const dateB = 'due' in b && b.due?.datetime ? parseISO(b.due.datetime).getTime() : Infinity;
        return dateA - dateB; // Earlier due date first
      });

      setBacklogTasks(sortedBacklog);
    } catch (error) {
      console.error("Erro ao carregar backlog de tarefas:", error);
      toast.error("Falha ao carregar tarefas do backlog.");
    } finally {
      setIsLoadingBacklog(false);
    }
  }, [fetchTasks, filterInput]); // Adicionar filterInput como dependência

  useEffect(() => {
    fetchBacklogTasks();
  }, [fetchBacklogTasks]);

  const handleAddBlock = useCallback(() => {
    if (!newBlockStart || !newBlockEnd) {
      toast.error("Por favor, defina o início e o fim do bloco.");
      return;
    }

    const newBlock: TimeBlock = {
      id: Date.now().toString(),
      start: newBlockStart,
      end: newBlockEnd,
      type: newBlockType,
      label: newBlockLabel.trim() || undefined,
    };

    setSchedules((prevSchedules) => {
      const dateKey = format(selectedDate, "yyyy-MM-dd");
      const currentDay = prevSchedules[dateKey] || { date: dateKey, timeBlocks: [], scheduledTasks: [] };
      const updatedBlocks = [...currentDay.timeBlocks, newBlock].sort((a, b) => a.start.localeCompare(b.start));
      return {
        ...prevSchedules,
        [dateKey]: { ...currentDay, timeBlocks: updatedBlocks },
      };
    });

    setNewBlockStart("09:00"); // Reset to default
    setNewBlockEnd("17:00");   // Reset to default
    setNewBlockLabel("");
    toast.success("Bloco de tempo adicionado!");
  }, [selectedDate, newBlockStart, newBlockEnd, newBlockType, newBlockLabel, schedules]);

  const handleDeleteBlock = useCallback((blockId: string) => {
    setSchedules((prevSchedules) => {
      const dateKey = format(selectedDate, "yyyy-MM-dd");
      const currentDay = prevSchedules[dateKey];
      if (!currentDay) return prevSchedules;

      const updatedBlocks = currentDay.timeBlocks.filter((block) => block.id !== blockId);
      return {
        ...prevSchedules,
        [dateKey]: { ...currentDay, timeBlocks: updatedBlocks },
      };
    });
    toast.info("Bloco de tempo removido.");
  }, [selectedDate]);

  const handleDateChange = (date: Date | undefined) => {
    if (date) {
      setSelectedDate(startOfDay(date));
      setSelectedTaskToSchedule(null); // Clear selected task when date changes
      setSuggestedSlot(null); // Clear suggested slot
    }
  };

  const handleSelectBacklogTask = useCallback((task: TodoistTask | InternalTask) => {
    setSelectedTaskToSchedule(task);
    setTempEstimatedDuration(String(task.estimatedDurationMinutes || 15)); // Set duration for editing
    setSuggestedSlot(null); // Clear any previous suggestion
    toast.info(`Tarefa "${task.content}" selecionada para agendamento.`);
  }, []);

  const handleCancelTaskSelection = useCallback(() => {
    setSelectedTaskToSchedule(null);
    setSuggestedSlot(null);
    setTempEstimatedDuration("15");
    toast.info("Seleção de tarefa cancelada.");
  }, []);

  const scheduleTask = useCallback((task: TodoistTask | InternalTask, start: string, end: string) => {
    const dateKey = format(selectedDate, "yyyy-MM-dd");
    const currentDay = schedules[dateKey] || { date: dateKey, timeBlocks: [], scheduledTasks: [] };
    
    const newScheduledTask: ScheduledTask = {
      id: `${task.id}-${Date.now()}`, // Unique ID for scheduled instance
      taskId: task.id,
      content: task.content,
      description: task.description,
      start: start,
      end: end,
      priority: 'priority' in task ? task.priority : 1,
      category: getTaskCategory(task) || "pessoal", // Default to pessoal if not found
      estimatedDurationMinutes: parseInt(tempEstimatedDuration, 10) || 15,
      originalTask: task,
    };

    setSchedules((prevSchedules) => {
      const updatedScheduledTasks = [...currentDay.scheduledTasks, newScheduledTask].sort((a, b) => a.start.localeCompare(b.start));
      return {
        ...prevSchedules,
        [dateKey]: { ...currentDay, scheduledTasks: updatedScheduledTasks },
      };
    });

    toast.success(`Tarefa "${task.content}" agendada para ${start}-${end}!`);
    setSelectedTaskToSchedule(null); // Clear selection after scheduling
    setSuggestedSlot(null); // Clear suggestion
    setTempEstimatedDuration("15");
  }, [selectedDate, schedules, tempEstimatedDuration]);

  const handleSelectSlot = useCallback((slotTimeStr: string, slotType: TimeBlockType) => {
    if (!selectedTaskToSchedule) {
      toast.info("Selecione uma tarefa do backlog primeiro para agendar.");
      return;
    }

    const durationMinutes = parseInt(tempEstimatedDuration, 10) || 15;
    const dateKey = format(selectedDate, "yyyy-MM-dd");
    const today = parseISO(dateKey);

    const startSlot = parse(slotTimeStr, "HH:mm", today);
    const endSlot = addMinutes(startSlot, durationMinutes);
    const endSlotStr = format(endSlot, "HH:mm");

    // Check for conflicts with existing scheduled tasks
    const hasConflict = currentDaySchedule.scheduledTasks.some(st => {
      const stStart = parse(st.start, "HH:mm", today);
      const stEnd = parse(st.end, "HH:mm", today);
      return (isWithinInterval(startSlot, { start: stStart, end: stEnd }) ||
              isWithinInterval(endSlot, { start: stStart, end: stEnd }) ||
              (startSlot <= stStart && endSlot >= stEnd));
    });

    if (hasConflict) {
      toast.error("O slot selecionado ou a duração da tarefa conflita com uma tarefa já agendada.");
      return;
    }

    // Check if the entire duration fits within a valid time block
    const fitsInBlock = currentDaySchedule.timeBlocks.some(block => {
      const blockStart = parse(block.start, "HH:mm", today);
      const blockEnd = parse(block.end, "HH:mm", today);
      const taskCategory = getTaskCategory(selectedTaskToSchedule);

      // Check if start and end are within the block and block type matches category
      return (startSlot >= blockStart && endSlot <= blockEnd) &&
             ((block.type === "work" && taskCategory === "profissional") ||
              (block.type === "personal" && taskCategory === "pessoal") ||
              (block.type === "break" && taskCategory === undefined) || // Breaks can be for anything
              (block.type === "work" && taskCategory === undefined) || // If no category, can go in work
              (block.type === "personal" && taskCategory === undefined)); // If no category, can go in personal
    });

    if (!fitsInBlock && currentDaySchedule.timeBlocks.length > 0) {
      toast.warning("A duração da tarefa não se encaixa completamente em um bloco de tempo apropriado ou o tipo de bloco não corresponde à categoria da tarefa.");
      // Optionally, you could prevent scheduling here: return;
    }

    scheduleTask(selectedTaskToSchedule, slotTimeStr, endSlotStr);
  }, [selectedTaskToSchedule, selectedDate, currentDaySchedule, scheduleTask, tempEstimatedDuration]);

  const handleDeleteScheduledTask = useCallback((taskToDelete: ScheduledTask) => {
    setSchedules((prevSchedules) => {
      const dateKey = format(selectedDate, "yyyy-MM-dd");
      const currentDay = prevSchedules[dateKey];
      if (!currentDay) return prevSchedules;

      const updatedScheduledTasks = currentDay.scheduledTasks.filter((task) => task.id !== taskToDelete.id);
      return {
        ...prevSchedules,
        [dateKey]: { ...currentDay, scheduledTasks: updatedScheduledTasks },
      };
    });
    toast.info(`Tarefa agendada "${taskToDelete.content}" removida.`);
  }, [selectedDate]);

  const suggestTimeSlot = useCallback(() => {
    if (!selectedTaskToSchedule) {
      toast.error("Selecione uma tarefa do backlog para sugerir um slot.");
      return;
    }

    const durationMinutes = parseInt(tempEstimatedDuration, 10) || 15;
    const dateKey = format(selectedDate, "yyyy-MM-dd");
    const today = parseISO(dateKey);
    const taskCategory = getTaskCategory(selectedTaskToSchedule);
    const taskPriority = 'priority' in selectedTaskToSchedule ? selectedTaskToSchedule.priority : 1; // P4 default for internal

    let bestSlot: { start: string; end: string } | null = null;
    let bestScore = -1;

    // Iterate through 15-minute slots for the entire day
    for (let hour = 0; hour < 24; hour++) {
      for (let minute = 0; minute < 60; minute += 15) {
        const slotStart = setMinutes(setHours(today, hour), minute);
        const slotEnd = addMinutes(slotStart, durationMinutes);
        const slotStartStr = format(slotStart, "HH:mm");
        const slotEndStr = format(slotEnd, "HH:mm");

        // 1. Check if slot is within the current day
        if (slotEnd.getDate() !== today.getDate()) continue;

        // 2. Check for conflicts with existing scheduled tasks
        const hasConflict = currentDaySchedule.scheduledTasks.some(st => {
          const stStart = parse(st.start, "HH:mm", today);
          const stEnd = parse(st.end, "HH:mm", today);
          return (isWithinInterval(slotStart, { start: stStart, end: stEnd }) ||
                  isWithinInterval(slotEnd, { start: stStart, end: stEnd }) ||
                  (slotStart <= stStart && slotEnd >= stEnd));
        });
        if (hasConflict) continue;

        // 3. Check if it fits within a defined time block and matches category
        let currentSlotScore = 0;
        let fitsInAppropriateBlock = false;
        let isProductivityPeak = false;

        for (const block of currentDaySchedule.timeBlocks) {
          const blockStart = parse(block.start, "HH:mm", today);
          const blockEnd = parse(block.end, "HH:mm", today);

          if (slotStart >= blockStart && slotEnd <= blockEnd) {
            // Slot is fully within a block
            if ((block.type === "work" && taskCategory === "profissional") ||
                (block.type === "personal" && taskCategory === "pessoal") ||
                (block.type === "break" && taskCategory === undefined) || // Breaks can be for anything
                (block.type === "work" && taskCategory === undefined) || // If no category, can go in work
                (block.type === "personal" && taskCategory === undefined)) {
              fitsInAppropriateBlock = true;
              currentSlotScore += 10; // High score for fitting in appropriate block

              // Check for productivity peak (06h-10h) for work tasks
              if (block.type === "work" && taskCategory === "profissional" &&
                  slotStart.getHours() >= 6 && slotStart.getHours() < 10) {
                isProductivityPeak = true;
                currentSlotScore += 5; // Extra score for productivity peak
              }
              break;
            }
          }
        }

        if (!fitsInAppropriateBlock && currentDaySchedule.timeBlocks.length > 0) {
          // If there are blocks but it doesn't fit appropriately, it's a lower priority
          currentSlotScore -= 5; // Penalize for not fitting in a defined block
        } else if (currentDaySchedule.timeBlocks.length === 0) {
          // If no blocks are defined, any free slot is fine
          currentSlotScore += 5;
        }

        // 4. Prioritize based on task priority
        currentSlotScore += taskPriority * 2; // P1 (4) gets +8, P4 (1) gets +2

        // 5. Prioritize earlier slots
        currentSlotScore -= (hour * 60 + minute) / 100; // Earlier in the day gets higher score

        if (currentSlotScore > bestScore) {
          bestScore = currentSlotScore;
          bestSlot = { start: slotStartStr, end: slotEndStr };
        }
      }
    }

    if (bestSlot) {
      setSuggestedSlot(bestSlot);
      toast.success(`Slot sugerido: ${bestSlot.start} - ${bestSlot.end}`);
    } else {
      setSuggestedSlot(null);
      toast.error("Não foi possível encontrar um slot adequado para esta tarefa.");
    }
  }, [selectedTaskToSchedule, selectedDate, currentDaySchedule, tempEstimatedDuration]);


  useEffect(() => {
    if (selectedTaskToSchedule) {
      setTempEstimatedDuration(String(selectedTaskToSchedule.estimatedDurationMinutes || 15));
    }
  }, [selectedTaskToSchedule]);

  const isLoading = isLoadingTodoist || isLoadingBacklog;

  return (
    <div className="p-4 grid grid-cols-1 lg:grid-cols-3 gap-6">
      <div className="lg:col-span-2">
        <h2 className="text-3xl font-bold mb-2 text-gray-800">🗓️ PLANEJADOR - Sequenciamento de Tarefas</h2>
        <p className="text-lg text-gray-600 mb-6">
          Defina seus blocos de tempo e organize suas tarefas em intervalos de 15 minutos.
        </p>

        <div className="mb-6">
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
                {selectedDate ? format(selectedDate, "PPP", { locale: ptBR }) : <span>Selecione uma data</span>}
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
        </div>

        <Card className="mb-6 p-6">
          <CardTitle className="text-xl font-bold mb-4 flex items-center gap-2">
            <Clock className="h-5 w-5 text-indigo-600" /> Definir Blocos de Tempo
          </CardTitle>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
            <div>
              <Label htmlFor="block-start">Início</Label>
              <Input
                id="block-start"
                type="time"
                value={newBlockStart}
                onChange={(e) => setNewBlockStart(e.target.value)}
                className="mt-1"
              />
            </div>
            <div>
              <Label htmlFor="block-end">Fim</Label>
              <Input
                id="block-end"
                type="time"
                value={newBlockEnd}
                onChange={(e) => setNewBlockEnd(e.target.value)}
                className="mt-1"
              />
            </div>
            <div>
              <Label htmlFor="block-type">Tipo</Label>
              <Select value={newBlockType} onValueChange={(value: TimeBlockType) => setNewBlockType(value)}>
                <SelectTrigger className="w-full mt-1">
                  <SelectValue placeholder="Tipo de Bloco" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="work">Trabalho</SelectItem>
                  <SelectItem value="personal">Pessoal</SelectItem>
                  <SelectItem value="break">Pausa</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="block-label">Rótulo (Opcional)</Label>
              <Input
                id="block-label"
                type="text"
                value={newBlockLabel}
                onChange={(e) => setNewBlockLabel(e.target.value)}
                placeholder="Ex: Almoço, Foco"
                className="mt-1"
              />
            </div>
            <Button onClick={handleAddBlock} className="md:col-span-4 mt-2">
              <PlusCircle className="h-4 w-4 mr-2" /> Adicionar Bloco
            </Button>
          </div>

          {currentDaySchedule.timeBlocks.length > 0 && (
            <div className="mt-6 space-y-2">
              <h3 className="text-lg font-semibold">Blocos Definidos:</h3>
              {currentDaySchedule.timeBlocks.map((block) => (
                <div key={block.id} className="flex items-center justify-between p-2 bg-gray-50 rounded-md border">
                  <span className="text-sm">
                    {block.start} - {block.end} |{" "}
                    {block.type === "work" && <Briefcase className="inline-block h-4 w-4 mr-1 text-green-600" />}
                    {block.type === "personal" && <Home className="inline-block h-4 w-4 mr-1 text-blue-600" />}
                    {block.type === "break" && <Clock className="inline-block h-4 w-4 mr-1 text-yellow-600" />}
                    {block.label || (block.type === "work" ? "Trabalho" : block.type === "personal" ? "Pessoal" : "Pausa")}
                  </span>
                  <Button variant="ghost" size="icon" onClick={() => handleDeleteBlock(block.id)}>
                    <Trash2 className="h-4 w-4 text-red-500" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </Card>

        <TimeSlotPlanner daySchedule={currentDaySchedule} onSelectSlot={handleSelectSlot} onSelectTask={handleDeleteScheduledTask} suggestedSlotStart={suggestedSlot?.start} suggestedSlotEnd={suggestedSlot?.end} />
      </div>

      <div className="lg:col-span-1">
        <Card className="h-full">
          <CardHeader>
            <CardTitle className="text-xl font-bold text-gray-800 flex items-center gap-2">
              <ListTodo className="h-5 w-5 text-indigo-600" /> Backlog de Tarefas
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="mb-4">
              <Label htmlFor="backlog-filter" className="sr-only">Filtrar Backlog</Label>
              <div className="relative">
                <Input
                  id="backlog-filter"
                  type="text"
                  placeholder="Filtrar tarefas (ex: 'hoje', 'p1', '#projeto')"
                  value={filterInput}
                  onChange={(e) => setFilterInput(e.target.value)}
                  onKeyPress={(e) => {
                    if (e.key === "Enter") {
                      fetchBacklogTasks(); // Recarregar tarefas ao pressionar Enter
                    }
                  }}
                  className="pr-10"
                  disabled={isLoading}
                />
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={fetchBacklogTasks}
                  className="absolute right-0 top-0 h-full px-3"
                  disabled={isLoading}
                >
                  <Filter className="h-4 w-4" />
                </Button>
              </div>
            </div>

            {selectedTaskToSchedule && (
              <div className="mb-4 p-3 border border-indigo-400 bg-indigo-50 rounded-md flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-indigo-800">
                    Selecionado: {selectedTaskToSchedule.content}
                  </span>
                  <Button variant="ghost" size="icon" onClick={handleCancelTaskSelection}>
                    <XCircle className="h-4 w-4 text-indigo-600" />
                  </Button>
                </div>
                <div className="flex items-center gap-2">
                  <Label htmlFor="temp-duration" className="text-sm text-indigo-800">Duração (min):</Label>
                  <Input
                    id="temp-duration"
                    type="number"
                    value={tempEstimatedDuration}
                    onChange={(e) => setTempEstimatedDuration(e.target.value)}
                    min="1"
                    className="w-20 text-sm"
                  />
                  <Button onClick={suggestTimeSlot} className="flex-grow bg-yellow-500 hover:bg-yellow-600 text-white">
                    <Lightbulb className="h-4 w-4 mr-2" /> Sugerir Slot
                  </Button>
                </div>
                {suggestedSlot && (
                  <div className="mt-2 p-2 bg-green-100 border border-green-400 rounded-md flex items-center justify-between">
                    <span className="text-sm text-green-800">
                      Sugestão: {suggestedSlot.start} - {suggestedSlot.end}
                    </span>
                    <Button size="sm" onClick={() => scheduleTask(selectedTaskToSchedule, suggestedSlot.start, suggestedSlot.end)}>
                      Agendar
                    </Button>
                  </div>
                )}
              </div>
            )}
            {isLoading ? (
              <div className="flex justify-center items-center h-[calc(100vh-400px)]">
                <LoadingSpinner size={30} />
              </div>
            ) : backlogTasks.length > 0 ? (
              <div className="mt-4 p-2 border rounded-md bg-gray-50 h-[calc(100vh-400px)] overflow-y-auto space-y-2">
                {backlogTasks.map((task) => (
                  <div
                    key={task.id}
                    className={cn(
                      "p-3 border rounded-md cursor-pointer hover:bg-gray-100 transition-colors",
                      selectedTaskToSchedule?.id === task.id ? "bg-indigo-100 border-indigo-500" : "bg-white border-gray-200"
                    )}
                    onClick={() => handleSelectBacklogTask(task)}
                  >
                    <h4 className="font-semibold text-gray-800">{task.content}</h4>
                    {task.description && <p className="text-xs text-gray-600 line-clamp-2">{task.description}</p>}
                    <div className="flex justify-between items-center text-xs text-gray-500 mt-1">
                      <span>
                        {'priority' in task ? `P${task.priority}` : 'P4'} - {'labels' in task ? (getTaskCategory(task) || 'N/A') : task.category}
                      </span>
                      <span className="flex items-center">
                        <Clock className="h-3 w-3 mr-1" /> {task.estimatedDurationMinutes || 15} min
                      </span>
                      {'due' in task && task.due?.date && (
                        <span>Venc: {format(parseISO(task.due.date), "dd/MM", { locale: ptBR })}</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="mt-4 p-4 border rounded-md bg-gray-50 h-[calc(100vh-400px)] overflow-y-auto">
                <p className="text-gray-500 italic">Nenhuma tarefa no backlog para agendar ainda.</p>
                <Button onClick={fetchBacklogTasks} className="mt-4 w-full">Recarregar Backlog</Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Planejador;