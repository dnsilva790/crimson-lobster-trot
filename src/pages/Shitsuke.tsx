"use client";

import React, { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useTodoist } from "@/context/TodoistContext";
import { TodoistTask } from "@/lib/types";
import LoadingSpinner from "@/components/ui/loading-spinner";
import { toast } from "sonner";
import { format, parseISO, isValid, isPast, isToday } from "date-fns";
import { ptBR } from "date-fns/locale";
import { CheckSquare } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { calculateNext15MinInterval } from "@/utils/dateUtils";
import TaskReviewCard from "@/components/TaskReviewCard"; // Importar TaskReviewCard

// Storage keys for daily review entries
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
  const [reflection, setReflection] = useState<string>("");
  const [improvements, setImprovements] = useState<string>("");
  const [currentReviewEntry, setCurrentReviewEntry] = useState<DailyReviewEntry | null>(null);

  const todayKey = format(new Date(), "yyyy-MM-dd");
  const dailyReviewStorageKey = `${DAILY_REVIEW_STORAGE_KEY_PREFIX}${todayKey}`;

  const loadDailyReview = useCallback(() => {
    const storedEntry = localStorage.getItem(dailyReviewStorageKey);
    if (storedEntry) {
      const parsedEntry: DailyReviewEntry = JSON.parse(storedEntry);
      setCurrentReviewEntry(parsedEntry);
      setReflection(parsedEntry.reflection);
      setImprovements(parsedEntry.improvements);
    } else {
      setCurrentReviewEntry(null);
      setReflection("");
      setImprovements("");
    }
  }, [dailyReviewStorageKey]);

  const saveDailyReview = useCallback(() => {
    const now = new Date().toISOString();
    const entry: DailyReviewEntry = {
      date: todayKey,
      reflection: reflection.trim(),
      improvements: improvements.trim(),
      createdAt: currentReviewEntry?.createdAt || now,
      updatedAt: now,
    };
    localStorage.setItem(dailyReviewStorageKey, JSON.stringify(entry));
    setCurrentReviewEntry(entry);
    toast.success("Revisão diária salva!");
  }, [reflection, improvements, todayKey, dailyReviewStorageKey, currentReviewEntry]);

  const fetchTodayTasks = useCallback(async () => {
    setReviewState("initial"); // Set to initial to show loading state
    setCurrentTaskIndex(0); // Reset index
    try {
      const tasks = await fetchTasks("today | overdue", { includeSubtasks: false, includeRecurring: false });
      const filtered = tasks.filter(task => !task.is_completed); // Only show incomplete tasks
      
      if (filtered.length > 0) {
        setTasksToReview(filtered);
        setReviewState("reviewing");
        toast.success(`Carregadas ${filtered.length} tarefas para revisão diária.`);
      } else {
        setTasksToReview([]);
        setReviewState("finished");
        toast.info("Nenhuma tarefa para hoje ou atrasada. Bom trabalho!");
      }
    } catch (error) {
      console.error("Failed to fetch today's tasks:", error);
      toast.error("Falha ao carregar tarefas do dia.");
      setTasksToReview([]);
      setReviewState("finished");
    }
  }, [fetchTasks]);

  useEffect(() => {
    fetchTodayTasks();
    loadDailyReview();
  }, [fetchTodayTasks, loadDailyReview]);

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

  const currentTask = tasksToReview[currentTaskIndex];

  return (
    <div className="p-4">
      <h2 className="text-3xl font-bold mb-2 text-gray-800">
        <CheckSquare className="inline-block h-8 w-8 mr-2 text-green-600" /> SHITSUKE - Revisão Diária
      </h2>
      <p className="text-lg text-gray-600 mb-6">
        Reflita sobre o seu dia, celebre conquistas e prepare-se para amanhã.
      </p>

      {isLoadingTodoist && (
        <div className="flex justify-center items-center h-48">
          <LoadingSpinner size={40} />
        </div>
      )}

      {!isLoadingTodoist && reviewState === "initial" && (
        <div className="text-center mt-10">
          <p className="text-lg text-gray-600 mb-6">
            Clique no botão abaixo para carregar as tarefas de hoje e atrasadas para revisão.
          </p>
          <Button
            onClick={fetchTodayTasks}
            className="px-8 py-4 text-xl bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors duration-200"
          >
            Iniciar Revisão Diária
          </Button>
        </div>
      )}

      {!isLoadingTodoist && reviewState === "reviewing" && currentTask && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div>
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
              onUpdateFieldDeadline={handleUpdateFieldDeadline}
              onPostpone={handlePostpone}
              onUpdateDuration={handleUpdateDuration}
              isLoading={isLoadingTodoist}
            />
          </div>

          <div>
            <Card className="mb-6 p-6">
              <CardHeader>
                <CardTitle className="text-xl font-bold text-gray-800">
                  Reflexão do Dia ({format(new Date(), "dd/MM/yyyy", { locale: ptBR })})
                </CardTitle>
              </CardHeader>
              <CardContent className="grid gap-4">
                <div>
                  <Label htmlFor="reflection" className="text-gray-700">O que funcionou bem hoje?</Label>
                  <Textarea
                    id="reflection"
                    value={reflection}
                    onChange={(e) => setReflection(e.target.value)}
                    placeholder="Ex: Consegui manter o foco nas P1s, a técnica Pomodoro ajudou."
                    rows={5}
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label htmlFor="improvements" className="text-gray-700">O que poderia ser melhorado amanhã?</Label>
                  <Textarea
                    id="improvements"
                    value={improvements}
                    onChange={(e) => setImprovements(e.target.value)}
                    placeholder="Ex: Preciso planejar melhor as pausas, evitar distrações no celular."
                    rows={5}
                    className="mt-1"
                  />
                </div>
                <Button onClick={saveDailyReview} className="w-full">
                  Salvar Reflexão
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {!isLoadingTodoist && reviewState === "finished" && (
        <div className="text-center mt-10">
          <p className="text-2xl font-semibold text-gray-700 mb-4">
            ✅ Revisão de tarefas concluída!
          </p>
          <p className="text-lg text-gray-600 mb-6">
            Você revisou todas as {tasksToReview.length} tarefas.
          </p>
          <Button
            onClick={fetchTodayTasks}
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