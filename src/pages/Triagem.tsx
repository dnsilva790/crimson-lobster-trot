"use client";

import React, { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useTodoist } from "@/context/TodoistContext";
import { EisenhowerTask, TodoistTask } from "@/lib/types";
import LoadingSpinner from "@/components/ui/loading-spinner";
import { toast } from "sonner";
import { Scale, ListTodo, RotateCcw, Filter } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getEisenhowerRating } from "@/utils/eisenhowerUtils";
import TriagemProcessor from "@/components/TriagemProcessor"; // New component
import { suggestEisenhowerRating } from "@/services/aiService"; // Importar o serviço de IA
import { getLearningContextForPrompt } from "@/utils/aiLearningStorage"; // Importar o contexto de aprendizado

type TriagemState = "initial" | "loading" | "reviewing" | "finished";

const TRIAGEM_FILTER_INPUT_STORAGE_KEY = "triagem_filter_input";

const Triagem = () => {
  const { fetchTasks, updateTask, closeTask, isLoading: isLoadingTodoist } = useTodoist();
  const [triagemState, setTriagemState] = useState<TriagemState>("initial");
  const [tasksToProcess, setTasksToProcess] = useState<EisenhowerTask[]>([]);
  const [currentTaskIndex, setCurrentTaskIndex] = useState<number>(0);
  const [filterInput, setFilterInput] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem(TRIAGEM_FILTER_INPUT_STORAGE_KEY) || "!@gtd_processada & !@gtd_5w2h_processada";
    }
    return "!@gtd_processada & !@gtd_5w2h_processada";
  });

  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem(TRIAGEM_FILTER_INPUT_STORAGE_KEY, filterInput);
    }
  }, [filterInput]);

  const sortTasksForTriagem = useCallback((tasks: EisenhowerTask[]): EisenhowerTask[] => {
    // Priorize tarefas não avaliadas primeiro, depois por prioridade Todoist
    return [...tasks].sort((a, b) => {
      const isARated = a.urgency !== null && a.importance !== null;
      const isBRated = b.urgency !== null && b.importance !== null;
      if (isARated && !isBRated) return 1;
      if (!isARated && isBRated) return -1;
      
      // Fallback para prioridade Todoist
      return b.priority - a.priority;
    });
  }, []);

  const loadTasksForProcessing = useCallback(async () => {
    setTriagemState("loading");
    setCurrentTaskIndex(0);
    setTasksToProcess([]);

    const filter = filterInput.trim() || undefined;
    
    try {
      // Alterado para EXCLUIR subtarefas, mas manter tarefas recorrentes
      const fetchedTodoistTasks = await fetchTasks(filter, { includeSubtasks: false, includeRecurring: true });
      
      const initialEisenhowerTasks: EisenhowerTask[] = [];

      for (const task of fetchedTodoistTasks) {
        const { urgency, importance, quadrant } = getEisenhowerRating(task);
        
        initialEisenhowerTasks.push({
          ...task,
          urgency: urgency, // Usa o valor existente ou null
          importance: importance, // Usa o valor existente ou null
          quadrant: quadrant,
          url: task.url,
        });
      }
      
      const sortedTasks = sortTasksForTriagem(initialEisenhowerTasks);
      
      if (sortedTasks.length > 0) {
        setTasksToProcess(sortedTasks);
        setTriagemState("reviewing");
        toast.success(`Encontradas ${sortedTasks.length} tarefas para triagem.`);
      } else {
        setTriagemState("finished");
        toast.info("Nenhuma tarefa encontrada para triagem com o filtro atual.");
      }
    } catch (error) {
      console.error("Failed to load tasks for Triagem:", error);
      toast.error("Falha ao carregar tarefas.");
      setTriagemState("initial");
    }
  }, [fetchTasks, filterInput, sortTasksForTriagem]);

  const advanceToNextTask = useCallback(() => {
    if (currentTaskIndex < tasksToProcess.length - 1) {
      setCurrentTaskIndex(prev => prev + 1);
    } else {
      setTriagemState("finished");
      toast.success("Triagem de tarefas concluída!");
    }
  }, [currentTaskIndex, tasksToProcess.length]);

  const updateTaskInList = useCallback((updatedTask: EisenhowerTask) => {
    setTasksToProcess(prevTasks => 
      prevTasks.map(task => 
        task.id === updatedTask.id ? updatedTask : task
      )
    );
  }, []);

  const removeTaskFromList = useCallback((taskId: string) => {
    setTasksToProcess(prevTasks => {
      const updatedTasks = prevTasks.filter(task => task.id !== taskId);
      if (updatedTasks.length === 0) {
        setTriagemState("finished");
        setCurrentTaskIndex(0);
        return [];
      } else {
        const newIndex = currentTaskIndex >= updatedTasks.length ? 0 : currentTaskIndex;
        setCurrentTaskIndex(newIndex);
        return updatedTasks;
      }
    });
  }, [currentTaskIndex]);

  const currentTask = tasksToProcess[currentTaskIndex];
  const isLoadingCombined = isLoadingTodoist || triagemState === "loading";

  return (
    <div className="p-4">
      <h2 className="text-3xl font-bold mb-2 text-gray-800">
        <Scale className="inline-block h-8 w-8 mr-2 text-indigo-600" /> TRIAGEM 3-em-1 (Experimental)
      </h2>
      <p className="text-lg text-gray-600 mb-6">
        Combine Seiri, Avaliação Eisenhower e Seiso em uma única tela de processamento.
      </p>

      {isLoadingCombined && (
        <div className="flex justify-center items-center h-96">
          <LoadingSpinner size={40} />
        </div>
      )}

      {!isLoadingCombined && triagemState === "initial" && (
        <div className="text-center mt-10">
          <div className="grid w-full items-center gap-1.5 mb-6 max-w-md mx-auto">
            <Label htmlFor="triagem-filter" className="text-left text-gray-600 font-medium">
              Filtro de Tarefas (Todoist)
            </Label>
            <Input
              type="text"
              id="triagem-filter"
              placeholder="Ex: 'no date & !@gtd_processada'"
              value={filterInput}
              onChange={(e) => setFilterInput(e.target.value)}
              className="mt-1"
              disabled={isLoadingCombined}
            />
            <p className="text-xs text-gray-500 text-left mt-1">
              Filtro padrão: tarefas sem prazo e não processadas pelo GTD/5W2H.
            </p>
          </div>
          <Button
            onClick={loadTasksForProcessing}
            className="px-8 py-4 text-xl bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-colors duration-200"
            disabled={isLoadingCombined}
          >
            <ListTodo className="h-5 w-5 mr-2" /> Iniciar Triagem
          </Button>
        </div>
      )}

      {!isLoadingCombined && triagemState === "reviewing" && currentTask && (
        <div className="mt-8">
          <p className="text-center text-xl font-medium mb-6 text-gray-700">
            Processando tarefa {currentTaskIndex + 1} de {tasksToProcess.length}
          </p>
          <TriagemProcessor
            task={currentTask}
            onAdvance={advanceToNextTask}
            onRemove={removeTaskFromList}
            onUpdate={updateTaskInList}
            onRefreshList={loadTasksForProcessing}
          />
        </div>
      )}

      {!isLoadingCombined && triagemState === "finished" && (
        <div className="text-center mt-10">
          <p className="text-2xl font-semibold text-gray-700 mb-4">
            🎉 Triagem Concluída!
          </p>
          <p className="text-lg text-gray-600 mb-6">
            Você processou todas as tarefas do filtro.
          </p>
          <Button
            onClick={() => setTriagemState("initial")}
            className="px-8 py-4 text-xl bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-colors duration-200"
          >
            <RotateCcw className="h-5 w-5 mr-2" /> Reiniciar Triagem
          </Button>
        </div>
      )}
    </div>
  );
};

export default Triagem;