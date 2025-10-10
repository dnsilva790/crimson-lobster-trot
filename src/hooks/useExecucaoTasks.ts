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

    const todoistFilterParts: string[] = [];
    if (filterInput.trim()) {
      todoistFilterParts.push(filterInput.trim());
    }
    if (selectedCategoryFilter !== "all") {
      todoistFilterParts.push(`#${selectedCategoryFilter}`);
    }
    const finalTodoistFilter = todoistFilterParts.join(" & ");

    if (useFilter && finalTodoistFilter) {
      fetchedTasks = await fetchTasks(finalTodoistFilter, true); 
      if (fetchedTasks.length === 0) {
        toast.info("Nenhuma tarefa encontrada com o filtro. Tentando carregar do ranking do Seiton...");
        const savedSeitonState = localStorage.getItem(SEITON_RANKING_STORAGE_KEY);
        if (savedSeitonState) {
          try {
            const parsedState: SeitonStateSnapshot = JSON.parse(savedSeitonState);
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
      // Fallback to fetching all tasks if no filter or filter yielded no results
      fetchedTasks = await fetchTasks(undefined, true);
    }

    if (fetchedTasks && fetchedTasks.length > 0) {
      const sortedTasks = sortTasksForFocus(fetchedTasks);
      setFocusTasks(sortedTasks);
      setInitialTotalTasks(sortedTasks.length); // Set initial total
      setExecucaoState("focusing");
      toast.info(`Encontradas ${sortedTasks.length} tarefas para focar.`);
    } else {
      setFocusTasks([]);
      setInitialTotalTasks(0);
      setExecucaoState("finished");
      toast.info("Nenhuma tarefa encontrada para focar. Bom trabalho!");
    }
  }, [fetchTasks, filterInput, selectedCategoryFilter, sortTasksForFocus]);

  // This function will be called when a task is completed or skipped
  const advanceToNextTask = useCallback(() => {
    setFocusTasks(prevTasks => {
      // Remove the current task from the list
      const updatedTasks = prevTasks.filter((_, index) => index !== currentTaskIndex);
      
      if (updatedTasks.length === 0) {
        setExecucaoState("finished");
        setCurrentTaskIndex(0); // Reset index
        // initialTotalTasks remains the same for progress calculation
        toast.success("Todas as tarefas foram processadas!");
        return [];
      } else {
        // If there are still tasks, advance the index or loop if at the end
        // The currentTaskIndex should remain the same if the task at that index was removed,
        // effectively shifting the next task into its place.
        // If the removed task was the last one, the new index should be 0.
        const newIndex = currentTaskIndex >= updatedTasks.length ? 0 : currentTaskIndex;
        setCurrentTaskIndex(newIndex);
        return updatedTasks;
      }
    });
  }, [currentTaskIndex]);

  // Function to update a task in the local state (used after API update)
  const updateTaskInFocusList = useCallback((updatedTask: TodoistTask) => {
    setFocusTasks(prevTasks => prevTasks.map(task => 
      task.id === updatedTask.id ? updatedTask : task
    ));
  }, []);


  return {
    focusTasks,
    initialTotalTasks, // Renamed
    currentTaskIndex,
    execucaoState,
    isLoadingTasks: isLoadingTodoist,
    loadTasksForFocus,
    advanceToNextTask,
    updateTaskInFocusList, // Expose this function
  };
};