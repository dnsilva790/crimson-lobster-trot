"use client";

import React, { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useTodoist } from "@/context/TodoistContext";
import { EisenhowerTask, TodoistTask, DisplayFilter, CategoryDisplayFilter, ManualThresholds } from "@/lib/types"; // Importar ManualThresholds
import LoadingSpinner from "@/components/ui/loading-spinner";
import { toast } from "sonner";
import { LayoutDashboard, Settings, ListTodo, Scale, Lightbulb, RefreshCw, Search, RotateCcw } from "lucide-react"; // Importar Search e RotateCcw
import { format, parseISO, isValid, isPast, isToday, isTomorrow, isBefore, startOfDay } from 'date-fns'; // Importar format, parseISO, isValid, isPast, isToday, isTomorrow, isBefore, startOfDay
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"; // Importar Select components
import { Input } from "@/components/ui/input"; // Importar Input
import { getTaskCategory } from "@/lib/utils"; // Importar getTaskCategory

// Importar os componentes do Eisenhower
import SetupScreen from "@/components/eisenhower/SetupScreen";
import RatingScreen from "@/components/eisenhower/RatingScreen";
import EisenhowerMatrixView from "@/components/eisenhower/EisenhowerMatrixView";
import ResultsScreen from "@/components/eisenhower/ResultsScreen";
import DashboardScreen from "@/components/eisenhower/DashboardScreen";
import AiAssistantModal from "@/components/eisenhower/AiAssistantModal";
import ThresholdSlider from "@/components/eisenhower/ThresholdSlider"; // Importar o novo slider

type EisenhowerView = "setup" | "rating" | "matrix" | "results" | "dashboard";
type RatingFilter = "all" | "unrated"; // Novo tipo de filtro para avaliação

const EISENHOWER_STORAGE_KEY = "eisenhowerMatrixState";
const EISENHOWER_FILTER_INPUT_STORAGE_KEY = "eisenhower_filter_input"; // Corrected typo here
const EISENHOWER_STATUS_FILTER_STORAGE_KEY = "eisenhower_status_filter";
const EISENHOWER_CATEGORY_FILTER_STORAGE_KEY = "eisenhower_category_filter";
const EISENHOWER_DISPLAY_FILTER_STORAGE_KEY = "eisenhower_display_filter"; // Nova chave para o filtro de exibição
const EISENHOWER_RATING_FILTER_STORAGE_KEY = "eisenhower_rating_filter"; // Nova chave para o filtro de avaliação
const EISENHOWER_CATEGORY_DISPLAY_FILTER_STORAGE_KEY = "eisenhower_category_display_filter"; // Nova chave para o filtro de categoria de exibição
const EISENHOWER_MANUAL_THRESHOLDS_STORAGE_KEY = "eisenhower_manual_thresholds"; // Nova chave para thresholds manuais

const defaultManualThresholds: ManualThresholds = { urgency: 50, importance: 50 };

const Eisenhower = () => {
  const { fetchTasks, isLoading: isLoadingTodoist } = useTodoist();
  const [currentView, setCurrentView] = useState<EisenhowerView>("setup");
  const [tasksToProcess, setTasksToProcess] = useState<EisenhowerTask[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isAiModalOpen, setIsAiModalOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState(""); // Novo estado para busca

  // Novos estados para os filtros de carregamento
  const [filterInput, setFilterInput] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem(EISENHOWER_FILTER_INPUT_STORAGE_KEY) || "";
    }
    return "";
  });
  const [statusFilter, setStatusFilter] = useState<"all" | "overdue">(() => {
    if (typeof window !== 'undefined') {
      return (localStorage.getItem(EISENHOWER_STATUS_FILTER_STORAGE_KEY) as "all" | "overdue") || "all";
    }
    return "all";
  });
  const [categoryFilter, setCategoryFilter] = useState<"all" | "pessoal" | "profissional">(() => {
    if (typeof window !== 'undefined') {
      return (localStorage.getItem(EISENHOWER_CATEGORY_FILTER_STORAGE_KEY) as "all" | "pessoal" | "profissional") || "all";
    }
    return "all";
  });

  // Novo estado para o filtro de exibição
  const [displayFilter, setDisplayFilter] = useState<DisplayFilter>(() => {
    if (typeof window !== 'undefined') {
      return (localStorage.getItem(EISENHOWER_DISPLAY_FILTER_STORAGE_KEY) as DisplayFilter) || "all";
    }
    return "all";
  });

  // Novo estado para o filtro de categoria de exibição
  const [categoryDisplayFilter, setCategoryDisplayFilter] = useState<CategoryDisplayFilter>(() => {
    if (typeof window !== 'undefined') {
      return (localStorage.getItem(EISENHOWER_CATEGORY_DISPLAY_FILTER_STORAGE_KEY) as CategoryDisplayFilter) || "all";
    }
    return "all";
  });

  // Novo estado para o filtro de avaliação
  const [ratingFilter, setRatingFilter] = useState<RatingFilter>(() => {
    if (typeof window !== 'undefined') {
      return (localStorage.getItem(EISENHOWER_RATING_FILTER_STORAGE_KEY) as RatingFilter) || "unrated";
    }
    return "unrated";
  });

  // Novo estado para thresholds manuais
  const [manualThresholds, setManualThresholds] = useState<ManualThresholds>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem(EISENHOWER_MANUAL_THRESHOLDS_STORAGE_KEY);
      return saved ? JSON.parse(saved) : defaultManualThresholds;
    }
    return defaultManualThresholds;
  });

  // Estado para tarefas que ainda precisam ser avaliadas
  const [unratedTasks, setUnratedTasks] = useState<EisenhowerTask[]>([]);

  // Efeitos para salvar os filtros no localStorage
  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem(EISENHOWER_FILTER_INPUT_STORAGE_KEY, filterInput);
    }
  }, [filterInput]);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem(EISENHOWER_STATUS_FILTER_STORAGE_KEY, statusFilter);
    }
  }, [statusFilter]);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem(EISENHOWER_CATEGORY_FILTER_STORAGE_KEY, categoryFilter);
    }
  }, [categoryFilter]);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem(EISENHOWER_DISPLAY_FILTER_STORAGE_KEY, displayFilter);
    }
  }, [displayFilter]);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem(EISENHOWER_RATING_FILTER_STORAGE_KEY, ratingFilter);
    }
  }, [ratingFilter]);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem(EISENHOWER_CATEGORY_DISPLAY_FILTER_STORAGE_KEY, categoryDisplayFilter);
    }
  }, [categoryDisplayFilter]);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem(EISENHOWER_MANUAL_THRESHOLDS_STORAGE_KEY, JSON.stringify(manualThresholds));
    }
    // Recategoriza as tarefas sempre que os thresholds mudam
    if (tasksToProcess.length > 0) {
      handleCategorizeTasks(manualThresholds);
    }
  }, [manualThresholds]);

  // Efeito para atualizar a lista de tarefas não avaliadas sempre que tasksToProcess mudar
  useEffect(() => {
    const filtered = tasksToProcess.filter(task => task.urgency === null || task.importance === null);
    setUnratedTasks(filtered);
  }, [tasksToProcess]);


  useEffect(() => {
    const savedState = localStorage.getItem(EISENHOWER_STORAGE_KEY);
    if (savedState) {
      try {
        const parsedState = JSON.parse(savedState);
        setTasksToProcess(parsedState.tasksToProcess || []);
        setCurrentView(parsedState.currentView || "setup");
        toast.info("Estado da Matriz de Eisenhower carregado.");
      } catch (e) {
        console.error("Failed to load Eisenhower state from localStorage", e);
        localStorage.removeItem(EISENHOWER_STORAGE_KEY);
        toast.error("Erro ao carregar estado da Matriz de Eisenhower. Reiniciando.");
      }
    }
  }, []);

  useEffect(() => {
    if (currentView !== "setup" || tasksToProcess.length > 0) {
      localStorage.setItem(EISENHOWER_STORAGE_KEY, JSON.stringify({ tasksToProcess, currentView }));
    }
  }, [tasksToProcess, currentView]);

  const sortEisenhowerTasks = useCallback((tasks: EisenhowerTask[]): EisenhowerTask[] => {
    return [...tasks].sort((a, b) => {
      // 1. Starred tasks first
      const isAStarred = a.content.startsWith("*");
      const isBStarred = b.content.startsWith("*");
      if (isAStarred && !isBStarred) return -1;
      if (!isAStarred && isBStarred) return 1;

      // Helper to get date value, handling null/undefined and invalid dates
      const getDateValue = (dateString: string | null | undefined) => {
        if (typeof dateString === 'string' && dateString) {
          const parsedDate = parseISO(dateString);
          return isValid(parsedDate) ? parsedDate.getTime() : Infinity;
        }
        return Infinity; // Tasks without a date go last
      };

      // 2. Deadline: earliest first
      const deadlineA = getDateValue(a.deadline);
      const deadlineB = getDateValue(b.deadline);
      if (deadlineA !== deadlineB) {
        return deadlineA - deadlineB;
      }

      // 3. Priority: P1 (4) > P2 (3) > P3 (2) > P4 (1)
      if (b.priority !== a.priority) {
        return b.priority - a.priority;
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

      // 5. Created at: earliest first (tie-breaker)
      const createdAtA = getDateValue(a.created_at);
      const createdAtB = getDateValue(b.created_at);
      if (createdAtA !== createdAtB) {
        return createdAtA - createdAtB;
      }
      return 0;
    });
  }, []);

  const handleLoadTasks = useCallback(async (filter: string) => {
    setIsLoading(true);
    try {
      const fetchedTodoistTasks = await fetchTasks(filter, { includeSubtasks: false, includeRecurring: false });
      
      // Merge logic: preserve existing ratings for tasks that are re-fetched
      const existingTasksMap = new Map(tasksToProcess.map(t => [t.id, t]));

      const initialEisenhowerTasks: EisenhowerTask[] = fetchedTodoistTasks.map(task => {
        const existing = existingTasksMap.get(task.id);
        return {
          ...task,
          urgency: existing?.urgency ?? null,
          importance: existing?.importance ?? null,
          quadrant: existing?.quadrant ?? null,
          url: task.url,
        };
      });
      
      const sortedTasks = sortEisenhowerTasks(initialEisenhowerTasks);
      
      setTasksToProcess(sortedTasks);
      setCurrentView("rating");
      toast.success(`Carregadas ${sortedTasks.length} tarefas para a Matriz de Eisenhower.`);
    } catch (error) {
      console.error("Failed to load tasks for Eisenhower Matrix:", error);
      toast.error("Falha ao carregar tarefas.");
    } finally {
      setIsLoading(false);
    }
  }, [fetchTasks, sortEisenhowerTasks, tasksToProcess]);

  const handleUpdateTaskRating = useCallback((taskId: string, urgency: number | null, importance: number | null) => {
    setTasksToProcess(prevTasks => {
      const updatedTasks = prevTasks.map(task =>
        task.id === taskId ? { ...task, urgency, importance } : task
      );
      return updatedTasks;
    });
  }, []);

  // Helper function to calculate dynamic domain and threshold, similar to ScatterPlotMatrix
  const getDynamicDomainAndThreshold = useCallback((values: number[]): { domain: [number, number], threshold: number } => {
    if (values.length === 0) {
      return { domain: [0, 100], threshold: 50 };
    }

    const minVal = Math.min(...values);
    const maxVal = Math.max(...values);

    if (minVal === maxVal) {
      const paddedMin = Math.max(0, minVal - 10);
      const paddedMax = Math.min(100, maxVal + 10);
      const domain: [number, number] = [paddedMin, paddedMax];
      const threshold = (domain[0] + domain[1]) / 2;
      return { domain, threshold };
    }

    const range = maxVal - minVal;
    const padding = range * 0.1;

    const domainMin = Math.max(0, minVal - padding);
    const domainMax = Math.min(100, maxVal + padding);

    const domain: [number, number] = [domainMin, domainMax];
    const threshold = (domainMin + domainMax) / 2;
    return { domain, threshold };
  }, []);

  const handleCategorizeTasks = useCallback((manualThresholds: ManualThresholds | null = null) => {
    const ratedTasks = tasksToProcess.filter(t => t.urgency !== null && t.importance !== null);
    
    if (ratedTasks.length === 0) {
      setTasksToProcess(prev => prev.map(t => ({ ...t, quadrant: null })));
      return;
    }

    let urgencyThreshold: number;
    let importanceThreshold: number;

    if (manualThresholds) {
      urgencyThreshold = manualThresholds.urgency;
      importanceThreshold = manualThresholds.importance;
    } else {
      // Calculate dynamic thresholds based on the *rated tasks* data
      const urgencyValues = ratedTasks.map(t => t.urgency!).filter(v => v !== null) as number[];
      const importanceValues = ratedTasks.map(t => t.importance!).filter(v => v !== null) as number[];

      const { threshold: dynamicUrgencyThreshold } = getDynamicDomainAndThreshold(urgencyValues);
      const { threshold: dynamicImportanceThreshold } = getDynamicDomainAndThreshold(importanceValues);
      
      urgencyThreshold = dynamicUrgencyThreshold;
      importanceThreshold = dynamicImportanceThreshold;
    }

    setTasksToProcess(prevTasks => {
      return prevTasks.map(task => {
        if (task.urgency !== null && task.importance !== null) {
          // Categorização baseada nos thresholds
          const isUrgent = task.urgency >= urgencyThreshold;
          const isImportant = task.importance >= importanceThreshold;

          let quadrant: EisenhowerTask['quadrant'] = null;

          if (isUrgent && isImportant) {
            quadrant = 'do';
          } else if (!isUrgent && isImportant) {
            quadrant = 'decide';
          } else if (isUrgent && !isImportant) {
            quadrant = 'delegate';
          } else {
            quadrant = 'delete';
          }
          return { ...task, quadrant };
        }
        return task;
      });
    });
    // toast.success("Tarefas categorizadas na Matriz de Eisenhower!"); // Removido para evitar spam de toast
  }, [tasksToProcess, getDynamicDomainAndThreshold]);

  const handleReset = useCallback(() => {
    setTasksToProcess([]);
    setCurrentView("setup");
    setManualThresholds(defaultManualThresholds);
    localStorage.removeItem(EISENHOWER_STORAGE_KEY);
    localStorage.removeItem(EISENHOWER_MANUAL_THRESHOLDS_STORAGE_KEY);
    toast.info("Matriz de Eisenhower resetada.");
  }, []);

  const handleFinishRating = useCallback(() => {
    handleCategorizeTasks(manualThresholds); // Categoriza todas as tarefas (incluindo as já avaliadas)
    setCurrentView("matrix"); // Muda para a visualização da matriz
  }, [handleCategorizeTasks, manualThresholds]);

  const ratedTasksCount = tasksToProcess.filter(t => t.urgency !== null && t.importance !== null).length;
  const canViewMatrixOrResults = tasksToProcess.length > 0; // Habilitar se houver tarefas carregadas

  // Função para filtrar as tarefas com base no displayFilter e categoryDisplayFilter
  const getFilteredTasksForDisplay = useCallback((tasks: EisenhowerTask[], dateFilter: DisplayFilter, categoryFilter: CategoryDisplayFilter): EisenhowerTask[] => {
    let filteredTasks = tasks;

    // 1. Filtragem por Categoria (categoryDisplayFilter)
    if (categoryFilter !== "all") {
      filteredTasks = filteredTasks.filter(task => {
        const category = getTaskCategory(task);
        return category === categoryFilter;
      });
    }

    // 2. Filtragem por Data/Status (dateFilter)
    if (dateFilter !== "all") {
      const now = new Date();
      const startOfToday = startOfDay(now);
      
      filteredTasks = filteredTasks.filter(task => {
        // Apenas tarefas com urgência e importância avaliadas podem ser filtradas por status
        if (task.urgency === null || task.importance === null) {
          return false;
        }

        let dueDate: Date | null = null;
        if (typeof task.due?.datetime === 'string' && task.due.datetime) {
          dueDate = parseISO(task.due.datetime);
        } else if (typeof task.due?.date === 'string' && task.due.date) {
          dueDate = parseISO(task.due.date);
        }

        let deadlineDate: Date | null = null;
        if (typeof task.deadline === 'string' && task.deadline) {
          deadlineDate = parseISO(task.deadline);
        }

        // Se não houver data de vencimento nem deadline, não se encaixa nos filtros de status
        if (!dueDate && !deadlineDate) return false;

        // Priorizar deadline para verificações de status se ambos existirem
        const effectiveDate = deadlineDate || dueDate;
        if (!effectiveDate || !isValid(effectiveDate)) return false;

        // --- Lógica de filtro de exibição corrigida ---
        if (dateFilter === "overdue") {
          // Atrasadas: Data efetiva é anterior ao início do dia de hoje.
          return isBefore(effectiveDate, startOfToday);
        }
        if (dateFilter === "today") {
          // Hoje: Data efetiva é hoje.
          return isToday(effectiveDate);
        }
        if (dateFilter === "tomorrow") {
          return isTomorrow(effectiveDate);
        }
        if (dateFilter === "overdue_and_today") { // Nova lógica para "Atrasadas e Hoje"
          // Inclui todas as tarefas que já passaram (overdue) OU que vencem hoje (isToday)
          return isBefore(effectiveDate, startOfToday) || isToday(effectiveDate);
        }
        return true;
      });
    }

    // 3. Filtragem por Termo de Busca (searchTerm)
    const lowerCaseSearchTerm = searchTerm.toLowerCase();
    if (lowerCaseSearchTerm.trim() === "") {
      return filteredTasks;
    }

    return filteredTasks.filter(task => 
      task.content.toLowerCase().includes(lowerCaseSearchTerm) ||
      task.description.toLowerCase().includes(lowerCaseSearchTerm) ||
      task.labels.some(label => label.toLowerCase().includes(lowerCaseSearchTerm))
    );

  }, [tasksToProcess, displayFilter, categoryDisplayFilter, searchTerm]);

  const filteredTasksForDisplay = getFilteredTasksForDisplay(tasksToProcess, displayFilter, categoryDisplayFilter);

  // Nova função para atualizar a matriz
  const handleRefreshMatrix = useCallback(async () => {
    setIsLoading(true);
    try {
      const filterParts: string[] = [];

      if (filterInput.trim()) {
        filterParts.push(`(${filterInput.trim()})`);
      }
      
      if (statusFilter === "overdue") {
        filterParts.push("due before: in 0 min");
      }

      if (categoryFilter === "pessoal") {
        filterParts.push("@pessoal");
      } else if (categoryFilter === "profissional") {
        filterParts.push("@profissional");
      }

      const finalFilter = filterParts.join(" & ");
      
      const fetchedTodoistTasks = await fetchTasks(finalFilter || undefined, { includeSubtasks: false, includeRecurring: false });
      
      // Preserve existing ratings
      const existingTasksMap = new Map(tasksToProcess.map(t => [t.id, t]));

      const updatedEisenhowerTasks: EisenhowerTask[] = fetchedTodoistTasks.map(task => {
        const existing = existingTasksMap.get(task.id);
        return {
          ...task,
          urgency: existing?.urgency ?? null,
          importance: existing?.importance ?? null,
          quadrant: existing?.quadrant ?? null,
          url: task.url,
        };
      });
      
      const sortedTasks = sortEisenhowerTasks(updatedEisenhowerTasks);
      setTasksToProcess(sortedTasks);
      handleCategorizeTasks(manualThresholds); // Recategoriza as tarefas após a atualização
      toast.success("Matriz atualizada com as últimas tarefas do Todoist!");
    } catch (error) {
      console.error("Failed to refresh Eisenhower Matrix:", error);
      toast.error("Falha ao atualizar a matriz.");
    } finally {
      setIsLoading(false);
    }
  }, [filterInput, statusFilter, categoryFilter, fetchTasks, tasksToProcess, sortEisenhowerTasks, handleCategorizeTasks, manualThresholds]);

  const handleStartReview = useCallback(() => {
    setCurrentView("rating");
    toast.info("Iniciando revisão de avaliação.");
  }, []);

  // Função para filtrar as tarefas na tela de avaliação
  const getTasksForRatingScreen = useCallback((tasks: EisenhowerTask[], filter: RatingFilter): EisenhowerTask[] => {
    if (filter === "unrated") {
      return tasks.filter(task => task.urgency === null || task.importance === null);
    }
    return tasks; // "all"
  }, []);

  const tasksForRatingScreen = getTasksForRatingScreen(tasksToProcess, ratingFilter);

  const handleUpdateThreshold = useCallback((key: keyof ManualThresholds, value: number) => {
    setManualThresholds(prev => ({ ...prev, [key]: value }));
  }, []);

  const renderContent = () => {
    if (isLoading || isLoadingTodoist) {
      return (
        <div className="flex justify-center items-center h-96">
          <LoadingSpinner size={40} />
        </div>
      );
    }

    switch (currentView) {
      case "setup":
        return <SetupScreen 
          onStart={handleLoadTasks} 
          initialFilterInput={filterInput}
          initialStatusFilter={statusFilter}
          initialCategoryFilter={categoryFilter}
          onFilterInputChange={setFilterInput}
          onStatusFilterChange={setStatusFilter}
          onCategoryFilterChange={setCategoryFilter}
        />;
      case "rating":
        return (
          <RatingScreen
            tasks={tasksForRatingScreen} // Passa as tarefas filtradas para revisão
            onUpdateTaskRating={handleUpdateTaskRating}
            onFinishRating={handleFinishRating} // Usa a nova função handleFinishRating
            onBack={() => setCurrentView("setup")}
            onViewMatrix={() => {
              handleCategorizeTasks(manualThresholds); // Categoriza todas as tarefas antes de visualizar a matriz
              setCurrentView("matrix");
            }}
            canViewMatrix={canViewMatrixOrResults} // Passa a prop canViewMatrixOrResults
            ratingFilter={ratingFilter} // Passa o filtro de avaliação
            onRatingFilterChange={setRatingFilter} // Passa a função para alterar o filtro
          />
        );
      case "matrix":
        return (
          <div className="flex flex-col gap-4">
            <div className="flex items-center justify-center">
              <ThresholdSlider
                value={manualThresholds.urgency}
                onValueChange={(v) => handleUpdateThreshold('urgency', v)}
                label="Threshold Urgência"
                orientation="horizontal"
                className="w-full max-w-[750px] mx-auto"
              />
            </div>
            <div className="flex">
              <div className="flex-shrink-0 mr-4">
                <ThresholdSlider
                  value={manualThresholds.importance}
                  onValueChange={(v) => handleUpdateThreshold('importance', v)}
                  label="Threshold Importância"
                  orientation="vertical"
                  className="h-[300px]"
                />
              </div>
              <div className="flex-grow">
                <EisenhowerMatrixView
                  tasks={filteredTasksForDisplay} // Passa as tarefas filtradas para exibição
                  onBack={handleStartReview} // Volta para a tela de avaliação
                  onViewResults={() => setCurrentView("results")}
                  displayFilter={displayFilter} // Passa o filtro de exibição
                  onDisplayFilterChange={setDisplayFilter} // Passa a função para alterar o filtro
                  onRefreshMatrix={handleRefreshMatrix} // Passa a nova função de atualização
                />
              </div>
            </div>
          </div>
        );
      case "results":
        return (
          <ResultsScreen
            tasks={filteredTasksForDisplay} // Passa as tarefas filtradas para exibição
            onBack={handleStartReview} // Volta para a tela de avaliação
            onViewDashboard={() => setCurrentView("dashboard")}
            displayFilter={displayFilter} // Passa o filtro de exibição
            onDisplayFilterChange={setDisplayFilter} // Passa a função para alterar o filtro
          />
        );
      case "dashboard":
        return (
          <DashboardScreen
            tasks={filteredTasksForDisplay} // Passa as tarefas filtradas para exibição
            onBack={() => setCurrentView("results")}
            onReset={handleReset}
            displayFilter={displayFilter} // Passa o filtro de exibição
            onDisplayFilterChange={setDisplayFilter} // Passa a função para alterar o filtro
          />
        );
      default:
        return <SetupScreen 
          onStart={handleLoadTasks} 
          initialFilterInput={filterInput}
          initialStatusFilter={statusFilter}
          initialCategoryFilter={categoryFilter}
          onFilterInputChange={setFilterInput}
          onStatusFilterChange={setStatusFilter}
          onCategoryFilterChange={setCategoryFilter}
        />;
    }
  };

  return (
    <div className="p-4">
      <h2 className="text-3xl font-bold mb-2 text-gray-800">
        <LayoutDashboard className="inline-block h-8 w-8 mr-2 text-indigo-600" /> Matriz de Eisenhower
      </h2>
      <p className="text-lg text-gray-600 mb-6">
        Priorize suas tarefas com base em Urgência e Importância.
      </p>

      <div className="flex flex-wrap gap-2 mb-6">
        <Button
          variant={currentView === "setup" ? "default" : "outline"}
          onClick={() => setCurrentView("setup")}
          disabled={isLoading || isLoadingTodoist}
          className="flex items-center gap-2"
        >
          <Settings className="h-4 w-4" /> Configurar
        </Button>
        <Button
          variant={currentView === "rating" ? "default" : "outline"}
          onClick={() => setCurrentView("rating")}
          disabled={isLoading || isLoadingTodoist || tasksToProcess.length === 0}
          className="flex items-center gap-2"
        >
          <Scale className="h-4 w-4" /> Avaliar
        </Button>
        <Button
          variant={currentView === "matrix" ? "default" : "outline"}
          onClick={() => { handleCategorizeTasks(manualThresholds); setCurrentView("matrix"); }} // Categoriza e vai para a matriz
          disabled={isLoading || isLoadingTodoist || !canViewMatrixOrResults}
          className="flex items-center gap-2"
        >
          <LayoutDashboard className="h-4 w-4" /> Matriz
        </Button>
        <Button
          variant={currentView === "results" ? "default" : "outline"}
          onClick={() => setCurrentView("results")}
          disabled={isLoading || isLoadingTodoist || !canViewMatrixOrResults}
          className="flex items-center gap-2"
        >
          <ListTodo className="h-4 w-4" /> Resultados
        </Button>
        <Button
          variant={currentView === "dashboard" ? "default" : "outline"}
          onClick={() => setCurrentView("dashboard")}
          disabled={isLoading || isLoadingTodoist || !canViewMatrixOrResults}
          className="flex items-center gap-2"
        >
          <LayoutDashboard className="h-4 w-4" /> Dashboard
        </Button>
        <Button
          variant="outline"
          onClick={() => setIsAiModalOpen(true)}
          disabled={isLoading || isLoadingTodoist}
          className="flex items-center gap-2 ml-auto"
        >
          <Lightbulb className="h-4 w-4" /> Assistente IA
        </Button>
      </div>

      {/* Seletor de filtro de exibição e busca */}
      {(currentView === "matrix" || currentView === "results" || currentView === "dashboard") && (
        <div className="mb-6 grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="relative md:col-span-2">
            <Input
              type="text"
              placeholder="Buscar tarefas por conteúdo, descrição ou etiqueta..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500" />
          </div>
          <Select value={displayFilter} onValueChange={(value: DisplayFilter) => setDisplayFilter(value)}>
            <SelectTrigger className="w-full mt-1">
              <SelectValue placeholder="Filtrar por Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas as Tarefas</SelectItem>
              <SelectItem value="overdue">Apenas Atrasadas</SelectItem>
              <SelectItem value="today">Apenas Vencem Hoje</SelectItem>
              <SelectItem value="tomorrow">Apenas Vencem Amanhã</SelectItem>
              <SelectItem value="overdue_and_today">Atrasadas e Hoje</SelectItem>
            </SelectContent>
          </Select>
          <Select value={categoryDisplayFilter} onValueChange={(value: CategoryDisplayFilter) => setCategoryDisplayFilter(value)}>
            <SelectTrigger className="w-full mt-1">
              <SelectValue placeholder="Filtrar por Categoria" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas as Categorias</SelectItem>
              <SelectItem value="pessoal">Pessoal</SelectItem>
              <SelectItem value="profissional">Profissional</SelectItem>
            </SelectContent>
          </Select>
        </div>
      )}

      <Card className="p-6">
        <CardContent className="p-0">
          {renderContent()}
        </CardContent>
      </Card>

      <AiAssistantModal
        isOpen={isAiModalOpen}
        onClose={() => setIsAiModalOpen(false)}
        tasks={tasksToProcess}
      />
    </div>
  );
};

export default Eisenhower;