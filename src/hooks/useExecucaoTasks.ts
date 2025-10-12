"use client";

import { useState, useEffect, useCallback } from "react";
import { useTodoist } from "@/context/TodoistContext";
import { TodoistTask, SeitonStateSnapshot, ScheduledTask, InternalTask } from "@/lib/types";
import { toast } from "sonner";
import { parseISO, isValid, format, startOfDay, addDays, isAfter, isEqual, startOfMinute, parse, isBefore } from "date-fns";

type ExecucaoState = "initial" | "focusing" | "finished";

const SEITON_RANKING_STORAGE_KEY = "seitonTournamentState";
const PLANNER_STORAGE_KEY = "planner_schedules_v2"; // Definido aqui para uso no hook

export const useExecucaoTasks = (filterInput: string, selectedCategoryFilter: "all" | "pessoal" | "profissional") => {
  const { fetchTasks, fetchTaskById, isLoading: isLoadingTodoist } = useTodoist();
  const [focusTasks, setFocusTasks] = useState<TodoistTask[]>([]);
  const [initialTotalTasks, setInitialTotalTasks] = useState<number>(0); // Total tasks at the start of the session
  const [currentTaskIndex, setCurrentTaskIndex] = useState<number>(0);
  const [execucaoState, setExecucaoState] = useState<ExecucaoState>("initial");
  const [seitonRankedTasks, setSeitonRankedTasks] = useState<TodoistTask[]>([]); // New state for Seiton ranked tasks

  // Load Seiton ranked tasks once on mount or when relevant state changes
  useEffect(() => {
    const loadSeitonRanking = () => {
      const savedSeitonState = localStorage.getItem(SEITON_RANKING_STORAGE_KEY);
      if (savedSeitonState) {
        try {
          const parsedState: SeitonStateSnapshot = JSON.parse(savedState);
          if (parsedState.rankedTasks && parsedState.rankedTasks.length > 0) {
            setSeitonRankedTasks(parsedState.rankedTasks);
            console.log("useExecucaoTasks: Loaded Seiton ranked tasks from localStorage:", parsedState.rankedTasks.length);
          } else {
            setSeitonRankedTasks([]);
            console.log("useExecucaoTasks: Seiton ranked tasks in localStorage are empty.");
          }
        } catch (e) {
          console.error("useExecucaoTasks: Failed to parse Seiton state from localStorage", e);
          localStorage.removeItem(SEITON_RANKING_STORAGE_KEY);
          toast.error("Erro ao carregar ranking do Seiton. Dados corrompidos foram removidos.");
          setSeitonRankedTasks([]);
        }
      } else {
        setSeitonRankedTasks([]);
        console.log("useExecucaoTasks: No Seiton ranked tasks found in localStorage.");
      }
    };
    loadSeitonRanking();
    // Listen for changes in localStorage from other tabs/windows (e.g., Seiton module)
    window.addEventListener('storage', loadSeitonRanking);
    return () => window.removeEventListener('change', loadSeitonRanking); // Changed to 'change' for localStorage events
  }, []); // Run once on mount

  const sortTasksForFocus = useCallback((tasks: TodoistTask[]): TodoistTask[] => {
    return [...tasks].sort((a, b) => {
      // 1. Starred tasks first
      const isAStarred = a.content.startsWith("*");
      const isBStarred = b.content.startsWith("*");
      if (isAStarred && !isBStarred) return -1;
      if (!isAStarred && isBStarred) return 1;

      // 2. Priority: P1 (4) > P2 (3) > P3 (2) > P4 (1)
      if (b.priority !== a.priority) {
        return b.priority - a.priority;
      }

      // Helper to get date value, handling null/undefined and invalid dates
      const getDateValue = (dateString: string | null | undefined) => {
        if (typeof dateString === 'string' && dateString) {
          const parsedDate = parseISO(dateString);
          return isValid(parsedDate) ? parsedDate.getTime() : Infinity;
        }
        return Infinity; // Tasks without a date go last
      };

      // 3. Deadline: earliest first
      const deadlineA = getDateValue(a.deadline);
      const deadlineB = getDateValue(b.deadline);
      if (deadlineA !== deadlineB) {
        return deadlineA - deadlineB;
      }

      // 4. Due date/time: earliest first
      const dueDateTimeA = getDateValue(a.due?.datetime);
      const dueDateTimeB = getDateValue(b.due?.datetime);
      if (dueDateTimeA !== dueDateTimeB) {
        return dueDateTimeA - dueDateTimeB;
      }

      const dueDateA = getDateValue(a.due?.date);
      const dueDateB = getDateValue(b.due?.date);
      if (dueDateA !== dueDateTimeB) { // Corrected from dueDateTimeB
        return dueDateA - dueDateB;
      }

      return 0; // No difference
    });
  }, []);

  const loadTasksForFocus = useCallback(async () => {
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

    // --- Step 1: Load tasks based on user-provided filter OR default smart filter ---
    const todoistFilterParts: string[] = [];
    if (filterInput.trim()) {
      todoistFilterParts.push(filterInput.trim());
    }
    if (selectedCategoryFilter !== "all") {
      todoistFilterParts.push(`#${selectedCategoryFilter}`);
    }
    const userProvidedFilter = todoistFilterParts.join(" & ");
    const isUserFilterActive = userProvidedFilter !== "";

    let initialTasks: TodoistTask[] = [];
    let initialFilterMessage = "";

    if (isUserFilterActive) {
      initialTasks = await fetchTasks(userProvidedFilter, fetchOptions);
      initialFilterMessage = `Carregadas ${initialTasks.length} tarefas do filtro de Execução.`;
    } else {
      const defaultSmartFilter = `(%23%F0%9F%93%85%20Reuni%C3%B5es%20%26%20due%20before%3A%20in%205%20min)%20%7C%20%40%F0%9F%8E%AF%20Foco%20%7C%20((%40%F0%9F%93%86%20Cronograma%20de%20hoje%20%26%20due%20before%3A%20in%203%20min)%20%7C%20(%40%F0%9F%93%86%20Cronograma%20de%20hoje%20%26%20today%20%26%20no%20time))%20%7C%20((%40%E2%9A%A1%20R%C3%A1pida%20%7C%20%40r%C3%A1pida)%20%26%20due%20before%3A%20in%200%20min)`;
      initialTasks = await fetchTasks(defaultSmartFilter, fetchOptions);
      initialFilterMessage = `Carregadas ${initialTasks.length} tarefas do filtro inteligente padrão.`;
    }

    initialTasks = sortTasksForFocus(initialTasks);
    initialTasks.forEach(task => {
      if (!seenTaskIds.has(task.id)) {
        finalCombinedTasks.push(task);
        seenTaskIds.add(task.id);
      }
    });
    if (initialTasks.length > 0) {
      toast.info(initialFilterMessage);
    } else {
      toast.info(`Nenhuma tarefa encontrada para o filtro inicial. Buscando em outras fontes...`);
    }

    // --- Step 2: Collect tasks from Planner (Overdue first, then Today/Tomorrow) ---
    const plannerStorage = localStorage.getItem(PLANNER_STORAGE_KEY);
    if (plannerStorage) {
        const { schedules: storedSchedules } = JSON.parse(plannerStorage);
        const now = new Date();
        const allRelevantScheduledTasks: ScheduledTask[] = [];

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
        let plannerTasksAddedCount = 0;

        for (const st of combinedPlannerTasks) {
            if (seenTaskIds.has(st.taskId)) continue;

            let actualTask: TodoistTask | InternalTask | undefined = st.originalTask;

            if (actualTask && 'project_id' in actualTask) { // It's a Todoist task
                const latestTodoistTask = await fetchTaskById(actualTask.id);
                if (latestTodoistTask && !latestTodoistTask.is_completed) {
                    finalCombinedTasks.push(latestTodoistTask);
                    seenTaskIds.add(latestTodoistTask.id);
                    plannerTasksAddedCount++;
                }
            } else if (actualTask && 'category' in actualTask) { // It's an InternalTask
                if (!actualTask.isCompleted) {
                    finalCombinedTasks.push(convertInternalTaskToTodoistTask(actualTask));
                    seenTaskIds.add(actualTask.id);
                    plannerTasksAddedCount++;
                }
            }
        }
        if (plannerTasksAddedCount > 0) {
            toast.info(`Adicionadas ${plannerTasksAddedCount} tarefas agendadas do Planejador (incluindo atrasadas).`);
        }
    }

    // --- Step 3: Add tasks from Seiton ranking ---
    let seitonTasksAddedCount = 0;
    let currentSeitonRankedTasks = [...seitonRankedTasks];
    currentSeitonRankedTasks = sortTasksForFocus(currentSeitonRankedTasks);
    const uniqueSeitonTasks = currentSeitonRankedTasks.filter(task => !seenTaskIds.has(task.id));
    uniqueSeitonTasks.forEach(task => {
        finalCombinedTasks.push(task);
        seenTaskIds.add(task.id);
        seitonTasksAddedCount++;
    });
    if (seitonTasksAddedCount > 0) {
        toast.info(`Adicionadas ${seitonTasksAddedCount} tarefas do ranking do Seiton.`);
    }

    // --- Step 4: Finally, add all other Todoist tasks (if any) ---
    let otherTodoistTasksAddedCount = 0;
    let allTodoistTasks: TodoistTask[] = await fetchTasks(undefined, fetchOptions); 
    allTodoistTasks = sortTasksForFocus(allTodoistTasks);
    const uniqueOtherTasks = allTodoistTasks.filter(task => !seenTaskIds.has(task.id));
    uniqueOtherTasks.forEach(task => {
        finalCombinedTasks.push(task);
        seenTaskIds.add(task.id);
        otherTodoistTasksAddedCount++;
    });
    if (otherTodoistTasksAddedCount > 0) {
        toast.info(`Adicionadas ${otherTodoistTasksAddedCount} tarefas restantes do Todoist.`);
    }

    // Remove duplicates and sort the final combined list (already done, but re-sorting for good measure)
    const uniqueFinalCombinedTasks = Array.from(new Set(finalCombinedTasks.map(task => task.id)))
                                        .map(id => finalCombinedTasks.find(task => task.id === id)!);
    const sortedFinalTasks = sortTasksForFocus(uniqueFinalCombinedTasks);

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


  return {
    focusTasks,
    initialTotalTasks, // Renomeado
    currentTaskIndex,
    execucaoState,
    isLoadingTasks: isLoadingTodoist,
    loadTasksForFocus,
    advanceToNextTask,
    updateTaskInFocusList, // Expor esta função
  };
};