"use client";

import React, { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useTodoist } from "@/context/TodoistContext";
import { TodoistTask } from "@/lib/types";
import LoadingSpinner from "@/components/ui/loading-spinner";
import { toast } from "sonner";
import { format, parseISO, isValid, addHours, isBefore } from "date-fns";
import { ptBR } from "date-fns/locale";
import { CheckSquare } from "lucide-react";
import TaskReviewCard from "@/components/TaskReviewCard";
import { calculateNextFullHour } from "@/utils/dateUtils";

// Storage keys for daily review entries (not used in UI, but kept for data integrity)
const DAILY_REVIEW_STORAGE_KEY_PREFIX = "shitsuke_daily_review_";

interface DailyReviewEntry {
  date: string; // YYYY-MM-DD
  reflection: string;
  improvements: string;
  createdAt: string;
  updatedAt: string;
}

const Shitsuke = () => {
  const { fetchTasks, closeTask, deleteTask, updateTask, isLoading: isLoadingTodoist } = useTodoist();
  const [tasksToReview, setTasksToReview] = useState<TodoistTask[]>([]);
  const [currentTaskIndex, setCurrentTaskIndex] = useState<number>(0);
  const [reviewState, setReviewState] = useState<"initial" | "reviewing" | "finished">("initial");
  const [nextRescheduleTime, setNextRescheduleTime] = useState<Date | null>(null);

  const todayKey = format(new Date(), "yyyy-MM-dd");
  const dailyReviewStorageKey = `${DAILY_REVIEW_STORAGE_KEY_PREFIX}${todayKey}`;

  // Placeholder for daily review loading/saving logic (not exposed in UI)
  const loadDailyReview = useCallback(() => {
    const storedEntry = localStorage.getItem(dailyReviewStorageKey);
    if (storedEntry) {
      const parsedEntry: DailyReviewEntry = JSON.parse(storedEntry);
      // Do something with parsedEntry if needed, but not for UI display
    }
  }, [dailyReviewStorageKey]);

  const saveDailyReview = useCallback(() => {
    const now = new Date().toISOString();
    const entry: DailyReviewEntry = {
      date: todayKey,
      reflection: "", // Not collecting from UI
      improvements: "", // Not collecting from UI
      createdAt: "", // Placeholder
      updatedAt: now,
    };
    localStorage.setItem(dailyReviewStorageKey, JSON.stringify(entry));
  }, [todayKey, dailyReviewStorageKey]);

  const sortTasksForShitsuke = useCallback((tasks: TodoistTask[]): TodoistTask[] => {
    return [...tasks].sort((a, b) => {
      // 1. Starred tasks first
      const isAStarred = a.content.startsWith("*");
      const isBStarred = b.content.startsWith("*");
      if (isAStarred && !isBStarred) return -1;
      if (!isAStarred && isBStarred) return 1;

      // 2. Priority: P1 (4) > P2 (3) > P3 (2) > P4 (1)
      if (b.priority !== a.priority) {
        return b.priority - a.priority;
      }

      // Helper to get date value, handling null/undefined and invalid dates
      const getDateValue = (dateString: string | null | undefined) => {
        if (typeof dateString === 'string' && dateString) {
          const parsedDate = parseISO(dateString);
          return isValid(parsedDate) ? parsedDate.getTime() : Infinity;
        }
        return Infinity; // Tasks without a date go last
      };

      // 3. Deadline: earliest first
      const deadlineA = getDateValue(a.deadline);
      const deadlineB = getDateValue(b.deadline);
      if (deadlineA !== deadlineB) {
        return deadlineA - deadlineB;
      }

      // 4. Due date/time: earliest first
      const dueDateTimeA = getDateValue(a.due?.datetime);
      const dueDateTimeB = getDateValue(b.due?.datetime);
      if (dueDateTimeA !== dueDateTimeB) {
        return dueDateTimeA - dueDateTimeB;
      }

      const dueDateA = getDateValue(a.due?.date);
      const dueDateB = getDateValue(b.due?.date);
      if (dueDateA !== dueDateB) { 
        return dueDateA - dueDateB;
      }

      return 0; // No difference
    });
  }, []);

  const loadTasksForReview = useCallback(async () => {
    setReviewState("initial");
    setCurrentTaskIndex(0);
    setNextRescheduleTime(null);

    try {
      const tasks = await fetchTasks("due before: in 0 min", { includeSubtasks: false, includeRecurring: false });
      const filtered = tasks.filter(task => !task.is_completed);
      
      if (filtered.length > 0) {
        const sortedTasks = sortTasksForShitsuke(filtered);
        setTasksToReview(sortedTasks);
        setReviewState("reviewing");
        toast.success(`Carregadas ${sortedTasks.length} tarefas do backlog para revisão.`);
      } else {
        setTasksToReview([]);
        setReviewState("finished");
        toast.info("Nenhuma tarefa no backlog para revisar. Bom trabalho!");
      }
    } catch (error) {
      console.error("Failed to fetch backlog tasks:", error);
      toast.error("Falha ao carregar tarefas do backlog.");
      setTasksToReview([]);
      setReviewState("finished");
    }
  }, [fetchTasks, sortTasksForShitsuke]);

  useEffect(() => {
    loadTasksForReview();
    loadDailyReview();
  }, [loadTasksForReview, loadDailyReview]);

  const handleNextTask = useCallback(() => {
    setTasksToReview(prevTasks => {
      const updatedTasks = prevTasks.filter((_, index) => index !== currentTaskIndex);
      
      if (updatedTasks.length === 0) {
        setReviewState("finished");
        setCurrentTaskIndex(0);
        toast.success("Revisão de tarefas concluída!");
        return [];
      } else {
        const newIndex = currentTaskIndex >= updatedTasks.length ? 0 : currentTaskIndex;
        setCurrentTaskIndex(newIndex);
        return updatedTasks;
      }
    });
  }, [currentTaskIndex]);

  const handleKeepCurrentDate = useCallback(() => {
    toast.info("Tarefa mantida com a data atual.");
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

  const handleUpdateFieldDeadline = useCallback(async (taskId: string, deadlineDate: string | null) => {
    const updated = await updateTask(taskId, { deadline: deadlineDate });
    if (updated) {
      setTasksToReview(prevTasks =>
        prevTasks.map(task =>
          task.id === taskId ? { ...task, deadline: updated.deadline } : task
        )
      );
      toast.success("Deadline da tarefa atualizado com sucesso!");
    } else {
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
          task.id === taskId ? { ...task, duration: updated.duration, estimatedDurationMinutes: updated.estimatedDurationMinutes } : task
        )
      );
      toast.success(`Duração da tarefa atualizada para: ${duration !== null ? `${duration} minutos` : 'nenhuma'}!`);
    } else {
      toast.error("Falha ao atualizar a duração da tarefa.");
    }
  }, [tasksToReview, updateTask]);

  const handleRescheduleTask = useCallback(async (taskId: string) => {
    const now = new Date();
    let newRescheduleDateTime: Date;

    if (nextRescheduleTime) {
      newRescheduleDateTime = addHours(nextRescheduleTime, 1);
      if (isBefore(newRescheduleDateTime, now)) {
        newRescheduleDateTime = parseISO(calculateNextFullHour(now).datetime);
      }
    } else {
      newRescheduleDateTime = parseISO(calculateNextFullHour(now).datetime);
    }

    const formattedDateTime = format(newRescheduleDateTime, "yyyy-MM-dd'T'HH:mm:ss");

    const updated = await updateTask(taskId, {
      due_date: null,
      due_datetime: formattedDateTime,
    });

    if (updated) {
      setNextRescheduleTime(newRescheduleDateTime);
      toast.success(`Tarefa reprogramada para ${format(newRescheduleDateTime, "dd/MM/yyyy HH:mm", { locale: ptBR })}!`);
      handleNextTask();
    } else {
      toast.error("Falha ao reprogramar a tarefa.");
    }
  }, [updateTask, handleNextTask, nextRescheduleTime]);

  const currentTask = tasksToReview[currentTaskIndex];

  return (
    <div className="p-4">
      <h2 className="text-3xl font-bold mb-2 text-gray-800">
        <CheckSquare className="inline-block h-8 w-8 mr-2 text-green-600" /> SHITSUKE - Revisão de Backlog
      </h2>
      <p className="text-lg text-gray-600 mb-6">
        Repasse seu backlog, decida o que fazer e organize suas tarefas.
      </p>

      {isLoadingTodoist && (
        <div className="flex justify-center items-center h-48">
          <LoadingSpinner size={40} />
        </div>
      )}

      {!isLoadingTodoist && reviewState === "initial" && (
        <div className="text-center mt-10">
          <p className="text-lg text-gray-600 mb-6">
            Clique no botão abaixo para carregar as tarefas do seu backlog (`due before: in 0 min`) para revisão.
          </p>
          <Button
            onClick={loadTasksForReview}
            className="px-8 py-4 text-xl bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors duration-200"
          >
            Iniciar Revisão de Backlog
          </Button>
        </div>
      )}

      {!isLoadingTodoist && reviewState === "reviewing" && currentTask && (
        <div className="grid grid-cols-1 lg:grid-cols-1 gap-6">
          <div>
            <p className="text-center text-xl font-medium mb-6 text-gray-700">
              Revisando tarefa {currentTaskIndex + 1} de {tasksToReview.length}
            </p>
            <TaskReviewCard
              task={currentTask}
              onKeep={handleKeepCurrentDate}
              onComplete={handleComplete}
              onDelete={handleDelete}
              onUpdateCategory={handleUpdateCategory}
              onUpdatePriority={handleUpdatePriority}
              onUpdateDeadline={handleUpdateDeadline}
              onUpdateFieldDeadline={handleUpdateFieldDeadline}
              onReschedule={handleRescheduleTask}
              onUpdateDuration={handleUpdateDuration}
              isLoading={isLoadingTodoist}
            />
          </div>
        </div>
      )}

      {!isLoadingTodoist && reviewState === "finished" && (
        <div className="text-center mt-10">
          <p className="text-2xl font-semibold text-gray-700 mb-4">
            ✅ Revisão de backlog concluída!
          </p>
          <p className="text-lg text-gray-600 mb-6">
            Você revisou todas as {tasksToReview.length} tarefas.
          </p>
          <Button
            onClick={loadTasksForReview}
            className="px-8 py-4 text-xl bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-colors duration-200"
          >
            Revisar Novamente
          </Button>
        </div>
      )}
    </div>
  );
};

export default Shitsuke;