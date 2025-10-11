"use client";

import React, { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CalendarIcon, PlusCircle, Trash2, Clock, Briefcase, Home, ListTodo, XCircle, Lightbulb, Filter, CalendarCheck, Ban } from "lucide-react"; // Adicionado Ban icon
import { format, parseISO, startOfDay, addMinutes, isWithinInterval, parse, setHours, setMinutes, addHours, addDays, getDay, isBefore, isEqual, startOfMinute, isValid } from "date-fns"; // Adicionado isValid
import { ptBR } from "date-fns/locale";
import { DaySchedule, TimeBlock, TimeBlockType, ScheduledTask, TodoistTask, InternalTask, RecurringTimeBlock, DayOfWeek, TodoistProject, Project } from "@/lib/types"; // Importar Project
import TimeSlotPlanner from "@/components/TimeSlot/TimeSlotPlanner";
import { toast } from "sonner";
import { cn, getTaskCategory } from "@/lib/utils"; // Importar getTaskCategory
import { useTodoist } from "@/context/TodoistContext";
import { getInternalTasks, updateInternalTask } from "@/utils/internalTaskStorage"; // Importar updateInternalTask
import { getProjects } from "@/utils/projectStorage"; // Importar getProjects
import LoadingSpinner from "@/components/ui/loading-spinner";
import PlannerPromptEditor from "@/components/PlannerPromptEditor"; // Importar o novo editor de prompt

const PLANNER_STORAGE_KEY = "planner_schedules_v2"; // Updated storage key for new structure
const MEETING_PROJECT_NAME = "📅 Reuniões"; // Nome do projeto de reuniões
const PLANNER_AI_PROMPT_STORAGE_KEY = "planner_ai_prompt"; // Nova chave para o prompt da IA do Planejador

const defaultPlannerAiPrompt = `**AGENTE DE SUGESTÃO DE SLOTS DO PLANEJADOR**
**MISSÃO:** Sua missão é sugerir o melhor slot de 15 minutos para uma tarefa no calendário, considerando a categoria da tarefa (Pessoal/Profissional), sua prioridade, os blocos de tempo definidos (Trabalho, Pessoal, Pausa) e o horário atual.

**REGRAS DE PONTUAÇÃO (Prioridade Alta = Pontuação Alta):**
1.  **Correspondência de Categoria/Tipo de Bloco (Base):**
    *   Tarefa Profissional em Bloco de Trabalho: +10 pontos
    *   Tarefa Pessoal em Bloco Pessoal: +10 pontos
    *   Tarefa sem categoria definida em qualquer bloco de Trabalho/Pessoal: +5 pontos
2.  **Horário de Pico de Produtividade (06h-10h):**
    *   Tarefa Profissional em Bloco de Trabalho durante 06h-10h: +5 pontos (bônus)
3.  **Prioridade da Tarefa:**
    *   P1 (Urgente): +8 pontos
    *   P2 (Alto): +6 pontos
    *   P3 (Médio): +4 pontos
    *   P4 (Baixo): +2 pontos
4.  **Proximidade da Data:**
    *   Hoje: +200 pontos
    *   Amanhã: +100 pontos
    *   Cada dia adicional no futuro: -10 pontos
5.  **Horário do Dia:**
    *   Slots mais cedo no dia (após o horário atual) são ligeiramente preferidos.
6.  **Penalidades:**
    *   Slot que não se encaixa em nenhum bloco de tempo adequado (se houver blocos definidos): -5 pontos
    *   Slots que se sobrepõem a blocos de "Pausa" são **estritamente proibidos** e devem ser ignorados.
    *   Não sugerir slots no passado.

**COMPORTAMENTO ADICIONAL:**
*   Se a tarefa não tiver categoria definida, priorize blocos de trabalho por padrão.
*   Sempre verifique conflitos com tarefas já agendadas. Slots conflitantes devem ser ignorados.
*   Se nenhum bloco de tempo for definido para o dia, qualquer slot disponível é considerado "adequado" (com uma pequena pontuação base).
*   A sugestão deve ser para o slot mais próximo possível no futuro que atenda aos critérios, começando pelo dia selecionado e avançando até 7 dias.
`;

const PRIORITY_COLORS: Record<1 | 2 | 3 | 4, string> = {
  4: "bg-red-500", // P1 - Urgente
  3: "bg-orange-500", // P2 - Alto
  2: "bg-yellow-500", // P3 - Médio
  1: "bg-gray-400", // P4 - Baixo
};

const PRIORITY_LABELS: Record<1 | 2 | 3 | 4, string> = {
  4: "P1",
  3: "P2",
  1: "P3",
  2: "P4",
};

const Planejador = () => {
  const { fetchTasks, fetchProjects, updateTask, fetchTaskById, isLoading: isLoadingTodoist } = useTodoist(); // Adicionar fetchTaskById
  const [selectedDate, setSelectedDate] = useState<Date>(startOfDay(new Date()));
  const [schedules, setSchedules] = useState<Record<string, DaySchedule>>({}); // Key: YYYY-MM-DD for date-specific blocks and scheduled tasks
  const [recurringBlocks, setRecurringBlocks] = useState<RecurringTimeBlock[]>([]); // New state for recurring blocks
  const [newBlockStart, setNewBlockStart] = useState("09:00");
  const [newBlockEnd, setNewBlockEnd] = useState("17:00");
  const [newBlockType, setNewBlockType] = useState<TimeBlockType>("work");
  const [newBlockLabel, setNewBlockLabel] = useState("");
  const [newBlockRecurrence, setNewBlockRecurrence] = useState<"daily" | "dayOfWeek" | "weekdays" | "weekend">("daily"); // New state for recurrence type
  const [newBlockDayOfWeek, setNewBlockDayOfWeek] = useState<DayOfWeek>("1"); // Default to Monday (1)
  const [backlogTasks, setBacklogTasks] = useState<(TodoistTask | InternalTask)[]>([]);
  const [selectedTaskToSchedule, setSelectedTaskToSchedule] = useState<(TodoistTask | InternalTask) | null>(null);
  const [isLoadingBacklog, setIsLoadingBacklog] = useState(false);
  const [suggestedSlot, setSuggestedSlot] = useState<{ start: string; end: string; date: string } | null>(null);
  const [ignoredMeetingTaskIds, setIgnoredMeetingTaskIds] = useState<string[]>([]); // Novo estado para IDs de reuniões ignoradas
  
  // Novos estados temporários para a tarefa selecionada
  const [tempEstimatedDuration, setTempEstimatedDuration] = useState<string>("15");
  const [tempSelectedCategory, setTempSelectedCategory] = useState<"pessoal" | "profissional" | "none">("none");
  const [tempSelectedPriority, setTempSelectedPriority] = useState<1 | 2 | 3 | 4>(1); // Default to P4

  const [filterInput, setFilterInput] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('planejador_filter_input') || "";
    }
    return "";
  });

  const [meetingProjectId, setMeetingProjectId] = useState<string | null>(null);
  const [isPreallocatingMeetings, setIsPreallocatingMeetings] = useState(false);

  // Novos estados para o filtro de projetos Shitsuke
  const [shitsukeProjects, setShitsukeProjects] = useState<Project[]>([]);
  const [selectedShitsukeProjectId, setSelectedShitsukeProjectId] = useState<string | 'all'>('all');

  // Estado para o prompt da IA do Planejador
  const [plannerAiPrompt, setPlannerAiPrompt] = useState<string>(defaultPlannerAiPrompt);

  // Load Shitsuke projects on mount
  useEffect(() => {
    setShitsukeProjects(getProjects());
  }, []);

  // Save filter to localStorage whenever it changes
  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('planejador_filter_input', filterInput);
    }
  }, [filterInput]);

  // Load schedules and recurring blocks from localStorage
  useEffect(() => {
    try {
      const storedData = localStorage.getItem(PLANNER_STORAGE_KEY);
      if (storedData) {
        const parsedData = JSON.parse(storedData);
        setSchedules(parsedData.schedules || {});
        setRecurringBlocks(parsedData.recurringBlocks || []);
        setIgnoredMeetingTaskIds(parsedData.ignoredMeetingTaskIds || []); // Carregar IDs de reuniões ignoradas
      }
    } catch (error) {
      console.error("Failed to load planner schedules from localStorage", error);
      toast.error("Erro ao carregar agendamentos do planejador.");
    }
  }, []);

  // Save schedules and recurring blocks to localStorage whenever they change
  useEffect(() => {
    localStorage.setItem(PLANNER_STORAGE_KEY, JSON.stringify({ schedules, recurringBlocks, ignoredMeetingTaskIds })); // Salvar IDs de reuniões ignoradas
  }, [schedules, recurringBlocks, ignoredMeetingTaskIds]);

  // Load/Save Planner AI Prompt
  useEffect(() => {
    const savedPrompt = localStorage.getItem(PLANNER_AI_PROMPT_STORAGE_KEY);
    if (savedPrompt) {
      setPlannerAiPrompt(savedPrompt);
    }
  }, []);

  const handleSavePlannerAiPrompt = useCallback((newPrompt: string) => {
    setPlannerAiPrompt(newPrompt);
    localStorage.setItem(PLANNER_AI_PROMPT_STORAGE_KEY, newPrompt);
  }, []);

  // Fetch projects and identify meeting project ID
  useEffect(() => {
    const getMeetingProjectId = async () => {
      const projects = await fetchProjects();
      const meetingProject = projects.find(p => p.name === MEETING_PROJECT_NAME);
      if (meetingProject) {
        setMeetingProjectId(meetingProject.id);
      } else {
        toast.warning(`Projeto "${MEETING_PROJECT_NAME}" não encontrado no Todoist.`);
        setMeetingProjectId(null);
      }
    };
    getMeetingProjectId();
  }, [fetchProjects]);

  const getCombinedTimeBlocksForDate = useCallback((date: Date): TimeBlock[] => {
    const dateKey = format(date, "yyyy-MM-dd");
    const dayOfWeek = getDay(date).toString() as DayOfWeek; // 0 for Sunday, 1 for Monday, etc.

    const dateSpecificBlocks = schedules[dateKey]?.timeBlocks || [];
    const recurringBlocksForDay = recurringBlocks.filter(block => block.dayOfWeek === dayOfWeek);

    // Combine and sort, giving priority to date-specific blocks if they overlap
    const combined = [...dateSpecificBlocks, ...recurringBlocksForDay];
    return combined.sort((a, b) => a.start.localeCompare(b.start));
  }, [schedules, recurringBlocks]);

  const currentDaySchedule: DaySchedule = {
    date: format(selectedDate, "yyyy-MM-dd"),
    timeBlocks: getCombinedTimeBlocksForDate(selectedDate),
    scheduledTasks: schedules[format(selectedDate, "yyyy-MM-dd")]?.scheduledTasks || [],
  };

  const fetchBacklogTasks = useCallback(async () => {
    setIsLoadingBacklog(true);
    try {
      let todoistFilter = filterInput.trim() || undefined;
      let includeSubtasksForTodoist = false; // Default

      let shitsukeProjectMainTaskId: string | null = null;
      let shitsukeProjectTodoistProjectId: string | null = null;

      if (selectedShitsukeProjectId !== 'all') {
        const selectedProject = shitsukeProjects.find(p => p.id === selectedShitsukeProjectId);
        if (selectedProject && selectedProject.todoistTaskId) {
          shitsukeProjectMainTaskId = selectedProject.todoistTaskId;
          const mainTodoistTask = await fetchTaskById(shitsukeProjectMainTaskId);
          if (mainTodoistTask) {
            shitsukeProjectTodoistProjectId = mainTodoistTask.project_id;
            includeSubtasksForTodoist = true; // Include subtasks for Shitsuke projects
            if (shitsukeProjectTodoistProjectId) {
              // Add project_id filter to Todoist API call
              todoistFilter = todoistFilter ? `${todoistFilter} & #${shitsukeProjectTodoistProjectId}` : `#${shitsukeProjectTodoistProjectId}`;
            }
          } else {
            toast.error("Tarefa principal do projeto Shitsuke não encontrada no Todoist.");
            setBacklogTasks([]);
            setIsLoadingBacklog(false);
            return;
          }
        } else {
          toast.info("Projeto Shitsuke selecionado não tem tarefa principal vinculada no Todoist.");
          setBacklogTasks([]);
          setIsLoadingBacklog(false);
          return;
        }
      }

      const todoistTasks = await fetchTasks(todoistFilter, { includeSubtasks: includeSubtasksForTodoist, includeRecurring: false }); 
      const internalTasks = getInternalTasks();

      let combinedBacklog = [
        ...(todoistTasks || []),
        ...internalTasks.filter(task => !task.isCompleted)
      ];

      // Apply Shitsuke project specific filtering if a project is selected
      if (selectedShitsukeProjectId !== 'all' && shitsukeProjectMainTaskId) {
        combinedBacklog = combinedBacklog.filter(task => {
          if ('project_id' in task) { // It's a TodoistTask
            return task.id === shitsukeProjectMainTaskId || task.parent_id === shitsukeProjectMainTaskId;
          }
          return false; // Internal tasks are not part of Todoist Shitsuke projects
        });
      }

      // Filter out tasks that are already scheduled (Todoist tasks only)
      const allScheduledTodoistTaskIds = Object.values(schedules).flatMap(day => 
        day.scheduledTasks
          .filter(st => st.originalTask && 'project_id' in st.originalTask)
          .map(st => st.originalTask?.id)
      );

      const filteredBacklog = combinedBacklog.filter(task => {
        if ('project_id' in task) { // It's a TodoistTask
          // Exclude tasks from the meeting project if they have a due_datetime
          if (meetingProjectId && task.project_id === meetingProjectId && task.due?.datetime) {
            // Also exclude if it's an ignored meeting task
            return !ignoredMeetingTaskIds.includes(task.id);
          }
          // Exclude tasks already scheduled
          return !allScheduledTodoistTaskIds.includes(task.id);
        }
        return true; // Keep internal tasks unless completed
      });

      // Nova lógica de ordenação
      const sortedBacklog = filteredBacklog.sort((a, b) => {
        // 1. Tarefas iniciadas com "*" primeiro
        const isAStarred = a.content.startsWith("*");
        const isBStarred = b.content.startsWith("*");
        if (isAStarred && !isBStarred) return -1;
        if (!isAStarred && isBStarred) return 1;

        // 2. Em seguida, por prioridade (P1 > P4)
        const priorityA = 'priority' in a ? a.priority : 1; // Internal tasks default to P4
        const priorityB = 'priority' in b ? b.priority : 1;
        if (priorityA !== priorityB) return priorityB - priorityA;

        // 3. Depois, por prazo (due date/time > due date)
        const getTaskDateValue = (task: TodoistTask | InternalTask) => {
          if ('due' in task && task.due?.datetime) return parseISO(task.due.datetime).getTime();
          if ('due' in task && task.due?.date) return parseISO(task.due.date).getTime();
          return Infinity; // Tarefas sem prazo vão para o final
        };

        const dateA = getTaskDateValue(a);
        const dateB = getTaskDateValue(b);

        if (dateA !== dateB) {
          return dateA - dateB; // Mais próximo primeiro
        }

        // 4. Desempate final: por data de criação (mais antiga primeiro)
        const createdAtA = 'createdAt' in a ? parseISO(a.createdAt).getTime() : ('created_at' in a ? parseISO(a.created_at).getTime() : Infinity);
        const createdAtB = 'createdAt' in b ? parseISO(b.createdAt).getTime() : ('created_at' in b ? parseISO(b.created_at).getTime() : Infinity);
        return createdAtA - createdAtB;
      });

      setBacklogTasks(sortedBacklog);
    } catch (error) {
      console.error("Erro ao carregar backlog de tarefas:", error);
      toast.error("Falha ao carregar tarefas do backlog.");
    } finally {
      setIsLoadingBacklog(false);
    }
  }, [fetchTasks, filterInput, meetingProjectId, schedules, ignoredMeetingTaskIds, selectedShitsukeProjectId, shitsukeProjects, fetchTaskById]); // Adicionar selectedShitsukeProjectId e shitsukeProjects como dependências

  useEffect(() => {
    fetchBacklogTasks();
  }, [fetchBacklogTasks]);

  // Efeito para sincronizar selectedTaskToSchedule com backlogTasks
  useEffect(() => {
    if (selectedTaskToSchedule && backlogTasks.length > 0) {
      const updatedSelectedTask = backlogTasks.find(
        (task) => task.id === selectedTaskToSchedule.id
      );
      if (updatedSelectedTask && updatedSelectedTask !== selectedTaskToSchedule) {
        // Se a tarefa foi atualizada no backlog, atualize selectedTaskToSchedule e seus estados temporários
        setSelectedTaskToSchedule(updatedSelectedTask);
        setTempEstimatedDuration(String(updatedSelectedTask.estimatedDurationMinutes || 15));
        const initialCategory = getTaskCategory(updatedSelectedTask);
        setTempSelectedCategory(initialCategory || "none");
        const initialPriority = 'priority' in updatedSelectedTask ? updatedSelectedTask.priority : 1;
        setTempSelectedPriority(initialPriority);
        toast.info(`Detalhes da tarefa selecionada atualizados no planejador.`);
      }
    }
  }, [backlogTasks, selectedTaskToSchedule]); // Depende de backlogTasks e selectedTaskToSchedule

  const handleAddBlock = useCallback(() => {
    if (!newBlockStart || !newBlockEnd) {
      toast.error("Por favor, defina o início e o fim do bloco.");
      return;
    }

    const baseBlock = {
      id: Date.now().toString(), // Ensure unique ID for all blocks
      start: newBlockStart,
      end: newBlockEnd,
      type: newBlockType,
      label: newBlockLabel.trim() || undefined,
    };

    if (newBlockRecurrence === "daily") {
      setSchedules((prevSchedules) => {
        const dateKey = format(selectedDate, "yyyy-MM-dd");
        const currentDay = prevSchedules[dateKey] || { date: dateKey, timeBlocks: [], scheduledTasks: [] };
        const updatedBlocks = [...currentDay.timeBlocks, baseBlock].sort((a, b) => a.start.localeCompare(b.start));
        return {
          ...prevSchedules,
          [dateKey]: { ...currentDay, timeBlocks: updatedBlocks },
        };
      });
      toast.success("Bloco de tempo diário adicionado!");
    } else if (newBlockRecurrence === "dayOfWeek") {
      const newRecurringBlock: RecurringTimeBlock = {
        ...baseBlock,
        dayOfWeek: newBlockDayOfWeek,
      };
      setRecurringBlocks((prev) => [...prev, newRecurringBlock].sort((a, b) => a.dayOfWeek.localeCompare(b.dayOfWeek) || a.start.localeCompare(b.start)));
      toast.success(`Bloco de tempo recorrente para ${DayOfWeekNames[newBlockDayOfWeek]} adicionado!`);
    } else if (newBlockRecurrence === "weekdays") {
      const weekdays: DayOfWeek[] = ["1", "2", "3", "4", "5"]; // Monday to Friday
      const newBlocks = weekdays.map(day => ({
        id: `${Date.now()}-${day}`, // Unique ID for each block
        ...baseBlock,
        dayOfWeek: day,
      }));
      setRecurringBlocks((prev) => [...prev, ...newBlocks].sort((a, b) => a.dayOfWeek.localeCompare(b.dayOfWeek) || a.start.localeCompare(b.start)));
      toast.success("Blocos de tempo adicionados para todos os dias de semana!");
    } else if (newBlockRecurrence === "weekend") {
      const weekendDays: DayOfWeek[] = ["0", "6"]; // Sunday and Saturday
      const newBlocks = weekendDays.map(day => ({
        id: `${Date.now()}-${day}`, // Unique ID for each block
        ...baseBlock,
        dayOfWeek: day,
      }));
      setRecurringBlocks((prev) => [...prev, ...newBlocks].sort((a, b) => a.dayOfWeek.localeCompare(b.dayOfWeek) || a.start.localeCompare(b.start)));
      toast.success("Blocos de tempo adicionados para o fim de semana!");
    }

    setNewBlockStart("09:00");
    setNewBlockEnd("17:00");
    setNewBlockLabel("");
  }, [selectedDate, newBlockStart, newBlockEnd, newBlockType, newBlockLabel, newBlockRecurrence, newBlockDayOfWeek, schedules]);

  const handleDeleteBlock = useCallback((blockId: string, isRecurring: boolean) => {
    if (isRecurring) {
      setRecurringBlocks((prev) => prev.filter((block) => block.id !== blockId));
      toast.info("Bloco de tempo recorrente removido.");
    } else {
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
      toast.info("Bloco de tempo diário removido.");
    }
  }, [selectedDate]);

  const handleDateChange = (date: Date | undefined) => {
    if (date) {
      setSelectedDate(startOfDay(date));
      setSelectedTaskToSchedule(null);
      setSuggestedSlot(null);
      // Reset temporary states when date changes
      setTempEstimatedDuration("15");
      setTempSelectedCategory("none");
      setTempSelectedPriority(1);
    }
  };

  const handleSelectBacklogTask = useCallback((task: TodoistTask | InternalTask) => {
    setSelectedTaskToSchedule(task);
    setTempEstimatedDuration(String(task.estimatedDurationMinutes || 15));
    setSuggestedSlot(null);
    
    // Set initial category for temp state
    const initialCategory = getTaskCategory(task);
    setTempSelectedCategory(initialCategory || "none");

    // Set initial priority for temp state
    const initialPriority = 'priority' in task ? task.priority : 1;
    setTempSelectedPriority(initialPriority);

    toast.info(`Tarefa "${task.content}" selecionada para agendamento.`);
  }, []);

  const handleCancelTaskSelection = useCallback(() => {
    setSelectedTaskToSchedule(null);
    setSuggestedSlot(null);
    setTempEstimatedDuration("15");
    setTempSelectedCategory("none");
    setTempSelectedPriority(1);
    toast.info("Seleção de tarefa cancelada.");
  }, []);

  const scheduleTask = useCallback(async (task: TodoistTask | InternalTask, start: string, end: string, targetDate: Date, isPreallocated: boolean = false) => {
    const dateKey = format(targetDate, "yyyy-MM-dd");
    const currentDay = schedules[dateKey] || { date: dateKey, timeBlocks: [], scheduledTasks: [] };
    
    const durationMinutes = parseInt(tempEstimatedDuration, 10) || 15;

    // --- Atualizar a tarefa original no Todoist ou no armazenamento interno ---
    if ('project_id' in task) { // É uma TodoistTask
      const newLabels: string[] = task.labels.filter(
        label => label !== "pessoal" && label !== "profissional"
      );
      if (tempSelectedCategory === "pessoal") {
        newLabels.push("pessoal");
      } else if (tempSelectedCategory === "profissional") {
        newLabels.push("profissional");
      }

      // Only update if not preallocated, or if preallocated but needs specific updates
      if (!isPreallocated) {
        const updatedTodoistTask = await updateTask(task.id, {
          priority: tempSelectedPriority,
          labels: newLabels,
          duration: durationMinutes,
          duration_unit: "minute",
          due_date: format(targetDate, "yyyy-MM-dd"),
          due_datetime: format(parse((start || ''), "HH:mm", targetDate), "yyyy-MM-dd'T'HH:mm:ss"),
        });

        if (!updatedTodoistTask) {
          toast.error("Falha ao atualizar a tarefa no Todoist.");
          return;
        }
        // Atualizar a tarefa no backlog local para refletir as mudanças
        setBacklogTasks(prev => prev.map(t => t.id === updatedTodoistTask.id ? updatedTodoistTask : t));
      }

    } else { // É uma InternalTask
      const updatedInternalTask: InternalTask = {
        ...task,
        category: tempSelectedCategory === "none" ? task.category : tempSelectedCategory,
        estimatedDurationMinutes: durationMinutes,
      };
      updateInternalTask(updatedInternalTask);
      // Atualizar a tarefa no backlog local para refletir as mudanças
      setBacklogTasks(prev => prev.map(t => t.id === updatedInternalTask.id ? updatedInternalTask : t));
    }
    // --- Fim da atualização da tarefa original ---

    const newScheduledTask: ScheduledTask = {
      id: `${task.id}-${Date.now()}`,
      taskId: task.id,
      content: task.content,
      description: task.description,
      start: start,
      end: end,
      priority: tempSelectedPriority,
      category: tempSelectedCategory === "none" ? (getTaskCategory(task) || "pessoal") : tempSelectedCategory,
      estimatedDurationMinutes: durationMinutes,
      originalTask: task,
    };

    setSchedules((prevSchedules) => {
      const updatedScheduledTasks = [...currentDay.scheduledTasks, newScheduledTask].sort((a, b) => a.start.localeCompare(b.start));
      return {
        ...prevSchedules,
        [dateKey]: { ...currentDay, scheduledTasks: updatedScheduledTasks },
      };
    });

    if (!isPreallocated) {
      toast.success(`Tarefa "${task.content}" agendada para ${start}-${end} em ${format(targetDate, "dd/MM", { locale: ptBR })} e atualizada!`);
    }
    setSelectedTaskToSchedule(null);
    setSuggestedSlot(null);
    setTempEstimatedDuration("15");
    setTempSelectedCategory("none");
    setTempSelectedPriority(1);
    fetchBacklogTasks(); // Re-fetch and re-sort the backlog after scheduling
  }, [schedules, tempEstimatedDuration, tempSelectedCategory, tempSelectedPriority, updateTask, updateInternalTask, fetchBacklogTasks]);

  const handleDeleteScheduledTask = useCallback(async (taskToDelete: ScheduledTask) => { // Tornar assíncrono
    setSchedules((prevSchedules) => {
      const dateKey = format(selectedDate, "yyyy-MM-dd");
      const currentDay = prevSchedules[dateKey];
      if (!currentDay) return prevSchedules;

      const updatedScheduledTasks = currentDay.scheduledTasks.filter(
        (task) => task.id !== taskToDelete.id
      );
      return {
        ...prevSchedules,
        [dateKey]: { ...currentDay, scheduledTasks: updatedScheduledTasks },
      };
    });
    
    // Se a tarefa deletada for uma reunião pré-alocada, adicione-a à lista de ignorados
    if (taskToDelete.originalTask && 'project_id' in taskToDelete.originalTask && taskToDelete.originalTask.project_id === meetingProjectId) {
      setIgnoredMeetingTaskIds(prev => [...new Set([...prev, taskToDelete.originalTask!.id])]);
      toast.info(`Reunião "${taskToDelete.content}" removida da agenda e não será pré-alocada novamente.`);
      // Não selecionamos para o backlog automaticamente se for uma reunião ignorada
    } else if (taskToDelete.originalTask && 'project_id' in taskToDelete.originalTask) { // É uma TodoistTask normal
      // Limpar a data de vencimento e o horário no Todoist
      await updateTask(taskToDelete.originalTask.id, {
        due_date: null,
        due_datetime: null,
      });
      toast.info(`Tarefa "${taskToDelete.content}" removida da agenda e data de vencimento limpa no Todoist.`);
      handleSelectBacklogTask(taskToDelete.originalTask); // Colocar de volta no backlog para reagendamento manual
    } else if (taskToDelete.originalTask) { // É uma InternalTask
      handleSelectBacklogTask(taskToDelete.originalTask);
      toast.info(`Tarefa "${taskToDelete.content}" removida da agenda e pronta para ser reagendada.`);
    } else {
      toast.info(`Tarefa "${taskToDelete.content}" removida da agenda.`);
    }
    fetchBacklogTasks(); // Refresh backlog to potentially show the task again if it was a Todoist task
  }, [selectedDate, fetchBacklogTasks, handleSelectBacklogTask, meetingProjectId, ignoredMeetingTaskIds, updateTask]); // Adicionar updateTask como dependência

  const handleClearIgnoredMeetings = useCallback(() => {
    setIgnoredMeetingTaskIds([]);
    toast.success("Lista de reuniões ignoradas limpa. Elas podem ser pré-alocadas novamente.");
    fetchBacklogTasks(); // Refresh backlog to potentially show them again
  }, [fetchBacklogTasks]);

  const handleSelectSlot = useCallback(async (time: string, type: TimeBlockType) => { // Tornar assíncrono
    if (!selectedTaskToSchedule) {
      toast.info("Selecione uma tarefa do backlog primeiro para agendar.");
      return;
    }

    const now = new Date();
    const slotStartDateTime = parse(time, "HH:mm", selectedDate);

    // Prevenir agendamento no passado
    if (isBefore(slotStartDateTime, now) && !isEqual(startOfDay(slotStartDateTime), startOfDay(now))) {
      toast.error("Não é possível agendar tarefas para um horário ou dia que já passou.");
      return;
    }
    // Allow scheduling for current day, but not for past times on current day
    if (isEqual(startOfDay(slotStartDateTime), startOfDay(now)) && isBefore(slotStartDateTime, startOfMinute(now))) {
      toast.error("Não é possível agendar tarefas para um horário que já passou hoje.");
      return;
    }


    const durationMinutes = parseInt(tempEstimatedDuration, 10) || 15;
    const slotStart = parse(time, "HH:mm", selectedDate);
    let slotEnd = addMinutes(slotStart, durationMinutes); // `addMinutes` handles crossing midnight correctly
    const slotEndStr = format(slotEnd, "HH:mm");

    const dateKey = format(selectedDate, "yyyy-MM-dd");
    const currentDay = schedules[dateKey] || { date: dateKey, timeBlocks: [], scheduledTasks: [] };
    const hasConflict = currentDay.scheduledTasks.some(st => {
      const stStart = parse(st.start, "HH:mm", selectedDate);
      const stEnd = parse(st.end, "HH:mm", selectedDate);
      return (isWithinInterval(slotStart, { start: stStart, end: stEnd }) ||
              isWithinInterval(slotEnd, { start: stStart, end: stEnd }) ||
              (slotStart <= stStart && slotEnd >= stEnd));
    });

    if (hasConflict) {
      toast.error("Este slot já está ocupado por outra tarefa agendada.");
      return;
    }

    const taskCategory = tempSelectedCategory === "none" ? (selectedTaskToSchedule ? getTaskCategory(selectedTaskToSchedule) : undefined) : tempSelectedCategory; // Usar a categoria temporária
    const combinedBlocks = getCombinedTimeBlocksForDate(selectedDate);

    let isOverlappingBreak = false;
    let fitsInAppropriateBlock = false;

    for (const block of combinedBlocks) {
      const blockStart = parse(block.start, "HH:mm", selectedDate);
      let blockEnd = parse(block.end, "HH:mm", selectedDate);
      // Adjust blockEnd if it crosses midnight (e.g., 23:00 to 00:00)
      if (isBefore(blockEnd, blockStart)) {
        blockEnd = addDays(blockEnd, 1);
      }

      // Check for overlap with ANY break block
      if (block.type === "break" && (
          isWithinInterval(slotStart, { start: blockStart, end: blockEnd }) ||
          isWithinInterval(slotEnd, { start: blockStart, end: blockEnd }) ||
          (slotStart <= blockStart && slotEnd >= blockEnd)
      )) {
        isOverlappingBreak = true;
        break; // Found an overlapping break, no need to check further blocks
      }

      // Check for fit in appropriate category block
      if (slotStart >= blockStart && slotEnd <= blockEnd) {
        if (taskCategory === "profissional" && block.type === "work") {
          fitsInAppropriateBlock = true;
        } else if (taskCategory === "pessoal" && block.type === "personal") {
          fitsInAppropriateBlock = true;
        }
      }
    }

    if (isOverlappingBreak) {
      toast.error("Não é possível agendar tarefas em blocos de pausa.");
      return;
    }

    if (!fitsInAppropriateBlock && combinedBlocks.length > 0) {
      toast.warning("O slot selecionado não está dentro de um bloco de tempo adequado para a categoria da tarefa.");
      // Allow scheduling if no appropriate block, but warn.
      // For strictness, we could add 'return' here. For now, it's a warning.
    } else if (combinedBlocks.length === 0) {
      fitsInAppropriateBlock = true; // If no blocks defined, any slot is considered appropriate
    }


    await scheduleTask(selectedTaskToSchedule, time, slotEndStr, selectedDate); // Chamar scheduleTask assincronamente
    fetchBacklogTasks(); // Refresh backlog after scheduling
  }, [selectedTaskToSchedule, tempEstimatedDuration, tempSelectedCategory, selectedDate, scheduleTask, schedules, getCombinedTimeBlocksForDate, fetchBacklogTasks]);

  const suggestTimeSlot = useCallback(async () => { // Tornar assíncrono
    if (!selectedTaskToSchedule) {
      toast.error("Selecione uma tarefa do backlog para sugerir um slot.");
      return;
    }

    // --- Nova trava: Obrigar classificação antes de sugerir ---
    if (tempSelectedCategory === "none") {
      toast.error("Por favor, classifique a tarefa como 'Pessoal' ou 'Profissional' antes de sugerir um slot.");
      return;
    }
    // --- Fim da trava ---

    const durationMinutes = parseInt(tempEstimatedDuration, 10) || 15;
    const taskCategory = tempSelectedCategory === "none" ? (selectedTaskToSchedule ? getTaskCategory(selectedTaskToSchedule) : undefined) : tempSelectedCategory; // Usar a categoria temporária
    const taskPriority = tempSelectedPriority; // Usar a prioridade temporária

    let bestSlot: { start: string; end: string; date: string } | null = null;
    let bestScore = -Infinity;

    const NUM_DAYS_TO_LOOK_AHEAD = 7;
    const now = new Date();
    const startOfToday = startOfDay(now);

    for (let dayOffset = 0; dayOffset < NUM_DAYS_TO_LOOK_AHEAD; dayOffset++) {
      const currentDayDate = addDays(selectedDate, dayOffset);
      const startOfCurrentDay = startOfDay(currentDayDate);

      // Pular dias que já passaram
      if (isBefore(startOfCurrentDay, startOfToday)) {
        continue;
      }

      const currentDayDateKey = format(currentDayDate, "yyyy-MM-dd");
      
      const combinedBlocksForSuggestion = getCombinedTimeBlocksForDate(currentDayDate);
      const scheduledTasksForSuggestion = schedules[currentDayDateKey]?.scheduledTasks || [];

      let startHour = 0;
      let startMinute = 0;

      // Se for o dia atual, começar a partir do início do bloco de 15 minutos atual
      if (isEqual(startOfCurrentDay, startOfToday)) {
        const currentTotalMinutes = now.getHours() * 60 + now.getMinutes();
        startHour = Math.floor(currentTotalMinutes / 60);
        startMinute = Math.floor((currentTotalMinutes % 60) / 15) * 15;
      }

      for (let hour = startHour; hour < 24; hour++) {
        for (let minute = (hour === startHour ? startMinute : 0); minute < 60; minute += 15) {
          const slotStart = setMinutes(setHours(currentDayDate, hour), minute);
          let slotEnd = addMinutes(slotStart, durationMinutes); // `addMinutes` handles crossing midnight correctly
          const slotStartStr = format(slotStart, "HH:mm");
          const slotEndStr = format(slotEnd, "HH:mm");

          // Pular slots que já passaram (considerando o final do slot)
          if (isBefore(slotEnd, now)) {
            continue;
          }

          // --- Nova trava: Ignorar slots que se sobrepõem a blocos de pausa ---
          let isOverlappingBreak = false;
          for (const block of combinedBlocksForSuggestion) {
            if (block.type === "break") {
              const blockStart = parse(block.start, "HH:mm", currentDayDate);
              let blockEnd = parse(block.end, "HH:mm", currentDayDate);
              if (isBefore(blockEnd, blockStart)) {
                blockEnd = addDays(blockEnd, 1);
              }
              if (isWithinInterval(slotStart, { start: blockStart, end: blockEnd }) ||
                  isWithinInterval(slotEnd, { start: blockStart, end: blockEnd }) ||
                  (slotStart <= blockStart && slotEnd >= blockEnd)) {
                isOverlappingBreak = true;
                break;
              }
            }
          }
          if (isOverlappingBreak) {
            continue; // Pular este slot completamente
          }
          // --- Fim da trava de pausa ---

          const hasConflict = scheduledTasksForSuggestion.some(st => {
            const stStart = parse(st.start, "HH:mm", currentDayDate);
            const stEnd = parse(st.end, "HH:mm", currentDayDate);
            return (isWithinInterval(slotStart, { start: stStart, end: stEnd }) ||
                    isWithinInterval(slotEnd, { start: stStart, end: stEnd }) ||
                    (slotStart <= stStart && slotEnd >= stEnd));
          });
          if (hasConflict) continue;

          let currentSlotScore = 0;
          let fitsInAppropriateBlock = false;

          // --- Lógica de pontuação baseada no prompt da IA ---
          // 1. Correspondência de Categoria/Tipo de Bloco (Base)
          for (const block of combinedBlocksForSuggestion) {
            if (block.type === "break") continue; // Já filtramos blocos de pausa acima

            const blockStart = parse(block.start, "HH:mm", currentDayDate);
            let blockEnd = parse(block.end, "HH:mm", currentDayDate);
            if (isBefore(blockEnd, blockStart)) {
              blockEnd = addDays(blockEnd, 1);
            }

            if (slotStart >= blockStart && slotEnd <= blockEnd) {
              let isCategoryMatch = false;
              if (taskCategory === "profissional" && block.type === "work") {
                isCategoryMatch = true;
                currentSlotScore += 10; // +10 pontos para Profissional em Trabalho
              } else if (taskCategory === "pessoal" && block.type === "personal") {
                isCategoryMatch = true;
                currentSlotScore += 10; // +10 pontos para Pessoal em Pessoal
              } else if (taskCategory === undefined && (block.type === "work" || block.type === "personal")) {
                // Tarefa sem categoria definida em qualquer bloco de Trabalho/Pessoal
                isCategoryMatch = true;
                currentSlotScore += 5; // +5 pontos
              }

              if (isCategoryMatch) {
                fitsInAppropriateBlock = true;

                // 2. Horário de Pico de Produtividade (06h-10h)
                if (block.type === "work" && taskCategory === "profissional" &&
                    slotStart.getHours() >= 6 && slotStart.getHours() < 10) {
                  currentSlotScore += 5; // +5 pontos de bônus
                }
                break;
              }
            }
          }

          // Penalidade se não se encaixa em nenhum bloco adequado (se houver blocos definidos)
          if (!fitsInAppropriateBlock && combinedBlocksForSuggestion.length > 0) {
            currentSlotScore -= 5; // -5 pontos
          } else if (combinedBlocksForSuggestion.length === 0) {
            fitsInAppropriateBlock = true; // Se nenhum bloco definido, qualquer slot é considerado adequado
            currentSlotScore += 5; // Pequeno bônus se não há blocos definidos
          }

          // 3. Prioridade da Tarefa
          switch (taskPriority) {
            case 4: currentSlotScore += 8; break; // P1
            case 3: currentSlotScore += 6; break; // P2
            case 2: currentSlotScore += 4; break; // P3
            case 1: currentSlotScore += 2; break; // P4
          }

          // 4. Proximidade da Data
          if (isEqual(currentDayDate, startOfToday)) {
            currentSlotScore += 200; // Hoje
          } else if (isEqual(currentDayDate, addDays(startOfToday, 1))) {
            currentSlotScore += 100; // Amanhã
          } else {
            currentSlotScore -= dayOffset * 10; // Cada dia adicional no futuro: -10 pontos
          }

          // 5. Horário do Dia (slots mais cedo são ligeiramente preferidos)
          currentSlotScore -= (hour * 60 + minute) / 100;

          if (currentSlotScore > bestScore) {
            bestScore = currentSlotScore;
            bestSlot = { start: slotStartStr, end: slotEndStr, date: currentDayDateKey };
          }
        }
      }
    }

    if (bestSlot) {
      setSuggestedSlot(bestSlot);
      toast.success(`Slot sugerido: ${bestSlot.start} - ${bestSlot.end} em ${format(parseISO(bestSlot.date), "dd/MM", { locale: ptBR })}`);
    } else {
      setSuggestedSlot(null);
      toast.error("Não foi possível encontrar um slot adequado para esta tarefa nos próximos 7 dias.");
    }
  }, [selectedTaskToSchedule, selectedDate, schedules, tempEstimatedDuration, tempSelectedCategory, tempSelectedPriority, getCombinedTimeBlocksForDate, plannerAiPrompt]); // Adicionar plannerAiPrompt como dependência

  useEffect(() => {
    if (selectedTaskToSchedule) {
      setTempEstimatedDuration(String(selectedTaskToSchedule.estimatedDurationMinutes || 15));
      const initialCategory = getTaskCategory(selectedTaskToSchedule);
      setTempSelectedCategory(initialCategory || "none");
      const initialPriority = 'priority' in selectedTaskToSchedule ? selectedTaskToSchedule.priority : 1;
      setTempSelectedPriority(initialPriority);
    }
  }, [selectedTaskToSchedule]);

  const preallocateMeetingTasks = useCallback(async () => {
    if (!meetingProjectId) {
      toast.error(`Projeto "${MEETING_PROJECT_NAME}" não encontrado. Não é possível pré-alocar reuniões.`);
      return;
    }
    setIsPreallocatingMeetings(true);
    toast.loading("Pré-alocando reuniões...");

    try {
      // Fetch all tasks, including subtasks and recurring, for meetings
      const allTodoistTasks = await fetchTasks(undefined, { includeSubtasks: true, includeRecurring: true }); 
      const meetingTasks = allTodoistTasks.filter(
        task => task.project_id === meetingProjectId && task.due?.datetime && !ignoredMeetingTaskIds.includes(task.id) // Filtrar reuniões ignoradas
      );

      let allocatedCount = 0;
      const newSchedules = { ...schedules };

      for (const task of meetingTasks) {
        const taskDueDateTime = parseISO(task.due!.datetime!);
        if (!isValid(taskDueDateTime)) { // Adicionar verificação de validade
          console.warn(`Skipping invalid meeting task due date: ${task.content}`);
          continue;
        }
        const taskDateKey = format(taskDueDateTime, "yyyy-MM-dd");
        const taskStartTime = format(taskDueDateTime, "HH:mm");
        const taskEndTime = format(addMinutes(taskDueDateTime, 30), "HH:mm"); // Default 30 min duration

        // Check for conflicts before scheduling
        const currentDayScheduledTasks = newSchedules[taskDateKey]?.scheduledTasks || [];
        const hasConflict = currentDayScheduledTasks.some(st => {
          const stStart = parse(st.start, "HH:mm", taskDueDateTime);
          const stEnd = parse(st.end, "HH:mm", taskDueDateTime);
          const proposedStart = parse(taskStartTime, "HH:mm", taskDueDateTime);
          const proposedEnd = parse(taskEndTime, "HH:mm", taskDueDateTime);

          return (isWithinInterval(proposedStart, { start: stStart, end: stEnd }) ||
                  isWithinInterval(proposedEnd, { start: stStart, end: stEnd }) ||
                  (proposedStart <= stStart && proposedEnd >= stEnd));
        });

        // Check if already scheduled
        const alreadyScheduled = currentDayScheduledTasks.some(st => st.originalTask?.id === task.id);

        if (!hasConflict && !alreadyScheduled) {
          const newScheduledTask: ScheduledTask = {
            id: `${task.id}-${Date.now()}`,
            taskId: task.id,
            content: task.content,
            description: task.description,
            start: taskStartTime,
            end: taskEndTime,
            priority: task.priority,
            category: getTaskCategory(task) || "profissional", // Meetings are usually professional
            estimatedDurationMinutes: 30,
            originalTask: task,
          };

          if (!newSchedules[taskDateKey]) {
            newSchedules[taskDateKey] = { date: taskDateKey, timeBlocks: [], scheduledTasks: [] };
          }
          newSchedules[taskDateKey].scheduledTasks.push(newScheduledTask);
          newSchedules[taskDateKey].scheduledTasks.sort((a, b) => a.start.localeCompare(b.start));
          allocatedCount++;
        }
      }
      setSchedules(newSchedules);
      toast.success(`Pré-alocadas ${allocatedCount} reuniões.`);
      fetchBacklogTasks(); // Refresh backlog to remove allocated meetings
    } catch (error) {
      console.error("Erro ao pré-alocar reuniões:", error);
      toast.error("Falha ao pré-alocar reuniões.");
    } finally {
      setIsPreallocatingMeetings(false);
    }
  }, [meetingProjectId, fetchTasks, schedules, fetchBacklogTasks, ignoredMeetingTaskIds]); // Adicionar ignoredMeetingTaskIds como dependência


  const isLoading = isLoadingTodoist || isLoadingBacklog || isPreallocatingMeetings;

  const DayOfWeekNames: Record<DayOfWeek, string> = {
    "0": "Domingo",
    "1": "Segunda-feira",
    "2": "Terça-feira",
    "3": "Quarta-feira",
    "4": "Quinta-feira",
    "5": "Sexta-feira",
    "6": "Sábado",
  };

  // Helper to set day of week for date-fns
  const setDay = (date: Date, day: number) => {
    const currentDay = date.getDay();
    const diff = day - currentDay;
    return addDays(date, diff);
  };

  // Group recurring blocks for display
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
          {block.type === "break" && <Clock className="inline-block h-4 w-4 mr-1 text-yellow-600" />}
          {block.label || (block.type === "work" ? "Trabalho" : block.type === "personal" ? "Pessoal" : "Pausa")}
          <span className="ml-2 text-gray-400">({dayDisplay})</span>
        </span>
        <Button variant="ghost" size="icon" onClick={() => handleDeleteBlock(block.id, true)}>
          <Trash2 className="h-4 w-4 text-red-500" />
        </Button>
      </div>
    );
  };


  return (
    <div className="p-4 grid grid-cols-1 lg:grid-cols-3 gap-6">
      <div className="lg:col-span-2">
        <h2 className="text-3xl font-bold mb-2 text-gray-800">🗓️ PLANEJADOR - Sequenciamento de Tarefas</h2>
        <p className="text-lg text-gray-600 mb-6">
          Defina seus blocos de tempo e organize suas tarefas em intervalos de 15 minutos.
        </p>

        <div className="mb-6 flex items-center gap-4">
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
          <Button
            onClick={preallocateMeetingTasks}
            disabled={!meetingProjectId || isLoading}
            className="bg-blue-600 hover:bg-blue-700 text-white flex items-center gap-2"
          >
            {isPreallocatingMeetings ? (
              <LoadingSpinner size={20} className="text-white" />
            ) : (
              <CalendarCheck className="h-4 w-4" />
            )}
            Pré-alocar Reuniões
          </Button>
          {ignoredMeetingTaskIds.length > 0 && (
            <Button
              onClick={handleClearIgnoredMeetings}
              variant="outline"
              className="flex items-center gap-2 text-red-600 border-red-600 hover:bg-red-50"
            >
              <Ban className="h-4 w-4" /> Limpar Ignorados ({ignoredMeetingTaskIds.length})
            </Button>
          )}
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
            <div className="md:col-span-2">
              <Label htmlFor="block-recurrence">Recorrência</Label>
              <Select value={newBlockRecurrence} onValueChange={(value: "daily" | "dayOfWeek" | "weekdays" | "weekend") => setNewBlockRecurrence(value)}>
                <SelectTrigger className="w-full mt-1">
                  <SelectValue placeholder="Recorrência" />
                </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="daily">Apenas nesta data</SelectItem>
                    <SelectItem value="dayOfWeek">Todo(a) ...</SelectItem>
                    <SelectItem value="weekdays">Todos os dias de semana</SelectItem>
                    <SelectItem value="weekend">Todos os fins de semana</SelectItem>
                  </SelectContent>
              </Select>
            </div>
            {newBlockRecurrence === "dayOfWeek" && (
              <div className="md:col-span-2">
                <Label htmlFor="block-day-of-week">Dia da Semana</Label>
                <Select value={newBlockDayOfWeek} onValueChange={(value: DayOfWeek) => setNewBlockDayOfWeek(value)}>
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
            <Button onClick={handleAddBlock} className="md:col-span-4 mt-2">
              <PlusCircle className="h-4 w-4 mr-2" /> Adicionar Bloco
            </Button>
          </div>

          {(currentDaySchedule.timeBlocks.length > 0 || recurringBlocks.length > 0) && (
            <div className="mt-6 space-y-2">
              <h3 className="text-lg font-semibold">Blocos Definidos:</h3>
              {/* Display date-specific blocks */}
              {schedules[format(selectedDate, "yyyy-MM-dd")]?.timeBlocks.map((block) => (
                <div key={block.id} className="flex items-center justify-between p-2 bg-gray-50 rounded-md border">
                  <span className="text-sm">
                    {block.start} - {block.end} |{" "}
                    {block.type === "work" && <Briefcase className="inline-block h-4 w-4 mr-1 text-green-600" />}
                    {block.type === "personal" && <Home className="inline-block h-4 w-4 mr-1 text-blue-600" />}
                    {block.type === "break" && <Clock className="inline-block h-4 w-4 mr-1 text-yellow-600" />}
                    {block.label || (block.type === "work" ? "Trabalho" : block.type === "personal" ? "Pessoal" : "Pausa")}
                    <span className="ml-2 text-gray-400">(Nesta data)</span>
                  </span>
                  <Button variant="ghost" size="icon" onClick={() => handleDeleteBlock(block.id, false)}>
                    <Trash2 className="h-4 w-4 text-red-500" />
                  </Button>
                </div>
              ))}
              {/* Display grouped recurring blocks */}
              {Object.values(groupedRecurringBlocks).map(renderRecurringBlockDisplay)}
            </div>
          )}
        </Card>

        <TimeSlotPlanner
          daySchedule={currentDaySchedule}
          onSelectSlot={handleSelectSlot}
          onSelectTask={handleDeleteScheduledTask}
          suggestedSlotStart={suggestedSlot && suggestedSlot.date === format(selectedDate, "yyyy-MM-dd") ? suggestedSlot.start : null}
          suggestedSlotEnd={suggestedSlot && suggestedSlot.date === format(selectedDate, "yyyy-MM-dd") ? suggestedSlot.end : null}
        />
      </div>

      <div className="lg:col-span-1">
        <div className="flex justify-end mb-4">
          <PlannerPromptEditor
            initialPrompt={plannerAiPrompt}
            onSave={handleSavePlannerAiPrompt}
            storageKey={PLANNER_AI_PROMPT_STORAGE_KEY}
          />
        </div>
        <Card className="h-full">
          <CardHeader>
            <CardTitle className="text-xl font-bold text-gray-800 flex items-center gap-2">
              <ListTodo className="h-5 w-5 text-indigo-600" /> Backlog de Tarefas
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="mb-4">
              <Label htmlFor="shitsuke-project-filter" className="text-sm text-gray-600 font-medium">
                Filtrar por Projeto Shitsuke
              </Label>
              <Select
                value={selectedShitsukeProjectId}
                onValueChange={(value: string | 'all') => setSelectedShitsukeProjectId(value)}
                disabled={isLoading}
              >
                <SelectTrigger className="w-full mt-1">
                  <SelectValue placeholder="Todos os Projetos Shitsuke" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os Projetos Shitsuke</SelectItem>
                  {shitsukeProjects.map(project => (
                    <SelectItem key={project.id} value={project.id}>
                      {project.what}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
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
                      fetchBacklogTasks();
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
                <div className="grid grid-cols-2 gap-2 mt-2">
                  <div>
                    <Label htmlFor="temp-category" className="text-sm text-indigo-800">Categoria:</Label>
                    <Select value={tempSelectedCategory} onValueChange={(value: "pessoal" | "profissional" | "none") => setTempSelectedCategory(value)}>
                      <SelectTrigger className="w-full mt-1">
                        <SelectValue placeholder="Categoria" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="pessoal">Pessoal</SelectItem>
                        <SelectItem value="profissional">Profissional</SelectItem>
                        <SelectItem value="none">Manter Categoria</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="temp-priority" className="text-sm text-indigo-800">Prioridade:</Label>
                    <Select value={String(tempSelectedPriority)} onValueChange={(value) => setTempSelectedPriority(Number(value) as 1 | 2 | 3 | 4)}>
                      <SelectTrigger className="w-full mt-1">
                        <SelectValue placeholder="Prioridade" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="4">P1 - Urgente</SelectItem>
                        <SelectItem value="3">P2 - Alto</SelectItem>
                        <SelectItem value="2">P3 - Médio</SelectItem>
                        <SelectItem value="1">P4 - Baixo</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="flex items-center gap-2 mt-2">
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
                      Sugestão: {suggestedSlot.start} - {suggestedSlot.end} ({format(parseISO(suggestedSlot.date), "dd/MM", { locale: ptBR })})
                    </span>
                    <Button size="sm" onClick={() => scheduleTask(selectedTaskToSchedule, suggestedSlot.start, suggestedSlot.end, parseISO(suggestedSlot.date))}>
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
                      <div className="flex items-center gap-2">
                        <span
                          className={cn(
                            "px-2 py-0.5 rounded-full text-white text-xs font-medium",
                            PRIORITY_COLORS['priority' in task ? task.priority : 1],
                          )}
                        >
                          {PRIORITY_LABELS['priority' in task ? task.priority : 1]}
                        </span>
                        <span className="text-gray-600">
                          {'labels' in task ? (getTaskCategory(task) || 'N/A') : task.category}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        {/* Removido: {'deadline' in task && task.deadline?.date && ( ... )} */}
                        {'due' in task && task.due?.datetime && isValid(parseISO(task.due.datetime)) && (
                          <span>Venc: {format(parseISO(task.due.datetime), "dd/MM HH:mm", { locale: ptBR })}</span>
                        )}
                        {'due' in task && task.due?.date && !('due' in task && task.due?.datetime) && isValid(parseISO(task.due.date)) && (
                          <span>Venc: {format(parseISO(task.due.date), "dd/MM", { locale: ptBR })}</span>
                        )}
                        <span className="flex items-center">
                          <Clock className="h-3 w-3 mr-1" /> {task.estimatedDurationMinutes || 15} min
                        </span>
                      </div>
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