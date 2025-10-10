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
    let combinedTasks: TodoistTask[] = [];

    const todoistFilterParts: string[] = [];
    if (filterInput.trim()) {
      todoistFilterParts.push(filterInput.trim());
    }
    if (selectedCategoryFilter !== "all") {
      todoistFilterParts.push(`#${selectedCategoryFilter}`);
    }
    const finalTodoistFilter = todoistFilterParts.join(" & ");

    // 1. Tentar carregar a tarefa principal do ranking do Seiton primeiro
    let topSeitonTask: TodoistTask | null = null;
    const savedSeitonState = localStorage.getItem(SEITON_RANKING_STORAGE_KEY);
    if (savedSeitonState) {
      try {
        const parsedState: SeitonStateSnapshot = JSON.parse(savedSeitonState);
        if (parsedState.rankedTasks && parsedState.rankedTasks.length > 0) {
          topSeitonTask = parsedState.rankedTasks[0];
          toast.info(`Carregada tarefa principal do ranking do Seiton: "${topSeitonTask.content}".`);
        }
      } catch (e) {
        console.error("Failed to parse Seiton state from localStorage", e);
        toast.error("Erro ao carregar ranking do Seiton.");
      }
    }

    // 2. Buscar tarefas com base no filtro (ou todas se não houver filtro)
    let filteredTasks: TodoistTask[] = [];
    if (useFilter && finalTodoistFilter) {
      filteredTasks = await fetchTasks(finalTodoistFilter, true); // Buscar todos os tipos de tarefas para o modo foco
      if (filteredTasks.length > 0) {
        toast.info(`Encontradas ${filteredTasks.length} tarefas com o filtro.`);
      }
    } else {
      // Se nenhum filtro específico for fornecido, buscar todas as tarefas
      filteredTasks = await fetchTasks(undefined, true);
      if (filteredTasks.length > 0) {
        toast.info(`Encontradas ${filteredTasks.length} tarefas sem filtro específico.`);
      }
    }

    // 3. Combinar e remover duplicatas, priorizando a tarefa do Seiton
    if (topSeitonTask) {
      combinedTasks.push(topSeitonTask);
      // Filtrar a topSeitonTask das filteredTasks para evitar duplicatas
      filteredTasks = filteredTasks.filter(task => task.id !== topSeitonTask!.id);
    }
    combinedTasks = [...combinedTasks, ...filteredTasks];

    // 4. Se ainda não houver tarefas, fallback para buscar todas as tarefas (se ainda não foi feito)
    if (combinedTasks.length === 0 && (useFilter && finalTodoistFilter)) { // Apenas se um filtro foi aplicado e não retornou nada
        toast.info("Nenhuma tarefa encontrada com o filtro ou ranking Seiton. Tentando carregar todas as tarefas...");
        combinedTasks = await fetchTasks(undefined, true);
    }


    if (combinedTasks && combinedTasks.length > 0) {
      const sortedTasks = sortTasksForFocus(combinedTasks);
      setFocusTasks(sortedTasks);
      setInitialTotalTasks(sortedTasks.length); // Definir total inicial
      setExecucaoState("focusing");
      toast.info(`Iniciando foco com ${sortedTasks.length} tarefas.`);
    } else {
      setFocusTasks([]);
      setInitialTotalTasks(0);
      setExecucaoState("finished");
      toast.info("Nenhuma tarefa encontrada para focar. Bom trabalho!");
    }
  }, [fetchTasks, filterInput, selectedCategoryFilter, sortTasksForFocus]);

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