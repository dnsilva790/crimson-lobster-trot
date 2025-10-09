"use client";

import React, { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { useTodoist } from "@/context/TodoistContext";
import { TodoistTask } from "@/lib/types";
import LoadingSpinner from "@/components/ui/loading-spinner";
import { toast } from "sonner";
import FocusTaskCard from "@/components/FocusTaskCard"; // Novo componente

type ExecucaoState = "initial" | "focusing" | "finished";

const Execucao = () => {
  const { fetchTasks, closeTask, isLoading } = useTodoist();
  const [focusTasks, setFocusTasks] = useState<TodoistTask[]>([]);
  const [currentTaskIndex, setCurrentTaskIndex] = useState<number>(0);
  const [execucaoState, setExecucaoState] = useState<ExecucaoState>("initial");

  const loadTasksForFocus = useCallback(async () => {
    setExecucaoState("initial");
    setCurrentTaskIndex(0);
    const fetchedTasks = await fetchTasks(); // Fetch all uncompleted tasks
    if (fetchedTasks && fetchedTasks.length > 0) {
      // Sort tasks by priority (P1 first) and then by due date (earliest first)
      const sortedTasks = [...fetchedTasks].sort((a, b) => {
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

      setFocusTasks(sortedTasks);
      setExecucaoState("focusing");
      toast.info(`Encontradas ${sortedTasks.length} tarefas para focar.`);
    } else {
      setFocusTasks([]);
      setExecucaoState("finished");
      toast.info("Nenhuma tarefa encontrada para focar. Bom trabalho!");
    }
  }, [fetchTasks]);

  useEffect(() => {
    // No initial load, wait for user to click "Iniciar Modo Foco"
  }, []);

  const handleNextTask = useCallback(() => {
    if (currentTaskIndex < focusTasks.length - 1) {
      setCurrentTaskIndex((prev) => prev + 1);
    } else {
      setExecucaoState("finished");
      toast.success("Modo Foco Total concluído!");
    }
  }, [currentTaskIndex, focusTasks.length]);

  const handleComplete = useCallback(async (taskId: string) => {
    const success = await closeTask(taskId);
    if (success !== undefined) {
      toast.success("Tarefa concluída com sucesso!");
      // Remove the completed task from the list and move to the next
      setFocusTasks((prev) => prev.filter((task) => task.id !== taskId));
      if (focusTasks.length - 1 === currentTaskIndex) { // If it was the last task
        setExecucaoState("finished");
        toast.success("Modo Foco Total concluído!");
      } else if (currentTaskIndex < focusTasks.length - 1) {
        // If there are more tasks, the index remains the same, but the next task shifts into its place
        // No need to increment currentTaskIndex here, as the list shrinks
      }
    }
  }, [closeTask, focusTasks.length, currentTaskIndex]);

  const handleSkip = useCallback(() => {
    toast.info("Tarefa pulada. Passando para a próxima.");
    handleNextTask();
  }, [handleNextTask]);

  const currentTask = focusTasks[currentTaskIndex];

  return (
    <div className="p-4">
      <h2 className="text-3xl font-bold mb-2 text-gray-800">⚡ EXECUÇÃO - Modo Foco Total</h2>
      <p className="text-lg text-gray-600 mb-6">Concentre-se em uma tarefa por vez.</p>

      {isLoading && (
        <div className="flex justify-center items-center h-48">
          <LoadingSpinner size={40} />
        </div>
      )}

      {!isLoading && execucaoState === "initial" && (
        <div className="text-center mt-10">
          <Button
            onClick={loadTasksForFocus}
            className="px-8 py-4 text-xl bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors duration-200"
          >
            Iniciar Modo Foco
          </Button>
        </div>
      )}

      {!isLoading && execucaoState === "focusing" && currentTask && (
        <div className="mt-8">
          <p className="text-center text-xl font-medium mb-6 text-gray-700">
            Focando na tarefa {currentTaskIndex + 1} de {focusTasks.length}
          </p>
          <FocusTaskCard
            task={currentTask}
            onComplete={handleComplete}
            onSkip={handleSkip}
            isLoading={isLoading}
          />
        </div>
      )}

      {!isLoading && execucaoState === "finished" && focusTasks.length === 0 && (
        <div className="text-center mt-10">
          <p className="text-2xl font-semibold text-gray-700 mb-4">
            🎉 Todas as tarefas foram focadas e/ou concluídas!
          </p>
          <p className="text-lg text-gray-600 mb-6">
            Nenhuma tarefa restante para focar.
          </p>
          <Button
            onClick={loadTasksForFocus}
            className="px-8 py-4 text-xl bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-colors duration-200"
          >
            Iniciar Novo Foco
          </Button>
        </div>
      )}

      {!isLoading && execucaoState === "finished" && focusTasks.length > 0 && (
        <div className="text-center mt-10">
          <p className="text-2xl font-semibold text-gray-700 mb-4">
            ✅ Modo Foco Total concluído!
          </p>
          <p className="text-lg text-gray-600 mb-6">
            Você revisou todas as {focusTasks.length} tarefas.
          </p>
          <Button
            onClick={loadTasksForFocus}
            className="px-8 py-4 text-xl bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-colors duration-200"
          >
            Iniciar Novo Foco
          </Button>
        </div>
      )}
    </div>
  );
};

export default Execucao;