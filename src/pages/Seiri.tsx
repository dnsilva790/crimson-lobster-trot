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
import { XCircle } from "lucide-react";
import { format, parseISO, isValid } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { calculateNext15MinInterval } from '@/utils/dateUtils';

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

  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('seiri_filter_input', filterInput);
    }
  }, [filterInput]);

  const sortTasks = useCallback((tasks: TodoistTask[]): TodoistTask[] => {
    return [...tasks].sort((a, b) => {
      const isAStarred = a.content.startsWith("*");
      const isBStarred = b.content.startsWith("*");
      if (isAStarred && !isBStarred) return -1;
      if (!isAStarred && isBStarred) return 1;

      const getDeadlineValue = (task: TodoistTask) => { // Adicionado
        if (typeof task.deadline === 'string' && task.deadline) return parseISO(task.deadline).getTime();
        return Infinity;
      };
      const deadlineA = getDeadlineValue(a);
      const deadlineB = getDeadlineValue(b);
      if (deadlineA !== deadlineB) {
        return deadlineA - deadlineB;
      }

      if (b.priority !== a.priority) {
        return b.priority - a.priority;
      }

      const getTaskDate = (task: TodoistTask) => {
        if (typeof task.due?.datetime === 'string' && task.due.datetime) {
          const parsedDate = parseISO(task.due.datetime);
          return isValid(parsedDate) ? parsedDate.getTime() : Infinity;
        }
        if (typeof task.due?.date === 'string' && task.due.date) {
          const parsedDate = parseISO(task.due.date);
          return isValid(parsedDate) ? parsedDate.getTime() : Infinity;
        }
        return Infinity;
      };

      const dateA = getTaskDate(a);
      const dateB = getTaskDate(b);

      if (dateA !== dateB) {
        return dateA - dateB;
      }

      const createdAtA = (typeof a.created_at === 'string' && a.created_at) ? parseISO(a.created_at) : null;
      const createdAtB = (typeof b.created_at === 'string' && b.created_at) ? parseISO(b.created_at) : null;
      
      if (createdAtA && createdAtB && isValid(createdAtA) && isValid(createdAtB)) {
        return createdAtA.getTime() - createdAtB.getTime();
      }
      return 0;
    });
  }, []);

  const loadTasks = useCallback(async () => {
    setReviewState("initial");
    setCurrentTaskIndex(0);

    const todoistFilter = filterInput.trim();
    const finalFilter = todoistFilter || undefined; 
    
    const fetchedTasks = await fetchTasks(finalFilter, { includeSubtasks: false, includeRecurring: false }); 
    
    let filteredTasksAfterInternalLogic: TodoistTask[] = [];
    if (fetchedTasks) {
      filteredTasksAfterInternalLogic = fetchedTasks;
    }

    let sortedTasks: TodoistTask[] = [];
    if (filteredTasksAfterInternalLogic.length > 0) {
      sortedTasks = sortTasks(filteredTasksAfterInternalLogic);
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

  const handleUpdateFieldDeadline = useCallback(async (taskId: string, deadlineDate: string | null) => { // Adicionado
    console.log("Seiri: onUpdateFieldDeadline called. Task ID:", taskId, "Deadline Date:", deadlineDate);
    const updated = await updateTask(taskId, { deadline: deadlineDate });
    if (updated) {
      console.log("Seiri: Task updated successfully. New deadline from API:", updated.deadline);
      setTasksToReview(prevTasks =>
        prevTasks.map(task =>
          task.id === taskId ? { ...task, deadline: updated.deadline } : task
        )
      );
      toast.success("Deadline da tarefa atualizado com sucesso!");
    } else {
      console.error("Seiri: Failed to update task deadline.");
      toast.error("Falha ao atualizar o deadline da tarefa.");
    }
  }, [tasksToReview, updateTask]);

  const handleUpdateDuration = useCallback(async (taskId: string, duration: number | null) => {
    const updated = await updateTask(taskId, {
      duration: duration,
      duration_unit: duration !== null ? "minute" : undefined,
    });
    if (updated) {
      setTasksToReview(prevTasks =>
        prevTasks.map(task =>
          task.id === taskId ? { ...task, duration: updated.duration } : task
        )
      );
      toast.success(`Duração da tarefa atualizada para: ${duration !== null ? `${duration} minutos` : 'nenhuma'}!`);
    } else {
      toast.error("Falha ao atualizar a duração da tarefa.");
    }
  }, [tasksToReview, updateTask]);

  const handlePostpone = useCallback(async (taskId: string) => {
    const nextInterval = calculateNext15MinInterval(new Date());
    const updated = await updateTask(taskId, {
      due_date: nextInterval.date,
      due_datetime: nextInterval.datetime,
    });
    if (updated) {
      toast.success(`Tarefa postergada para ${format(parseISO(nextInterval.datetime), "dd/MM/yyyy HH:mm", { locale: ptBR })}!`);
      handleNextTask();
    } else {
      toast.error("Falha ao postergar a tarefa.");
    }
  }, [updateTask, handleNextTask]);


  const handleClearFilter = useCallback(() => {
    setFilterInput("");
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
                className="pr-10"
                disabled={isLoading}
              />
              {filterInput && (
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
            onUpdateDeadline={handleUpdateDeadline}
            onUpdateFieldDeadline={handleUpdateFieldDeadline} // Adicionado
            onPostpone={handlePostpone}
            onUpdateDuration={handleUpdateDuration}
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