"use client";

import React, { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { useTodoist } from "@/context/TodoistContext";
import { TodoistTask } from "@/lib/types";
import LoadingSpinner from "@/components/ui/loading-spinner";
import { toast } from "sonner";
import TaskReviewCard from "@/components/TaskReviewCard"; // Importando o TaskReviewCard

type SeisoState = "initial" | "reviewing" | "finished";

const Seiso = () => {
  const { fetchTasks, closeTask, deleteTask, isLoading } = useTodoist();
  const [tasksToReview, setTasksToReview] = useState<TodoistTask[]>([]);
  const [currentTaskIndex, setCurrentTaskIndex] = useState<number>(0);
  const [seisoState, setSeisoState] = useState<SeisoState>("initial");

  // Função para ordenar as tarefas com foco em revisão (ex: mais antigas, sem prazo), priorizando deadline
  const sortTasksForSeiso = useCallback((tasks: TodoistTask[]): TodoistTask[] => {
    return [...tasks].sort((a, b) => {
      // Priorizar tarefas com deadline mais próximo
      const getTaskDate = (task: TodoistTask) => {
        if (task.deadline?.date) return new Date(task.deadline.date).getTime();
        if (task.due?.datetime) return new Date(task.due.datetime).getTime();
        if (task.due?.date) return new Date(task.due.date).getTime();
        return Infinity; // Tarefas sem prazo vão para o final
      };

      const dateA = getTaskDate(a);
      const dateB = getTaskDate(b);

      if (dateA !== dateB) {
        return dateA - dateB; // Mais próximo primeiro
      }

      // Se os prazos forem iguais ou inexistentes, priorizar as mais antigas por data de criação
      return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
    });
  }, []);

  const loadTasksForSeiso = useCallback(async () => {
    setSeisoState("initial");
    setCurrentTaskIndex(0);
    const fetchedTasks = await fetchTasks(); // Fetch all tasks
    if (fetchedTasks && fetchedTasks.length > 0) {
      const sortedTasks = sortTasksForSeiso(fetchedTasks);
      setTasksToReview(sortedTasks);
      setSeisoState("reviewing");
      toast.info(`Encontradas ${sortedTasks.length} tarefas para limpeza e revisão.`);
    } else {
      setTasksToReview([]);
      setSeisoState("finished");
      toast.info("Nenhuma tarefa encontrada para limpeza e revisão. Tudo limpo!");
    }
  }, [fetchTasks, sortTasksForSeiso]);

  useEffect(() => {
    // Load tasks only when the component mounts or when explicitly triggered
    // The initial state will show the "Iniciar Limpeza e Revisão" button
  }, []);

  const handleNextTask = useCallback(() => {
    if (currentTaskIndex < tasksToReview.length - 1) {
      setCurrentTaskIndex((prev) => prev + 1);
    } else {
      setSeisoState("finished");
      toast.success("Limpeza e revisão de tarefas concluída!");
    }
  }, [currentTaskIndex, tasksToReview.length]);

  const handleKeep = useCallback((taskId: string) => { // Ajustado para aceitar taskId
    toast.info("Tarefa mantida. Revise-a mais tarde.");
    handleNextTask();
  }, [handleNextTask]);

  const handleComplete = useCallback(async (taskId: string) => {
    const success = await closeTask(taskId);
    if (success !== undefined) {
      toast.success("Tarefa concluída com sucesso!");
      handleNextTask();
    }
  }, [closeTask, handleNextTask]);

  const handleDelete = useCallback(async (taskId: string) => {
    const success = await deleteTask(taskId);
    if (success !== undefined) {
      toast.success("Tarefa excluída com sucesso!");
      handleNextTask();
    }
  }, [deleteTask, handleNextTask]);

  const currentTask = tasksToReview[currentTaskIndex];

  return (
    <div className="p-4">
      <h2 className="text-3xl font-bold mb-2 text-gray-800">✨ SEISO - Limpeza e Revisão</h2>
      <p className="text-lg text-gray-600 mb-6">
        Revise tarefas antigas ou sem prazo. Mantenha apenas o que importa.
      </p>

      {isLoading && (
        <div className="flex justify-center items-center h-48">
          <LoadingSpinner size={40} />
        </div>
      )}

      {!isLoading && seisoState === "initial" && (
        <div className="text-center mt-10">
          <Button
            onClick={loadTasksForSeiso}
            className="px-8 py-4 text-xl bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors duration-200"
          >
            Iniciar Limpeza e Revisão
          </Button>
        </div>
      )}

      {!isLoading && seisoState === "reviewing" && currentTask && (
        <div className="mt-8">
          <p className="text-center text-xl font-medium mb-6 text-gray-700">
            Revisando tarefa {currentTaskIndex + 1} de {tasksToReview.length}
          </p>
          <TaskReviewCard
            task={currentTask}
            onKeep={handleKeep}
            onComplete={handleComplete}
            onDelete={handleDelete}
            isLoading={isLoading}
          />
        </div>
      )}

      {!isLoading && seisoState === "finished" && tasksToReview.length === 0 && (
        <div className="text-center mt-10">
          <p className="text-2xl font-semibold text-gray-700 mb-4">
            🎉 Todas as tarefas estão limpas!
          </p>
          <p className="text-lg text-gray-600 mb-6">
            Nenhuma tarefa encontrada para limpeza e revisão.
          </p>
          <Button
            onClick={loadTasksForSeiso}
            className="px-8 py-4 text-xl bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-colors duration-200"
          >
            Revisar Novamente
          </Button>
        </div>
      )}

      {!isLoading && seisoState === "finished" && tasksToReview.length > 0 && (
        <div className="text-center mt-10">
          <p className="text-2xl font-semibold text-gray-700 mb-4">
            ✅ Limpeza e revisão concluída!
          </p>
          <p className="text-lg text-gray-600 mb-6">
            Você revisou todas as {tasksToReview.length} tarefas.
          </p>
          <Button
            onClick={loadTasksForSeiso}
            className="px-8 py-4 text-xl bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-colors duration-200"
          >
            Revisar Novamente
          </Button>
        </div>
      )}
    </div>
  );
};

export default Seiso;