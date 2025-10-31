"use client";

import React, { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CalendarIcon, Clock, ListTodo, Play, RotateCcw, PlusCircle, Trash2, Briefcase, Home, Bed } from "lucide-react";
import { format, parseISO, isValid, startOfDay, addMinutes, parse, setHours, setMinutes, getDay, addDays, isBefore, isEqual, isToday } from "date-fns"; // Adicionado isToday e isBefore
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";
import { useTodoist } from "@/context/TodoistContext";
import LoadingSpinner from "@/components/ui/loading-spinner";
import { RecurringTimeBlock, TimeBlockType, DayOfWeek, TodoistTask } from "@/lib/types";
import { cn, getTaskCategory } from "@/lib/utils";

const MASSIVE_PLANNER_BLOCKS_STORAGE_KEY = "massive_planner_recurring_blocks";
const MASSIVE_PLANNER_FILTER_STORAGE_KEY = "massive_planner_filter_input";

const DayOfWeekNames: Record<DayOfWeek, string> = {
  "0": "Domingo",
  "1": "Segunda-feira",
  "2": "Terça-feira",
  "3": "Quarta-feira",
  "4": "Quinta-feira",
  "5": "Sexta-feira",
  "6": "Sábado",
};

const MassivePlanner = () => {
  const { fetchTasks, updateTask, isLoading: isLoadingTodoist } = useTodoist();
  const [recurringBlocks, setRecurringBlocks] = useState<RecurringTimeBlock[]>([]);
  const [newBlockStart, setNewBlockStart] = useState("09:00");
  const [newBlockEnd, setNewBlockEnd] = useState("17:00");
  const [newBlockType, setNewBlockType] = useState<TimeBlockType>("work");
  const [newBlockLabel, setNewBlockLabel] = useState("");
  const [newBlockRecurrence, setNewBlockRecurrence] = useState<"dayOfWeek" | "weekdays" | "weekend">("weekdays");
  const [newBlockDayOfWeek, setNewBlockDayOfWeek] = useState<DayOfWeek>("1");
  const [filterInput, setFilterInput] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem(MASSIVE_PLANNER_FILTER_STORAGE_KEY) || "no date & !@agenda & !@foco & !@rapida";
    }
    return "no date & !@agenda & !@foco & !@rapida";
  });
  const [planningHorizonDays, setPlanningHorizonDays] = useState<string>("7");
  const [isPlanning, setIsPlanning] = useState(false);
  const [planningSummary, setPlanningSummary] = useState<{ planned: number; displaced: number; skipped: number; } | null>(null);

  useEffect(() => {
    try {
      const storedBlocks = localStorage.getItem(MASSIVE_PLANNER_BLOCKS_STORAGE_KEY);
      if (storedBlocks) {
        setRecurringBlocks(JSON.parse(storedBlocks));
      }
    } catch (error) {
      console.error("Failed to load recurring blocks from localStorage", error);
      toast.error("Erro ao carregar blocos de tempo recorrentes.");
    }
  }, []);

  useEffect(() => {
    localStorage.setItem(MASSIVE_PLANNER_BLOCKS_STORAGE_KEY, JSON.stringify(recurringBlocks));
  }, [recurringBlocks]);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem(MASSIVE_PLANNER_FILTER_STORAGE_KEY, filterInput);
    }
  }, [filterInput]);

  const handleAddBlock = useCallback(() => {
    if (!newBlockStart || !newBlockEnd) {
      toast.error("Por favor, defina o início e o fim do bloco.");
      return;
    }

    const baseBlock = {
      id: Date.now().toString(),
      start: newBlockStart,
      end: newBlockEnd,
      type: newBlockType,
      label: newBlockLabel.trim() || undefined,
    };

    if (newBlockRecurrence === "dayOfWeek") {
      const newRecurringBlock: RecurringTimeBlock = {
        ...baseBlock,
        dayOfWeek: newBlockDayOfWeek,
      };
      setRecurringBlocks((prev) => [...prev, newRecurringBlock].sort((a, b) => a.dayOfWeek.localeCompare(b.dayOfWeek) || a.start.localeCompare(b.start)));
      toast.success(`Bloco de tempo recorrente para ${DayOfWeekNames[newBlockDayOfWeek]} adicionado!`);
    } else if (newBlockRecurrence === "weekdays") {
      const weekdays: DayOfWeek[] = ["1", "2", "3", "4", "5"];
      const newBlocks = weekdays.map(day => ({
        id: `${Date.now()}-${day}`,
        ...baseBlock,
        dayOfWeek: day,
      }));
      setRecurringBlocks((prev) => [...prev, ...newBlocks].sort((a, b) => a.dayOfWeek.localeCompare(b.dayOfWeek) || a.start.localeCompare(b.start)));
      toast.success("Blocos de tempo adicionados para todos os dias de semana!");
    } else if (newBlockRecurrence === "weekend") {
      const weekendDays: DayOfWeek[] = ["0", "6"];
      const newBlocks = weekendDays.map(day => ({
        id: `${Date.now()}-${day}`,
        ...baseBlock,
        dayOfWeek: day,
      }));
      setRecurringBlocks((prev) => [...prev, ...newBlocks].sort((a, b) => a.dayOfWeek.localeCompare(b.dayOfWeek) || a.start.localeCompare(b.start)));
      toast.success("Blocos de tempo adicionados para o fim de semana!");
    }

    setNewBlockStart("09:00");
    setNewBlockEnd("17:00");
    setNewBlockLabel("");
  }, [newBlockStart, newBlockEnd, newBlockType, newBlockLabel, newBlockRecurrence, newBlockDayOfWeek]);

  const handleDeleteBlock = useCallback((blockId: string) => {
    setRecurringBlocks((prev) => prev.filter((block) => block.id !== blockId));
    toast.info("Bloco de tempo recorrente removido.");
  }, []);

  const handleResetBlocks = useCallback(() => {
    if (confirm("Tem certeza que deseja resetar todos os blocos de tempo recorrentes?")) {
      setRecurringBlocks([]);
      localStorage.removeItem(MASSIVE_PLANNER_BLOCKS_STORAGE_KEY);
      toast.success("Blocos de tempo resetados!");
    }
  }, []);

  const sortTasksForPlanning = useCallback((tasks: TodoistTask[]): TodoistTask[] => {
    return [...tasks].sort((a, b) => {
      // 1. Starred tasks first
      const isAStarred = a.content.startsWith("*");
      const isBStarred = b.content.startsWith("*");
      if (isAStarred && !isBStarred) return -1;
      if (!isAStarred && isBStarred) return 1;

      // Helper to get date value, handling null/undefined and invalid dates
      const getDateValue = (dateString: string | null | undefined) => {
        if (typeof dateString === 'string' && dateString) {
          const parsedDate = parseISO(dateString);
          return isValid(parsedDate) ? parsedDate.getTime() : Infinity;
        }
        return Infinity; // Tasks without a date go last
      };

      // 2. Deadline: earliest first
      const deadlineA = getDateValue(a.deadline);
      const deadlineB = getDateValue(b.deadline);
      if (deadlineA !== deadlineB) {
        return deadlineA - deadlineB;
      }

      // 3. Priority: P1 (4) > P2 (3) > P3 (2) > P4 (1)
      if (b.priority !== a.priority) {
        return b.priority - a.priority;
      }

      // 4. Due date/time: earliest first
      const dueDateTimeA = getDateValue(a.due?.datetime);
      const dueDateTimeB = getDateValue(b.due?.datetime);
      if (dueDateTimeA !== dueDateTimeB) {
        return dueDateTimeA - dueDateTimeB;
      }

      const dueDateA = getDateValue(a.due?.date);
      const dueDateB = getDateValue(b.due?.date);
      if (dueDateA !== dueDateB) { 
        return dueDateA - dueDateB;
      }

      // 5. Created at: earliest first (tie-breaker)
      const createdAtA = getDateValue(a.created_at);
      const createdAtB = getDateValue(b.created_at);
      if (createdAtA !== createdAtB) {
        return createdAtA - createdAtB;
      }
      return 0;
    });
  }, []);

  const handleMassivePlanning = useCallback(async () => {
    if (recurringBlocks.length === 0) {
      toast.error("Por favor, defina pelo menos um bloco de tempo recorrente.");
      return;
    }
    if (!filterInput.trim()) {
      toast.error("Por favor, insira um filtro para as tarefas do Todoist.");
      return;
    }

    setIsPlanning(true);
    setPlanningSummary(null);
    let plannedCount = 0;
    let displacedCount = 0;
    let skippedCount = 0;

    try {
      const tasksToPlan = await fetchTasks(filterInput, { includeSubtasks: false, includeRecurring: false });
      const sortedTasks = sortTasksForPlanning(tasksToPlan.filter(task => !task.is_completed));

      if (sortedTasks.length === 0) {
        toast.info("Nenhuma tarefa encontrada com o filtro atual para planejar.");
        setIsPlanning(false);
        return;
      }

      const horizon = parseInt(planningHorizonDays, 10);
      if (isNaN(horizon) || horizon <= 0) {
        toast.error("O horizonte de planejamento deve ser um número positivo de dias.");
        setIsPlanning(false);
        return;
      }

      const today = startOfDay(new Date());
      const dailySchedules: Record<string, { scheduledTasks: { start: Date; end: Date; taskId: string; priority: number; }[] }> = {};

      for (let i = 0; i < horizon; i++) {
        const currentDay = addDays(today, i);
        const dayOfWeek = getDay(currentDay).toString() as DayOfWeek;
        const dateKey = format(currentDay, "yyyy-MM-dd");

        dailySchedules[dateKey] = { scheduledTasks: [] };

        const blocksForDay = recurringBlocks.filter(block => block.dayOfWeek === dayOfWeek);
        blocksForDay.sort((a, b) => a.start.localeCompare(b.start));

        // Fetch existing tasks for this day to avoid conflicts
        // Corrected filter syntax for Todoist API
        const existingTasksFilter = `due: ${dateKey} & !is_completed`;
        const existingTasksForDay = await fetchTasks(existingTasksFilter, { includeSubtasks: false, includeRecurring: false });
        existingTasksForDay.forEach(task => {
          if (task.due?.datetime && isValid(parseISO(task.due.datetime))) {
            const start = parseISO(task.due.datetime);
            const duration = task.duration?.amount || 30; // Default to 30 min
            const end = addMinutes(start, duration);
            dailySchedules[dateKey].scheduledTasks.push({ start, end, taskId: task.id, priority: task.priority });
          }
        });
        dailySchedules[dateKey].scheduledTasks.sort((a, b) => a.start.getTime() - b.start.getTime());
      }

      for (const task of sortedTasks) {
        let taskPlanned = false;
        const taskCategory = getTaskCategory(task);
        const taskDuration = task.estimatedDurationMinutes || 30; // Default duration

        for (let i = 0; i < horizon; i++) {
          const currentDay = addDays(today, i);
          const dayOfWeek = getDay(currentDay).toString() as DayOfWeek;
          const dateKey = format(currentDay, "yyyy-MM-dd");

          const blocksForDay = recurringBlocks.filter(block => block.dayOfWeek === dayOfWeek);
          blocksForDay.sort((a, b) => a.start.localeCompare(b.start));

          const availableBlocks = blocksForDay.filter(block => block.type !== "break"); // Exclude break blocks

          for (const block of availableBlocks) {
            // Check category match
            if (taskCategory && block.type !== "work" && block.type !== "personal") continue; // Skip if block type is not work/personal for categorized tasks
            if (taskCategory === "profissional" && block.type === "personal") continue;
            if (taskCategory === "pessoal" && block.type === "work") continue;

            let slotStart = parse(block.start, "HH:mm", currentDay);
            const blockEnd = parse(block.end, "HH:mm", currentDay);

            // Adjust slotStart if it's in the past for today
            if (isToday(currentDay) && isBefore(slotStart, new Date())) {
              slotStart = setMinutes(setHours(currentDay, new Date().getHours()), Math.ceil(new Date().getMinutes() / 15) * 15);
              if (isBefore(slotStart, new Date())) slotStart = addMinutes(slotStart, 15); // Ensure it's in the future
            }
            if (isBefore(slotStart, parse(block.start, "HH:mm", currentDay))) slotStart = parse(block.start, "HH:mm", currentDay); // Don't start before block start

            while (addMinutes(slotStart, taskDuration) <= blockEnd) {
              const slotEnd = addMinutes(slotStart, taskDuration);
              let conflictFound = false;
              let displacedTask: { taskId: string; priority: number; } | null = null;

              for (const scheduled of dailySchedules[dateKey].scheduledTasks) {
                if (slotStart < scheduled.end && slotEnd > scheduled.start) { // Overlap
                  if (task.priority > scheduled.priority) {
                    displacedTask = scheduled;
                  } else {
                    conflictFound = true;
                    break;
                  }
                }
              }

              if (!conflictFound) {
                // If there's a displaced task, remove it from the schedule
                if (displacedTask) {
                  dailySchedules[dateKey].scheduledTasks = dailySchedules[dateKey].scheduledTasks.filter(st => st.taskId !== displacedTask!.taskId);
                  displacedCount++;
                  // The displaced task is effectively "skipped" for this planning run,
                  // as it will be picked up by the filter again if not rescheduled.
                }

                // Schedule the current task
                const updated = await updateTask(task.id, {
                  due_date: null,
                  due_datetime: format(slotStart, "yyyy-MM-dd'T'HH:mm:ss"),
                  duration: taskDuration,
                  duration_unit: "minute",
                  labels: [...new Set([...task.labels, "agenda"])], // Add agenda label
                });

                if (updated) {
                  dailySchedules[dateKey].scheduledTasks.push({ start: slotStart, end: slotEnd, taskId: task.id, priority: task.priority });
                  dailySchedules[dateKey].scheduledTasks.sort((a, b) => a.start.getTime() - b.start.getTime());
                  plannedCount++;
                  taskPlanned = true;
                  break; // Move to the next task
                } else {
                  toast.error(`Falha ao atualizar tarefa "${task.content}" no Todoist.`);
                  skippedCount++;
                  taskPlanned = true; // Treat as planned to avoid re-attempting
                  break;
                }
              }
              slotStart = addMinutes(slotStart, 15); // Try next 15-min slot
            }
            if (taskPlanned) break;
          }
          if (taskPlanned) break;
        }
        if (!taskPlanned) {
          skippedCount++;
        }
      }

      setPlanningSummary({ planned: plannedCount, displaced: displacedCount, skipped: skippedCount });
      toast.success("Planejamento massivo concluído!");

    } catch (error) {
      console.error("Erro durante o planejamento massivo:", error);
      toast.error("Ocorreu um erro durante o planejamento massivo.");
    } finally {
      setIsPlanning(false);
    }
  }, [recurringBlocks, filterInput, planningHorizonDays, fetchTasks, sortTasksForPlanning, updateTask]);

  const groupedRecurringBlocks = recurringBlocks.reduce((acc, block) => {
    const key = `${block.start}-${block.end}-${block.type}-${block.label || ''}`;
    if (!acc[key]) {
      acc[key] = { ...block, days: [] };
    }
    acc[key].days.push(block.dayOfWeek);
    return acc;
  }, {} as Record<string, RecurringTimeBlock & { days: DayOfWeek[] }>);

  const renderRecurringBlockDisplay = (block: RecurringTimeBlock & { days: DayOfWeek[] }) => {
    const sortedDays = block.days.sort((a, b) => parseInt(a) - parseInt(b));
    let dayDisplay = "";

    const isWeekdays = sortedDays.length === 5 && sortedDays.every((day, i) => day === String(i + 1));
    const isWeekend = sortedDays.length === 2 && sortedDays.includes("0") && sortedDays.includes("6");

    if (isWeekdays) {
      dayDisplay = "Todo(a) dia de semana";
    } else if (isWeekend) {
      dayDisplay = "Todo(a) fim de semana";
    } else if (sortedDays.length === 1) {
      dayDisplay = `Todo(a) ${DayOfWeekNames[sortedDays[0]]}`;
    } else {
      dayDisplay = sortedDays.map(day => DayOfWeekNames[day]).join(", ");
    }

    return (
      <div key={block.id} className="flex items-center justify-between p-2 bg-gray-50 rounded-md border">
        <span className="text-sm">
          {block.start} - {block.end} |{" "}
          {block.type === "work" && <Briefcase className="inline-block h-4 w-4 mr-1 text-green-600" />}
          {block.type === "personal" && <Home className="inline-block h-4 w-4 mr-1 text-blue-600" />}
          {block.type === "break" && <Bed className="inline-block h-4 w-4 mr-1 text-yellow-600" />}
          {block.label || (block.type === "work" ? "Trabalho" : block.type === "personal" ? "Pessoal" : "Descanso")}
          <span className="ml-2 text-gray-400">({dayDisplay})</span>
        </span>
        <Button variant="ghost" size="icon" onClick={() => handleDeleteBlock(block.id)}>
          <Trash2 className="h-4 w-4 text-red-500" />
        </Button>
      </div>
    );
  };

  const isLoadingCombined = isLoadingTodoist || isPlanning;

  return (
    <div className="p-4">
      <h2 className="text-3xl font-bold mb-2 text-gray-800">
        <CalendarIcon className="inline-block h-8 w-8 mr-2 text-indigo-600" /> SEISO - Planejamento Massivo
      </h2>
      <p className="text-lg text-gray-600 mb-6">
        Defina seus blocos de tempo recorrentes e deixe a IA planejar suas tarefas em massa.
      </p>

      <Card className="mb-6 p-6">
        <CardTitle className="text-xl font-bold mb-4 flex items-center gap-2">
          <Clock className="h-5 w-5 text-indigo-600" /> Definir Blocos de Tempo Recorrentes
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
              disabled={isLoadingCombined}
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
              disabled={isLoadingCombined}
            />
          </div>
          <div>
            <Label htmlFor="block-type">Tipo</Label>
            <Select value={newBlockType} onValueChange={(value: TimeBlockType) => setNewBlockType(value)} disabled={isLoadingCombined}>
              <SelectTrigger className="w-full mt-1">
                <SelectValue placeholder="Tipo de Bloco" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="work">Trabalho</SelectItem>
                <SelectItem value="personal">Pessoal</SelectItem>
                <SelectItem value="break">Descanso (Sono Noturno)</SelectItem>
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
              disabled={isLoadingCombined}
            />
          </div>
          <div className="md:col-span-2">
            <Label htmlFor="block-recurrence">Recorrência</Label>
            <Select value={newBlockRecurrence} onValueChange={(value: "dayOfWeek" | "weekdays" | "weekend") => setNewBlockRecurrence(value)} disabled={isLoadingCombined}>
              <SelectTrigger className="w-full mt-1">
                <SelectValue placeholder="Recorrência" />
              </SelectTrigger>
                <SelectContent>
                  <SelectItem value="dayOfWeek">Todo(a) ...</SelectItem>
                  <SelectItem value="weekdays">Todos os dias de semana</SelectItem>
                  <SelectItem value="weekend">Todos os fins de semana</SelectItem>
                </SelectContent>
            </Select>
          </div>
          {newBlockRecurrence === "dayOfWeek" && (
            <div className="md:col-span-2">
              <Label htmlFor="block-day-of-week">Dia da Semana</Label>
              <Select value={newBlockDayOfWeek} onValueChange={(value: DayOfWeek) => setNewBlockDayOfWeek(value)} disabled={isLoadingCombined}>
                <SelectTrigger className="w-full mt-1">
                  <SelectValue placeholder="Dia da Semana" />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(DayOfWeekNames).map(([value, label]) => (
                    <SelectItem key={value} value={value}>{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          <Button onClick={handleAddBlock} className="md:col-span-4 mt-2" disabled={isLoadingCombined}>
            <PlusCircle className="h-4 w-4 mr-2" /> Adicionar Bloco
          </Button>
        </div>

        {recurringBlocks.length > 0 && (
          <div className="mt-6 space-y-2">
            <h3 className="text-lg font-semibold">Blocos Recorrentes Definidos:</h3>
            {Object.values(groupedRecurringBlocks).map(renderRecurringBlockDisplay)}
            <Button onClick={handleResetBlocks} variant="outline" className="w-full mt-4 flex items-center gap-2 text-red-600 border-red-600 hover:bg-red-50" disabled={isLoadingCombined}>
              <RotateCcw className="h-4 w-4" /> Resetar Todos os Blocos
            </Button>
          </div>
        )}
      </Card>

      <Card className="p-6">
        <CardTitle className="text-xl font-bold mb-4 flex items-center gap-2">
          <ListTodo className="h-5 w-5 text-indigo-600" /> Configurar Planejamento
        </CardTitle>
        <div className="grid gap-4">
          <div>
            <Label htmlFor="task-filter">Filtro de Tarefas (Todoist)</Label>
            <Input
              id="task-filter"
              type="text"
              value={filterInput}
              onChange={(e) => setFilterInput(e.target.value)}
              placeholder="Ex: 'no date & !@agenda & !@foco'"
              className="mt-1"
              disabled={isLoadingCombined}
            />
            <p className="text-sm text-gray-500 mt-1">
              Use a sintaxe de filtro do Todoist para selecionar as tarefas do backlog.
            </p>
          </div>
          <div>
            <Label htmlFor="planning-horizon">Horizonte de Planejamento (dias)</Label>
            <Input
              id="planning-horizon"
              type="number"
              value={planningHorizonDays}
              onChange={(e) => setPlanningHorizonDays(e.target.value)}
              min="1"
              max="30"
              placeholder="Ex: 7"
              className="mt-1"
              disabled={isLoadingCombined}
            />
            <p className="text-sm text-gray-500 mt-1">
              Quantos dias à frente a IA deve tentar planejar as tarefas.
            </p>
          </div>
          <Button
            onClick={handleMassivePlanning}
            className="w-full py-3 text-lg bg-green-600 hover:bg-green-700 text-white flex items-center justify-center gap-2"
            disabled={isLoadingCombined || recurringBlocks.length === 0 || !filterInput.trim()}
          >
            {isLoadingCombined ? (
              <LoadingSpinner size={20} className="text-white" />
            ) : (
              <Play className="h-5 w-5" />
            )}
            Iniciar Planejamento Massivo
          </Button>
        </div>
      </Card>

      {planningSummary && (
        <Card className="mt-6 p-6">
          <CardTitle className="text-xl font-bold mb-4 flex items-center gap-2">
            <ListTodo className="h-5 w-5 text-indigo-600" /> Resumo do Planejamento
          </CardTitle>
          <CardContent className="grid gap-2">
            <p className="text-lg text-gray-700">
              Tarefas planejadas: <span className="font-semibold text-green-600">{planningSummary.planned}</span>
            </p>
            <p className="text-lg text-gray-700">
              Tarefas remanejadas: <span className="font-semibold text-orange-600">{planningSummary.displaced}</span>
            </p>
            <p className="text-lg text-gray-700">
              Tarefas puladas: <span className="font-semibold text-red-600">{planningSummary.skipped}</span>
            </p>
            <p className="text-sm text-gray-500 mt-2">
              As tarefas puladas não puderam ser encaixadas nos blocos de tempo disponíveis ou não atenderam aos critérios.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default MassivePlanner;