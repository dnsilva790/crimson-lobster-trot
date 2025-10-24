"use client";

import React, { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useTodoist } from "@/context/TodoistContext";
import { TodoistTask, SeitonStateSnapshot, SortingCriterion, CustomSortingPreference } from "@/lib/types";
import LoadingSpinner from "@/components/ui/loading-spinner";
import { toast } from "sonner";
import { cn, getTaskCategory } from "@/lib/utils";
import { format, parseISO, isValid } from "date-fns";
import { ptBR } from "date-fns/locale";
import { ArrowRight, Star, Scale, Zap, UserCheck, XCircle, ExternalLink, CalendarIcon, Clock, Check, SortAsc, RotateCcw } from "lucide-react";
import { Badge } from "@/components/ui/badge";


type TournamentState = "initial" | "comparing" | "finished";
type PrioritizationContext = "none" | "pessoal" | "profissional";

const LOCAL_STORAGE_KEY = "seitonTournamentState";
const SEITON_FILTER_INPUT_STORAGE_KEY = "seiton_filter_input";
const SEITON_CATEGORY_FILTER_STORAGE_KEY = "seiton_category_filter";
const SEITON_PRIORITIZATION_CONTEXT_STORAGE_KEY = "seiton_prioritization_context";
const SEITON_CUSTOM_SORTING_PREFERENCES_STORAGE_KEY = "seiton_custom_sorting_preferences"; // Novo

const defaultCustomSortingPreferences: CustomSortingPreference = {
  primary: "deadline",
  secondary: "priority",
  tertiary: "due_date_time",
};

const Seiton = () => {
  console.log("Seiton component rendering...");
  const { fetchTasks, closeTask, updateTask, isLoading: isLoadingTodoist } = useTodoist();
  const [tournamentState, setTournamentState] = useState<TournamentState>("initial");
  const [tasksToProcess, setTasksToProcess] = useState<TodoistTask[]>([]);
  const [rankedTasks, setRankedTasks] = useState<TodoistTask[]>([]);
  const [currentTaskToPlace, setCurrentTaskToPlace] = useState<TodoistTask | null>(null);
  const [comparisonCandidate, setComparisonCandidate] = useState<TodoistTask | null>(null);
  const [comparisonIndex, setComparisonIndex] = useState<number>(0);
  const [history, setHistory] = useState<SeitonStateSnapshot[]>([]
  );
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
  const [selectedPrioritizationContext, setSelectedPrioritizationContext] = useState<PrioritizationContext>(() => {
    if (typeof window !== 'undefined') {
      return (localStorage.getItem(SEITON_PRIORITIZATION_CONTEXT_STORAGE_KEY) as PrioritizationContext) || "none";
    }
    return "none";
  });
  const [customSortingPreferences, setCustomSortingPreferences] = useState<CustomSortingPreference>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem(SEITON_CUSTOM_SORTING_PREFERENCES_STORAGE_KEY);
      return saved ? JSON.parse(saved) : defaultCustomSortingPreferences;
    }
    return defaultCustomSortingPreferences;
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

  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem(SEITON_PRIORITIZATION_CONTEXT_STORAGE_KEY, selectedPrioritizationContext);
    }
  }, [selectedPrioritizationContext]);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem(SEITON_CUSTOM_SORTING_PREFERENCES_STORAGE_KEY, JSON.stringify(customSortingPreferences));
    }
  }, [customSortingPreferences]);

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

  const sortingCriteriaOptions: { value: SortingCriterion | "none"; label: string }[] = [
    { value: "none", label: "Nenhum" },
    { value: "starred", label: "Iniciados com *" },
    { value: "deadline", label: "Deadline" },
    { value: "priority", label: "Prioridade" },
    { value: "duration", label: "Duração Estimada" },
    { value: "due_date_time", label: "Data/Hora de Vencimento" },
    { value: "category", label: "Categoria (Pessoal/Profissional)" },
    { value: "created_at", label: "Data de Criação" },
  ];

  const getSortingCriterionValue = useCallback((task: TodoistTask, criterion: SortingCriterion) => {
    const getDateValue = (dateString: string | null | undefined) => {
      if (typeof dateString === 'string' && dateString) {
        const parsedDate = parseISO(dateString);
        return isValid(parsedDate) ? parsedDate.getTime() : Infinity;
      }
      return Infinity;
    };

    switch (criterion) {
      case "starred":
        return task.content.startsWith("*") ? 0 : 1; // Starred first
      case "deadline":
        return getDateValue(task.deadline);
      case "priority":
        return -task.priority; // Higher priority (4) comes first (smaller negative number)
      case "duration":
        return -(task.duration?.amount || 0); // Longer duration first
      case "due_date_time":
        return getDateValue(task.due?.datetime || task.due?.date);
      case "category":
        const category = getTaskCategory(task);
        if (selectedPrioritizationContext === "pessoal") {
          return category === "pessoal" ? 0 : 1;
        }
        if (selectedPrioritizationContext === "profissional") {
          return category === "profissional" ? 0 : 1;
        }
        return 0; // No specific category prioritization
      case "created_at":
        return getDateValue(task.created_at);
      default:
        return 0;
    }
  }, [selectedPrioritizationContext]);

  const sortTasks = useCallback((tasks: TodoistTask[], preferences: CustomSortingPreference): TodoistTask[] => {
    return [...tasks].sort((a, b) => {
      const criteria = [preferences.primary, preferences.secondary, preferences.tertiary].filter(c => c !== "none") as SortingCriterion[];

      for (const criterion of criteria) {
        const valA = getSortingCriterionValue(a, criterion);
        const valB = getSortingCriterionValue(b, criterion);

        if (valA !== valB) {
          return valA - valB;
        }
      }
      return 0;
    });
  }, [getSortingCriterionValue]);

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
        selectedPrioritizationContext,
        customSortingPreferences, // Adicionado
      },
    ]);
  }, [tasksToProcess, rankedTasks, currentTaskToPlace, comparisonCandidate, comparisonIndex, tournamentState, selectedPrioritizationContext, customSortingPreferences]);

  const undoLastAction = useCallback(() => {
    if (history.length > 0) {
      const lastState = history[history.length - 1];
      setTasksToProcess(lastState.tasksToProcess);
      setRankedTasks(lastState.rankedTasks);
      setCurrentTaskToPlace(lastState.currentTaskToPlace);
      setComparisonCandidate(lastState.comparisonCandidate);
      setComparisonIndex(lastState.comparisonIndex);
      setTournamentState(lastState.tournamentState);
      setSelectedPrioritizationContext(lastState.selectedPrioritizationContext);
      setCustomSortingPreferences(lastState.customSortingPreferences); // Adicionado
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

    const sortedTasksToLoad = sortTasks(tasksToLoad, customSortingPreferences); // Usar preferências personalizadas
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
      setComparisonIndex(rankedTasks.length - 1);
      setComparisonCandidate(rankedTasks[rankedTasks.length - 1]);
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
  }, [fetchTasks, sortTasks, tasksToProcess, rankedTasks, filterInput, selectedCategoryFilter, selectedPrioritizationContext, customSortingPreferences, resetTournamentState]);

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
        // Always force to 'initial' when loading from localStorage to show config options
        setTournamentState("initial"); 
        setSelectedPrioritizationContext(parsedState.selectedPrioritizationContext);
        setCustomSortingPreferences(parsedState.customSortingPreferences || defaultCustomSortingPreferences); // Adicionado
        setHasSavedState(true);
        toast.info("Estado do torneio carregado. Clique em 'Continuar Torneio' para prosseguir.");
        console.log("Seiton: Successfully parsed saved state from localStorage:", parsedState);
      } catch (e) {
        console.error("Failed to parse saved state from localStorage", e);
        localStorage.removeItem(LOCAL_STORAGE_KEY);
        toast.error("Erro ao carregar estado do torneio. Dados corrompidos foram removidos.");
        setHasSavedState(false);
        setTournamentState("initial"); // Ensure it's initial on error too
      }
    } else {
      setTournamentState("initial"); // Ensure it's initial if no saved state
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
        selectedPrioritizationContext,
        customSortingPreferences, // Adicionado
      };
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(stateToSave));
      console.log("Seiton: In-progress state saved to localStorage:", stateToSave);
      setHasSavedState(true);
    }
  }, [tasksToProcess, rankedTasks, currentTaskToPlace, comparisonCandidate, comparisonIndex, tournamentState, selectedPrioritizationContext, customSortingPreferences]);

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
        selectedPrioritizationContext,
        customSortingPreferences, // Adicionado
      };
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(finalStateToSave));
      console.log("Seiton: Final state saved to localStorage (tournament finished):", finalStateToSave);
      setHasSavedState(true);
    }
  }, [tournamentState, rankedTasks, selectedPrioritizationContext, customSortingPreferences]); // Depend on tournamentState and rankedTasks

  // Nova função para aplicar as regras de prioridade baseadas no ranking
  const applyRankingPriorityRules = useCallback(async () => {
    if (rankedTasks.length === 0) return;

    let updatedRankedTasks = [...rankedTasks];
    let changesMade = false;

    for (let i = 0; i < rankedTasks.length; i++) {
      const task = rankedTasks[i];
      let newPriority: 1 | 2 | 3 | 4;

      if (i < 4) { // Top 4 tasks (0-3)
        newPriority = 4; // P1
      } else if (i < 24) { // Next 20 tasks (4-23)
        newPriority = 3; // P2
      } else { // From 25th task onwards (24+)
        newPriority = 2; // P3
      }

      if (task.priority !== newPriority) {
        console.log(`Seiton: Atualizando tarefa "${task.content}" (ID: ${task.id}) de P${task.priority} para P${newPriority}.`);
        const updatedTodoistTask = await updateTask(task.id, { priority: newPriority });
        if (updatedTodoistTask) {
          updatedRankedTasks[i] = updatedTodoistTask;
          changesMade = true;
        } else {
          toast.error(`Falha ao atualizar a prioridade da tarefa "${task.content}" para P${newPriority} no Todoist.`);
        }
      }
    }

    if (changesMade) {
      setRankedTasks(updatedRankedTasks);
      toast.success("Prioridades das tarefas ajustadas com base no ranking!");
    } else {
      toast.info("Nenhuma alteração de prioridade necessária com base no ranking.");
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
        applyRankingPriorityRules(); // Chamada para a nova função
    }
  }, [tournamentState, currentTaskToPlace, tasksToProcess.length, rankedTasks.length, startNextPlacement, applyRankingPriorityRules]);

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

  const renderTaskDatesAndDuration = (task: TodoistTask) => {
    const elements: JSX.Element[] = [];

    if (typeof task.due?.datetime === 'string' && task.due.datetime) {
      const parsedDate = parseISO(task.due.datetime);
      if (isValid(parsedDate)) {
        elements.push(
          <span key="due-datetime" className="flex items-center gap-1">
            <CalendarIcon className="h-3 w-3" /> {format(parsedDate, "dd/MM/yyyy HH:mm", { locale: ptBR })}
          </span>
        );
      }
    } else if (typeof task.due?.date === 'string' && task.due.date) {
      const parsedDate = parseISO(task.due.date);
      if (isValid(parsedDate)) {
        elements.push(
          <span key="due-date" className="flex items-center gap-1">
            <CalendarIcon className="h-3 w-3" /> {format(parsedDate, "dd/MM/yyyy", { locale: ptBR })}
          </span>
        );
      }
    }

    if (typeof task.deadline === 'string' && task.deadline) {
      const parsedDeadline = parseISO(task.deadline);
      if (isValid(parsedDeadline)) {
        elements.push(
          <span key="field-deadline" className="flex items-center gap-1 text-red-600 font-semibold">
            <CalendarIcon className="h-3 w-3" /> Deadline: {format(parsedDeadline, "dd/MM/yyyy", { locale: ptBR })}
          </span>
        );
      }
    }

    if (task.duration?.amount && task.duration.unit === "minute") {
      elements.push(
        <span key="duration" className="flex items-center gap-1">
          <Clock className="h-3 w-3" /> {task.duration.amount} min
        </span>
      );
    }

    if (elements.length === 0) {
      return <span>Sem prazo</span>;
    }

    return <div className="flex flex-wrap gap-x-4 gap-y-1">{elements}</div>;
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
          {task.labels && task.labels.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-2">
              {task.labels.map((label) => (
                <Badge key={label} variant="secondary" className="text-xs bg-gray-100 text-gray-700">
                  {label}
                </Badge>
              ))}
            </div>
          )}
        </div>
        <div className="flex items-center justify-between text-xs text-gray-500 mt-auto pt-2">
          {renderTaskDatesAndDuration(task)}
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

  const handleSortingPreferenceChange = useCallback((level: 'primary' | 'secondary' | 'tertiary', value: SortingCriterion | "none") => {
    setCustomSortingPreferences(prev => {
      const newPreferences = { ...prev, [level]: value };
      // Ensure no duplicates
      if (level === 'primary') {
        if (newPreferences.secondary === value) newPreferences.secondary = "none";
        if (newPreferences.tertiary === value) newPreferences.tertiary = "none";
      } else if (level === 'secondary') {
        if (newPreferences.primary === value) newPreferences.primary = "none"; // Should not happen if primary is selected first
        if (newPreferences.tertiary === value) newPreferences.tertiary = "none";
      } else if (level === 'tertiary') {
        if (newPreferences.primary === value) newPreferences.primary = "none";
        if (newPreferences.secondary === value) newPreferences.secondary = "none";
      }
      return newPreferences;
    });
  }, []);

  const handleResetSortingPreferences = useCallback(() => {
    setCustomSortingPreferences(defaultCustomSortingPreferences);
    toast.info("Preferências de ordenação resetadas para o padrão.");
  }, []);

  const getAvailableSortingOptions = (currentLevel: 'primary' | 'secondary' | 'tertiary') => {
    return sortingCriteriaOptions.filter(option => {
      if (option.value === "none") return true; // Always allow "None"

      if (currentLevel === 'primary') return true;
      if (currentLevel === 'secondary') {
        return option.value !== customSortingPreferences.primary;
      }
      if (currentLevel === 'tertiary') {
        return option.value !== customSortingPreferences.primary && option.value !== customSortingPreferences.secondary;
      }
      return true;
    });
  };

  return (
    <div className="p-4">
      <h2 className="text-3xl font-bold mb-2 text-gray-800">🏆 SEITON - Torneio de Priorização</h2>
      <p className="text-lg text-gray-600 mb-6">
        Compare 2 tarefas por vez. Qual é mais importante agora?
      </p>

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
            <div className="grid w-full items-center gap-1.5 mb-6 max-w-md mx-auto">
              <Label htmlFor="prioritization-context" className="text-left text-gray-600 font-medium">
                Priorizar Contexto
              </Label>
              <Select
                value={selectedPrioritizationContext}
                onValueChange={(value: PrioritizationContext) => setSelectedPrioritizationContext(value)}
                disabled={isLoadingTodoist}
              >
                <SelectTrigger className="w-full mt-1">
                  <SelectValue placeholder="Não Priorizar Categoria" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Não Priorizar Categoria</SelectItem>
                  <SelectItem value="pessoal">Priorizar Pessoal</SelectItem>
                  <SelectItem value="profissional">Priorizar Profissional</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Custom Sorting Preferences */}
            <Card className="p-4 mt-6 max-w-md mx-auto text-left">
              <CardTitle className="text-lg font-bold mb-3 flex items-center gap-2">
                <SortAsc className="h-5 w-5 text-indigo-600" /> Ordenação Personalizada
              </CardTitle>
              <div className="grid gap-4">
                <div>
                  <Label htmlFor="primary-sort">1º Critério de Ordenação</Label>
                  <Select
                    value={customSortingPreferences.primary}
                    onValueChange={(value: SortingCriterion | "none") => handleSortingPreferenceChange('primary', value)}
                    disabled={isLoadingTodoist}
                  >
                    <SelectTrigger className="w-full mt-1">
                      <SelectValue placeholder="Selecione o 1º critério" />
                    </SelectTrigger>
                    <SelectContent>
                      {getAvailableSortingOptions('primary').map(option => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="secondary-sort">2º Critério de Ordenação</Label>
                  <Select
                    value={customSortingPreferences.secondary}
                    onValueChange={(value: SortingCriterion | "none") => handleSortingPreferenceChange('secondary', value)}
                    disabled={isLoadingTodoist}
                  >
                    <SelectTrigger className="w-full mt-1">
                      <SelectValue placeholder="Selecione o 2º critério" />
                    </SelectTrigger>
                    <SelectContent>
                      {getAvailableSortingOptions('secondary').map(option => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="tertiary-sort">3º Critério de Ordenação</Label>
                  <Select
                    value={customSortingPreferences.tertiary}
                    onValueChange={(value: SortingCriterion | "none") => handleSortingPreferenceChange('tertiary', value)}
                    disabled={isLoadingTodoist}
                  >
                    <SelectTrigger className="w-full mt-1">
                      <SelectValue placeholder="Selecione o 3º critério" />
                    </SelectTrigger>
                    <SelectContent>
                      {getAvailableSortingOptions('tertiary').map(option => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <Button
                  onClick={handleResetSortingPreferences}
                  variant="outline"
                  className="w-full mt-2 flex items-center gap-2"
                  disabled={isLoadingTodoist}
                >
                  <RotateCcw className="h-4 w-4" /> Resetar Ordenação
                </Button>
              </div>
            </Card>

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
                        {task.labels && task.labels.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-1">
                            {task.labels.map((label) => (
                              <Badge key={label} variant="secondary" className="text-xs bg-gray-100 text-gray-700">
                                {label}
                              </Badge>
                            ))}
                          </div>
                        )}
                        <div className="text-xs text-gray-500">
                          {renderTaskDatesAndDuration(task)}
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

      {!isLoadingTodoist && tournamentState === "finished" && (
        <>
          {console.log("Rendering: Finished state")}
          <div className="text-center mt-10">
            <p className="text-2xl font-semibold text-gray-700 mb-4">
              🎉 Torneio de Priorização Concluído!
            </p>
            <p className="text-lg text-gray-600 mb-6">
              As prioridades das suas tarefas foram ajustadas no Todoist.
            </p>
            <div className="flex flex-col md:flex-row justify-center gap-4 mt-6">
              <Button
                onClick={() => startTournament(false)}
                className="px-8 py-4 text-xl bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-colors duration-200"
              >
                Iniciar Novo Torneio
              </Button>
              <Button
                onClick={resetTournamentState}
                className="px-8 py-4 text-xl bg-red-500 hover:bg-red-600 text-white rounded-lg transition-colors duration-200"
              >
                Resetar Ranking Salvo
              </Button>
            </div>
          </div>

          {rankedTasks.length > 0 && (
            <div className="mt-12 p-6 bg-gray-50 rounded-xl shadow-inner">
              <h3 className="text-2xl font-bold mb-4 text-center text-gray-800">
                Ranking Final
              </h3>
              <div className="space-y-3">
                {rankedTasks.map((task, index) => {
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
                        {task.labels && task.labels.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-1">
                            {task.labels.map((label) => (
                              <Badge key={label} variant="secondary" className="text-xs bg-gray-100 text-gray-700">
                                {label}
                              </Badge>
                            ))}
                          </div>
                        )}
                        <div className="text-xs text-gray-500">
                          {renderTaskDatesAndDuration(task)}
                        </div>
                      </div>
                      <span
                        className={cn(
                          "px-2 py-1 rounded-full text-white text-xs font-medium ml-auto",
                          PRIORITY_COLORS[task.priority],
                        )}
                      >
                        {PRIORITY_LABELS[task.priority]}
                      </span>
                    </Card>
                  );
                })}
              </div>
            </div>
          )}
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