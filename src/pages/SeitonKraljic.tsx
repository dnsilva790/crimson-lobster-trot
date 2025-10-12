"use client";

import React, { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { useTodoist } from "@/context/TodoistContext";
import { TodoistTask } from "@/lib/types";
import LoadingSpinner from "@/components/ui/loading-spinner";
import { toast } from "sonner";
import { cn, getTaskCategory } from "@/lib/utils";
import { format, parseISO, isValid } from "date-fns";
import { ptBR } from "date-fns/locale";
import { ArrowRight, Star, Scale, Zap, UserCheck, XCircle, ExternalLink, CalendarIcon, Clock } from "lucide-react"; // Adicionado CalendarIcon e Clock
import { Badge } from "@/components/ui/badge";

type EvaluationState = "initial" | "evaluating" | "finished";

interface EvaluatedTask extends TodoistTask {
  urgencyScore?: number;
  dependenceScore?: number;
}

const SEITON_KRALJIC_STORAGE_KEY = "seitonKraljicEvaluationState";
const SEITON_KRALJIC_FILTER_INPUT_STORAGE_KEY = "seitonKraljicFilterInput";

const SeitonKraljic = () => {
  const { fetchTasks, isLoading: isLoadingTodoist } = useTodoist();
  const [evaluationState, setEvaluationState] = useState<EvaluationState>("initial");
  const [tasksToEvaluate, setTasksToEvaluate] = useState<EvaluatedTask[]>([]);
  const [currentTaskIndex, setCurrentTaskIndex] = useState<number>(0);
  const [urgencyScore, setUrgencyscore] = useState<number>(50);
  const [dependenceScore, setDependenceScore] = useState<number>(50);
  const [filterInput, setFilterInput] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem(SEITON_KRALJIC_FILTER_INPUT_STORAGE_KEY) || "";
    }
    return "";
  });

  const currentTask = tasksToEvaluate[currentTaskIndex];
  const isLoading = isLoadingTodoist || evaluationState === "initial";

  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem(SEITON_KRALJIC_FILTER_INPUT_STORAGE_KEY, filterInput);
    }
  }, [filterInput]);

  // Load saved state from localStorage
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const savedState = localStorage.getItem(SEITON_KRALJIC_STORAGE_KEY);
      if (savedState) {
        try {
          const parsedState = JSON.parse(savedState);
          setTasksToEvaluate(parsedState.tasksToEvaluate || []);
          setCurrentTaskIndex(parsedState.currentTaskIndex || 0);
          setEvaluationState(parsedState.evaluationState || "initial");
          setFilterInput(parsedState.filterInput || "");
          toast.info("Estado do Seiton Kraljic carregado. Clique em 'Continuar Avaliação' para prosseguir.");
        } catch (e) {
          console.error("Failed to parse Seiton Kraljic state from localStorage", e);
          localStorage.removeItem(SEITON_KRALJIC_STORAGE_KEY);
          toast.error("Erro ao carregar estado do Seiton Kraljic. Reiniciando.");
        }
      }
    }
  }, []);

  // Save state to localStorage whenever relevant state changes
  useEffect(() => {
    if (evaluationState !== "initial") {
      const stateToSave = {
        tasksToEvaluate,
        currentTaskIndex,
        evaluationState,
        filterInput,
      };
      localStorage.setItem(SEITON_KRALJIC_STORAGE_KEY, JSON.stringify(stateToSave));
    }
  }, [tasksToEvaluate, currentTaskIndex, evaluationState, filterInput]);

  const loadTasksForEvaluation = useCallback(async () => {
    setEvaluationState("initial"); // Set to initial to show loading or initial UI
    setCurrentTaskIndex(0);
    setTasksToEvaluate([]);

    const fetchedTasks = await fetchTasks(filterInput, { includeSubtasks: false, includeRecurring: false });

    if (fetchedTasks && fetchedTasks.length > 0) {
      // Filter out tasks that already have scores (if resuming)
      const tasksWithoutScores = fetchedTasks.filter(task => {
        const existingTask = tasksToEvaluate.find(t => t.id === task.id);
        return !existingTask || existingTask.urgencyScore === undefined || existingTask.dependenceScore === undefined;
      });

      // Merge with existing evaluated tasks to preserve scores
      const mergedTasks = fetchedTasks.map(task => {
        const existingTask = tasksToEvaluate.find(t => t.id === task.id);
        return existingTask ? { ...task, ...existingTask } : task;
      });

      const sortedTasks = mergedTasks.sort((a, b) => {
        // Prioritize tasks without scores first
        const aHasScores = a.urgencyScore !== undefined && a.dependenceScore !== undefined;
        const bHasScores = b.urgencyScore !== undefined && b.dependenceScore !== undefined;
        if (aHasScores && !bHasScores) return 1;
        if (!aHasScores && bHasScores) return -1;

        // Then sort by priority, then due date
        if (b.priority !== a.priority) return b.priority - a.priority;
        const getDateValue = (dateString: string | null | undefined) => {
          if (typeof dateString === 'string' && dateString) {
            const parsedDate = parseISO(dateString);
            return isValid(parsedDate) ? parsedDate.getTime() : Infinity;
          }
          return Infinity;
        };
        const dateA = getDateValue(a.due?.datetime || a.due?.date);
        const dateB = getDateValue(b.due?.datetime || b.due?.date);
        return dateA - dateB;
      });

      setTasksToEvaluate(sortedTasks);
      
      // Find the first task that needs evaluation
      const firstUnevaluatedIndex = sortedTasks.findIndex(task => task.urgencyScore === undefined || task.dependenceScore === undefined);
      if (firstUnevaluatedIndex !== -1) {
        setCurrentTaskIndex(firstUnevaluatedIndex);
        setUrgencyscore(sortedTasks[firstUnevaluatedIndex].urgencyScore || 50);
        setDependenceScore(sortedTasks[firstUnevaluatedIndex].dependenceScore || 50);
        setEvaluationState("evaluating");
        toast.success(`Encontradas ${sortedTasks.length} tarefas. Iniciando avaliação.`);
      } else {
        setEvaluationState("finished");
        toast.info("Todas as tarefas já foram avaliadas. Pronto para visualizar os quadrantes!");
      }
    } else {
      setTasksToEvaluate([]);
      setEvaluationState("finished");
      toast.info("Nenhuma tarefa encontrada para avaliação com o filtro atual.");
    }
  }, [filterInput, fetchTasks, tasksToEvaluate]);

  const handleNextTask = useCallback(() => {
    if (!currentTask) return;

    const updatedTasks = tasksToEvaluate.map((task, index) =>
      index === currentTaskIndex
        ? { ...task, urgencyScore, dependenceScore }
        : task
    );
    setTasksToEvaluate(updatedTasks);

    const nextIndex = currentTaskIndex + 1;
    if (nextIndex < updatedTasks.length) {
      setCurrentTaskIndex(nextIndex);
      setUrgencyscore(updatedTasks[nextIndex].urgencyScore || 50);
      setDependenceScore(updatedTasks[nextIndex].dependenceScore || 50);
    } else {
      setEvaluationState("finished");
      toast.success("Avaliação de tarefas concluída! Agora você pode visualizar os quadrantes.");
    }
  }, [currentTask, currentTaskIndex, tasksToEvaluate, urgencyScore, dependenceScore]);

  const handlePreviousTask = useCallback(() => {
    if (currentTaskIndex > 0) {
      const updatedTasks = tasksToEvaluate.map((task, index) =>
        index === currentTaskIndex
          ? { ...task, urgencyScore, dependenceScore }
          : task
      );
      setTasksToEvaluate(updatedTasks);

      const prevIndex = currentTaskIndex - 1;
      setCurrentTaskIndex(prevIndex);
      setUrgencyscore(updatedTasks[prevIndex].urgencyScore || 50);
      setDependenceScore(updatedTasks[prevIndex].dependenceScore || 50);
    } else {
      toast.info("Você está na primeira tarefa.");
    }
  }, [currentTaskIndex, tasksToEvaluate, urgencyScore, dependenceScore]);

  const handleClearFilter = useCallback(() => {
    setFilterInput("");
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
    3: "P2 - Importante",
    2: "P3 - Rotina",
    1: "P4 - Inbox",
  };

  return (
    <div className="p-4">
      <h2 className="text-3xl font-bold mb-2 text-gray-800">
        <Scale className="inline-block h-8 w-8 mr-2 text-purple-600" /> SEITON KRALJIC - Priorização por Matriz
      </h2>
      <p className="text-lg text-gray-600 mb-6">
        Avalie suas tarefas por Urgência e Dependência para classificá-las em quadrantes.
      </p>

      {isLoadingTodoist && (
        <div className="flex justify-center items-center h-48">
          <LoadingSpinner size={40} />
        </div>
      )}

      {!isLoadingTodoist && evaluationState === "initial" && (
        <div className="text-center mt-10">
          <div className="grid w-full items-center gap-1.5 mb-6 max-w-md mx-auto">
            <Label htmlFor="task-filter" className="text-left text-gray-600 font-medium">
              Filtro de Tarefas (Todoist)
            </Label>
            <div className="relative flex items-center mt-1">
              <Input
                type="text"
                id="task-filter"
                placeholder={`Ex: 'hoje | amanhã'`}
                value={filterInput}
                onChange={(e) => setFilterInput(e.target.value)}
                className="pr-10"
                disabled={isLoadingTodoist}
              />
              {filterInput && (
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={handleClearFilter}
                  className="absolute right-0 top-0 h-full px-3"
                  disabled={isLoadingTodoist}
                >
                  <XCircle className="h-4 w-4" />
                </Button>
              )}
            </div>
            <p className="text-xs text-gray-500 text-left mt-1">
              Use filtros do Todoist para definir quais tarefas avaliar.
            </p>
          </div>
          <Button
            onClick={loadTasksForEvaluation}
            className="px-8 py-4 text-xl bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-colors duration-200"
            disabled={isLoadingTodoist}
          >
            Iniciar Avaliação
          </Button>
        </div>
      )}

      {!isLoadingTodoist && evaluationState === "evaluating" && currentTask && (
        <div className="mt-8">
          <p className="text-center text-xl font-medium mb-6 text-gray-700">
            Avaliando tarefa {currentTaskIndex + 1} de {tasksToEvaluate.length}
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

          <div className="mt-6 space-y-6 max-w-2xl mx-auto">
            <div>
              <Label htmlFor="urgency-score" className="text-lg font-semibold flex items-center gap-2 mb-2">
                <Zap className="h-5 w-5 text-red-500" /> Urgência da Tarefa: <span className="font-bold text-xl">{urgencyScore}</span>
              </Label>
              <Slider
                id="urgency-score"
                min={0}
                max={100}
                step={1}
                value={[urgencyScore]}
                onValueChange={(value) => setUrgencyscore(value[0])}
                className="w-full"
              />
              <p className="text-sm text-gray-500 mt-2">
                Quão rápido esta tarefa precisa ser feita? (0 = Não urgente, 100 = Extremamente urgente)
              </p>
            </div>

            <div>
              <Label htmlFor="dependence-score" className="text-lg font-semibold flex items-center gap-2 mb-2">
                <UserCheck className="h-5 w-5 text-blue-500" /> Dependência de Mim: <span className="font-bold text-xl">{dependenceScore}</span>
              </Label>
              <Slider
                id="dependence-score"
                min={0}
                max={100}
                step={1}
                value={[dependenceScore]}
                onValueChange={(value) => setDependenceScore(value[0])}
                className="w-full"
              />
              <p className="text-sm text-gray-500 mt-2">
                Quão essencial é a sua participação direta para que ela avance? (0 = Nenhuma, 100 = Total)
              </p>
            </div>

            <div className="flex justify-between gap-4 mt-6">
              <Button
                onClick={handlePreviousTask}
                disabled={currentTaskIndex === 0}
                variant="outline"
                className="px-6 py-3 text-md flex items-center justify-center"
              >
                Voltar
              </Button>
              <Button
                onClick={handleNextTask}
                className="px-6 py-3 text-md flex items-center justify-center bg-indigo-600 hover:bg-indigo-700 text-white"
              >
                {currentTaskIndex < tasksToEvaluate.length - 1 ? (
                  <>
                    Próxima Tarefa <ArrowRight className="ml-2 h-5 w-5" />
                  </>
                ) : (
                  "Finalizar Avaliação"
                )}
              </Button>
            </div>
          </div>
        </div>
      )}

      {!isLoadingTodoist && evaluationState === "finished" && (
        <div className="text-center mt-10">
          <p className="text-2xl font-semibold text-gray-700 mb-4">
            🎉 Avaliação Concluída!
          </p>
          <p className="text-lg text-gray-600 mb-6">
            Todas as tarefas foram avaliadas. Agora você pode visualizar o gráfico de quadrantes.
          </p>
          <Button
            onClick={() => toast.info("Funcionalidade de visualização de quadrantes em desenvolvimento.")}
            className="px-8 py-4 text-xl bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors duration-200"
          >
            Visualizar Quadrantes
          </Button>
          <Button
            onClick={loadTasksForEvaluation}
            variant="outline"
            className="ml-4 px-8 py-4 text-xl text-indigo-600 border-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors duration-200"
          >
            Reavaliar Tarefas
          </Button>
        </div>
      )}
    </div>
  );
};

export default SeitonKraljic;