"use client";

import React, { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { useTodoist } from "@/context/TodoistContext";
import { TodoistTask } from "@/lib/types";
import LoadingSpinner from "@/components/ui/loading-spinner";
import { toast } from "sonner";
import TaskReviewCard from "@/components/TaskReviewCard";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { XCircle } from "lucide-react"; // Importar ícones

type ReviewState = "initial" | "reviewing" | "finished";

const Seiri = () => {
  const { fetchTasks, closeTask, deleteTask, updateTask, isLoading } = useTodoist();
  const [tasksToReview, setTasksToReview] = useState<TodoistTask[]>([]);
  const [currentTaskIndex, setCurrentTaskIndex] = useState<number>(0);
  const [reviewState, setReviewState] = useState<ReviewState>("initial");
  const [filterInput, setFilterInput] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('seiri_filter_input') || "";
    }
    return "";
  });

  // Save filter to localStorage whenever it changes
  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('seiri_filter_input', filterInput);
    }
  }, [filterInput]);

  // Função para ordenar as tarefas com base nos critérios combinados, priorizando due date
  const sortTasks = useCallback((tasks: TodoistTask[]): TodoistTask[] => {
    return [...tasks].sort((a, b) => {
      // 1. Tarefas iniciadas com "*" primeiro
      const isAStarred = a.content.startsWith("*");
      const isBStarred = b.content.startsWith("*");
      if (isAStarred && !isBStarred) return -1;
      if (!isAStarred && isBStarred) return 1;

      // 2. Em seguida, por prioridade (P1 > P4)
      if (b.priority !== a.priority) {
        return b.priority - a.priority;
      }

      // 3. Depois, por prazo (due date/time > due date)
      const getTaskDate = (task: TodoistTask) => {
        if (task.due?.datetime) return new Date(task.due.datetime).getTime();
        if (task.due?.date) return new Date(task.due.date).getTime();
        return Infinity; // Tarefas sem prazo vão para o final
      };

      const dateA = getTaskDate(a);
      const dateB = getTaskDate(b);

      if (dateA !== dateB) {
        return dateA - dateB; // Mais próximo primeiro
      }

      // 4. Desempate final: por data de criação (mais antiga primeiro)
      return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
    });
  }, []);

  const loadTasks = useCallback(async () => {
    setReviewState("initial");
    setCurrentTaskIndex(0);

    const todoistFilter = filterInput.trim();
    const finalFilter = todoistFilter || undefined; 
    
    // Alterado para 'false' para excluir subtarefas e tarefas recorrentes
    const fetchedTasks = await fetchTasks(finalFilter, false); 
    
    let filteredTasksAfterInternalLogic: TodoistTask[] = [];
    if (fetchedTasks) {
      filteredTasksAfterInternalLogic = fetchedTasks;
    }

    let sortedTasks: TodoistTask[] = [];
    if (filteredTasksAfterInternalLogic.length > 0) {
      sortedTasks = sortTasks(filteredTasksAfterInternalLogic); // Aplicar ordenação combinada
      setTasksToReview(sortedTasks);
      setReviewState("reviewing");
      toast.info(`Encontradas ${sortedTasks.length} tarefas para revisar.`);
    } else {
      setTasksToReview([]);
      setReviewState("finished");
      toast.info("Nenhuma tarefa encontrada para revisar. Bom trabalho!");
    }

  }, [fetchTasks, sortTasks, filterInput]);

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

  const handleUpdateCategory = useCallback(async (taskId: string, newCategory: "pessoal" | "profissional" | "none") => {
    const taskToUpdate = tasksToReview.find(task => task.id === taskId);
    if (!taskToUpdate) return;

    let updatedLabels = taskToUpdate.labels.filter(
      label => label !== "pessoal" && label !== "profissional"
    );

    if (newCategory === "pessoal") {
      updatedLabels.push("pessoal");
    } else if (newCategory === "profissional") {
      updatedLabels.push("profissional");
    }

    const updated = await updateTask(taskId, { labels: updatedLabels });
    if (updated) {
      setTasksToReview(prevTasks =>
        prevTasks.map(task =>
          task.id === taskId ? { ...task, labels: updatedLabels } : task
        )
      );
      toast.success(`Categoria da tarefa atualizada para: ${newCategory === "none" ? "Nenhum" : newCategory}!`);
    } else {
      toast.error("Falha ao atualizar a categoria da tarefa.");
    }
  }, [tasksToReview, updateTask]);

  const handleUpdatePriority = useCallback(async (taskId: string, newPriority: 1 | 2 | 3 | 4) => {
    const updated = await updateTask(taskId, { priority: newPriority });
    if (updated) {
      setTasksToReview(prevTasks =>
        prevTasks.map(task =>
          task.id === taskId ? { ...task, priority: newPriority } : task
        )
      );
      toast.success(`Prioridade da tarefa atualizada para P${newPriority}!`);
    } else {
      toast.error("Falha ao atualizar a prioridade da tarefa.");
    }
  }, [tasksToReview, updateTask]);

  const handleUpdateDeadline = useCallback(async (taskId: string, dueDate: string | null, dueDateTime: string | null) => {
    const updated = await updateTask(taskId, { due_date: dueDate, due_datetime: dueDateTime });
    if (updated) {
      setTasksToReview(prevTasks =>
        prevTasks.map(task =>
          task.id === taskId ? { ...task, due: updated.due } : task
        )
      );
      toast.success("Prazo da tarefa atualizado com sucesso!");
    } else {
      toast.error("Falha ao atualizar o prazo da tarefa.");
    }
  }, [tasksToReview, updateTask]);

  const handleClearFilter = useCallback(() => {
    setFilterInput(""); // Limpa o input do filtro
    // loadTasks será chamado automaticamente pelo useEffect do filterInput,
    // ou pode ser chamado explicitamente aqui se preferir um comportamento imediato.
    // Por enquanto, deixaremos o useEffect lidar com isso.
  }, []);

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
          <div className="grid w-full items-center gap-1.5 mb-6 max-w-md mx-auto">
            <Label htmlFor="task-filter" className="text-left text-gray-600 font-medium">
              Filtro de Tarefas (ex: "hoje", "p1", "#projeto")
            </Label>
            <div className="relative flex items-center mt-1">
              <Input
                type="text"
                id="task-filter"
                placeholder="Opcional: insira um filtro do Todoist (padrão: todas as tarefas)..."
                value={filterInput}
                onChange={(e) => setFilterInput(e.target.value)}
                className="pr-10" // Adiciona padding para o botão
                disabled={isLoading}
              />
              {filterInput && ( // Mostra o botão apenas se houver texto no filtro
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={handleClearFilter}
                  className="absolute right-0 top-0 h-full px-3"
                  disabled={isLoading}
                >
                  <XCircle className="h-4 w-4" />
                </Button>
              )}
            </div>
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
            onUpdateCategory={handleUpdateCategory}
            onUpdatePriority={handleUpdatePriority}
            onUpdateDeadline={handleUpdateDeadline} // Passando a nova função
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