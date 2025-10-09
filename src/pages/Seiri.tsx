"use client";

import React, { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { useTodoist } from "@/context/TodoistContext";
import { TodoistTask } from "@/lib/types";
import LoadingSpinner from "@/components/ui/loading-spinner";
import { toast } from "sonner";
import TaskReviewCard from "@/components/TaskReviewCard";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type ReviewState = "initial" | "reviewing" | "finished";
type SortCriteria = "random" | "priority" | "deadline" | "starred";

const Seiri = () => {
  const { fetchTasks, closeTask, deleteTask, isLoading } = useTodoist();
  const [tasksToReview, setTasksToReview] = useState<TodoistTask[]>([]);
  const [currentTaskIndex, setCurrentTaskIndex] = useState<number>(0);
  const [reviewState, setReviewState] = useState<ReviewState>("initial");
  const [sortCriteria, setSortCriteria] = useState<SortCriteria>("random"); // Novo estado para o critério de ordenação

  // Função para ordenar as tarefas com base no critério selecionado
  const sortTasks = useCallback((tasks: TodoistTask[], criteria: SortCriteria): TodoistTask[] => {
    switch (criteria) {
      case "priority":
        // P1 (4) > P2 (3) > P3 (2) > P4 (1)
        return [...tasks].sort((a, b) => b.priority - a.priority);
      case "deadline":
        return [...tasks].sort((a, b) => {
          const dateA = a.due?.datetime || a.due?.date;
          const dateB = b.due?.datetime || b.due?.date;

          if (dateA && dateB) {
            return new Date(dateA).getTime() - new Date(dateB).getTime();
          }
          if (dateA) return -1; // A tem prazo, B não
          if (dateB) return 1; // B tem prazo, A não
          return 0; // Ambos sem prazo
        });
      case "starred":
        return [...tasks].sort((a, b) => {
          const isAStarred = a.content.startsWith("*");
          const isBStarred = b.content.startsWith("*");

          if (isAStarred && !isBStarred) return -1;
          if (!isAStarred && isBStarred) return 1;
          return 0;
        });
      case "random":
      default:
        return [...tasks].sort(() => 0.5 - Math.random());
    }
  }, []);

  const loadTasks = useCallback(async () => {
    setReviewState("initial");
    setCurrentTaskIndex(0);
    const fetchedTasks = await fetchTasks();
    if (fetchedTasks && fetchedTasks.length > 0) {
      const sortedTasks = sortTasks(fetchedTasks, sortCriteria); // Aplicar ordenação
      setTasksToReview(sortedTasks);
      setReviewState("reviewing");
      toast.info(`Encontradas ${sortedTasks.length} tarefas para revisar.`);
    } else {
      setTasksToReview([]);
      setReviewState("finished");
      toast.info("Nenhuma tarefa encontrada para revisar. Bom trabalho!");
    }
  }, [fetchTasks, sortTasks, sortCriteria]);

  useEffect(() => {
    // Load tasks only when the component mounts or when explicitly triggered
    // The initial state will show the "Iniciar Revisão" button
  }, []);

  const handleNextTask = useCallback(() => {
    if (currentTaskIndex < tasksToReview.length - 1) {
      setCurrentTaskIndex((prev) => prev + 1);
    } else {
      setReviewState("finished");
      toast.success("Revisão de tarefas concluída!");
    }
  }, [currentTaskIndex, tasksToReview.length]);

  const handleKeep = useCallback((taskId: string) => {
    toast.info("Tarefa mantida para revisão posterior.");
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
      <h2 className="text-3xl font-bold mb-2 text-gray-800">📋 SEIRI - Separar o Essencial</h2>
      <p className="text-lg text-gray-600 mb-6">Decida: esta tarefa é realmente necessária?</p>

      {isLoading && (
        <div className="flex justify-center items-center h-48">
          <LoadingSpinner size={40} />
        </div>
      )}

      {!isLoading && reviewState === "initial" && (
        <div className="text-center mt-10">
          <div className="mb-6 flex flex-col items-center gap-4">
            <label htmlFor="sort-criteria" className="text-lg font-medium text-gray-700">
              Ordenar tarefas por:
            </label>
            <Select
              value={sortCriteria}
              onValueChange={(value: SortCriteria) => setSortCriteria(value)}
            >
              <SelectTrigger id="sort-criteria" className="w-[200px]">
                <SelectValue placeholder="Selecione a ordenação" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="random">Aleatório</SelectItem>
                <SelectItem value="priority">Prioridade (P1-P4)</SelectItem>
                <SelectItem value="deadline">Prazo (Mais Próximo)</SelectItem>
                <SelectItem value="starred">Iniciadas com "*"</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Button
            onClick={loadTasks}
            className="px-8 py-4 text-xl bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors duration-200"
          >
            Iniciar Revisão de Tarefas
          </Button>
        </div>
      )}

      {!isLoading && reviewState === "reviewing" && currentTask && (
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

      {!isLoading && reviewState === "finished" && tasksToReview.length === 0 && (
        <div className="text-center mt-10">
          <p className="text-2xl font-semibold text-gray-700 mb-4">
            🎉 Todas as tarefas estão em ordem!
          </p>
          <p className="text-lg text-gray-600 mb-6">
            Nenhuma tarefa encontrada para revisar.
          </p>
          <Button
            onClick={loadTasks}
            className="px-8 py-4 text-xl bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-colors duration-200"
          >
            Revisar Novamente
          </Button>
        </div>
      )}

      {!isLoading && reviewState === "finished" && tasksToReview.length > 0 && (
        <div className="text-center mt-10">
          <p className="text-2xl font-semibold text-gray-700 mb-4">
            ✅ Revisão de tarefas concluída!
          </p>
          <p className="text-lg text-gray-600 mb-6">
            Você revisou todas as {tasksToReview.length} tarefas.
          </p>
          <Button
            onClick={loadTasks}
            className="px-8 py-4 text-xl bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-colors duration-200"
          >
            Revisar Novamente
          </Button>
        </div>
      )}
    </div>
  );
};

export default Seiri;