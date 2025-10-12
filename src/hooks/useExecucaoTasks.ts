"use client";

import { useState, useEffect, useCallback } from "react";
import { useTodoist } from "@/context/TodoistContext";
import { TodoistTask, SeitonStateSnapshot } from "@/lib/types";
import { toast } from "sonner";
import { parseISO, isValid } from "date-fns";

type ExecucaoState = "initial" | "focusing" | "finished";

const SEITON_RANKING_STORAGE_KEY = "seitonTournamentState";

export const useExecucaoTasks = (filterInput: string, selectedCategoryFilter: "all" | "pessoal" | "profissional") => {
  const { fetchTasks, isLoading: isLoadingTodoist } = useTodoist();
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
    return () => window.removeEventListener('storage', loadSeitonRanking);
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
      if (dueDateA !== dueDateB) {
        return dueDateA - dueDateB;
      }

      return 0; // No difference
    });
  }, []);

  const loadTasksForFocus = useCallback(async () => {
    setExecucaoState("initial");
    setCurrentTaskIndex(0);
    
    const todoistFilterParts: string[] = [];
    if (filterInput.trim()) {
      todoistFilterParts.push(filterInput.trim());
    }
    // Only add category filter if it's not "all"
    if (selectedCategoryFilter !== "all") {
      todoistFilterParts.push(`#${selectedCategoryFilter}`);
    }
    const finalExecucaoFilter = todoistFilterParts.join(" & ");
    const isExecucaoFilterActive = finalExecucaoFilter !== ""; // Check if any filter is active

    const fetchOptions = { includeSubtasks: false, includeRecurring: true };

    let finalCombinedTasks: TodoistTask[] = [];
    const seenTaskIds = new Set<string>();

    // 1. First, try to load tasks based on the explicit execution filter (if active)
    if (isExecucaoFilterActive) {
      let execucaoFilteredTasks = await fetchTasks(finalExecucaoFilter, fetchOptions);
      execucaoFilteredTasks = sortTasksForFocus(execucaoFilteredTasks);
      execucaoFilteredTasks.forEach(task => {
        if (!seenTaskIds.has(task.id)) {
          finalCombinedTasks.push(task);
          seenTaskIds.add(task.id);
        }
      });
      if (execucaoFilteredTasks.length > 0) {
        toast.info(`Carregadas ${execucaoFilteredTasks.length} tarefas do filtro de Execução.`);
      } else {
        toast.info("Nenhuma tarefa encontrada para o filtro de Execução.");
      }
    }

    // 2. If no tasks from the explicit filter, or if we want to add more, try Seiton ranking
    let currentSeitonRankedTasks = [...seitonRankedTasks];
    currentSeitonRankedTasks = sortTasksForFocus(currentSeitonRankedTasks);
    const uniqueSeitonTasks = currentSeitonRankedTasks.filter(task => !seenTaskIds.has(task.id));
    uniqueSeitonTasks.forEach(task => {
      finalCombinedTasks.push(task);
      seenTaskIds.add(task.id);
    });
    if (uniqueSeitonTasks.length > 0) {
        toast.info(`Adicionadas ${uniqueSeitonTasks.length} tarefas do ranking do Seiton.`);
    }

    // 3. Finally, if still more tasks are needed, get all other Todoist tasks
    // Pass undefined as filter to fetch all active tasks if no specific filter is needed
    let allTodoistTasks: TodoistTask[] = await fetchTasks(undefined, fetchOptions); 
    allTodoistTasks = sortTasksForFocus(allTodoistTasks);
    const uniqueOtherTasks = allTodoistTasks.filter(task => !seenTaskIds.has(task.id));
    uniqueOtherTasks.forEach(task => {
      finalCombinedTasks.push(task);
      seenTaskIds.add(task.id);
    });
    if (uniqueOtherTasks.length > 0) {
        toast.info(`Adicionadas ${uniqueOtherTasks.length} tarefas restantes do Todoist.`);
    }

    // Remove duplicates and sort the final combined list
    const uniqueFinalCombinedTasks = Array.from(new Set(finalCombinedTasks.map(task => task.id)))
                                        .map(id => finalCombinedTasks.find(task => task.id === id)!);
    const sortedFinalTasks = sortTasksForFocus(uniqueFinalCombinedTasks);

    // 4. Final state update
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
  }, [fetchTasks, filterInput, selectedCategoryFilter, sortTasksForFocus, seitonRankedTasks]);

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