"use client";

import React, { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useTodoist } from "@/context/TodoistContext";
import { TodoistTask } from "@/lib/types";
import LoadingSpinner from "@/components/ui/loading-spinner";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Check, Trash2, RotateCcw } from "lucide-react";

type SeisoState = "initial" | "reviewing" | "finished";

const Seiso = () => {
  const { fetchTasks, closeTask, deleteTask, isLoading } = useTodoist();
  const [tasksToReview, setTasksToReview] = useState<TodoistTask[]>([]);
  const [currentTaskIndex, setCurrentTaskIndex] = useState<number>(0);
  const [seisoState, setSeisoState] = useState<SeisoState>("initial");

  const PRIORITY_COLORS: Record<1 | 2 | 3 | 4, string> = {
    4: "bg-red-500", // P1 - Urgente
    3: "bg-orange-500", // P2 - Alto
    2: "bg-yellow-500", // P3 - Médio
    1: "bg-gray-400", // P4 - Baixo
  };

  const PRIORITY_LABELS: Record<1 | 2 | 3 | 4, string> = {
    4: "P1 - Urgente",
    3: "P2 - Alto",
    2: "P3 - Médio",
    1: "P4 - Baixo",
  };

  // Função para ordenar as tarefas com foco em revisão (ex: mais antigas, sem prazo)
  const sortTasksForSeiso = useCallback((tasks: TodoistTask[]): TodoistTask[] => {
    return [...tasks].sort((a, b) => {
      // Priorizar tarefas sem prazo ou com prazo muito distante (indicando que podem estar 'paradas')
      const hasDueA = !!(a.due?.datetime || a.due?.date);
      const hasDueB = !!(b.due?.datetime || b.due?.date);

      if (!hasDueA && hasDueB) return -1; // A sem prazo, B com prazo -> A vem primeiro
      if (hasDueA && !hasDueB) return 1; // B sem prazo, A com prazo -> B vem primeiro

      // Se ambos têm prazo, priorizar as mais antigas
      if (hasDueA && hasDueB) {
        const dateA = new Date(a.due?.datetime || a.due?.date!).getTime();
        const dateB = new Date(b.due?.datetime || b.due?.date!).getTime();
        if (dateA !== dateB) {
          return dateA - dateB; // Mais antigas primeiro
        }
      }

      // Se ambos sem prazo ou com prazo igual, priorizar as mais antigas por data de criação
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

  const handleNextTask = useCallback(() => {
    if (currentTaskIndex < tasksToReview.length - 1) {
      setCurrentTaskIndex((prev) => prev + 1);
    } else {
      setSeisoState("finished");
      toast.success("Limpeza e revisão de tarefas concluída!");
    }
  }, [currentTaskIndex, tasksToReview.length]);

  const handleKeep = useCallback(() => {
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
        <Card className="p-6 rounded-xl shadow-lg bg-white flex flex-col h-full max-w-2xl mx-auto mt-8">
          <p className="text-center text-xl font-medium mb-6 text-gray-700">
            Revisando tarefa {currentTaskIndex + 1} de {tasksToReview.length}
          </p>
          <div className="flex-grow">
            <h3 className="text-2xl font-bold mb-3 text-gray-800">{currentTask.content}</h3>
            {currentTask.description && (
              <p className="text-md text-gray-700 mb-4 whitespace-pre-wrap">{currentTask.description}</p>
            )}
          </div>
          <div className="flex items-center justify-between text-sm text-gray-500 mt-auto pt-4 border-t border-gray-200">
            {currentTask.due?.datetime ? (
              <span>Vencimento: {format(new Date(currentTask.due.datetime), "dd/MM/yyyy HH:mm", { locale: ptBR })}</span>
            ) : currentTask.due?.date ? (
              <span>Vencimento: {format(new Date(currentTask.due.date), "dd/MM/yyyy", { locale: ptBR })}</span>
            ) : (
              <span>Sem prazo</span>
            )}
            <span
              className={cn(
                "px-2 py-1 rounded-full text-white text-xs font-medium",
                PRIORITY_COLORS[currentTask.priority],
              )}
            >
              {PRIORITY_LABELS[currentTask.priority]}
            </span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6">
            <Button
              onClick={handleKeep}
              disabled={isLoading}
              className="bg-gray-200 hover:bg-gray-300 text-gray-800 py-3 text-md flex items-center justify-center"
            >
              <RotateCcw className="mr-2 h-5 w-5" /> Manter
            </Button>
            <Button
              onClick={() => handleComplete(currentTask.id)}
              disabled={isLoading}
              className="bg-green-500 hover:bg-green-600 text-white py-3 text-md flex items-center justify-center"
            >
              <Check className="mr-2 h-5 w-5" /> Concluir
            </Button>
            <Button
              onClick={() => handleDelete(currentTask.id)}
              disabled={isLoading}
              className="bg-red-500 hover:bg-red-600 text-white py-3 text-md flex items-center justify-center"
            >
              <Trash2 className="mr-2 h-5 w-5" /> Excluir
            </Button>
          </div>
        </Card>
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