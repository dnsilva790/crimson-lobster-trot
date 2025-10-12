"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useTodoist } from "@/context/TodoistContext";
import { TodoistTask } from "@/lib/types";
import LoadingSpinner from "@/components/ui/loading-spinner";
import { toast } from "sonner";
import { cn, getTaskCategory } from "@/lib/utils";
import { format, parseISO, isPast, isToday, isTomorrow, addDays, isValid } from "date-fns";
import { ptBR } from "date-fns/locale";
import { ArrowRight, Check, XCircle, Star, CalendarIcon, Clock, ExternalLink } from "lucide-react";
import { Badge } from "@/components/ui/badge";

type ReviewState = "initial" | "reviewing" | "finished";

interface OverdueCounts {
  1: number;
  2: number;
  3: number;
  4: number;
}

const SEITON_REVIEW_FILTER_INPUT_STORAGE_KEY = "seiton_review_filter_input";
const GTD_PROCESSED_LABEL = "gtd_processada";

// Ratios Fibonacci para P1:P2:P3:P4 (1:2:3:5)
const FIBONACCI_RATIOS = { 4: 1, 3: 2, 2: 3, 1: 5 };
const TOTAL_FIBONACCI_UNITS = Object.values(FIBONACCI_RATIOS).reduce((sum, ratio) => sum + ratio, 0); // 1 + 2 + 3 + 5 = 11

const SeitonReview = () => {
  const { fetchTasks, updateTask, isLoading: isLoadingTodoist } = useTodoist();
  const [reviewState, setReviewState] = useState<ReviewState>("initial");
  const [tasksToReview, setTasksToReview] = useState<TodoistTask[]>([]);
  const [currentTaskIndex, setCurrentTaskIndex] = useState<number>(0);
  const [filterInput, setFilterInput] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem(SEITON_REVIEW_FILTER_INPUT_STORAGE_KEY) || `no label:${GTD_PROCESSED_LABEL}`;
    }
    return `no label:${GTD_PROCESSED_LABEL}`;
  });
  const [overdueCounts, setOverdueCounts] = useState<OverdueCounts>({ 1: 0, 2: 0, 3: 0, 4: 0 });
  const [allTaskCountsByPriority, setAllTaskCountsByPriority] = useState<OverdueCounts>({ 1: 0, 2: 0, 3: 0, 4: 0 });


  const currentTask = tasksToReview[currentTaskIndex];
  const isLoading = isLoadingTodoist || reviewState === "loading";

  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem(SEITON_REVIEW_FILTER_INPUT_STORAGE_KEY, filterInput);
    }
  }, [filterInput]);

  const calculateOverdueCounts = useCallback(async (currentFilter: string) => {
    const counts: OverdueCounts = { 1: 0, 2: 0, 3: 0, 4: 0 };
    const now = new Date();

    const tasksForCounts = await fetchTasks(currentFilter, { includeSubtasks: false, includeRecurring: false });

    if (tasksForCounts) {
      tasksForCounts.forEach(task => {
        if ((typeof task.due?.date === 'string' && task.due.date) || (typeof task.due?.datetime === 'string' && task.due.datetime)) {
          const dueDate = (typeof task.due?.datetime === 'string' && task.due.datetime) ? parseISO(task.due.datetime) : (typeof task.due?.date === 'string' && task.due.date) ? parseISO(task.due.date) : null;
          if (dueDate && isValid(dueDate) && isPast(dueDate) && !isToday(dueDate)) {
            counts[task.priority]++;
          }
        }
      });
    }
    setOverdueCounts(counts);
  }, [fetchTasks]);

  const calculateAllTaskCountsByPriority = useCallback((tasks: TodoistTask[]) => {
    const counts: OverdueCounts = { 1: 0, 2: 0, 3: 0, 4: 0 };
    tasks.forEach(task => {
        counts[task.priority]++;
    });
    setAllTaskCountsByPriority(counts);
  }, []);

  const sortTasks = useCallback((tasks: TodoistTask[]): TodoistTask[] => {
    return [...tasks].sort((a, b) => {
      const isAStarred = a.content.startsWith("*");
      const isBStarred = b.content.startsWith("*");
      if (isAStarred && !isBStarred) return -1;
      if (!isAStarred && isBStarred) return 1;

      if (b.priority !== a.priority) {
        return b.priority - a.priority;
      }

      const getDeadlineValue = (task: TodoistTask) => {
        if (typeof task.deadline === 'string' && task.deadline) return parseISO(task.deadline).getTime();
        return Infinity;
      };
      const deadlineA = getDeadlineValue(a);
      const deadlineB = getDeadlineValue(b);
      if (deadlineA !== deadlineB) {
        return deadlineA - deadlineB;
      }

      const getDueDateValue = (task: TodoistTask) => {
        if (typeof task.due?.datetime === 'string' && task.due.datetime) return parseISO(task.due.datetime).getTime();
        if (typeof task.due?.date === 'string' && task.due.date) return parseISO(task.due.date).getTime();
        return Infinity;
      };
      const dueDateA = getDueDateValue(a);
      const dueDateB = getDueDateValue(b);
      if (dueDateA !== dueDateB) {
        return dueDateA - dueDateB;
      }

      const createdAtA = (typeof a.created_at === 'string' && a.created_at) ? parseISO(a.created_at) : null;
      const createdAtB = (typeof b.created_at === 'string' && b.created_at) ? parseISO(b.created_at) : null;
      
      if (createdAtA && createdAtB && isValid(createdAtA) && isValid(createdAtB)) {
        return createdAtA.getTime() - createdAtB.getTime();
      }
      return 0;
    });
  }, []);

  const loadTasksForReview = useCallback(async () => {
    setReviewState("loading");
    setCurrentTaskIndex(0);
    setTasksToReview([]);

    const fetchedTasks = await fetchTasks(filterInput, { includeSubtasks: false, includeRecurring: false });

    if (fetchedTasks && fetchedTasks.length > 0) {
      const sortedTasks = sortTasks(fetchedTasks);
      setTasksToReview(sortedTasks);
      setReviewState("reviewing");
      toast.success(`Encontradas ${sortedTasks.length} tarefas para revisão de prioridade.`);
      calculateAllTaskCountsByPriority(sortedTasks); // Calculate for all tasks
    } else {
      setTasksToReview([]);
      setReviewState("finished");
      toast.info("Nenhuma tarefa encontrada para revisão de prioridade com o filtro atual.");
      calculateAllTaskCountsByPriority([]); // Clear counts if no tasks
    }

    await calculateOverdueCounts(filterInput);
  }, [fetchTasks, filterInput, calculateOverdueCounts, sortTasks, calculateAllTaskCountsByPriority]);

  useEffect(() => {
    calculateOverdueCounts(filterInput);
    // When filterInput changes, we should also re-calculate allTaskCountsByPriority
    // However, `tasksToReview` is only updated by `loadTasksForReview`.
    // So, we'll rely on `loadTasksForReview` to call `calculateAllTaskCountsByPriority`.
  }, [filterInput, calculateOverdueCounts]);


  const advanceToNextTask = useCallback(() => {
    setTasksToReview(prevTasks => {
      const updatedTasks = prevTasks.filter((_, index) => index !== currentTaskIndex);
      // Recalculate all task counts for the *remaining* tasks
      calculateAllTaskCountsByPriority(updatedTasks);
      return updatedTasks;
    });

    if (currentTaskIndex < tasksToReview.length - 1) {
      setCurrentTaskIndex((prev) => prev + 1);
    } else {
      setReviewState("finished");
      toast.success("Revisão de prioridades concluída!");
    }
    calculateOverdueCounts(filterInput);
  }, [currentTaskIndex, tasksToReview.length, calculateOverdueCounts, filterInput, calculateAllTaskCountsByPriority, tasksToReview]);

  const handleAssignPriority = useCallback(async (newPriority: 1 | 2 | 3 | 4) => {
    if (!currentTask) return;

    const updated = await updateTask(currentTask.id, { priority: newPriority });
    if (updated) {
      toast.success(`Prioridade da tarefa "${currentTask.content}" atualizada para P${newPriority}!`);
      advanceToNextTask();
    } else {
      toast.error("Falha ao atualizar a prioridade da tarefa.");
    }
  }, [currentTask, updateTask, advanceToNextTask]);

  const handleSkip = useCallback(() => {
    toast.info("Tarefa pulada para revisão posterior.");
    advanceToNextTask();
  }, [advanceToNextTask]);

  const handleClearFilter = useCallback(() => {
    setFilterInput(`no label:${GTD_PROCESSED_LABEL}`);
  }, []);

  const renderTaskDates = (task: TodoistTask) => {
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

    if (task.duration?.amount && task.duration.unit === "minute") {
      dateElements.push(
        <span key="duration" className="flex items-center gap-1">
          <Clock className="h-3 w-3" /> {task.duration.amount} min
        </span>
      );
    }

    if (dateElements.length === 0) {
      return <span>Sem prazo</span>;
    }

    return <div className="flex flex-wrap gap-x-4 gap-y-1">{dateElements}</div>;
  };

  const PRIORITY_COLORS: Record<1 | 2 | 3 | 4, string> = {
    4: "bg-red-500",
    3: "bg-orange-500",
    2: "bg-yellow-500",
    1: "bg-gray-400",
  };

  const PRIORITY_LABELS: Record<1 | 2 | 3 | 4, string> = {
    4: "P1 - Urgente",
    3: "P2 - Alto",
    2: "P3 - Médio",
    1: "P4 - Baixo",
  };

  const totalTasksInReview = tasksToReview.length;
  const fibonacciSuggestion = useMemo(() => {
      if (totalTasksInReview === 0) return null;

      const targetCounts: OverdueCounts = { 1: 0, 2: 0, 3: 0, 4: 0 };
      let suggestionText = "";
      let bestPriorityToSuggest: 1 | 2 | 3 | 4 | null = null;
      let maxDeficit = 0;

      // Calculate target counts based on Fibonacci ratios
      for (const p of [4, 3, 2, 1] as (1 | 2 | 3 | 4)[]) {
          targetCounts[p] = Math.round(totalTasksInReview * (FIBONACCI_RATIOS[p] / TOTAL_FIBONACCI_UNITS));
      }

      // Find the priority with the largest deficit (under target)
      for (const p of [4, 3, 2, 1] as (1 | 2 | 3 | 4)[]) { // Check P1 first
          const deficit = targetCounts[p] - allTaskCountsByPriority[p];
          if (deficit > maxDeficit) {
              maxDeficit = deficit;
              bestPriorityToSuggest = p;
          }
      }

      if (bestPriorityToSuggest) {
          suggestionText = `Considere atribuir P${bestPriorityToSuggest} (${PRIORITY_LABELS[bestPriorityToSuggest]}) para balancear o ranking.`;
      } else {
          suggestionText = "Sua distribuição de prioridades está bem equilibrada ou acima dos alvos Fibonacci.";
      }

      return { targetCounts, suggestionText };
  }, [totalTasksInReview, allTaskCountsByPriority]);


  return (
    <div className="p-4 grid grid-cols-1 lg:grid-cols-3 gap-6">
      <div className="lg:col-span-2">
        <h2 className="text-3xl font-bold mb-2 text-gray-800">
          <Star className="inline-block h-8 w-8 mr-2 text-yellow-600" /> SEITON - Revisão de Prioridades
        </h2>
        <p className="text-lg text-gray-600 mb-6">
          Revise e atribua prioridades (P1-P4) às suas tarefas com base em critérios claros.
        </p>

        {isLoading && (
          <div className="flex justify-center items-center h-48">
            <LoadingSpinner size={40} />
          </div>
        )}

        {!isLoading && reviewState === "initial" && (
          <div className="text-center mt-10">
            <div className="grid w-full items-center gap-1.5 mb-6 max-w-md mx-auto">
              <Label htmlFor="task-filter" className="text-left text-gray-600 font-medium">
                Filtro de Tarefas (Todoist)
              </Label>
              <div className="relative flex items-center mt-1">
                <Input
                  type="text"
                  id="task-filter"
                  placeholder={`Ex: 'no date & no project & !@gtd_processada & !@agenda'`}
                  value={filterInput}
                  onChange={(e) => setFilterInput(e.target.value)}
                  className="pr-10"
                  disabled={isLoading}
                />
                {filterInput !== `no label:${GTD_PROCESSED_LABEL}` && (
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
              <p className="text-xs text-gray-500 text-left mt-1">
                Use filtros do Todoist para definir quais tarefas revisar. Por padrão, exclui tarefas já processadas pelo Seiketsu.
              </p>
            </div>
            <Button
              onClick={loadTasksForReview}
              className="px-8 py-4 text-xl bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-colors duration-200"
              disabled={isLoading}
            >
              Iniciar Revisão de Prioridades
            </Button>
          </div>
        )}

        {!isLoading && reviewState === "reviewing" && currentTask && (
          <div className="mt-8">
            <p className="text-center text-xl font-medium mb-6 text-gray-700">
              Revisando tarefa {currentTaskIndex + 1} de {tasksToReview.length}
            </p>
            <Card className="p-6 rounded-xl shadow-lg bg-white flex flex-col h-full max-w-2xl mx-auto">
              <div className="flex-grow">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-2xl font-bold text-gray-800">{currentTask.content}</h3>
                  <a href={currentTask.url} target="_blank" rel="noopener noreferrer" className="ml-2 text-indigo-600 hover:text-indigo-800">
                    <ExternalLink className="h-5 w-5" />
                  </a>
                </div>
                {currentTask.description && (
                  <p className="text-md text-gray-700 mb-4 whitespace-pre-wrap">{currentTask.description}</p>
                )}
              </div>
              <div className="flex items-center justify-between text-sm text-gray-500 mt-auto pt-4 border-t border-gray-200">
                {renderTaskDates(currentTask)}
                <span
                  className={cn(
                    "px-2 py-1 rounded-full text-white text-xs font-medium",
                    PRIORITY_COLORS[currentTask.priority],
                  )}
                >
                  {PRIORITY_LABELS[currentTask.priority]}
                </span>
              </div>
            </Card>

            <div className="mt-6">
              <p className="text-gray-700 mb-2 font-semibold">Atribuir Nova Prioridade:</p>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <Button
                  onClick={() => handleAssignPriority(4)}
                  disabled={isLoading}
                  className="bg-red-600 hover:bg-red-700 text-white py-3 text-md"
                >
                  P1 - Urgente
                </Button>
                <Button
                  onClick={() => handleAssignPriority(3)}
                  disabled={isLoading}
                  className="bg-orange-600 hover:bg-orange-700 text-white py-3 text-md"
                >
                  P2 - Importante
                </Button>
                <Button
                  onClick={() => handleAssignPriority(2)}
                  disabled={isLoading}
                  className="bg-yellow-600 hover:bg-yellow-700 text-white py-3 text-md"
                >
                  P3 - Rotina
                </Button>
                <Button
                  onClick={() => handleAssignPriority(1)}
                  disabled={isLoading}
                  className="bg-gray-600 hover:bg-gray-700 text-white py-3 text-md"
                >
                  P4 - Inbox
                </Button>
              </div>
              <div className="mt-4 text-center">
                <Button
                  onClick={handleSkip}
                  disabled={isLoading}
                  variant="outline"
                  className="px-8 py-3 text-md"
                >
                  <ArrowRight className="mr-2 h-5 w-5" /> Pular Tarefa
                </Button>
              </div>
            </div>
          </div>
        )}

        {!isLoading && reviewState === "finished" && (
          <div className="text-center mt-10">
            <p className="text-2xl font-semibold text-gray-700 mb-4">
              🎉 Revisão de Prioridades Concluída!
            </p>
            <p className="text-lg text-gray-600 mb-6">
              Você revisou todas as tarefas com o filtro atual.
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

      <div className="lg:col-span-1 flex flex-col gap-6">
        <Card className="h-full">
          <CardHeader>
            <CardTitle className="text-xl font-bold text-gray-800 flex items-center gap-2">
              <CalendarIcon className="h-5 w-5 text-indigo-600" /> Tarefas Vencidas por Prioridade
            </CardTitle>
          </CardHeader>
          <CardContent className="p-6 space-y-4">
            <div className="flex items-center justify-between p-3 rounded-md bg-red-50 border border-red-200">
              <span className="font-medium text-red-800">P1 - Urgente:</span>
              <Badge className="bg-red-500 text-white text-lg px-3 py-1">{overdueCounts[4]}</Badge>
            </div>
            <div className="flex items-center justify-between p-3 rounded-md bg-orange-50 border border-orange-200">
              <span className="font-medium text-orange-800">P2 - Importante:</span>
              <Badge className="bg-orange-500 text-white text-lg px-3 py-1">{overdueCounts[3]}</Badge>
            </div>
            <div className="flex items-center justify-between p-3 rounded-md bg-yellow-50 border border-yellow-200">
              <span className="font-medium text-yellow-800">P3 - Rotina:</span>
              <Badge className="bg-yellow-500 text-white text-lg px-3 py-1">{overdueCounts[2]}</Badge>
            </div>
            <div className="flex items-center justify-between p-3 rounded-md bg-gray-50 border border-gray-200">
              <span className="font-medium text-gray-800">P4 - Inbox:</span>
              <Badge className="bg-gray-500 text-white text-lg px-3 py-1">{overdueCounts[1]}</Badge>
            </div>
            <p className="text-sm text-gray-500 mt-4">
              *Contagem de tarefas com prazo no passado (excluindo o dia de hoje).
            </p>
          </CardContent>
        </Card>

        <Card className="h-full">
          <CardHeader>
            <CardTitle className="text-xl font-bold text-gray-800 flex items-center gap-2">
              <Star className="h-5 w-5 text-yellow-600" /> Sugestão Fibonacci
            </CardTitle>
          </CardHeader>
          <CardContent className="p-6 space-y-4">
              {fibonacciSuggestion ? (
                  <>
                      <p className="text-sm text-gray-600">
                          Distribuição ideal (Fibonacci 1:2:3:5 para P1:P2:P3:P4) para {totalTasksInReview} tarefas:
                      </p>
                      {Object.entries(FIBONACCI_RATIOS).sort(([pA], [pB]) => parseInt(pB) - parseInt(pA)).map(([priority, ratio]) => {
                          const p = parseInt(priority) as 1 | 2 | 3 | 4;
                          const currentCount = allTaskCountsByPriority[p];
                          const targetCount = fibonacciSuggestion.targetCounts[p];
                          const isUnder = currentCount < targetCount;
                          const isOver = currentCount > targetCount;
                          return (
                              <div key={p} className={cn(
                                  "flex items-center justify-between p-3 rounded-md border",
                                  isUnder && "bg-blue-50 border-blue-200",
                                  isOver && "bg-red-50 border-red-200",
                                  !isUnder && !isOver && "bg-green-50 border-green-200"
                              )}>
                                  <span className="font-medium text-gray-800">
                                      {PRIORITY_LABELS[p]}:
                                  </span>
                                  <div className="flex items-center gap-2">
                                      <span className="text-sm text-gray-500">Atual: {currentCount}</span>
                                      <span className="text-sm text-gray-500">Alvo: {targetCount}</span>
                                      <Badge className={cn(
                                          "text-white text-lg px-3 py-1",
                                          isUnder && "bg-blue-500",
                                          isOver && "bg-red-500",
                                          !isUnder && !isOver && "bg-green-500"
                                      )}>
                                          {isUnder ? "⬆️" : isOver ? "⬇️" : "✅"}
                                      </Badge>
                                  </div>
                              </div>
                          );
                      })}
                      <p className="text-md font-semibold text-gray-700 mt-4">
                          {fibonacciSuggestion.suggestionText}
                      </p>
                  </>
              ) : (
                  <p className="text-gray-600 italic">Inicie a revisão para ver a sugestão de prioridades.</p>
              )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default SeitonReview;