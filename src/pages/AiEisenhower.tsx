"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ArrowLeft, ArrowRight, Scale, Check, Lightbulb, LayoutDashboard, RefreshCw, XCircle } from "lucide-react";
import { EisenhowerTask, DisplayFilter } from "@/lib/types";
import TaskCard from "@/components/eisenhower/TaskCard"; // Reutilizando o TaskCard
import { toast } from "sonner";
import LoadingSpinner from "@/components/ui/loading-spinner";
import { useTodoist } from "@/context/TodoistContext";
import { format, parseISO, isValid, isPast, isToday, isTomorrow } from 'date-fns';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import SetupScreen from "@/components/eisenhower/SetupScreen"; // Reutilizando o SetupScreen
import ResultsScreen from "@/components/eisenhower/ResultsScreen"; // Reutilizando ResultsScreen
import EisenhowerMatrixView from "@/components/eisenhower/EisenhowerMatrixView"; // Reutilizando EisenhowerMatrixView
import { Progress } from "@/components/ui/progress"; // Importar o componente Progress

type AiEisenhowerView = "setup" | "results" | "matrix" | "dashboard"; // Removido 'processing'

const AI_EISENHOWER_STORAGE_KEY = "aiEisenhowerMatrixState";
const AI_EISENHOWER_FILTER_INPUT_STORAGE_KEY = "ai_eisenhower_filter_input";
const AI_EISENHOWER_STATUS_FILTER_STORAGE_KEY = "ai_eisenhower_status_filter";
const AI_EISENHOWER_CATEGORY_FILTER_STORAGE_KEY = "ai_eisenhower_category_filter";
const AI_EISENHOWER_DISPLAY_FILTER_STORAGE_KEY = "ai_eisenhower_display_filter";

// URL da função Edge do Supabase
const GEMINI_CHAT_FUNCTION_URL = "https://nesiwmsujsulwncbmcnc.supabase.co/functions/v1/gemini-chat";

const AiEisenhower = () => {
  const { fetchTasks, isLoading: isLoadingTodoist } = useTodoist();
  const [currentView, setCurrentView] = useState<AiEisenhowerView>("setup");
  const [tasksToProcess, setTasksToProcess] = useState<EisenhowerTask[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // Filtros de carregamento
  const [filterInput, setFilterInput] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem(AI_EISENHOWER_FILTER_INPUT_STORAGE_KEY) || "";
    }
    return "";
  });
  const [statusFilter, setStatusFilter] = useState<"all" | "overdue">(() => {
    if (typeof window !== 'undefined') {
      return (localStorage.getItem(AI_EISENHOWER_STATUS_FILTER_STORAGE_KEY) as "all" | "overdue") || "all";
    }
    return "all";
  });
  const [categoryFilter, setCategoryFilter] = useState<"all" | "pessoal" | "profissional">(() => {
    if (typeof window !== 'undefined') {
      return (localStorage.getItem(AI_EISENHOWER_CATEGORY_FILTER_STORAGE_KEY) as "all" | "pessoal" | "profissional") || "all";
    }
    return "all";
  });

  // Filtro de exibição
  const [displayFilter, setDisplayFilter] = useState<DisplayFilter>(() => {
    if (typeof window !== 'undefined') {
      return (localStorage.getItem(AI_EISENHOWER_DISPLAY_FILTER_STORAGE_KEY) as DisplayFilter) || "all";
    }
    return "all";
  });

  // Efeitos para salvar os filtros no localStorage
  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem(AI_EISENHOWER_FILTER_INPUT_STORAGE_KEY, filterInput);
      localStorage.setItem(AI_EISENHOWER_STATUS_FILTER_STORAGE_KEY, statusFilter);
      localStorage.setItem(AI_EISENHOWER_CATEGORY_FILTER_STORAGE_KEY, categoryFilter);
      localStorage.setItem(AI_EISENHOWER_DISPLAY_FILTER_STORAGE_KEY, displayFilter);
    }
  }, [filterInput, statusFilter, categoryFilter, displayFilter]);

  // Carregar estado salvo
  useEffect(() => {
    const savedState = localStorage.getItem(AI_EISENHOWER_STORAGE_KEY);
    if (savedState) {
      try {
        const parsedState = JSON.parse(savedState);
        setTasksToProcess(parsedState.tasksToProcess || []);
        setCurrentView(parsedState.currentView || "setup");
        toast.info("Estado da Matriz de Eisenhower (IA) carregado.");
      } catch (e) {
        console.error("Failed to load AI Eisenhower state from localStorage", e);
        localStorage.removeItem(AI_EISENHOWER_STORAGE_KEY);
        toast.error("Erro ao carregar estado da Matriz de Eisenhower (IA). Reiniciando.");
      }
    }
  }, []);

  // Salvar estado
  useEffect(() => {
    if (currentView !== "setup" || tasksToProcess.length > 0) {
      localStorage.setItem(AI_EISENHOWER_STORAGE_KEY, JSON.stringify({ tasksToProcess, currentView }));
    }
  }, [tasksToProcess, currentView]);

  const sortEisenhowerTasks = useCallback((tasks: EisenhowerTask[]): EisenhowerTask[] => {
    return [...tasks].sort((a, b) => {
      const getDateValue = (dateString: string | null | undefined) => {
        if (typeof dateString === 'string' && dateString) {
          const parsedDate = parseISO(dateString);
          return isValid(parsedDate) ? parsedDate.getTime() : Infinity;
        }
        return Infinity;
      };

      const deadlineA = getDateValue(a.deadline);
      const deadlineB = getDateValue(b.deadline);
      if (deadlineA !== deadlineB) return deadlineA - deadlineB;

      if (b.priority !== a.priority) return b.priority - a.priority;

      const dueDateTimeA = getDateValue(a.due?.datetime);
      const dueDateTimeB = getDateValue(b.due?.datetime);
      if (dueDateTimeA !== dueDateTimeB) return dueDateTimeA - dueDateTimeB;

      const dueDateA = getDateValue(a.due?.date);
      const dueDateB = getDateValue(b.due?.date);
      if (dueDateA !== dueDateB) return dueDateA - dueDateB;

      const createdAtA = getDateValue(a.created_at);
      const createdAtB = getDateValue(b.created_at);
      if (createdAtA !== createdAtB) return createdAtA - createdAtB;
      return 0;
    });
  }, []);

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

  const handleCategorizeTasks = useCallback((tasks: EisenhowerTask[]): EisenhowerTask[] => {
    const ratedTasks = tasks.filter(t => t.urgency !== null && t.importance !== null);
    
    if (ratedTasks.length === 0) {
      return tasks.map(t => ({ ...t, quadrant: null }));
    }

    const urgencyValues = ratedTasks.map(t => t.urgency!).filter(v => v !== null) as number[];
    const importanceValues = ratedTasks.map(t => t.importance!).filter(v => v !== null) as number[];

    const { threshold: urgencyThreshold } = getDynamicDomainAndThreshold(urgencyValues);
    const { threshold: importanceThreshold } = getDynamicDomainAndThreshold(importanceValues);

    return tasks.map(task => {
      if (task.urgency !== null && task.importance !== null) {
        const isUrgent = task.urgency >= urgencyThreshold;
        const isImportant = task.importance >= importanceThreshold;

        let quadrant: EisenhowerTask['quadrant'] = null;
        if (isUrgent && isImportant) quadrant = 'do';
        else if (!isUrgent && isImportant) quadrant = 'decide';
        else if (isUrgent && !isImportant) quadrant = 'delegate';
        else quadrant = 'delete';
        return { ...task, quadrant };
      }
      return task;
    });
  }, [getDynamicDomainAndThreshold]);

  const handleLoadTasks = useCallback(async (filter: string) => {
    setIsLoading(true);
    try {
      const fetchedTodoistTasks = await fetchTasks(filter, { includeSubtasks: false, includeRecurring: false });
      const initialEisenhowerTasks: EisenhowerTask[] = fetchedTodoistTasks.map(task => ({
        ...task,
        urgency: null, // Tasks start unrated in this module
        importance: null,
        quadrant: null,
        url: task.url,
      }));
      
      const sortedTasks = sortEisenhowerTasks(initialEisenhowerTasks);
      
      setTasksToProcess(sortedTasks);
      if (sortedTasks.length > 0) {
        // In this reverted state, we don't automatically process with AI here.
        // Tasks will be displayed unrated, or with ratings if loaded from saved state.
        const categorizedTasks = handleCategorizeTasks(sortedTasks); // Categorize based on any existing ratings
        setTasksToProcess(categorizedTasks);
        setCurrentView("results"); // Go directly to results to show loaded tasks
        toast.success(`Carregadas ${sortedTasks.length} tarefas para a Matriz de Eisenhower (IA).`);
      } else {
        setCurrentView("results"); // If no tasks, go to results to show empty state
        toast.info("Nenhuma tarefa encontrada para a Matriz de Eisenhower (IA).");
      }
    } catch (error) {
      console.error("Failed to load tasks for AI Eisenhower Matrix:", error);
      toast.error("Falha ao carregar tarefas.");
      setCurrentView("setup"); // Volta para setup em caso de erro
    } finally {
      setIsLoading(false);
    }
  }, [fetchTasks, sortEisenhowerTasks, handleCategorizeTasks]);

  const handleReset = useCallback(() => {
    setTasksToProcess([]);
    setCurrentView("setup");
    localStorage.removeItem(AI_EISENHOWER_STORAGE_KEY);
    toast.info("Matriz de Eisenhower (IA) resetada.");
  }, []);

  const getFilteredTasksForDisplay = useCallback((tasks: EisenhowerTask[], filter: DisplayFilter): EisenhowerTask[] => {
    if (filter === "all") return tasks;

    const now = new Date();
    return tasks.filter(task => {
      if (task.urgency === null || task.importance === null) return false;

      let dueDate: Date | null = null;
      if (typeof task.due?.datetime === 'string' && task.due.datetime) dueDate = parseISO(task.due.datetime);
      else if (typeof task.due?.date === 'string' && task.due.date) dueDate = parseISO(task.due.date);

      let deadlineDate: Date | null = null;
      if (typeof task.deadline === 'string' && task.deadline) deadlineDate = parseISO(task.deadline);

      if (!dueDate && !deadlineDate) return false;

      const effectiveDate = deadlineDate || dueDate;
      if (!effectiveDate || !isValid(effectiveDate)) return false;

      if (filter === "overdue") return isPast(effectiveDate) && !isToday(effectiveDate);
      if (filter === "today") return isToday(effectiveDate);
      if (filter === "tomorrow") return isTomorrow(effectiveDate);
      if (filter === "overdue_and_today") return (isPast(effectiveDate) && !isToday(effectiveDate)) || isToday(effectiveDate);
      return true;
    });
  }, []);

  const filteredTasksForDisplay = getFilteredTasksForDisplay(tasksToProcess, displayFilter);

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
      case "results":
        return (
          <ResultsScreen
            tasks={filteredTasksForDisplay} // Passa as tarefas filtradas para exibição
            onBack={() => setCurrentView("setup")} // Volta para setup
            onViewDashboard={() => setCurrentView("dashboard")}
            displayFilter={displayFilter} // Passa o filtro de exibição
            onDisplayFilterChange={setDisplayFilter} // Passa a função para alterar o filtro
          />
        );
      case "matrix":
        return (
          <EisenhowerMatrixView
            tasks={filteredTasksForDisplay} // Passa as tarefas filtradas para exibição
            onBack={() => setCurrentView("results")}
            onViewResults={() => setCurrentView("results")}
            displayFilter={displayFilter} // Passa o filtro de exibição
            onDisplayFilterChange={setDisplayFilter} // Passa a função para alterar o filtro
            onRefreshMatrix={handleLoadTasks} // Usa handleLoadTasks para recarregar
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
        <LayoutDashboard className="inline-block h-8 w-8 mr-2 text-indigo-600" /> EISENHOWER - IA
      </h2>
      <p className="text-lg text-gray-600 mb-6">
        Deixe a IA sugerir a urgência e importância das suas tarefas.
      </p>

      <div className="flex flex-wrap gap-2 mb-6">
        <Button
          variant={currentView === "setup" ? "default" : "outline"}
          onClick={() => setCurrentView("setup")}
          disabled={isLoading || isLoadingTodoist}
          className="flex items-center gap-2"
        >
          <Lightbulb className="h-4 w-4" /> Configurar
        </Button>
        <Button
          variant={currentView === "results" ? "default" : "outline"}
          onClick={() => setCurrentView("results")}
          disabled={isLoading || isLoadingTodoist || tasksToProcess.length === 0}
          className="flex items-center gap-2"
        >
          <LayoutDashboard className="h-4 w-4" /> Resultados
        </Button>
        <Button
          variant={currentView === "matrix" ? "default" : "outline"}
          onClick={() => setCurrentView("matrix")}
          disabled={isLoading || isLoadingTodoist || tasksToProcess.length === 0}
          className="flex items-center gap-2"
        >
          <LayoutDashboard className="h-4 w-4" /> Matriz Visual
        </Button>
        <Button
          variant={currentView === "dashboard" ? "default" : "outline"}
          onClick={() => setCurrentView("dashboard")}
          disabled={isLoading || isLoadingTodoist || tasksToProcess.length === 0}
          className="flex items-center gap-2"
        >
          <LayoutDashboard className="h-4 w-4" /> Dashboard
        </Button>
      </div>

      {/* Novo seletor de filtro de exibição, visível em todas as telas de visualização */}
      {(currentView === "results" || currentView === "matrix" || currentView === "dashboard") && (
        <div className="mb-6 max-w-md mx-auto">
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
        </div>
      )}

      <Card className="p-6">
        <CardContent className="p-0">
          {renderContent()}
        </CardContent>
      </Card>
    </div>
  );
};

export default AiEisenhower;