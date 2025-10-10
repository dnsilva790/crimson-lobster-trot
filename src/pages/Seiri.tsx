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
import { ChevronDown, ChevronUp, Bug } from "lucide-react"; // Importar ícones

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

  // Estados para o painel de depuração
  const [showDebug, setShowDebug] = useState(false);
  const [debugInfo, setDebugInfo] = useState<{
    apiFilterUsed: string;
    rawTasksCount: number;
    filteredTasksCount: number;
    sortedTasksCount: number;
    currentReviewState: ReviewState;
  } | null>(null);

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
    const finalFilter = todoistFilter || undefined; // Se o filtro estiver vazio, buscar todas as tarefas

    // Inclua subtarefas e tarefas recorrentes para uma revisão abrangente
    const fetchedTasks = await fetchTasks(finalFilter, true); 
    
    let filteredTasksAfterInternalLogic: TodoistTask[] = [];
    if (fetchedTasks) {
      // A lógica de filtragem de subtasks e recorrentes já está em TodoistContext.tsx
      // Se `includeSubtasksAndRecurring` for `true`, `fetchTasks` retorna todas.
      // Se for `false` ou `undefined` E `filter` for `undefined`, ele filtra.
      // Como estamos passando `true`, `fetchedTasks` já deve conter tudo.
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

    // Atualizar informações de depuração
    setDebugInfo({
      apiFilterUsed: finalFilter || "Nenhum (todas as tarefas)",
      rawTasksCount: fetchedTasks ? fetchedTasks.length : 0,
      filteredTasksCount: filteredTasksAfterInternalLogic.length,
      sortedTasksCount: sortedTasks.length,
      currentReviewState: sortedTasks.length > 0 ? "reviewing" : "finished",
    });

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

  const currentTask = tasksToReview[currentTaskIndex];

  return (
    <div className="p-4">
      <h2 className="text-3xl font-bold mb-2 text-gray-800">📋 SEIRI - Separar o Essencial</h2>
      <p className="text-lg text-gray-600 mb-6">Decida: esta tarefa é realmente necessária?</p>

      {/* Botão de Debug */}
      <div className="flex justify-end mb-4">
        <Button variant="outline" onClick={() => setShowDebug(!showDebug)} className="flex items-center gap-2">
          <Bug className="h-4 w-4" /> Debug {showDebug ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </Button>
      </div>

      {/* Painel de Debug */}
      {showDebug && debugInfo && (
        <div className="bg-gray-100 p-4 rounded-md shadow-inner mb-6 text-sm text-gray-700">
          <h3 className="font-bold text-lg mb-2 flex items-center gap-2">
            <Bug className="h-5 w-5" /> Informações de Depuração
          </h3>
          <p><strong>Estado Atual:</strong> {debugInfo.currentReviewState}</p>
          <p><strong>Filtro da API Usado:</strong> {debugInfo.apiFilterUsed}</p>
          <p><strong>Tarefas Brutas da API (Contagem):</strong> {debugInfo.rawTasksCount}</p>
          <p><strong>Tarefas Após Filtragem Interna (Contagem):</strong> {debugInfo.filteredTasksCount}</p>
          <p><strong>Tarefas Após Ordenação Seiri (Contagem):</strong> {debugInfo.sortedTasksCount}</p>
          <p><strong>Índice da Tarefa Atual:</strong> {currentTaskIndex}</p>
          <p><strong>Tarefas Restantes para Revisar:</strong> {tasksToReview.length - currentTaskIndex}</p>
        </div>
      )}

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
            <Input
              type="text"
              id="task-filter"
              placeholder="Opcional: insira um filtro do Todoist (padrão: todas as tarefas)..."
              value={filterInput}
              onChange={(e) => setFilterInput(e.target.value)}
              className="mt-1"
              disabled={isLoading}
            />
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