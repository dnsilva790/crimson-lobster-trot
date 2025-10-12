ranking do Seiton > todas as outras tarefas.">
"use client";

import { useState, useEffect, useCallback } from "react";
import { useTodoist } from "@/context/TodoistContext";
import { TodoistTask, SeitonStateSnapshot } from "@/lib/types";
import { toast } from "sonner";
// import { format } from "date-fns"; // Not used here

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
      // Priority: P1 (4) > P2 (3) > P3 (2) > P4 (1)
      if (b.priority !== a.priority) {
        return b.priority - a.priority;
      }

      // Due date: earliest first
      const getDateValue = (task: TodoistTask) => {
        if (task.due?.datetime) return new Date(task.due.datetime).getTime();
        if (task.due?.date) return new Date(task.due.date).getTime();
        return Infinity; // Tasks without a due date go last
      };

      const dateA = getDateValue(a);
      const dateB = getDateValue(b);

      return dateA - dateB;
    });
  }, []);

  const loadTasksForFocus = useCallback(async () => {
    setExecucaoState("initial");
    setCurrentTaskIndex(0);
    
    const todoistFilterParts: string[] = [];
    if (filterInput.trim()) {
      todoistFilterParts.push(filterInput.trim());
    }
    if (selectedCategoryFilter !== "all") {
      todoistFilterParts.push(`#${selectedCategoryFilter}`);
    }
    const finalExecucaoFilter = todoistFilterParts.join(" & ");
    const isExecucaoFilterActive = filterInput.trim() !== "" || selectedCategoryFilter !== "all";

    const fetchOptions = { includeSubtasks: false, includeRecurring: true };

    let finalCombinedTasks: TodoistTask[] = [];
    const seenTaskIds = new Set<string>();

    // 1. Get tasks from Execucao filter (highest priority)
    let execucaoFilteredTasks: TodoistTask[] = [];
    if (isExecucaoFilterActive) {
      execucaoFilteredTasks = await fetchTasks(finalExecucaoFilter, fetchOptions);
      execucaoFilteredTasks = sortTasksForFocus(execucaoFilteredTasks); // Sort internally
      execucaoFilteredTasks.forEach(task => {
        if (!seenTaskIds.has(task.id)) {
          finalCombinedTasks.push(task);
          seenTaskIds.add(task.id);
        }
      });
      if (execucaoFilteredTasks.length > 0) {
        toast.info(`Priorizando ${execucaoFilteredTasks.length} tarefas do filtro de Execução.`);
      }
    }

    // 2. Get tasks from Seiton ranking (second priority)
    let currentSeitonRankedTasks = [...seitonRankedTasks]; // Use a copy
    currentSeitonRankedTasks = sortTasksForFocus(currentSeitonRankedTasks); // Sort internally
    const uniqueSeitonTasks = currentSeitonRankedTasks.filter(task => !seenTaskIds.has(task.id));
    uniqueSeitonTasks.forEach(task => {
      finalCombinedTasks.push(task);
      seenTaskIds.add(task.id);
    });
    if (uniqueSeitonTasks.length > 0) {
        toast.info(`Adicionadas ${uniqueSeitonTasks.length} tarefas do ranking do Seiton.`);
    }


    // 3. Get all other tasks (lowest priority)
    let allTodoistTasks: TodoistTask[] = await fetchTasks(undefined, fetchOptions);
    allTodoistTasks = sortTasksForFocus(allTodoistTasks); // Sort internally
    const uniqueOtherTasks = allTodoistTasks.filter(task => !seenTaskIds.has(task.id));
    uniqueOtherTasks.forEach(task => {
      finalCombinedTasks.push(task);
      seenTaskIds.add(task.id);
    });
    if (uniqueOtherTasks.length > 0) {
        toast.info(`Adicionadas ${uniqueOtherTasks.length} tarefas restantes do Todoist.`);
    }


    // 4. Final state update
    if (finalCombinedTasks.length > 0) {
      setFocusTasks(finalCombinedTasks); // Already sorted within groups and concatenated
      setInitialTotalTasks(finalCombinedTasks.length);
      setExecucaoState("focusing");
      toast.success(`Iniciando foco com um total de ${finalCombinedTasks.length} tarefas.`);
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