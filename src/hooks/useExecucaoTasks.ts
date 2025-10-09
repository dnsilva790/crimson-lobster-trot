"use client";

import { useState, useEffect, useCallback } from "react";
import { useTodoist } from "@/context/TodoistContext";
import { TodoistTask, SeitonStateSnapshot } from "@/lib/types";
import { toast } from "sonner";
import { format } from "date-fns";

type ExecucaoState = "initial" | "focusing" | "finished";

const SEITON_RANKING_STORAGE_KEY = "seitonTournamentState";

export const useExecucaoTasks = (filterInput: string) => {
  const { fetchTasks, isLoading: isLoadingTodoist } = useTodoist();
  const [focusTasks, setFocusTasks] = useState<TodoistTask[]>([]);
  const [originalTasksCount, setOriginalTasksCount] = useState<number>(0);
  const [currentTaskIndex, setCurrentTaskIndex] = useState<number>(0);
  const [execucaoState, setExecucaoState] = useState<ExecucaoState>("initial");

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

  const loadTasksForFocus = useCallback(async (useFilter: boolean = false) => {
    setExecucaoState("initial");
    setCurrentTaskIndex(0); // Reset index when loading new tasks
    let fetchedTasks: TodoistTask[] = [];

    if (useFilter && filterInput.trim()) {
      // Alterado para incluir tarefas recorrentes e subtarefas
      fetchedTasks = await fetchTasks(filterInput.trim(), true); 
      if (fetchedTasks.length === 0) {
        toast.info("Nenhuma tarefa encontrada com o filtro. Tentando carregar do ranking do Seiton...");
        const savedSeitonState = localStorage.getItem(SEITON_RANKING_STORAGE_KEY);
        if (savedSeitonState) {
          try {
            const parsedState: SeitonStateSnapshot = JSON.parse(savedState);
            if (parsedState.rankedTasks && parsedState.rankedTasks.length > 0) {
              fetchedTasks = parsedState.rankedTasks;
              toast.info(`Carregadas ${fetchedTasks.length} tarefas do ranking do Seiton.`);
            }
          } catch (e) {
            console.error("Failed to parse Seiton state from localStorage", e);
            toast.error("Erro ao carregar ranking do Seiton.");
          }
        }
      }
    }

    if (fetchedTasks.length === 0) {
      // Alterado para incluir tarefas recorrentes e subtarefas
      fetchedTasks = await fetchTasks(undefined, true);
    }

    if (fetchedTasks && fetchedTasks.length > 0) {
      const sortedTasks = sortTasksForFocus(fetchedTasks);
      setFocusTasks(sortedTasks);
      setOriginalTasksCount(sortedTasks.length);
      setExecucaoState("focusing");
      toast.info(`Encontradas ${sortedTasks.length} tarefas para focar.`);
    } else {
      setFocusTasks([]);
      setOriginalTasksCount(0);
      setExecucaoState("finished");
      toast.info("Nenhuma tarefa encontrada para focar. Bom trabalho!");
    }
  }, [fetchTasks, filterInput, sortTasksForFocus]);

  const handleNextTask = useCallback(async () => {
    if (currentTaskIndex < focusTasks.length - 1) {
      setCurrentTaskIndex((prev) => prev + 1);
    } else {
      // If at the last task, re-fetch tasks to get a fresh list
      toast.info("Última tarefa da lista. Recarregando tarefas...");
      await loadTasksForFocus(true); // Use filter if present, else no filter
    }
  }, [currentTaskIndex, focusTasks.length, loadTasksForFocus]);

  return {
    focusTasks,
    originalTasksCount,
    currentTaskIndex,
    execucaoState,
    isLoadingTasks: isLoadingTodoist,
    loadTasksForFocus,
    handleNextTask,
  };
};