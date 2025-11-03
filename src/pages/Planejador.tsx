"use client";

import React, { useState, useEffect, useCallback, useRef, useImperativeHandle, ForwardedRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CalendarIcon, PlusCircle, Trash2, Clock, Briefcase, Home, ListTodo, XCircle, Lightbulb, Filter, CalendarCheck, Ban, RotateCcw, Eraser, SortAsc, ExternalLink } from "lucide-react";
import { format, parseISO, startOfDay, addMinutes, isWithinInterval, parse, setHours, setMinutes, addHours, addDays, getDay, isBefore, isEqual, startOfMinute, isValid } from "date-fns";
import { ptBR } from "date-fns/locale";
import { DaySchedule, TimeBlock, TimeBlockType, ScheduledTask, TodoistTask, InternalTask, RecurringTimeBlock, DayOfWeek, TodoistProject, Project, SeitonStateSnapshot } from "@/lib/types";
import TimeSlotPlanner from "@/components/TimeSlot/TimeSlotPlanner"; // Caminho corrigido
import { toast } from "sonner";
import { cn, getTaskCategory } from "@/lib/utils";
import { useTodoist } from "@/context/TodoistContext";
import { getInternalTasks, updateInternalTask } from "@/utils/internalTaskStorage";
import { getProjects } from "@/utils/projectStorage";
import LoadingSpinner from "@/components/ui/loading-spinner";
import PlannerPromptEditor from "@/components/PlannerPromptEditor";
import PlannerAIAssistant, { PlannerAIAssistantRef } from "@/components/PlannerAIAssistant";

const PLANNER_STORAGE_KEY = "planner_schedules_v2";
const MEETING_PROJECT_NAME = "📅 Reuniões";
const PLANNER_AI_PROMPT_STORAGE_KEY = "planner_ai_prompt";
const SEITON_RANKING_STORAGE_KEY = "seitonTournamentState"; // Adicionado
const CRONOGRAMA_HOJE_LABEL = "📆 Cronograma de hoje"; // Nova constante para a etiqueta

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
  3: "P2", // Corrected from P4
  2: "P3", // Corrected from P3
  1: "P4", // Corrected from P3
};

const DayOfWeekNames: Record<DayOfWeek, string> = {
  "0": "Domingo",
  "1": "Segunda-feira",
  "2": "Terça-feira",
  "3": "Quarta-feira",
  "4": "Quinta-feira",
  "5": "Sexta-feira",
  "6": "Sábado",
};

const Planejador = () => {
  const { fetchTasks, fetchProjects, updateTask, fetchTaskById, isLoading: isLoadingTodoist } = useTodoist();
  const [selectedDate, setSelectedDate] = useState<Date>(startOfDay(new Date()));
  const [schedules, setSchedules] = useState<Record<string, DaySchedule>>({});
  const [recurringBlocks, setRecurringBlocks] = useState<RecurringTimeBlock[]>([]);
  const [newBlockStart, setNewBlockStart] = useState("09:00");
  const [newBlockEnd, setNewBlockEnd] = useState("17:00");
  const [newBlockType, setNewBlockType] = useState<TimeBlockType>("work");
  const [newBlockLabel, setNewBlockLabel] = useState("");
  const [newBlockRecurrence, setNewBlockRecurrence] = useState<"daily" | "dayOfWeek" | "weekdays" | "weekend">("daily");
  const [newBlockDayOfWeek, setNewBlockDayOfWeek] = useState<DayOfWeek>("1");
  const [backlogTasks, setBacklogTasks] = useState<(TodoistTask | InternalTask)[]>([]);
  const [selectedTaskToSchedule, setSelectedTaskToSchedule] = useState<(TodoistTask | InternalTask) | null>(null);
  const [isLoadingBacklog, setIsLoadingBacklog] = useState(false);
  const [suggestedSlot, setSuggestedSlot] = useState<{ start: string; end: string; date: string; displacedTask?: ScheduledTask } | null>(null);
  const [ignoredMeetingTaskIds, setIgnoredMeetingTaskIds] = useState<string[]>([]);
  
  const [tempEstimatedDuration, setTempEstimatedDuration] = useState<string>("15");
  const [tempSelectedCategory, setTempSelectedCategory] = useState<"pessoal" | "profissional" | "none">("none");
  const [tempSelectedPriority, setTempSelectedPriority] = useState<1 | 2 | 3 | 4>(1);

  const [filterInput, setFilterInput] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('planejador_filter_input') || "";
    }
    return "";
  });

  const [meetingProjectId, setMeetingProjectId] = useState<string | null>(null);
  const [isPreallocatingMeetings, setIsPreallocatingMeetings] = useState(false);

  const [shitsukeProjects, setShitsukeProjects] = useState<Project[]>([]);
  const [selectedShitsukeProjectId, setSelectedShitsukeProjectId] = useState<string | 'all'>('all');

  const [plannerAiPrompt, setPlannerAiPrompt] = useState<string>(defaultPlannerAiPrompt);
  const [seitonRankedTasks, setSeitonRankedTasks] = useState<TodoistTask[]>([]); // Estado para tarefas ranqueadas do Seiton
  const [backlogSortOrder, setBacklogSortOrder] = useState<"default" | "seiton">("default"); // Novo estado para ordem do backlog

  // Ref para o componente PlannerAIAssistant para chamar métodos
  const plannerAIAssistantRef = useRef<PlannerAIAssistantRef>(null);

  useEffect(() => {
    setShitsukeProjects(getProjects());
  }, []);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('planejador_filter_input', filterInput);
    }
  }, [filterInput]);

  useEffect(() => {
    try {
      const storedData = localStorage.getItem(PLANNER_STORAGE_KEY);
      if (storedData) {
        const parsedData = JSON.parse(storedData);
        setSchedules(parsedData.schedules || {});
        setRecurringBlocks(parsedData.recurringBlocks || []);
        setIgnoredMeetingTaskIds(parsedData.ignoredMeetingTaskIds || []);
      }
    } catch (error) {
      console.error("Failed to load planner schedules from localStorage", error);
      toast.error("Erro ao carregar agendamentos do planejador.");
    }
  }, []);

  useEffect(() => {
    localStorage.setItem(PLANNER_STORAGE_KEY, JSON.stringify({ schedules, recurringBlocks, ignoredMeetingTaskIds }));
  }, [schedules, recurringBlocks, ignoredMeetingTaskIds]);

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

  // Load Seiton ranked tasks
  useEffect(() => {
    const loadSeitonRanking = () => {
      let loadedState: SeitonStateSnapshot = {
        tasksToProcess: [],
        rankedTasks: [],
        currentTaskToPlace: null,
        comparisonCandidate: null,
        comparisonIndex: 0,
        tournamentState: "initial",
        selectedPrioritizationContext: "none",
        customSortingPreferences: { primary: "deadline", secondary: "priority", tertiary: "due_date_time" },
      };
      try {
        const savedSeitonState = localStorage.getItem(SEITON_RANKING_STORAGE_KEY);
        if (savedSeitonState) {
          const parsed = JSON.parse(savedSeitonState);
          loadedState = { ...loadedState, ...parsed };
        }
        if (loadedState.rankedTasks && loadedState.rankedTasks.length > 0) {
          setSeitonRankedTasks(loadedState.rankedTasks);
        } else {
          setSeitonRankedTasks([]);
        }
      } catch (e) {
        console.error("Planejador: Failed to load or parse Seiton state from localStorage. Error:", e);
        localStorage.removeItem(SEITON_RANKING_STORAGE_KEY);
        toast.error("Erro ao carregar ranking do Seiton. Dados corrompidos foram removidos.");
        setSeitonRankedTasks([]);
      }
    };
    loadSeitonRanking();
    window.addEventListener('storage', loadSeitonRanking);
    return () => window.removeEventListener('storage', loadSeitonRanking);
  }, []);

  const getCombinedTimeBlocksForDate = useCallback((date: Date): TimeBlock[] => {
    const dateKey = format(date, "yyyy-MM-dd");
    const dayOfWeek = getDay(date).toString() as DayOfWeek;

    const dateSpecificBlocks = schedules[dateKey]?.timeBlocks || [];
    const recurringBlocksForDay = recurringBlocks.filter(block => block.dayOfWeek === dayOfWeek);

    const combined = [...dateSpecificBlocks, ...recurringBlocksForDay];
    return combined.sort((a, b) => a.start.localeCompare(b.start));
  }, [schedules, recurringBlocks]);

  const currentDaySchedule: DaySchedule = {
    date: format(selectedDate, "yyyy-MM-dd"),
    timeBlocks: getCombinedTimeBlocksForDate(selectedDate),
    scheduledTasks: schedules[format(selectedDate, "yyyy-MM-dd")]?.scheduledTasks || [],
  };

  const sortBacklogTasks = useCallback((tasks: (TodoistTask | InternalTask)[]): (TodoistTask | InternalTask)[] => {
    if (backlogSortOrder === "seiton") {
      // Create a map for quick lookup of Seiton rank
      const seitonRankMap = new Map<string, number>();
      seitonRankedTasks.forEach((task, index) => seitonRankMap.set(task.id, index));

      // Sort by Seiton rank, then by default criteria for tasks not in Seiton ranking
      return [...tasks].sort((a, b) => {
        const rankA = seitonRankMap.get(a.id);
        const rankB = seitonRankMap.get(b.id);

        if (rankA !== undefined && rankB !== undefined) {
          return rankA - rankB; // Both in Seiton ranking
        }
        if (rankA !== undefined) return -1; // A is in Seiton, B is not
        if (rankB !== undefined) return 1; // B is in Seiton, A is not

        // Fallback to default sorting if neither is in Seiton ranking
        // 1. Starred tasks first
        const isAStarred = a.content.startsWith("*");
        const isBStarred = b.content.startsWith("*");
        if (isAStarred && !isBStarred) return -1;
        if (!isAStarred && isBStarred) return 1;

        // Helper to get date value, handling null/undefined and invalid dates
        const getDateValue = (task: TodoistTask | InternalTask, dateField: 'deadline' | 'due_datetime' | 'due_date' | 'createdAt' | 'created_at') => {
          let dateString: string | null | undefined;
          if (dateField === 'deadline' && 'deadline' in task) dateString = task.deadline;
          else if (dateField === 'due_datetime' && 'due' in task) dateString = task.due?.datetime;
          else if (dateField === 'due_date' && 'due' in task) dateString = task.due?.date;
          else if (dateField === 'createdAt' && 'createdAt' in task) dateString = task.createdAt;
          else if (dateField === 'created_at' && 'created_at' in task) dateString = task.created_at;
          
          if (typeof dateString === 'string' && dateString) {
            const parsedDate = parseISO(dateString);
            return isValid(parsedDate) ? parsedDate.getTime() : Infinity;
          }
          return Infinity;
        };

        // 2. Deadline: earliest first
        const deadlineA = getDateValue(a, 'deadline');
        const deadlineB = getDateValue(b, 'deadline');
        if (deadlineA !== deadlineB) {
          return deadlineA - deadlineB;
        }

        // 3. Priority: P1 (4) > P2 (3) > P3 (2) > P4 (1)
        const priorityA = 'priority' in a ? a.priority : 1;
        const priorityB = 'priority' in b ? b.priority : 1;
        if (priorityA !== priorityB) return priorityB - priorityA;

        // 4. Due date/time: earliest first
        const dueDateTimeA = getDateValue(a, 'due_datetime');
        const dueDateTimeB = getDateValue(b, 'due_datetime');
        if (dueDateTimeA !== dueDateTimeB) {
          return dueDateTimeA - dueDateTimeB;
        }

        const dueDateA = getDateValue(a, 'due_date');
        const dueDateB = getDateValue(b, 'due_date');
        if (dueDateA !== dueDateB) { 
          return dueDateA - dueDateB;
        }

        // 5. Created at: earliest first (tie-breaker)
        const createdAtA = getDateValue(a, 'createdAt');
        const createdAtB = getDateValue(b, 'createdAt');
        if (createdAtA !== createdAtB) {
          return createdAtA - createdAtB;
        }
        return 0;
      });
    } else { // Default sorting
      return [...tasks].sort((a, b) => {
        // 1. Starred tasks first
        const isAStarred = a.content.startsWith("*");
        const isBStarred = b.content.startsWith("*");
        if (isAStarred && !isBStarred) return -1;
        if (!isAStarred && isBStarred) return 1;

        // Helper to get date value, handling null/undefined and invalid dates
        const getDateValue = (task: TodoistTask | InternalTask, dateField: 'deadline' | 'due_datetime' | 'due_date' | 'createdAt' | 'created_at') => {
          let dateString: string | null | undefined;
          if (dateField === 'deadline' && 'deadline' in task) dateString = task.deadline;
          else if (dateField === 'due_datetime' && 'due' in task) dateString = task.due?.datetime;
          else if (dateField === 'due_date' && 'due' in task) dateString = task.due?.date;
          else if (dateField === 'createdAt' && 'createdAt' in task) dateString = task.createdAt;
          else if (dateField === 'created_at' && 'created_at' in task) dateString = task.created_at;
          
          if (typeof dateString === 'string' && dateString) {
            const parsedDate = parseISO(dateString);
            return isValid(parsedDate) ? parsedDate.getTime() : Infinity;
          }
          return Infinity;
        };

        // 2. Deadline: earliest first
        const deadlineA = getDateValue(a, 'deadline');
        const deadlineB = getDateValue(b, 'deadline');
        if (deadlineA !== deadlineB) {
          return deadlineA - deadlineB;
        }

        // 3. Priority: P1 (4) > P2 (3) > P3 (2) > P4 (1)
        const priorityA = 'priority' in a ? a.priority : 1;
        const priorityB = 'priority' in b ? b.priority : 1;
        if (priorityA !== priorityB) return priorityB - priorityA;

        // 4. Due date/time: earliest first
        const dueDateTimeA = getDateValue(a, 'due_datetime');
        const dueDateTimeB = getDateValue(b, 'due_datetime');
        if (dueDateTimeA !== dueDateTimeB) {
          return dueDateTimeA - dueDateTimeB;
        }

        const dueDateA = getDateValue(a, 'due_date');
        const dueDateB = getDateValue(b, 'due_date');
        if (dueDateA !== dueDateB) { 
          return dueDateA - dueDateB;
        }

        // 5. Created at: earliest first (tie-breaker)
        const createdAtA = getDateValue(a, 'createdAt');
        const createdAtB = getDateValue(b, 'createdAt');
        if (createdAtA !== createdAtB) {
          return createdAtA - createdAtB;
        }
        return 0;
      });
    }
  }, [backlogSortOrder, seitonRankedTasks]);

  const fetchBacklogTasks = useCallback(async () => {
    setIsLoadingBacklog(true);
    try {
      let todoistFilter = filterInput.trim() || undefined;
      let includeSubtasksForTodoist = false;

      let shitsukeProjectMainTaskId: string | null = null;
      let shitsukeProjectTodoistProjectId: string | null = null;

      if (selectedShitsukeProjectId !== 'all') {
        const selectedProject = shitsukeProjects.find(p => p.id === selectedShitsukeProjectId);
        if (selectedProject && selectedProject.todoistTaskId) {
          shitsukeProjectMainTaskId = selectedProject.todoistTaskId;
          const mainTodoistTask = await fetchTaskById(shitsukeProjectMainTaskId);
          if (mainTodoistTask) {
            shitsukeProjectTodoistProjectId = mainTodoistTask.project_id;
            includeSubtasksForTodoist = true;
            if (shitsukeProjectTodoistProjectId) {
              todoistFilter = todoistFilter ? `${todoistFilter} & #${shitsukeProjectTodoistProjectId}` : `#${shitsukeProjectTodoistProjectId}`;
            }
          } else {
            toast.error("Tarefa principal do projeto 5W2H não encontrada no Todoist.");
            setBacklogTasks([]);
            setIsLoadingBacklog(false);
            return;
          }
        } else {
          toast.info("Projeto 5W2H selecionado não tem tarefa principal vinculada no Todoist.");
          setBacklogTasks([]);
          setIsLoadingBacklog(false);
          return;
        }
      }

      // fetchTasks now defaults to !is_completed, so no explicit filter needed here
      const todoistTasks = await fetchTasks(todoistFilter, { includeSubtasks: includeSubtasksForTodoist, includeRecurring: false }); 
      const internalTasks = getInternalTasks();

      let combinedBacklog = [
        ...(todoistTasks || []).map(task => ({ 
          ...task, 
          isMeeting: task.content.startsWith('*') || (meetingProjectId !== null && task.project_id === meetingProjectId) 
        })), // Identify meetings
        ...internalTasks.filter(task => !task.isCompleted)
      ];

      if (selectedShitsukeProjectId !== 'all' && shitsukeProjectMainTaskId) {
        combinedBacklog = combinedBacklog.filter(task => {
          if ('project_id' in task) {
            // CORREÇÃO: Usar parentId na opção de fetchTasks, mas manter a lógica de filtro aqui
            // Se a tarefa principal do projeto 5W2H foi carregada, queremos apenas ela e suas subtarefas.
            return task.id === shitsukeProjectMainTaskId || task.parent_id === shitsukeProjectMainTaskId;
          }
          return false;
        });
      }

      // Collect ALL scheduled task IDs (Todoist and Internal)
      const allScheduledTaskIds = Object.values(schedules).flatMap(day => 
        day.scheduledTasks.map(st => st.taskId)
      );

      const filteredBacklog = combinedBacklog.filter(task => {
        // Filter out tasks that are already scheduled
        if (allScheduledTaskIds.includes(task.id)) {
          return false;
        }
        // Special handling for ignored meeting tasks
        if ('project_id' in task && meetingProjectId && task.project_id === meetingProjectId) {
          return !ignoredMeetingTaskIds.includes(task.id);
        }
        return true;
      });

      const sortedBacklog = sortBacklogTasks(filteredBacklog); // Apply the new sorting function

      setBacklogTasks(sortedBacklog);
    } catch (error) {
      console.error("Erro ao carregar backlog de tarefas:", error);
      toast.error("Falha ao carregar tarefas do backlog.");
    } finally {
      setIsLoadingBacklog(false);
    }
  }, [fetchTasks, filterInput, meetingProjectId, schedules, ignoredMeetingTaskIds, selectedShitsukeProjectId, shitsukeProjects, fetchTaskById, sortBacklogTasks]); // Add sortBacklogTasks to dependencies

  // NEW: Function to sync scheduled tasks with Todoist status
  const syncScheduledTasks = useCallback(async () => {
    console.log("Planejador: Iniciando sincronização de tarefas agendadas com o Todoist.");
    let changesMadeOverall = false; // Flag to track if any changes were made across all dates

    // Fetch all active Todoist tasks once for efficiency
    const allActiveTodoistTasks = await fetchTasks(undefined, { includeSubtasks: true, includeRecurring: true });
    const fetchedTodoistTasksMap = new Map<string, TodoistTask>();
    allActiveTodoistTasks.forEach(task => fetchedTodoistTasksMap.set(task.id, task));

    // Collect all Todoist API updates to perform them after setSchedules
    const todoistUpdates: { taskId: string; data: { labels: string[] } }[] = [];

    setSchedules(prevSchedules => {
      let updatedSchedules = { ...prevSchedules };
      let changesMadeInThisCycle = false;

      for (const dateKey in updatedSchedules) {
        const daySchedule = updatedSchedules[dateKey];
        const originalScheduledTasks = [...daySchedule.scheduledTasks];
        const newScheduledTasks: ScheduledTask[] = [];
        let changesMadeForDay = false;

        for (const scheduledTask of originalScheduledTasks) {
          if (scheduledTask.originalTask && 'project_id' in scheduledTask.originalTask) { // It's a Todoist task
            const todoistTask = fetchedTodoistTasksMap.get(scheduledTask.originalTask.id);

            if (todoistTask === undefined || todoistTask.is_completed) {
              console.log(`Planejador: Tarefa Todoist agendada "${scheduledTask.content}" (ID: ${scheduledTask.taskId}) está concluída ou não existe mais. Removendo da agenda.`);
              changesMadeForDay = true;
              // Check the *fetched* task's labels for CRONOGRAMA_HOJE_LABEL
              if (scheduledTask.originalTask.labels.includes(CRONOGRAMA_HOJE_LABEL)) { // Use originalTask labels for check
                const updatedLabels = scheduledTask.originalTask.labels.filter(label => label !== CRONOGRAMA_HOJE_LABEL);
                todoistUpdates.push({ taskId: scheduledTask.originalTask.id, data: { labels: updatedLabels } });
              }
            } else {
              const scheduledStartDateTime = parse(`${scheduledTask.start}`, "HH:mm", parseISO(dateKey));
              
              let todoistDueDateTime: Date | null = null;
              if (todoistTask.due?.datetime) {
                  todoistDueDateTime = parseISO(todoistTask.due.datetime);
              } else if (todoistTask.due?.date) {
                  todoistDueDateTime = startOfDay(parseISO(todoistTask.due.date));
              }

              const isDueDateTimeMatch = todoistDueDateTime && isValid(todoistDueDateTime) &&
                                          isEqual(scheduledStartDateTime, todoistDueDateTime);
              
              if (!isDueDateTimeMatch) {
                  console.log(`Planejador: Tarefa Todoist agendada "${scheduledTask.content}" (ID: ${scheduledTask.taskId}) tem prazo diferente no Todoist. Removendo da agenda.`);
                  changesMadeForDay = true;
                  if (todoistTask.labels.includes(CRONOGRAMA_HOJE_LABEL)) {
                      const updatedLabels = todoistTask.labels.filter(label => label !== CRONOGRAMA_HOJE_LABEL);
                      todoistUpdates.push({ taskId: todoistTask.id, data: { labels: updatedLabels } });
                  }
              } else {
                  newScheduledTasks.push(scheduledTask);
              }
            }
          } else { // Internal task
            newScheduledTasks.push(scheduledTask);
          }
        }
        if (changesMadeForDay) {
          updatedSchedules[dateKey] = { ...daySchedule, scheduledTasks: newScheduledTasks };
          changesMadeInThisCycle = true;
        }
      }
      if (changesMadeInThisCycle) {
        changesMadeOverall = true;
        return updatedSchedules;
      }
      return prevSchedules;
    });

    // Perform all Todoist API updates after the state has been updated
    if (todoistUpdates.length > 0) {
      console.log(`Planejador: Realizando ${todoistUpdates.length} atualizações de etiquetas no Todoist.`);
      for (const update of todoistUpdates) {
        await updateTask(update.taskId, update.data);
      }
    }

    if (changesMadeOverall) {
      toast.info("Agenda sincronizada com o status das tarefas do Todoist.");
    }
    console.log("Planejador: Sincronização de tarefas agendadas concluída.");
  }, [fetchTasks, updateTask]);


  useEffect(() => {
    const initPlanner = async () => {
      await syncScheduledTasks(); // Primeiro, sincroniza as tarefas agendadas
      fetchBacklogTasks(); // Depois, busca o backlog
    };
    initPlanner();
  }, [syncScheduledTasks, fetchBacklogTasks, backlogSortOrder]); // `selectedDate` é tratado em outro useEffect

  // Também chama syncScheduledTasks quando selectedDate muda para garantir que a visualização atual esteja fresca
  useEffect(() => {
    syncScheduledTasks();
  }, [selectedDate, syncScheduledTasks]);

  useEffect(() => {
    if (selectedTaskToSchedule && backlogTasks.length > 0) {
      const updatedSelectedTask = backlogTasks.find(
        (task) => task.id === selectedTaskToSchedule.id
      );
      if (updatedSelectedTask && updatedSelectedTask !== selectedTaskToSchedule) {
        setSelectedTaskToSchedule(updatedSelectedTask);
        setTempEstimatedDuration(String(updatedSelectedTask.estimatedDurationMinutes || 15));
        const initialCategory = getTaskCategory(updatedSelectedTask);
        setTempSelectedCategory(initialCategory || "none");
        const initialPriority = 'priority' in updatedSelectedTask ? updatedSelectedTask.priority : 1;
        setTempSelectedPriority(initialPriority);
        toast.info(`Detalhes da tarefa selecionada atualizados no planejador.`);
      }
    }
  }, [backlogTasks, selectedTaskToSchedule]);

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
      setTempEstimatedDuration("15");
      setTempSelectedCategory("none");
      setTempSelectedPriority(1);
    }
  };

  const handleSelectBacklogTask = useCallback((task: TodoistTask | InternalTask) => {
    setSelectedTaskToSchedule(task);
    setTempEstimatedDuration(String(task.estimatedDurationMinutes || 15));
    setSuggestedSlot(null);
    
    const initialCategory = getTaskCategory(task);
    setTempSelectedCategory(initialCategory || "none");

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

  const scheduleTask = useCallback(async (task: TodoistTask | InternalTask, start: string, end: string, targetDate: Date, isPreallocated: boolean = false): Promise<ScheduledTask | undefined> => {
    const dateKey = format(targetDate, "yyyy-MM-dd");
    const durationMinutes = ('estimatedDurationMinutes' in task && task.estimatedDurationMinutes) ? task.estimatedDurationMinutes : (parseInt(tempEstimatedDuration, 10) || 15);

    // Determine if the task is a meeting based on project_id or content prefix
    const isTaskMeeting = ('project_id' in task && meetingProjectId !== null && task.project_id === meetingProjectId) || task.content.startsWith('*');

    // For preallocated tasks (meetings), we don't update Todoist or modify global state directly here.
    // We just prepare the scheduled task object and return it.
    if (isPreallocated) {
      const newScheduledTask: ScheduledTask = {
        id: `${task.id}-${Date.now()}`, // Unique ID for scheduled instance
        taskId: task.id,
        content: task.content,
        description: task.description,
        start: start,
        end: end,
        priority: ('priority' in task ? task.priority : 1), // Use original task priority for preallocated
        category: getTaskCategory(task) || "profissional", // Meetings are usually professional
        estimatedDurationMinutes: durationMinutes, // Use the calculated duration for meetings
        originalTask: task,
        isMeeting: isTaskMeeting,
      };
      return newScheduledTask; // Return the scheduled task object
    }

    // --- Logic for non-preallocated tasks (manual scheduling) ---
    // This part will only run for manual scheduling
    if ('project_id' in task) { // Todoist task
      const newLabels: string[] = task.labels.filter(
        label => label !== "pessoal" && label !== "profissional"
      );
      if (tempSelectedCategory === "pessoal") {
        newLabels.push("pessoal");
      } else if (tempSelectedCategory === "profissional") {
        newLabels.push("profissional");
      }

      // Add "📆 Cronograma de hoje" label
      if (!newLabels.includes(CRONOGRAMA_HOJE_LABEL)) {
        newLabels.push(CRONOGRAMA_HOJE_LABEL);
      }

      const formattedDueDate = format(targetDate, "yyyy-MM-dd");
      const parsedStartTime = parse((start || ''), "HH:mm", targetDate);
      let finalDueDate: string | null = null;
      let finalDueDateTime: string | null = null;

      if (isValid(parsedStartTime)) {
        finalDueDateTime = format(parsedStartTime, "yyyy-MM-dd'T'HH:mm:ss");
        finalDueDate = null;
      } else {
        finalDueDate = formattedDueDate;
        finalDueDateTime = null;
      }

      const updatedTodoistTask = await updateTask(task.id, {
        priority: tempSelectedPriority,
        labels: newLabels,
        duration: durationMinutes,
        duration_unit: "minute",
        due_date: finalDueDate,
        due_datetime: finalDueDateTime,
      });

      if (!updatedTodoistTask) {
        toast.error("Falha ao atualizar a tarefa no Todoist.");
        return undefined;
      }
      setBacklogTasks(prev => prev.map(t => t.id === updatedTodoistTask.id ? updatedTodoistTask : t));

    } else { // Internal task
      const updatedInternalTask: InternalTask = {
        ...task,
        category: tempSelectedCategory === "none" ? task.category : tempSelectedCategory,
        estimatedDurationMinutes: durationMinutes,
      };
      updateInternalTask(updatedInternalTask);
      setBacklogTasks(prev => prev.map(t => t.id === updatedInternalTask.id ? updatedInternalTask : t));
    }

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
      isMeeting: isTaskMeeting,
    };

    setSchedules((prevSchedules) => {
      const currentDay = prevSchedules[dateKey] || { date: dateKey, timeBlocks: [], scheduledTasks: [] };
      const updatedScheduledTasks = [...currentDay.scheduledTasks, newScheduledTask].sort((a, b) => a.start.localeCompare(b.start));
      return {
        ...prevSchedules,
        [dateKey]: { ...currentDay, scheduledTasks: updatedScheduledTasks },
      };
    });

    toast.success(`Tarefa "${task.content}" agendada para ${start}-${end} em ${format(targetDate, "dd/MM", { locale: ptBR })} e atualizada!`);
    setSelectedTaskToSchedule(null);
    setSuggestedSlot(null);
    setTempEstimatedDuration("15");
    setTempSelectedCategory("none");
    setTempSelectedPriority(1);
    fetchBacklogTasks();
    return newScheduledTask;
  }, [schedules, tempEstimatedDuration, tempSelectedCategory, tempSelectedPriority, updateTask, updateInternalTask, fetchBacklogTasks, meetingProjectId, getTaskCategory]);

  const handleDeleteScheduledTask = useCallback(async (taskToDelete: ScheduledTask, shouldReaddToBacklog: boolean = true) => {
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
    
    if (taskToDelete.originalTask && 'project_id' in taskToDelete.originalTask && taskToDelete.originalTask.project_id === meetingProjectId) {
      setIgnoredMeetingTaskIds(prev => [...new Set([...prev, taskToDelete.originalTask!.id])]);
      toast.info(`Reunião "${taskToDelete.content}" removida da agenda e não será pré-alocada novamente.`);
      setSelectedTaskToSchedule(null); // Clear selection for ignored meetings
    } else if (taskToDelete.originalTask && 'project_id' in taskToDelete.originalTask) { // It's a Todoist task
      // Remove "📆 Cronograma de hoje" label
      const updatedLabels = taskToDelete.originalTask.labels.filter(label => label !== CRONOGRAMA_HOJE_LABEL);
      await updateTask(taskToDelete.originalTask.id, {
        due_date: null,
        due_datetime: null,
        labels: updatedLabels, // Update labels
      });
      toast.info(`Tarefa "${taskToDelete.content}" removida da agenda e data de vencimento limpa no Todoist.`);
      if (shouldReaddToBacklog) {
        handleSelectBacklogTask(taskToDelete.originalTask); // This selects it
      } else {
        setSelectedTaskToSchedule(null);
      }
    } else if (taskToDelete.originalTask && shouldReaddToBacklog) { // Internal task
      handleSelectBacklogTask(taskToDelete.originalTask); // This selects it
      toast.info(`Tarefa "${taskToDelete.content}" removida da agenda e pronta para ser reagendada.`);
    } else { // shouldReaddToBacklog is false, or no originalTask
      toast.info(`Tarefa "${taskToDelete.content}" removida da agenda.`);
      setSelectedTaskToSchedule(null); // Clear selection if not re-adding to backlog or no original task
    }
    fetchBacklogTasks();
  }, [selectedDate, fetchBacklogTasks, handleSelectBacklogTask, meetingProjectId, ignoredMeetingTaskIds, updateTask]);

  const handleClearIgnoredMeetings = useCallback(() => {
    setIgnoredMeetingTaskIds([]);
    toast.success("Lista de reuniões ignoradas limpa. Elas podem ser pré-alocadas novamente.");
    fetchBacklogTasks();
  }, [fetchBacklogTasks]);

  const preallocateMeetingTasks = useCallback(async () => {
    if (!meetingProjectId) {
      toast.error("Projeto de reuniões não configurado. Verifique as configurações do Todoist.");
      return;
    }

    setIsPreallocatingMeetings(true);
    try {
      const filterString = `project:${meetingProjectId} & (due: today | due: tomorrow | due: next 7 days)`;
      const meetingTasksWithDueDate = await fetchTasks(filterString, { includeSubtasks: false, includeRecurring: false });
      let preallocatedCount = 0;
      const newScheduledMeetingsByDate: Record<string, ScheduledTask[]> = {};

      for (const task of meetingTasksWithDueDate) {
        if (ignoredMeetingTaskIds.includes(task.id)) {
          continue;
        }

        const isCurrentTaskMeeting = task.content.startsWith('*') || (meetingProjectId !== null && task.project_id === meetingProjectId);

        if (isCurrentTaskMeeting && task.due?.datetime && isValid(parseISO(task.due.datetime))) {
          const originalDueDateTime = parseISO(task.due.datetime);
          const originalDueDate = startOfDay(originalDueDateTime);
          const originalStartTime = format(originalDueDateTime, "HH:mm");
          const durationMinutes = task.estimatedDurationMinutes || 30;
          const originalEndTime = format(addMinutes(originalDueDateTime, durationMinutes), "HH:mm");
          const originalDateKey = format(originalDueDate, "yyyy-MM-dd");

          const isAlreadyScheduled = schedules[originalDateKey]?.scheduledTasks.some(
            st => st.taskId === task.id && st.start === originalStartTime && st.end === originalEndTime
          );

          if (!isAlreadyScheduled) {
            // Call scheduleTask with isPreallocated: true, it will return the ScheduledTask object
            const scheduledMeeting = await scheduleTask(task, originalStartTime, originalEndTime, originalDueDate, true);
            
            if (scheduledMeeting) {
              if (!newScheduledMeetingsByDate[originalDateKey]) {
                newScheduledMeetingsByDate[originalDateKey] = [];
              }
              newScheduledMeetingsByDate[originalDateKey].push(scheduledMeeting);
              preallocatedCount++;
            }
          }
        }
      }

      // Perform a single, atomic update to schedules
      if (preallocatedCount > 0) {
        setSchedules(prevSchedules => {
          const updatedSchedules = { ...prevSchedules };
          for (const dateKey in newScheduledMeetingsByDate) {
            const existingScheduledTasks = updatedSchedules[dateKey]?.scheduledTasks || [];
            const newMeetingsForDate = newScheduledMeetingsByDate[dateKey];
            updatedSchedules[dateKey] = {
              date: dateKey,
              timeBlocks: updatedSchedules[dateKey]?.timeBlocks || [],
              scheduledTasks: [...existingScheduledTasks, ...newMeetingsForDate].sort((a, b) => a.start.localeCompare(b.start)),
            };
          }
          return updatedSchedules;
        });
        toast.success(`${preallocatedCount} reuniões pré-alocadas com sucesso!`);
      } else {
        toast.info("Nenhuma reunião encontrada para pré-alocar ou todas já estão agendadas.");
      }
    } catch (error) {
      console.error("Erro ao pré-alocar reuniões:", error);
      toast.error("Falha ao pré-alocar reuniões.");
    } finally {
      setIsPreallocatingMeetings(false);
      fetchBacklogTasks(); // Recarregar backlog uma única vez
    }
  }, [meetingProjectId, fetchTasks, ignoredMeetingTaskIds, schedules, scheduleTask, fetchBacklogTasks]);

  const handleSuggestSlot = useCallback(() => {
    console.log("Planejador: handleSuggestSlot called."); // Log de depuração
    if (plannerAIAssistantRef.current) {
      plannerAIAssistantRef.current.triggerSuggestion();
    } else {
      toast.error("O assistente de IA não está pronto. Tente novamente.");
    }
  }, []);

  const handleSelectSlot = useCallback(async (time: string, type: TimeBlockType) => {
    console.log("Planejador: handleSelectSlot - Início.");
    if (!selectedTaskToSchedule) {
      toast.info("Selecione uma tarefa do backlog primeiro para agendar em um slot.");
      return;
    }

    const durationMinutes = parseInt(tempEstimatedDuration, 10) || 15;
    const slotStart = parse(time, "HH:mm", selectedDate);
    const slotEnd = addMinutes(slotStart, durationMinutes);

    if (!isValid(slotStart) || !isValid(slotEnd)) {
      toast.error("Erro ao calcular o slot de tempo. Verifique o formato da hora.");
      console.error("Planejador: handleSelectSlot - slotStart ou slotEnd inválido.");
      return;
    }

    // Check for conflicts with already scheduled tasks in the current day
    const dateKey = format(selectedDate, "yyyy-MM-dd");
    const scheduledTasksForDay = schedules[dateKey]?.scheduledTasks || [];
    const hasConflict = scheduledTasksForDay.some(st => {
      const stStart = parse(st.start, "HH:mm", selectedDate);
      const stEnd = parse(st.end, "HH:mm", selectedDate);
      if (!isValid(stStart) || !isValid(stEnd)) {
        console.warn(`Planejador: handleSelectSlot - Tarefa agendada inválida encontrada: ${st.content}`);
        return false; // Ignore invalid scheduled tasks for conflict check
      }
      
      // Standard overlap check: (start1 < end2 && end1 > start2)
      return (slotStart < stEnd && slotEnd > stStart);
    });

    if (hasConflict) {
      toast.error("Este slot já está ocupado por outra tarefa agendada.");
      console.log("Planejador: handleSelectSlot - Conflito de slot detectado.");
      return;
    }

    // Check for conflicts with break blocks
    const combinedBlocksForDay = getCombinedTimeBlocksForDate(selectedDate);
    const isOverlappingBreak = combinedBlocksForDay.some(block => {
      if (block.type === "break") {
        const blockStart = parse(block.start, "HH:mm", selectedDate);
        const blockEnd = parse(block.end, "HH:mm", selectedDate);
        if (!isValid(blockStart) || !isValid(blockEnd)) {
          console.warn(`Planejador: handleSelectSlot - Bloco de tempo inválido encontrado: ${block.label}`);
          return false; // Ignore invalid time blocks for conflict check
        }
        
        // Standard overlap check: (start1 < end2 && end1 > start2)
        return (slotStart < blockEnd && slotEnd > blockStart);
      }
      return false;
    });

    if (isOverlappingBreak) {
      toast.error("Não é possível agendar em um bloco de pausa.");
      console.log("Planejador: handleSelectSlot - Sobreposição com bloco de pausa detectada.");
      return;
    }

    try {
      console.log("Planejador: handleSelectSlot - Chamando scheduleTask.");
      await scheduleTask(selectedTaskToSchedule, time, format(slotEnd, "HH:mm"), selectedDate);
      console.log("Planejador: handleSelectSlot - scheduleTask concluído com sucesso.");
    } catch (error) {
      console.error("Planejador: handleSelectSlot - Erro ao agendar tarefa:", error);
      toast.error("Ocorreu um erro ao agendar a tarefa. Verifique o console para mais detalhes.");
    }
    console.log("Planejador: handleSelectSlot - Fim.");
  }, [selectedTaskToSchedule, tempEstimatedDuration, selectedDate, scheduleTask, schedules, getCombinedTimeBlocksForDate]);

  const handleScheduleSuggestedTask = useCallback(async () => {
    if (!selectedTaskToSchedule || !suggestedSlot) {
      toast.error("Nenhuma tarefa ou slot sugerido para agendar.");
      return;
    }

    const displacedTask = suggestedSlot.displacedTask;
    let originalTaskOfDisplaced: TodoistTask | InternalTask | undefined = undefined;

    if (displacedTask) {
      // Store the original task of the displaced one before deleting it from schedule
      originalTaskOfDisplaced = displacedTask.originalTask;
      // Remove the displaced task from its current slot without clearing Todoist due date
      await handleDeleteScheduledTask(displacedTask, false); // false: don't re-add to backlog, it's already there
      toast.info(`Tarefa "${displacedTask.content}" remanejada para o backlog.`);
    }

    // Schedule the new task
    await scheduleTask(
      selectedTaskToSchedule,
      suggestedSlot.start,
      suggestedSlot.end,
      parseISO(suggestedSlot.date)
    );

    // AFTER scheduling the new task, if there was a displaced task,
    // automatically select it and trigger a new AI suggestion for it.
    if (originalTaskOfDisplaced) {
      // Ensure the originalTaskOfDisplaced is still in the backlogTasks before selecting
      const foundInBacklog = backlogTasks.find(t => t.id === originalTaskOfDisplaced!.id);
      if (foundInBacklog) {
        handleSelectBacklogTask(foundInBacklog);
        // Trigger AI suggestion for the newly selected (displaced) task
        if (plannerAIAssistantRef.current) {
          plannerAIAssistantRef.current.triggerSuggestion();
        }
      } else {
        toast.warning(`A tarefa remanejada "${originalTaskOfDisplaced.content}" não foi encontrada no backlog para nova sugestão.`);
      }
    }
  }, [selectedTaskToSchedule, suggestedSlot, handleDeleteScheduledTask, scheduleTask, backlogTasks, handleSelectBacklogTask]);

  const handleResetPlanner = useCallback(() => {
    if (confirm("Tem certeza que deseja resetar o planejador? Isso apagará todos os blocos de tempo e tarefas agendadas (diárias e recorrentes) do seu navegador.")) {
      setSchedules({});
      setRecurringBlocks([]);
      setIgnoredMeetingTaskIds([]);
      localStorage.removeItem(PLANNER_STORAGE_KEY);
      toast.success("Planejador resetado com sucesso!");
      fetchBacklogTasks(); // Recarregar backlog após reset
    }
  }, [fetchBacklogTasks]);


  const isLoading = isLoadingTodoist || isLoadingBacklog || isPreallocatingMeetings;

  const setDay = (date: Date, day: number) => {
    const currentDay = date.getDay();
    const diff = day - currentDay;
    return addDays(date, diff);
  };

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
          <Button
            onClick={handleResetPlanner}
            variant="destructive"
            className="flex items-center gap-2"
          >
            <Eraser className="h-4 w-4" /> Resetar Planejador
          </Button>
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
              {currentDaySchedule.timeBlocks.map((block) => (
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
                Filtrar por Projeto 5W2H
              </Label>
              <Select
                value={selectedShitsukeProjectId}
                onValueChange={(value: string | 'all') => setSelectedShitsukeProjectId(value)}
                disabled={isLoading}
              >
                <SelectTrigger className="w-full mt-1">
                  <SelectValue placeholder="Todos os Projetos 5W2H" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os Projetos 5W2H</SelectItem>
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
            <div className="mb-4">
              <Label htmlFor="backlog-sort-order" className="text-sm text-gray-600 font-medium">
                Ordenar Backlog por
              </Label>
              <Select
                value={backlogSortOrder}
                onValueChange={(value: "default" | "seiton") => setBacklogSortOrder(value)}
                disabled={isLoading}
              >
                <SelectTrigger className="w-full mt-1">
                  <SelectValue placeholder="Ordenação Padrão" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="default">Ordenação Padrão</SelectItem>
                  <SelectItem value="seiton">Ranking Seiton</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button onClick={fetchBacklogTasks} disabled={isLoading} className="w-full mt-2 flex items-center justify-center">
              <RotateCcw className="h-4 w-4 mr-2" /> Recarregar Backlog
            </Button>

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
                  <Button onClick={handleSuggestSlot} className="flex-grow bg-yellow-500 hover:bg-yellow-600 text-white">
                    <Lightbulb className="h-4 w-4 mr-2" /> Sugerir Slot
                  </Button>
                </div>
                {suggestedSlot && (
                  <div className="mt-2 p-2 bg-green-100 border border-green-400 rounded-md flex items-center justify-between">
                    <span className="text-sm text-green-800">
                      Sugestão: {suggestedSlot.start} - {suggestedSlot.end} ({format(parseISO(suggestedSlot.date), "dd/MM", { locale: ptBR })})
                      {suggestedSlot.displacedTask && (
                        <span className="block text-xs text-orange-700">
                          (Remanejar: {suggestedSlot.displacedTask.content})
                        </span>
                      )}
                    </span>
                    <Button size="sm" onClick={handleScheduleSuggestedTask}>
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
                    <div className="flex items-center justify-between">
                      <h4 className="font-semibold text-gray-800">{task.content}</h4>
                      {'url' in task && task.url && (
                        <a href={task.url} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()}>
                          <Button variant="ghost" size="icon" className="h-6 w-6">
                            <ExternalLink className="h-4 w-4 text-blue-500" />
                          </Button>
                        </a>
                      )}
                    </div>
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
                        {'due' in task && typeof task.due?.datetime === 'string' && task.due.datetime && isValid(parseISO(task.due.datetime)) && (
                          <span>Venc: {format(parseISO(task.due.datetime), "dd/MM HH:mm", { locale: ptBR })}</span>
                        )}
                        {'due' in task && typeof task.due?.date === 'string' && task.due.date && !(typeof task.due?.datetime === 'string' && task.due.datetime) && isValid(parseISO(task.due.date)) && (
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
        {/* PlannerAIAssistant component */}
        <div className="mt-6">
          <PlannerAIAssistant
            ref={plannerAIAssistantRef}
            plannerAiPrompt={plannerAiPrompt}
            selectedTaskToSchedule={selectedTaskToSchedule}
            selectedDate={selectedDate}
            schedules={schedules}
            recurringBlocks={recurringBlocks}
            tempEstimatedDuration={tempEstimatedDuration}
            tempSelectedCategory={tempSelectedCategory}
            tempSelectedPriority={tempSelectedPriority}
            onSuggestSlot={setSuggestedSlot}
            onScheduleSuggestedTask={scheduleTask}
            getCombinedTimeBlocksForDate={getCombinedTimeBlocksForDate}
          />
        </div>
      </div>
    </div>
  );
};

export default Planejador;