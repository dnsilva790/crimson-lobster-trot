"use client";

import React, { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { useTodoist } from "@/context/TodoistContext";
import { TodoistTask } from "@/lib/types";
import LoadingSpinner from "@/components/ui/loading-spinner";
import { toast } from "sonner";
import TaskStandardizationCard from "@/components/TaskStandardizationCard"; // Novo componente
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type SeiketsuState = "initial" | "standardizing" | "finished";

const Seiketsu = () => {
  const { fetchTasks, updateTask, isLoading } = useTodoist();
  const [tasksToStandardize, setTasksToStandardize] = useState<TodoistTask[]>([]);
  const [currentTaskIndex, setCurrentTaskIndex] = useState<number>(0);
  const [seiketsuState, setSeiketsuState] = useState<SeiketsuState>("initial");
  const [filterInput, setFilterInput] = useState<string>("");

  const loadTasksForStandardization = useCallback(async () => {
    setSeiketsuState("initial");
    setCurrentTaskIndex(0);

    const todoistFilter = filterInput.trim();
    
    const fetchedTasks = await fetchTasks(todoistFilter || undefined);
    if (fetchedTasks && fetchedTasks.length > 0) {
      // Filtra tarefas que precisam de padronização: sem due date ou com prioridade P4 (1)
      const filteredTasks = fetchedTasks.filter(
        (task) => !task.due?.date || task.priority === 1
      );
      if (filteredTasks.length > 0) {
        setTasksToStandardize(filteredTasks);
        setSeiketsuState("standardizing");
        toast.info(`Encontradas ${filteredTasks.length} tarefas para padronizar.`);
      } else {
        setTasksToStandardize([]);
        setSeiketsuState("finished");
        toast.success("Todas as tarefas já estão padronizadas!");
      }
    } else {
      setTasksToStandardize([]);
      setSeiketsuState("finished");
      toast.info("Nenhuma tarefa encontrada para padronizar.");
    }
  }, [fetchTasks, filterInput]);

  useEffect(() => {
    // Load tasks only when the component mounts or when explicitly triggered
  }, []);

  const handleNextTask = useCallback(() => {
    if (currentTaskIndex < tasksToStandardize.length - 1) {
      setCurrentTaskIndex((prev) => prev + 1);
    } else {
      setSeiketsuState("finished");
      toast.success("Padronização de tarefas concluída!");
    }
  }, [currentTaskIndex, tasksToStandardize.length]);

  const handleUpdateTask = useCallback(async (taskId: string, data: Partial<TodoistTask>) => {
    const updated = await updateTask(taskId, data);
    if (updated) {
      toast.success("Tarefa atualizada com sucesso!");
      handleNextTask();
    }
  }, [updateTask, handleNextTask]);

  const handleSkipTask = useCallback(() => {
    toast.info("Tarefa pulada.");
    handleNextTask();
  }, [handleNextTask]);

  const currentTask = tasksToStandardize[currentTaskIndex];

  return (
    <div className="p-4">
      <h2 className="text-3xl font-bold mb-2 text-gray-800">📊 SEIKETSU - Padronizar Tarefas</h2>
      <p className="text-lg text-gray-600 mb-6">
        Revise e padronize tarefas sem data de vencimento ou com baixa prioridade.
      </p>

      {isLoading && (
        <div className="flex justify-center items-center h-48">
          <LoadingSpinner size={40} />
        </div>
      )}

      {!isLoading && seiketsuState === "initial" && (
        <div className="text-center mt-10">
          <div className="grid w-full items-center gap-1.5 mb-6 max-w-md mx-auto">
            <Label htmlFor="task-filter" className="text-left text-gray-600 font-medium">
              Filtro de Tarefas (ex: "hoje", "p1", "#projeto")
            </Label>
            <Input
              type="text"
              id="task-filter"
              placeholder="Opcional: insira um filtro do Todoist..."
              value={filterInput}
              onChange={(e) => setFilterInput(e.target.value)}
              className="mt-1"
              disabled={isLoading}
            />
          </div>
          <Button
            onClick={loadTasksForStandardization}
            className="px-8 py-4 text-xl bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-colors duration-200"
          >
            Iniciar Padronização
          </Button>
        </div>
      )}

      {!isLoading && seiketsuState === "standardizing" && currentTask && (
        <div className="mt-8">
          <p className="text-center text-xl font-medium mb-6 text-gray-700">
            Padronizando tarefa {currentTaskIndex + 1} de {tasksToStandardize.length}
          </p>
          <TaskStandardizationCard
            task={currentTask}
            onUpdate={handleUpdateTask}
            onSkip={handleSkipTask}
            isLoading={isLoading}
          />
        </div>
      )}

      {!isLoading && seiketsuState === "finished" && tasksToStandardize.length === 0 && (
        <div className="text-center mt-10">
          <p className="text-2xl font-semibold text-gray-700 mb-4">
            🎉 Todas as tarefas estão padronizadas!
          </p>
          <p className="text-lg text-gray-600 mb-6">
            Nenhuma tarefa encontrada para padronização.
          </p>
          <Button
            onClick={loadTasksForStandardization}
            className="px-8 py-4 text-xl bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-colors duration-200"
          >
            Revisar Padronização Novamente
          </Button>
        </div>
      )}

      {!isLoading && seiketsuState === "finished" && tasksToStandardize.length > 0 && (
        <div className="text-center mt-10">
          <p className="text-2xl font-semibold text-gray-700 mb-4">
            ✅ Padronização de tarefas concluída!
          </p>
          <p className="text-lg text-gray-600 mb-6">
            Você revisou todas as {tasksToStandardize.length} tarefas.
          </p>
          <Button
            onClick={loadTasksForStandardization}
            className="px-8 py-4 text-xl bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-colors duration-200"
          >
            Revisar Padronização Novamente
          </Button>
        </div>
      )}
    </div>
  );
};

export default Seiketsu;