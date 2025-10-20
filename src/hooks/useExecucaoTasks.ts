"use client";

import { useState, useEffect, useCallback } from "react";
import { useTodoist } from "@/context/TodoistContext";
import { TodoistTask, SeitonStateSnapshot, ScheduledTask, InternalTask } from "@/lib/types";
import { toast } from "sonner";
import { parseISO, isValid, format, startOfDay, addDays, isAfter, isEqual, startOfMinute, parse, isBefore } from "date-fns";

type ExecucaoState = "initial" | "focusing" | "finished";

const SEITON_RANKING_STORAGE_KEY = "seitonTournamentState";
const PLANNER_STORAGE_KEY = "planner_schedules_v2"; // Definido aqui para uso no hook

export const useExecucaoTasks = (
  filterInput: string,
  selectedCategoryFilter: "all" | "pessoal" | "profissional",
  selectedTaskSource: "filter" | "planner" | "ranking" | "all" // Novo parâmetro
) => {
  const { fetchTasks, fetchTaskById, isLoading: isLoadingTodoist } = useTodoist();
  const [focusTasks, setFocusTasks] = useState<TodoistTask[]>([]);
  const [initialTotalTasks, setInitialTotalTasks] = useState<number>(0); // Total tasks at the start of the session
  const [currentTaskIndex, setCurrentTaskIndex] = useState<number>(0);
  const [execucaoState, setExecucaoState] = useState<ExecucaoState>("initial");
  const [seitonRankedTasks, setSeitonRankedTasks] = useState<TodoistTask[]>([]); // New state for Seiton ranked tasks

  // Define a default state object for Seiton
  const defaultSeitonState: SeitonStateSnapshot = {
    tasksToProcess: [],
    rankedTasks: [],
    currentTaskToPlace: null,
    comparisonCandidate: null,
    comparisonIndex: 0,
    tournamentState: "initial",
    selectedPrioritizationContext: "none",
  };

  // Load Seiton ranked tasks once on mount or when relevant state changes
  useEffect(() => {
    const loadSeitonRanking = () => {
      let loadedState: SeitonStateSnapshot = defaultSeitonState;
      try {
        const savedSeitonState = localStorage.getItem(SEITON_RANKING_STORAGE_KEY);
        
        if (savedSeitonState) {
          const parsed = JSON.parse(savedSeitonState);
          // Merge with default to ensure all properties exist, even if not in saved JSON
          loadedState = { ...defaultSeitonState, ...parsed };
        }
        // If savedSeitonState is null, loadedState remains defaultSeitonState

        if (loadedState.rankedTasks && loadedState.rankedTasks.length > 0) {
          setSeitonRankedTasks(loadedState.rankedTasks);
          console.log("useExecucaoTasks: Loaded Seiton ranked tasks from localStorage:", loadedState.rankedTasks.length);
        } else {
          setSeitonRankedTasks([]);
          console.log("useExecucaoTasks: Seiton ranked tasks in localStorage are empty or invalid.");
        }
      } catch (e) {
        console.error("useExecucaoTasks: Failed to load or parse Seiton state from localStorage. Error:", e);
        localStorage.removeItem(SEITON_RANKING_STORAGE_KEY);
        toast.error("Erro ao carregar ranking do Seiton. Dados corrompidos foram removidos.");
        setSeitonRankedTasks([]); // Ensure state is cleared on error
      }
    };
    loadSeitonRanking();
    // Listen for changes in localStorage from other tabs/windows (e.g., Seiton module)
    window.addEventListener('storage', loadSeitonRanking);
    return () => window.removeEventListener('storage', loadSeitonRanking);
  }, []); // Run once on mount

  const sortTasksForFocus = useCallback((tasks: TodoistTask[]): TodoistTask[] => {
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

  const loadTasksForFocus = useCallback(async (source: "filter" | "planner" | "ranking" | "all") => {
    setExecucaoState("initial");
    setCurrentTaskIndex(0);
    
    let finalCombinedTasks: TodoistTask[] = [];
    const seenTaskIds = new Set<string>();
    const fetchOptions = { includeSubtasks: false, includeRecurring: true };

    // Helper to convert InternalTask to TodoistTask format
    const convertInternalTaskToTodoistTask = (internalTask: InternalTask): TodoistTask => ({
      id: internalTask.id,
      content: internalTask.content,
      description: internalTask.description || '',
      is_completed: internalTask.isCompleted,
      labels: [internalTask.category],
      priority: 1, // Default priority for internal tasks
      due: internalTask.dueDate ? {
          date: internalTask.dueDate,
          string: internalTask.dueDate,
          lang: 'pt',
          is_recurring: false,
          datetime: internalTask.dueTime ? `${internalTask.dueDate}T${internalTask.dueTime}:00` : null,
          timezone: null,
      } : null,
      duration: internalTask.estimatedDurationMinutes ? {
          amount: internalTask.estimatedDurationMinutes,
          unit: 'minute'
      } : null,
      url: '#', // Placeholder URL
      comment_count: 0,
      created_at: internalTask.createdAt,
      creator_id: 'internal',
      project_id: 'internal', // Placeholder
      section_id: null,
      parent_id: null,
      order: 0,
      estimatedDurationMinutes: internalTask.estimatedDurationMinutes,
      deadline: null,
    });

    // --- Helper functions for loading from different sources ---

    const _loadFromUserFilter = async (): Promise<TodoistTask[]> => {
        const todoistFilterParts: string[] = [];
        if (filterInput.trim()) {
            todoistFilterParts.push(filterInput.trim());
        }
        if (selectedCategoryFilter !== "all") {
            todoistFilterParts.push(`#${selectedCategoryFilter}`);
        }
        const userProvidedFilter = todoistFilterParts.join(" & ");
        if (!userProvidedFilter) {
          toast.info("Nenhum filtro de usuário fornecido.");
          return []; // No filter provided, no tasks from this source
        }

        let tasks = await fetchTasks(userProvidedFilter, fetchOptions);
        tasks = sortTasksForFocus(tasks);
        if (tasks.length > 0) {
          toast.info(`Carregadas ${tasks.length} tarefas do filtro de Execução.`);
        } else {
          toast.info("Nenhuma tarefa encontrada para o filtro de Execução.");
        }
        return tasks;
    };

    const _loadFromDefaultSmartFilter = async (): Promise<TodoistTask[]> => {
        // Ajustado para remover emojis e usar sintaxe de filtro mais robusta
        const defaultSmartFilter = `(project: "Reuniões" & due before: +5 minutes) | @Foco | ((@Cronograma de hoje & due before: +3 minutes) | (@Cronograma de hoje & today & no time)) | ((@Rápida | @rapida) & due before: +0 minutes)`;
        let tasks = await fetchTasks(defaultSmartFilter, fetchOptions);
        tasks = sortTasksForFocus(tasks);
        if (tasks.length > 0) {
          toast.info(`Adicionadas ${tasks.length} tarefas do filtro inteligente padrão.`);
        } else {
          toast.info("Nenhuma tarefa encontrada para o filtro inteligente padrão.");
        }
        return tasks;
    };

    const _loadFromPlanner = async (): Promise<TodoistTask[]> => {
        // ALWAYS re-read from localStorage to get the latest state
        const plannerStorage = localStorage.getItem(PLANNER_STORAGE_KEY);
        if (!plannerStorage) {
          toast.info("Nenhum dado do Planejador encontrado.");
          return [];
        }

        let parsedPlannerData;
        try {
          parsedPlannerData = JSON.parse(plannerStorage);
        } catch (e) {
          console.error("useExecucaoTasks: Failed to parse planner data from localStorage:", e);
          toast.error("Erro ao carregar dados do Planejador. Dados corrompidos.");
          return [];
        }

        const { schedules: storedSchedules } = parsedPlannerData;
        const now = new Date();
        const allRelevantScheduledTasks: (ScheduledTask & { scheduledDateTime: Date })[] = [];

        for (const dateKey in storedSchedules) {
            if (storedSchedules[dateKey] && storedSchedules[dateKey].scheduledTasks) {
                storedSchedules[dateKey].scheduledTasks.forEach((st: ScheduledTask) => {
                    const taskStartDateTime = parse(st.start, "HH:mm", parseISO(dateKey));
                    if (isValid(taskStartDateTime)) {
                        allRelevantScheduledTasks.push({ ...st, scheduledDateTime: taskStartDateTime });
                    }
                });
            }
        }

        const overdueScheduledTasks = allRelevantScheduledTasks.filter(st => isBefore(st.scheduledDateTime, now));
        const futureOrCurrentScheduledTasks = allRelevantScheduledTasks.filter(st => !isBefore(st.scheduledDateTime, now));

        overdueScheduledTasks.sort((a, b) => a.scheduledDateTime.getTime() - b.scheduledDateTime.getTime());
        futureOrCurrentScheduledTasks.sort((a, b) => a.scheduledDateTime.getTime() - b.scheduledDateTime.getTime());

        const combinedPlannerTasks = [...overdueScheduledTasks, ...futureOrCurrentScheduledTasks];
        let tasks: TodoistTask[] = [];

        for (const st of combinedPlannerTasks) {
            if (seenTaskIds.has(st.taskId)) continue;

            let actualTask: TodoistTask | InternalTask | undefined = st.originalTask;

            if (actualTask && 'project_id' in actualTask) { // It's a Todoist task
                const latestTodoistTask = await fetchTaskById(actualTask.id);
                if (latestTodoistTask && !latestTodoistTask.is_completed) {
                    tasks.push(latestTodoistTask);
                }
            } else if (actualTask && 'category' in actualTask) { // It's an InternalTask
                if (!actualTask.isCompleted) {
                    tasks.push(convertInternalTaskToTodoistTask(actualTask));
                }
            }
        }
        // IMPORTANT: Do NOT re-sort tasks here. The planner order is already established.
        if (tasks.length > 0) {
          toast.info(`Adicionadas ${tasks.length} tarefas agendadas do Planejador (incluindo atrasadas).`);
        } else {
          toast.info("Nenhuma tarefa encontrada no Planejador.");
        }
        return tasks;
    };

    const _loadFromSeitonRanking = async (): Promise<TodoistTask[]> => {
        let tasks: TodoistTask[] = [...seitonRankedTasks];
        tasks = sortTasksForFocus(tasks);
        if (tasks.length > 0) {
          toast.info(`Adicionadas ${tasks.length} tarefas do ranking do Seiton.`);
        } else {
          toast.info("Nenhuma tarefa encontrada no Ranking Seiton.");
        }
        return tasks;
    };

    const _loadFromAllTodoist = async (): Promise<TodoistTask[]> => {
        let tasks: TodoistTask[] = await fetchTasks(undefined, fetchOptions);
        tasks = sortTasksForFocus(tasks);
        if (tasks.length > 0) {
          toast.info(`Adicionadas ${tasks.length} tarefas restantes do Todoist.`);
        } else {
          toast.info("Nenhuma tarefa restante do Todoist encontrada.");
        }
        return tasks;
    };

    // --- Main loading logic based on selected source ---
    if (source === "filter") {
        finalCombinedTasks = await _loadFromUserFilter();
    } else if (source === "planner") {
        // For 'planner' source, use the order directly from _loadFromPlanner
        finalCombinedTasks = await _loadFromPlanner();
    } else if (source === "ranking") {
        finalCombinedTasks = await _loadFromSeitonRanking();
    } else if (source === "all") {
        // Sequential fallback for "all" option
        let tasks = await _loadFromUserFilter(); // Try user filter first
        tasks.forEach(task => { if (!seenTaskIds.has(task.id)) { finalCombinedTasks.push(task); seenTaskIds.add(task.id); } });

        if (finalCombinedTasks.length === 0) { // If user filter yielded nothing, try smart filter
            tasks = await _loadFromDefaultSmartFilter();
            tasks.forEach(task => { if (!seenTaskIds.has(task.id)) { finalCombinedTasks.push(task); seenTaskIds.add(task.id); } });
        }

        tasks = await _loadFromPlanner(); // Always try planner after initial filters
        tasks.forEach(task => { if (!seenTaskIds.has(task.id)) { finalCombinedTasks.push(task); seenTaskIds.add(task.id); } });

        tasks = await _loadFromSeitonRanking(); // Always try seiton after planner
        tasks.forEach(task => { if (!seenTaskIds.has(task.id)) { finalCombinedTasks.push(task); seenTaskIds.add(task.id); } });

        tasks = await _loadFromAllTodoist(); // Finally, all other todoist tasks
        tasks.forEach(task => { if (!seenTaskIds.has(task.id)) { finalCombinedTasks.push(task); seenTaskIds.add(task.id); } });
    }

    // Filter out duplicates
    const uniqueFinalCombinedTasks = Array.from(new Set(finalCombinedTasks.map(task => task.id)))
                                        .map(id => finalCombinedTasks.find(task => task.id === id)!);
    
    let sortedFinalTasks: TodoistTask[];
    if (source === "planner") {
        // If the source is 'planner', the tasks are already sorted by _loadFromPlanner
        // We just need to ensure uniqueness.
        sortedFinalTasks = uniqueFinalCombinedTasks;
    } else {
        // For other sources or 'all', apply the default focus sorting
        sortedFinalTasks = sortTasksForFocus(uniqueFinalCombinedTasks);
    }

    // 5. Final state update
    if (sortedFinalTasks.length > 0) {
      setFocusTasks(sortedFinalTasks);
      setInitialTotalTasks(sortedFinalTasks.length);
      setExecucaoState("focusing");
      toast.success(`Iniciando foco com um total de ${sortedFinalTasks.length} tarefas.`);
    } else {
      setFocusTasks([]);
      setInitialTotalTasks(0);
      setExecucaoState("finished");
      toast.info("Nenhuma tarefa encontrada para focar. Bom trabalho!");
    }
}, [fetchTasks, fetchTaskById, filterInput, selectedCategoryFilter, sortTasksForFocus, seitonRankedTasks]);

  // Esta função será chamada quando uma tarefa for concluída ou pulada
  const advanceToNextTask = useCallback(() => {
    setFocusTasks(prevTasks => {
      // Remover a tarefa atual da lista
      const updatedTasks = prevTasks.filter((_, index) => index !== currentTaskIndex);
      
      if (updatedTasks.length === 0) {
        setExecucaoState("finished");
        setCurrentTaskIndex(0); // Resetar índice
        // initialTotalTasks permanece o mesmo para cálculo de progresso
        toast.success("Todas as tarefas foram processadas!");
        return [];
      } else {
        // Se ainda houver tarefas, avançar o índice ou voltar ao início se estiver no final
        // O currentTaskIndex deve permanecer o mesmo se a tarefa naquele índice foi removida,
        // efetivamente deslocando a próxima tarefa para o seu lugar.
        // Se a tarefa removida foi a última, o novo índice deve ser 0.
        const newIndex = currentTaskIndex >= updatedTasks.length ? 0 : currentTaskIndex;
        setCurrentTaskIndex(newIndex);
        return updatedTasks;
      }
    });
  }, [currentTaskIndex]);

  // Função para atualizar uma tarefa no estado local (usada após atualização da API)
  const updateTaskInFocusList = useCallback((updatedTask: TodoistTask) => {
    setFocusTasks(prevTasks => prevTasks.map(task => 
      task.id === updatedTask.id ? updatedTask : task
    ));
  }, []);

  // Nova função para definir a tarefa de foco por ID
  const setFocusTaskById = useCallback((taskId: string) => {
    const index = focusTasks.findIndex(task => task.id === taskId);
    if (index !== -1) {
      setCurrentTaskIndex(index);
      setExecucaoState("focusing"); // Ensure we are in focusing state
      toast.info(`Foco alterado para a tarefa sugerida pelo IA.`);
    } else {
      toast.error("A tarefa sugerida pelo IA não está na lista de foco atual.");
    }
  }, [focusTasks]);


  return {
    focusTasks,
    initialTotalTasks, // Renomeado
    currentTaskIndex,
    execucaoState,
    isLoadingTasks: isLoadingTodoist,
    loadTasksForFocus,
    advanceToNextTask,
    updateTaskInFocusList, // Expor esta função
    setFocusTaskById, // Expor a nova função
  };
};