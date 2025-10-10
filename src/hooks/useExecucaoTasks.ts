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
    setCurrentTaskIndex(0);
    let tasksFromFilter: TodoistTask[] = [];
    let topSeitonTask: TodoistTask | null = null;

    const todoistFilterParts: string[] = [];
    if (filterInput.trim()) {
      todoistFilterParts.push(filterInput.trim());
    }
    if (selectedCategoryFilter !== "all") {
      todoistFilterParts.push(`#${selectedCategoryFilter}`);
    }
    const finalTodoistFilter = todoistFilterParts.join(" & ");

    // 1. Carregar tarefas com base no filtro primeiro
    if (useFilter && finalTodoistFilter) {
      tasksFromFilter = await fetchTasks(finalTodoistFilter, true); // Buscar todos os tipos de tarefas para o modo foco
      if (tasksFromFilter.length > 0) {
        toast.info(`Encontradas ${tasksFromFilter.length} tarefas com o filtro.`);
      }
    } else {
      // Se nenhum filtro específico for fornecido, buscar todas as tarefas
      tasksFromFilter = await fetchTasks(undefined, true);
      if (tasksFromFilter.length > 0) {
        toast.info(`Encontradas ${tasksFromFilter.length} tarefas sem filtro específico.`);
      }
    }

    // 2. Considerar a tarefa principal do ranking do Seiton
    const savedSeitonState = localStorage.getItem(SEITON_RANKING_STORAGE_KEY);
    if (savedSeitonState) {
      try {
        const parsedState: SeitonStateSnapshot = JSON.parse(savedSeitonState);
        if (parsedState.rankedTasks && parsedState.rankedTasks.length > 0) {
          const potentialTopSeitonTask = parsedState.rankedTasks[0];
          // Adicionar a tarefa do Seiton apenas se ela não estiver já na lista filtrada
          if (!tasksFromFilter.some(task => task.id === potentialTopSeitonTask.id)) {
            topSeitonTask = potentialTopSeitonTask;
            toast.info(`Adicionada tarefa principal do ranking do Seiton: "${topSeitonTask.content}".`);
          }
        }
      } catch (e) {
        console.error("Failed to parse Seiton state from localStorage", e);
        localStorage.removeItem(SEITON_RANKING_STORAGE_KEY); // Clear corrupted data
        toast.error("Erro ao carregar ranking do Seiton. Dados corrompidos foram removidos.");
      }
    }

    // 3. Combinar as listas: tarefas filtradas primeiro, depois a tarefa única do Seiton (se houver)
    let combinedTasks = [...tasksFromFilter];
    if (topSeitonTask) {
        combinedTasks.push(topSeitonTask); // Adicionar ao final, a ordenação cuidará da posição
    }

    // 4. Se ainda não houver tarefas, fallback para buscar todas as tarefas (se um filtro foi aplicado e não retornou nada)
    if (combinedTasks.length === 0 && (useFilter && finalTodoistFilter)) {
        toast.info("Nenhuma tarefa encontrada com o filtro ou ranking Seiton. Tentando carregar todas as tarefas...");
        combinedTasks = await fetchTasks(undefined, true);
    }

    // 5. Ordenar a lista combinada
    if (combinedTasks && combinedTasks.length > 0) {
      const sortedTasks = sortTasksForFocus(combinedTasks);
      setFocusTasks(sortedTasks);
      setInitialTotalTasks(sortedTasks.length);
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