"use client";

import React, { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useTodoist } from "@/context/TodoistContext";
import { TodoistTask } from "@/lib/types";
import LoadingSpinner from "@/components/ui/loading-spinner";
import { toast } from "sonner";
import { cn, getTaskCategory } from "@/lib/utils";
import { format, parseISO, isValid } from "date-fns";
import { ptBR } from "date-fns/locale";
import { ArrowRight, Star, Scale, Zap, UserCheck, XCircle, ExternalLink, CalendarIcon, Clock, Check } from "lucide-react";
import { Badge } from "@/components/ui/badge";

type EvaluationState = "initial" | "evaluating" | "finished";

interface EvaluatedTask extends TodoistTask {
  urgencyScore?: number;
  dependenceScore?: number;
}

const SEITON_KRALJIC_STORAGE_KEY = "seitonKraljicEvaluationState";
const SEITON_KRALJIC_FILTER_INPUT_STORAGE_KEY = "seitonKraljicFilterInput";

type TournamentState = "initial" | "comparing" | "finished";

interface SeitonStateSnapshot {
  tasksToProcess: TodoistTask[];
  rankedTasks: TodoistTask[];
  currentTaskToPlace: TodoistTask | null;
  comparisonCandidate: TodoistTask | null;
  comparisonIndex: number;
  tournamentState: TournamentState;
}

const LOCAL_STORAGE_KEY = "seitonTournamentState";
const SEITON_FILTER_INPUT_STORAGE_KEY = "seiton_filter_input";
const SEITON_CATEGORY_FILTER_STORAGE_KEY = "seiton_category_filter";

const Seiton = () => {
  console.log("Seiton component rendering...");
  const { fetchTasks, closeTask, updateTask, isLoading: isLoadingTodoist } = useTodoist();
  const [tournamentState, setTournamentState] = useState<TournamentState>("initial");
  const [tasksToProcess, setTasksToProcess] = useState<TodoistTask[]>([]);
  const [rankedTasks, setRankedTasks] = useState<TodoistTask[]>([]);
  const [currentTaskToPlace, setCurrentTaskToPlace] = useState<TodoistTask | null>(null);
  const [comparisonCandidate, setComparisonCandidate] = useState<TodoistTask | null>(null);
  const [comparisonIndex, setComparisonIndex] = useState<number>(0);
  const [history, setHistory] = useState<SeitonStateSnapshot[]>([]);
  const [hasSavedState, setHasSavedState] = useState<boolean>(false);
  const [filterInput, setFilterInput] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem(SEITON_FILTER_INPUT_STORAGE_KEY) || "";
    }
    return "";
  });
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState<"all" | "pessoal" | "profissional">(() => {
    if (typeof window !== 'undefined') {
      return (localStorage.getItem(SEITON_CATEGORY_FILTER_STORAGE_KEY) as "all" | "pessoal" | "profissional") || "all";
    }
    return "all";
  });

  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem(SEITON_FILTER_INPUT_STORAGE_KEY, filterInput);
    }
  }, [filterInput]);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem(SEITON_CATEGORY_FILTER_STORAGE_KEY, selectedCategoryFilter);
    }
  }, [selectedCategoryFilter]);

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

  const sortTasks = useCallback((tasks: TodoistTask[]): TodoistTask[] => {
    return [...tasks].sort((a, b) => {
      const isAStarred = a.content.startsWith("*");
      const isBStarred = b.content.startsWith("*");
      if (isAStarred && !isBStarred) return -1;
      if (!isAStarred && isBStarred) return 1;

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

  const saveStateToHistory = useCallback(() => {
    setHistory((prev) => [
      ...prev,
      {
        tasksToProcess,
        rankedTasks,
        currentTaskToPlace,
        comparisonCandidate,
        comparisonIndex,
        tournamentState,
      },
    ]);
  }, [tasksToProcess, rankedTasks, currentTaskToPlace, comparisonCandidate, comparisonIndex, tournamentState]);

  const undoLastAction = useCallback(() => {
    if (history.length > 0) {
      const lastState = history[history.length - 1];
      setTasksToProcess(lastState.tasksToProcess);
      setRankedTasks(lastState.rankedTasks);
      setCurrentTaskToPlace(lastState.currentTaskToPlace);
      setComparisonCandidate(lastState.comparisonCandidate);
      setComparisonIndex(lastState.comparisonIndex);
      setTournamentState(lastState.tournamentState);
      setHistory((prev) => prev.slice(0, prev.length - 1));
      toast.info("Última ação desfeita.");
    } else {
      toast.info("Não há ações para desfazer.");
    }
  }, [history]);

  const resetTournamentState = useCallback(() => {
    setTournamentState("initial");
    setTasksToProcess([]);
    setRankedTasks([]);
    setCurrentTaskToPlace(null);
    setComparisonCandidate(null);
    setComparisonIndex(0);
    setHistory([]);
    localStorage.removeItem(LOCAL_STORAGE_KEY);
    setHasSavedState(false);
    toast.success("Ranking salvo resetado!");
  }, []);

  const startTournament = useCallback(async (continueSaved: boolean = false) => {
    console.log("startTournament called. continueSaved:", continueSaved);
    if (!continueSaved) {
      resetTournamentState();
    }

    const todoistFilterParts: string[] = [];
    if (filterInput.trim()) {
      todoistFilterParts.push(filterInput.trim());
    }
    if (selectedCategoryFilter !== "all") {
      todoistFilterParts.push(`@${selectedCategoryFilter}`);
    }
    const finalTodoistFilter = todoistFilterParts.join(" & ");
    console.log("Final Todoist Filter:", finalTodoistFilter);

    let tasksToLoad: TodoistTask[] = [];
    let currentRankedTasks = continueSaved ? rankedTasks : [];

    if (continueSaved) {
      const savedTasksToProcess = tasksToProcess;
      console.log("Continuing saved state. savedTasksToProcess.length:", savedTasksToProcess.length);

      if (finalTodoistFilter) {
        const filteredSavedTasks = savedTasksToProcess.filter(task => {
          const matchesFilterInput = !filterInput.trim() || 
                                     task.content.toLowerCase().includes(filterInput.trim().toLowerCase()) ||
                                     task.description.toLowerCase().includes(filterInput.trim().toLowerCase()) ||
                                     task.labels.some(label => label.toLowerCase().includes(filterInput.trim().toLowerCase()));
          
          const matchesCategory = selectedCategoryFilter === "all" || 
                                  (selectedCategoryFilter === "pessoal" && task.labels.includes("pessoal")) ||
                                  (selectedCategoryFilter === "profissional" && task.labels.includes("profissional"));
          
          return matchesFilterInput && matchesCategory;
        });

        if (filteredSavedTasks.length > 0) {
          tasksToLoad = filteredSavedTasks;
          toast.info(`Continuando torneio com ${tasksToLoad.length} tarefas filtradas do estado salvo.`);
        } else if (savedTasksToProcess.length > 0) {
          toast.warning("Nenhuma tarefa salva corresponde ao novo filtro. Buscando novas tarefas com o filtro.");
          tasksToLoad = await fetchTasks(finalTodoistFilter || undefined, { includeSubtasks: false, includeRecurring: false });
        } else {
          tasksToLoad = await fetchTasks(finalTodoistFilter || undefined, { includeSubtasks: false, includeRecurring: false });
          if (tasksToLoad.length > 0) {
            toast.info(`Iniciando novo torneio com ${tasksToLoad.length} tarefas com o filtro.`);
          }
        }
      } else {
        tasksToLoad = savedTasksToProcess;
        toast.info(`Continuando torneio com ${tasksToLoad.length} tarefas do estado salvo.`);
      }
    } else {
      tasksToLoad = await fetchTasks(finalTodoistFilter || undefined, { includeSubtasks: false, includeRecurring: false });
      if (tasksToLoad.length > 0) {
        toast.info(`Iniciando novo torneio com ${tasksToLoad.length} tarefas.`);
      }
    }

    console.log("startTournament: tasksToLoad before setting state:", tasksToLoad.length, tasksToLoad);

    const sortedTasksToLoad = sortTasks(tasksToLoad);
    setTasksToProcess(sortedTasksToLoad);
    setRankedTasks(currentRankedTasks);

    console.log("Sorted tasks to load:", sortedTasksToLoad.length);
    console.log("Current ranked tasks (after setting):", currentRankedTasks.length);
    
    if (currentRankedTasks.length === 0 && sortedTasksToLoad.length >= 2) {
      setCurrentTaskToPlace(sortedTasksToLoad[0]);
      setComparisonCandidate(sortedTasksToLoad[1]);
      setTasksToProcess(sortedTasksToLoad.slice(2));
      setComparisonIndex(-1);
      setTournamentState("comparing");
    } else if (currentRankedTasks.length > 0 && sortedTasksToLoad.length >= 1) {
      setCurrentTaskToPlace(sortedTasksToLoad[0]);
      setTasksToProcess(sortedTasksToLoad.slice(1));
      setComparisonIndex(currentRankedTasks.length - 1);
      setComparisonCandidate(currentRankedTasks[currentRankedTasks.length - 1]);
      setTournamentState("comparing");
    } else if (currentRankedTasks.length === 0 && sortedTasksToLoad.length === 1) {
      setRankedTasks((prev) => [...prev, sortedTasksToLoad[0]]);
      setTasksToProcess([]);
      setTournamentState("finished");
      toast.info("Apenas uma tarefa encontrada, adicionada ao ranking.");
    } else if (currentRankedTasks.length > 0 && sortedTasksToLoad.length === 0) {
      setTasksToProcess([]);
      setTournamentState("finished");
      toast.info("Todas as tarefas foram classificadas. Exibindo ranking final.");
    } else {
      setTasksToProcess([]);
      setRankedTasks([]);
      setTournamentState("finished");
      toast.info("Nenhuma tarefa encontrada para o torneio. Adicione tarefas ao Todoist!");
    }
  }, [fetchTasks, sortTasks, tasksToProcess, rankedTasks, filterInput, selectedCategoryFilter, resetTournamentState]);

  const startNextPlacement = useCallback(() => {
    console.log("startNextPlacement called. tasksToProcess.length:", tasksToProcess.length, "rankedTasks.length:", rankedTasks.length);
    if (tasksToProcess.length === 0) {
      console.log("tasksToProcess is empty, setting tournamentState to finished.");
      setTournamentState("finished");
      setCurrentTaskToPlace(null);
      setComparisonCandidate(null);
      return;
    }

    saveStateToHistory();

    const nextTask = tasksToProcess[0];
    setTasksToProcess((prev) => prev.slice(1));

    setCurrentTaskToPlace(nextTask);
    setComparisonIndex(rankedTasks.length - 1);
    setComparisonCandidate(rankedTasks[rankedTasks.length - 1]);
  }, [tasksToProcess, rankedTasks, saveStateToHistory]);

  // Effect to load state from localStorage on component mount
  useEffect(() => {
    const savedState = localStorage.getItem(LOCAL_STORAGE_KEY);
    console.log("Seiton: Loading from localStorage. Raw savedState:", savedState);
    if (savedState) {
      try {
        const parsedState: SeitonStateSnapshot = JSON.parse(savedState);
        setTasksToProcess(parsedState.tasksToProcess);
        setRankedTasks(parsedState.rankedTasks);
        setCurrentTaskToPlace(parsedState.currentTaskToPlace);
        setComparisonCandidate(parsedState.comparisonCandidate);
        setComparisonIndex(parsedState.comparisonIndex);
        setTournamentState(parsedState.tournamentState);
        setHasSavedState(true);
        toast.info("Estado do torneio carregado. Clique em 'Continuar Torneio' para prosseguir.");
        console.log("Seiton: Successfully parsed saved state from localStorage:", parsedState);
      } catch (e) {
        console.error("Failed to parse saved state from localStorage", e);
        localStorage.removeItem(LOCAL_STORAGE_KEY);
        toast.error("Erro ao carregar estado do torneio. Dados corrompidos foram removidos.");
        setHasSavedState(false);
      }
    }
  }, []);

  // Effect to save in-progress state to localStorage
  useEffect(() => {
    if (tournamentState === "comparing") { // Only save if actively comparing
      const stateToSave: SeitonStateSnapshot = {
        tasksToProcess,
        rankedTasks,
        currentTaskToPlace,
        comparisonCandidate,
        comparisonIndex,
        tournamentState,
      };
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(stateToSave));
      console.log("Seiton: In-progress state saved to localStorage:", stateToSave);
      setHasSavedState(true);
    }
  }, [tasksToProcess, rankedTasks, currentTaskToPlace, comparisonCandidate, comparisonIndex, tournamentState]);

  // Effect to save final state when tournament finishes
  useEffect(() => {
    if (tournamentState === "finished") {
      const finalStateToSave: SeitonStateSnapshot = {
        tasksToProcess: [], // Clear these for a finished state
        rankedTasks,
        currentTaskToPlace: null,
        comparisonCandidate: null,
        comparisonIndex: 0,
        tournamentState: "finished",
      };
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(finalStateToSave));
      console.log("Seiton: Final state saved to localStorage (tournament finished):", finalStateToSave);
      setHasSavedState(true);
    }
  }, [tournamentState, rankedTasks]); // Depend on tournamentState and rankedTasks

  // Nova função para aplicar a regra P1
  const applyP1Rule = useCallback(async () => {
    if (rankedTasks.length === 0) return;

    let updatedRankedTasks = [...rankedTasks];
    let changesMade = false;

    for (let i = 0; i < Math.min(4, rankedTasks.length); i++) {
      const task = rankedTasks[i];
      if (task.priority !== 4) {
        console.log(`Seiton: Promovendo tarefa "${task.content}" (ID: ${task.id}) de P${task.priority} para P1.`);
        const updatedTodoistTask = await updateTask(task.id, { priority: 4 });
        if (updatedTodoistTask) {
          updatedRankedTasks[i] = updatedTodoistTask;
          changesMade = true;
        } else {
          toast.error(`Falha ao promover a tarefa "${task.content}" para P1 no Todoist.`);
        }
      }
    }

    if (changesMade) {
      setRankedTasks(updatedRankedTasks);
      toast.success("Regra P1 aplicada: As 4 primeiras tarefas foram ajustadas para P1, se necessário.");
    } else {
      toast.info("Regra P1 aplicada: Nenhuma alteração necessária nas 4 primeiras tarefas.");
    }
  }, [rankedTasks, updateTask]);


  useEffect(() => {
    console.log("useEffect for tournamentState triggered. Current state:", tournamentState);
    if (tournamentState === "comparing" && !currentTaskToPlace) {
      if (rankedTasks.length > 0 || tasksToProcess.length > 0) {
        startNextPlacement();
      } else {
        setTournamentState("finished");
      }
    } else if (tournamentState === "comparing" && tasksToProcess.length === 0 && !currentTaskToPlace && rankedTasks.length > 0) {
        setTournamentState("finished");
    } else if (tournamentState === "finished") {
        applyP1Rule();
    }
  }, [tournamentState, currentTaskToPlace, tasksToProcess.length, rankedTasks.length, startNextPlacement, applyP1Rule]);

  const handleSelection = useCallback(
    (winner: TodoistTask) => {
      if (!currentTaskToPlace || !comparisonCandidate) return;

      saveStateToHistory();

      const isCurrentTaskToPlaceWinner = winner.id === currentTaskToPlace.id;

      if (rankedTasks.length === 0 && comparisonIndex === -1) {
        if (isCurrentTaskToPlaceWinner) {
          setRankedTasks([currentTaskToPlace, comparisonCandidate]);
        } else {
          setRankedTasks([comparisonCandidate, currentTaskToPlace]);
        }
        setCurrentTaskToPlace(null);
        setComparisonCandidate(null);
        setComparisonIndex(0);
        return;
      }

      if (isCurrentTaskToPlaceWinner) {
        const nextComparisonIndex = comparisonIndex - 1;

        if (nextComparisonIndex < 0) {
          setRankedTasks((prev) => {
            const newRanked = [currentTaskToPlace, ...prev];
            return newRanked.slice(0, 24);
          });
          setCurrentTaskToPlace(null);
          setComparisonCandidate(null);
          setComparisonIndex(0);
        } else {
          setComparisonIndex(nextComparisonIndex);
          setComparisonCandidate(rankedTasks[nextComparisonIndex]);
        }
      } else {
        setRankedTasks((prev) => {
          const newRanked = [...prev];
          newRanked.splice(comparisonIndex + 1, 0, currentTaskToPlace);
          return newRanked.slice(0, 24);
        });
        setCurrentTaskToPlace(null);
        setComparisonCandidate(null);
        setComparisonIndex(0);
      }
    },
    [currentTaskToPlace, comparisonCandidate, comparisonIndex, rankedTasks, saveStateToHistory],
  );

  const handleCompleteTask = useCallback(async (taskId: string) => {
    const success = await closeTask(taskId);
    if (success !== undefined) {
      toast.success("Tarefa concluída com sucesso!");

      setTasksToProcess(prev => prev.filter(task => task.id !== taskId));
      setRankedTasks(prev => prev.filter(task => task.id !== taskId));

      if (currentTaskToPlace?.id === taskId || comparisonCandidate?.id === taskId) {
        setCurrentTaskToPlace(null);
        setComparisonCandidate(null);
        setComparisonIndex(0);
      }
    }
  }, [closeTask, currentTaskToPlace, comparisonCandidate]);

  const renderTaskDates = (task: TodoistTask) => {
    const dateElements: JSX.Element[] = [];

    if (typeof task.due?.datetime === 'string' && task.due.datetime) {
      const parsedDate = parseISO(task.due.datetime);
      if (isValid(parsedDate)) {
        dateElements.push(
          <span key="due-datetime" className="block">
            Vencimento: {format(parsedDate, "dd/MM/yyyy HH:mm", { locale: ptBR })}
          </span>
        );
      }
    } else if (typeof task.due?.date === 'string' && task.due.date) {
      const parsedDate = parseISO(task.due.date);
      if (isValid(parsedDate)) {
        dateElements.push(
          <span key="due-date" className="block">
            Vencimento: {format(parsedDate, "dd/MM/yyyy", { locale: ptBR })}
          </span>
        );
      }
    }

    if (dateElements.length === 0) {
      return <span>Sem prazo</span>;
    }

    return <div className="space-y-1">{dateElements}</div>;
  };

  const renderTaskCard = (task: TodoistTask, isClickable: boolean = false, showActions: boolean = false) => {
    const category = getTaskCategory(task);
    return (
      <Card
        key={task.id}
        className={cn(
          "p-4 rounded-lg shadow-md flex flex-col justify-between h-full",
          isClickable && "cursor-pointer hover:shadow-lg hover:scale-[1.01] transition-all duration-200",
          task.priority === 4 && "border-l-4 border-red-500",
          task.priority === 3 && "border-l-4 border-orange-500",
          task.priority === 2 && "border-l-4 border-yellow-500",
          task.priority === 1 && "border-l-4 border-gray-400",
        )}
        onClick={isClickable ? () => handleSelection(task) : undefined}
      >
        <div>
          <div className="flex items-center gap-2 mb-2">
            <h3 className="text-xl font-semibold text-gray-800">{task.content}</h3>
            {category && (
              <Badge
                className={cn(
                  "text-xs font-medium",
                  category === "pessoal" ? "bg-blue-100 text-blue-800" : "bg-green-100 text-green-800"
                )}
              >
                {category === "pessoal" ? "Pessoal" : "Profissional"}
              </Badge>
            )}
          </div>
          {task.description && (
            <p className="text-sm text-gray-600 mb-2 line-clamp-3">{task.description}</p>
          )}
        </div>
        <div className="flex items-center justify-between text-xs text-gray-500 mt-auto pt-2">
          {renderTaskDates(task)}
          <span
            className={cn(
              "px-2 py-1 rounded-full text-white text-xs font-medium",
              PRIORITY_COLORS[task.priority],
            )}
          >
            {PRIORITY_LABELS[task.priority]}
          </span>
        </div>
        {showActions && (
          <div className="mt-4 space-y-2">
            <a href={task.url} target="_blank" rel="noopener noreferrer" className="w-full">
              <Button variant="outline" className="w-full py-2 text-sm flex items-center justify-center">
                <ExternalLink className="mr-2 h-4 w-4" /> Abrir no Todoist
              </Button>
            </a>
            <Button
              onClick={(e) => { e.stopPropagation(); handleCompleteTask(task.id); }}
              disabled={isLoadingTodoist}
              variant="secondary"
              className="w-full py-2 text-sm flex items-center justify-center bg-green-500 hover:bg-green-600 text-white"
            >
              <Check className="mr-2 h-4 w-4" /> Concluir
            </Button>
          </div>
        )}
      </Card>
    );
  };

  return (
    <div className="p-4">
      <h2 className="text-3xl font-bold mb-2 text-gray-800">🏆 SEITON - Torneio de Priorização</h2>
      <p className="text-lg text-gray-600 mb-6">
        Compare 2 tarefas por vez. Qual é mais importante agora?
      </p>

      {/* <div className="text-center text-sm text-gray-400 mb-4 p-2 bg-gray-100 rounded-md border border-gray-200">
        Debug State: <span className="font-semibold">{tournamentState}</span> | Current Task: <span className="font-semibold">{currentTaskToPlace?.content || "N/A"}</span> | Candidate: <span className="font-semibold">{comparisonCandidate?.content || "N/A"}</span> | Tasks to Process: <span className="font-semibold">{tasksToProcess.length}</span> | Ranked Tasks: <span className="font-semibold">{rankedTasks.length}</span> | Is Loading: <span className="font-semibold">{isLoadingTodoist ? "Yes" : "No"}</span>
      </div> */}

      {isLoadingTodoist && (
        <>
          {console.log("Rendering: Loading spinner")}
          <div className="flex justify-center items-center h-48">
            <LoadingSpinner size={40} />
          </div>
        </>
      )}

      {!isLoadingTodoist && tournamentState === "initial" && (
        <>
          {console.log("Rendering: Initial state")}
          <div className="text-center mt-10">
            <div className="grid w-full items-center gap-1.5 mb-6 max-w-md mx-auto">
              <Label htmlFor="task-filter" className="text-left text-gray-600 font-medium">
                Filtro de Tarefas (ex: "hoje", "p1", "#projeto")
              </Label>
              <Input
                type="text"
                id="task-filter"
                placeholder="Opcional: insira um filtro do Todoist..."
                value={filterInput}
                onChange={(e) => setFilterInput(e.target.value)}
                className="mt-1"
                disabled={isLoadingTodoist}
              />
            </div>
            <div className="grid w-full items-center gap-1.5 mb-6 max-w-md mx-auto">
              <Label htmlFor="category-filter" className="text-left text-gray-600 font-medium">
                Filtrar por Categoria
              </Label>
              <Select
                value={selectedCategoryFilter}
                onValueChange={(value: "all" | "pessoal" | "profissional") => setSelectedCategoryFilter(value)}
                disabled={isLoadingTodoist}
              >
                <SelectTrigger className="w-full mt-1">
                  <SelectValue placeholder="Todas as Categorias" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas as Categorias</SelectItem>
                  <SelectItem value="pessoal">Pessoal</SelectItem>
                  <SelectItem value="profissional">Profissional</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col md:flex-row justify-center gap-4 mt-6">
              {hasSavedState && (
                <Button
                  onClick={() => startTournament(true)}
                  className="px-8 py-4 text-xl bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors duration-200"
                >
                  Continuar Torneio
                </Button>
              )}
              <Button
                onClick={() => startTournament(false)}
                className="px-8 py-4 text-xl bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-colors duration-200"
              >
                Iniciar Novo Torneio
              </Button>
              {hasSavedState && (
                <Button
                  onClick={resetTournamentState}
                  className="px-8 py-4 text-xl bg-red-500 hover:bg-red-600 text-white rounded-lg transition-colors duration-200"
                >
                  Resetar Ranking Salvo
                </Button>
              )}
            </div>
          </div>
        </>
      )}

      {!isLoadingTodoist && tournamentState === "comparing" && currentTaskToPlace && comparisonCandidate && (
        <>
          {console.log("Rendering: Comparing state with tasks")}
          <p className="text-center text-xl font-medium mb-6 text-gray-700">
            Tarefas restantes para classificar: {tasksToProcess.length + (currentTaskToPlace ? 1 : 0) + (comparisonCandidate ? 1 : 0) - (rankedTasks.length > 0 ? 2 : 0)}
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {renderTaskCard(currentTaskToPlace, true, true)}
            {renderTaskCard(comparisonCandidate, true, true)}
          </div>
          <div className="flex justify-center gap-4 mt-6">
            <Button
              onClick={() => handleSelection(currentTaskToPlace)}
              className="bg-green-500 hover:bg-green-600 text-white px-6 py-3 text-lg"
            >
              Escolher Esquerda
            </Button>
            <Button
              onClick={() => handleSelection(comparisonCandidate)}
              className="bg-blue-500 hover:bg-blue-600 text-white px-6 py-3 text-lg"
            >
              Escolher Direita
            </Button>
          </div>
          <div className="flex justify-center gap-4 mt-6">
            <Button
              onClick={undoLastAction}
              disabled={history.length === 0}
              className="bg-gray-400 hover:bg-gray-500 text-white px-6 py-3 text-lg"
            >
              Desfazer
            </Button>
            <Button
              onClick={() => startTournament(false)}
              className="bg-red-500 hover:bg-red-600 text-white px-6 py-3 text-lg"
            >
              Resetar Ranking
            </Button>
          </div>

          {rankedTasks.length > 0 && (
            <div className="mt-12 p-6 bg-gray-50 rounded-xl shadow-inner">
              <h3 className="text-2xl font-bold mb-4 text-center text-gray-800">
                Ranking Atual (Top {Math.min(rankedTasks.length, 24)})
              </h3>
              <div className="space-y-3">
                {rankedTasks.slice(0, 24).map((task, index) => {
                  const category = getTaskCategory(task);
                  return (
                    <Card
                      key={task.id}
                      className={cn(
                        "p-3 rounded-lg flex items-center gap-3 border",
                        index === 0 && "bg-yellow-50 border-yellow-400",
                        index === 1 && "bg-gray-50 border-gray-300",
                        index === 2 && "bg-amber-50 border-amber-300",
                      )}
                    >
                      <span className="text-xl font-bold text-gray-600 w-6 text-center">
                        {index + 1}º
                      </span>
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <h4 className="text-md font-semibold text-gray-700">{task.content}</h4>
                          {category && (
                            <Badge
                              className={cn(
                                "text-xs font-medium",
                                category === "pessoal" ? "bg-blue-100 text-blue-800" : "bg-green-100 text-green-800"
                              )}
                            >
                              {category === "pessoal" ? "Pessoal" : "Profissional"}
                            </Badge>
                          )}
                        </div>
                        <div className="text-xs text-gray-500">
                          {renderTaskDates(task)}
                        </div>
                      </div>
                      {index < 3 && (
                        <span className="ml-auto text-2xl">
                          {index === 0 && "🥇"}
                          {index === 1 && "🥈"}
                          {index === 2 && "🥉"}
                        </span>
                      )}
                    </Card>
                  );
                })}
              </div>
              {rankedTasks.length > 24 && (
                <p className="text-center text-sm text-gray-500 mt-4">
                  ... e mais {rankedTasks.length - 24} tarefas ranqueadas (não exibidas).
                </p>
              )}
            </div>
          )}
        </>
      )}

      {!isLoadingTodoist && tournamentState === "finished" && (
        <>
          {console.log("Rendering: Finished state")}
          <div className="mt-8">
            <h3 className="text-3xl font-bold mb-6 text-center text-indigo-800">
              🎯 Ranking de Prioridades
            </h3>
            {rankedTasks.length > 0 ? (
              <div className="space-y-4">
                {rankedTasks.map((task, index) => {
                  const category = getTaskCategory(task);
                  return (
                    <Card
                      key={task.id}
                      className={cn(
                        "p-4 rounded-lg shadow-md flex items-center gap-4",
                        index === 0 && "bg-gradient-to-r from-yellow-100 to-yellow-200 border-yellow-500",
                        index === 1 && "bg-gradient-to-r from-gray-100 to-gray-200 border-gray-400",
                        index === 2 && "bg-gradient-to-r from-amber-100 to-amber-200 border-amber-500",
                        "border-l-4",
                      )}
                    >
                      <span className="text-2xl font-bold text-gray-700 w-8 text-center">
                        {index + 1}º
                      </span>
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <h4 className="text-lg font-semibold text-gray-800">{task.content}</h4>
                          {category && (
                            <Badge
                              className={cn(
                                "text-xs font-medium",
                                category === "pessoal" ? "bg-blue-100 text-blue-800" : "bg-green-100 text-green-800"
                              )}
                            >
                              {category === "pessoal" ? "Pessoal" : "Profissional"}
                            </Badge>
                          )}
                        </div>
                        {task.description && (
                          <p className="text-sm text-gray-600 line-clamp-2">{task.description}</p>
                        )}
                        <div className="text-xs text-gray-500 mt-1">
                          {renderTaskDates(task)}
                        </div>
                      </div>
                      {index < 3 && (
                        <span className="ml-auto text-3xl">
                          {index === 0 && "🥇"}
                          {index === 1 && "🥈"}
                          {index === 2 && "🥉"}
                        </span>
                      )}
                      <a href={task.url} target="_blank" rel="noopener noreferrer" className="ml-auto">
                        <Button variant="outline" size="icon">
                          <ExternalLink className="h-4 w-4" />
                        </Button>
                      </a>
                    </Card>
                  );
                })}
              </div>
            ) : (
              <p className="text-center text-gray-600 text-lg">
                Nenhuma tarefa foi classificada neste torneio.
              </p>
            )}
            <div className="flex justify-center gap-4 mt-8">
              <Button
                onClick={() => startTournament(false)}
                className="bg-indigo-500 hover:bg-indigo-600 text-white px-6 py-3 text-lg"
              >
                Refazer Torneio
              </Button>
              <Button
                onClick={undoLastAction}
                disabled={history.length === 0}
                className="bg-gray-400 hover:bg-gray-500 text-white px-6 py-3 text-lg"
              >
                Desfazer Última Ação
              </Button>
            </div>
          </div>
        </>
      )}

      {!isLoadingTodoist && tournamentState === "comparing" && (!currentTaskToPlace || !comparisonCandidate) && (
        <>
          {console.log("Rendering: Comparing state, waiting for next task (with reset option)")}
          <div className="text-center mt-10">
            <p className="text-xl text-gray-700">Preparando próxima comparação ou estado inválido.</p>
            <p className="text-md text-gray-600 mb-4">Se o problema persistir, por favor, resete o ranking.</p>
            <LoadingSpinner size={30} className="mt-4" />
            <Button
              onClick={resetTournamentState}
              className="mt-6 px-8 py-4 text-xl bg-red-500 hover:bg-red-600 text-white rounded-lg transition-colors duration-200"
            >
              Resetar Ranking
            </Button>
          </div>
        </>
      )}

      {!isLoadingTodoist && !["initial", "comparing", "finished"].includes(tournamentState) && (
        <>
          {console.log("Rendering: Unexpected state fallback")}
          <div className="text-center mt-10">
            <p className="text-xl text-red-700">Erro: Estado desconhecido do torneio. Por favor, reinicie.</p>
            <Button onClick={resetTournamentState} className="mt-4">Resetar Torneio</Button>
          </div>
        </>
      )}
    </div>
  );
};

export default Seiton;