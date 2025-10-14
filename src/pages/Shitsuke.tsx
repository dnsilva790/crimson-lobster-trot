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
import { CheckSquare, CalendarIcon, Clock, ExternalLink, Check, ArrowRight, XCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { calculateNext15MinInterval } from "@/utils/dateUtils";

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
  const { fetchTasks, closeTask, updateTask, isLoading: isLoadingTodoist } = useTodoist();
  const [todayTasks, setTodayTasks] = useState<TodoistTask[]>([]);
  const [isLoadingTasks, setIsLoadingTasks] = useState(false);
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
    setIsLoadingTasks(true);
    try {
      const tasks = await fetchTasks("today | overdue", { includeSubtasks: false, includeRecurring: false });
      const filtered = tasks.filter(task => !task.is_completed); // Only show incomplete tasks
      setTodayTasks(filtered);
      toast.success(`Carregadas ${filtered.length} tarefas para revisão diária.`);
    } catch (error) {
      console.error("Failed to fetch today's tasks:", error);
      toast.error("Falha ao carregar tarefas do dia.");
    } finally {
      setIsLoadingTasks(false);
    }
  }, [fetchTasks]);

  useEffect(() => {
    fetchTodayTasks();
    loadDailyReview();
  }, [fetchTodayTasks, loadDailyReview]);

  const handleCompleteTask = useCallback(async (taskId: string) => {
    const success = await closeTask(taskId);
    if (success !== undefined) {
      toast.success("Tarefa concluída!");
      fetchTodayTasks(); // Refresh tasks
    }
  }, [closeTask, fetchTodayTasks]);

  const handlePostponeTask = useCallback(async (taskId: string) => {
    const nextInterval = calculateNext15MinInterval(new Date());
    const updated = await updateTask(taskId, {
      due_date: nextInterval.date,
      due_datetime: nextInterval.datetime,
    });
    if (updated) {
      toast.success(`Tarefa postergada para ${format(parseISO(nextInterval.datetime), "dd/MM/yyyy HH:mm", { locale: ptBR })}!`);
      fetchTodayTasks(); // Refresh tasks
    } else {
      toast.error("Falha ao postergar a tarefa.");
    }
  }, [updateTask, fetchTodayTasks]);

  const renderTaskItem = (task: TodoistTask) => {
    const isOverdue = (task.due?.date && isPast(parseISO(task.due.date)) && !isToday(parseISO(task.due.date))) ||
                      (task.due?.datetime && isPast(parseISO(task.due.datetime)) && !isToday(parseISO(task.due.datetime)));
    const isDueToday = (task.due?.date && isToday(parseISO(task.due.date))) ||
                       (task.due?.datetime && isToday(parseISO(task.due.datetime)));

    const PRIORITY_COLORS: Record<1 | 2 | 3 | 4, string> = {
      4: "bg-red-500",
      3: "bg-orange-500",
      2: "bg-yellow-500",
      1: "bg-gray-400",
    };
  
    const PRIORITY_LABELS: Record<1 | 2 | 3 | 4, string> = {
      4: "P1",
      3: "P2",
      2: "P3",
      1: "P4",
    };

    const renderDueDateAndDuration = () => {
      const dateElements: JSX.Element[] = [];
  
      if (typeof task.due?.datetime === 'string' && task.due.datetime) {
        const parsedDate = parseISO(task.due.datetime);
        if (isValid(parsedDate)) {
          dateElements.push(
            <span key="due-datetime" className="flex items-center gap-1">
              <CalendarIcon className="h-3 w-3" /> {format(parsedDate, "dd/MM/yyyy HH:mm", { locale: ptBR })}
            </span>
          );
        }
      } else if (typeof task.due?.date === 'string' && task.due.date) {
        const parsedDate = parseISO(task.due.date);
        if (isValid(parsedDate)) {
          dateElements.push(
            <span key="due-date" className="flex items-center gap-1">
              <CalendarIcon className="h-3 w-3" /> {format(parsedDate, "dd/MM/yyyy", { locale: ptBR })}
            </span>
          );
        }
      }
  
      if (typeof task.deadline === 'string' && task.deadline) {
        const parsedDeadline = parseISO(task.deadline);
        if (isValid(parsedDeadline)) {
          dateElements.push(
            <span key="field-deadline" className="flex items-center gap-1 text-red-600 font-semibold">
              <CalendarIcon className="h-3 w-3" /> Deadline: {format(parsedDeadline, "dd/MM/yyyy", { locale: ptBR })}
            </span>
          );
        }
      }
  
      if (task.estimatedDurationMinutes) {
        dateElements.push(
          <span key="duration" className="flex items-center gap-1">
            <Clock className="h-3 w-3" /> {task.estimatedDurationMinutes} min
          </span>
        );
      }
  
      if (dateElements.length === 0) {
        return <span>Sem prazo</span>;
      }
  
      return <div className="flex flex-wrap gap-x-4 gap-y-1">{dateElements}</div>;
    };

    return (
      <Card
        key={task.id}
        className={cn(
          "p-4 rounded-xl shadow-sm bg-white flex flex-col",
          isOverdue && "border-l-4 border-red-500 bg-red-50",
          isDueToday && "border-l-4 border-yellow-500 bg-yellow-50"
        )}
      >
        <div className="flex-grow">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-lg font-bold text-gray-800">{task.content}</h3>
            <a href={task.url} target="_blank" rel="noopener noreferrer" className="ml-2 text-indigo-600 hover:text-indigo-800">
              <ExternalLink className="h-4 w-4" />
            </a>
          </div>
          {task.description && (
            <p className="text-sm text-gray-700 mb-3 whitespace-pre-wrap line-clamp-3">{task.description}</p>
          )}
        </div>
        <div className="flex items-center justify-between text-xs text-gray-500 mt-auto pt-3 border-t border-gray-200">
          {renderDueDateAndDuration()}
          <span
            className={cn(
              "px-2 py-1 rounded-full text-white text-xs font-medium",
              PRIORITY_COLORS[task.priority],
            )}
          >
            {PRIORITY_LABELS[task.priority]}
          </span>
        </div>
        <div className="grid grid-cols-2 gap-2 mt-4">
          <Button
            onClick={() => handleCompleteTask(task.id)}
            disabled={isLoadingTodoist}
            className="bg-green-500 hover:bg-green-600 text-white py-2 text-sm flex items-center justify-center"
          >
            <Check className="mr-2 h-4 w-4" /> Concluir
          </Button>
          <Button
            onClick={() => handlePostponeTask(task.id)}
            disabled={isLoadingTodoist}
            className="bg-yellow-500 hover:bg-yellow-600 text-white py-2 text-sm flex items-center justify-center"
          >
            <ArrowRight className="mr-2 h-4 w-4" /> Postergue
          </Button>
        </div>
      </Card>
    );
  };

  const isLoading = isLoadingTodoist || isLoadingTasks;

  return (
    <div className="p-4">
      <h2 className="text-3xl font-bold mb-2 text-gray-800">
        <CheckSquare className="inline-block h-8 w-8 mr-2 text-green-600" /> SHITSUKE - Revisão Diária
      </h2>
      <p className="text-lg text-gray-600 mb-6">
        Reflita sobre o seu dia, celebre conquistas e prepare-se para amanhã.
      </p>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div>
          <Card className="mb-6 p-6">
            <CardHeader>
              <CardTitle className="text-xl font-bold text-gray-800">
                Tarefas de Hoje ({todayTasks.length})
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {isLoading ? (
                <div className="flex justify-center items-center h-48">
                  <LoadingSpinner size={40} />
                </div>
              ) : todayTasks.length > 0 ? (
                <div className="space-y-4">
                  {todayTasks.map(renderTaskItem)}
                </div>
              ) : (
                <div className="p-6 text-center text-gray-600">
                  <p className="text-lg mb-2">Nenhuma tarefa para hoje ou atrasada!</p>
                  <p className="text-sm text-gray-500">
                    Bom trabalho! Aproveite para focar na reflexão.
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
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
    </div>
  );
};

export default Shitsuke;