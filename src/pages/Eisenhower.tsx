"use client";

import React, { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useTodoist } from "@/context/TodoistContext";
import { EisenhowerTask, TodoistTask } from "@/lib/types";
import LoadingSpinner from "@/components/ui/loading-spinner";
import { toast } from "sonner";
import { LayoutDashboard, Settings, ListTodo, Scale, Lightbulb } from "lucide-react"; // Alterado de Matrix para LayoutDashboard
import { format, parseISO, isValid } from 'date-fns'; // Importar format, parseISO, isValid

// Importar os componentes do Eisenhower
import SetupScreen from "@/components/eisenhower/SetupScreen";
import RatingScreen from "@/components/eisenhower/RatingScreen";
import EisenhowerMatrixView from "@/components/eisenhower/EisenhowerMatrixView";
import ResultsScreen from "@/components/eisenhower/ResultsScreen";
import DashboardScreen from "@/components/eisenhower/DashboardScreen";
import AiAssistantModal from "@/components/eisenhower/AiAssistantModal";

// A função calculateMedian duplicada foi removida daqui.
const calculateMedian = (values: number[]): number => {
  if (values.length === 0) return 50;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  
  if (sorted.length % 2 === 0) {
    return (sorted[mid - 1] + sorted[mid]) / 2;
  }
  return sorted[mid];
};

type EisenhowerView = "setup" | "rating" | "matrix" | "results" | "dashboard";

const EISENHOWER_STORAGE_KEY = "eisenhowerMatrixState";
const EISENHOWER_FILTER_INPUT_STORAGE_KEY = "eisenhower_filter_input";
const EISENHOWER_STATUS_FILTER_STORAGE_KEY = "eisenhower_status_filter";
const EISENHOWER_CATEGORY_FILTER_STORAGE_KEY = "eisenhower_category_filter";

const Eisenhower = () => {
  const { fetchTasks, isLoading: isLoadingTodoist } = useTodoist();
  const [currentView, setCurrentView] = useState<EisenhowerView>("setup");
  const [tasksToProcess, setTasksToProcess] = useState<EisenhowerTask[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isAiModalOpen, setIsAiModalOpen] = useState(false);

  // Novos estados para os filtros
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
      const initialEisenhowerTasks: EisenhowerTask[] = fetchedTodoistTasks.map(task => ({
        ...task,
        urgency: null, // Garantir que novas tarefas comecem sem avaliação
        importance: null, // Garantir que novas tarefas comecem sem avaliação
        quadrant: null,
        url: task.url, // Garantir que a URL seja passada
      }));
      
      const sortedTasks = sortEisenhowerTasks(initialEisenhowerTasks); // Aplicar a ordenação aqui
      
      setTasksToProcess(sortedTasks);
      setCurrentView("rating");
      toast.success(`Carregadas ${sortedTasks.length} tarefas para a Matriz de Eisenhower.`);
    } catch (error) {
      console.error("Failed to load tasks for Eisenhower Matrix:", error);
      toast.error("Falha ao carregar tarefas.");
    } finally {
      setIsLoading(false);
    }
  }, [fetchTasks, sortEisenhowerTasks]);

  const handleUpdateTaskRating = useCallback((taskId: string, urgency: number | null, importance: number | null) => {
    setTasksToProcess(prevTasks => {
      const updatedTasks = prevTasks.map(task =>
        task.id === taskId ? { ...task, urgency, importance } : task
      );
      return updatedTasks;
    });
  }, []);

  const handleCategorizeTasks = useCallback(() => {
    const ratedTasks = tasksToProcess.filter(t => t.urgency !== null && t.importance !== null);
    
    if (ratedTasks.length === 0) {
      setTasksToProcess(prev => prev.map(t => ({ ...t, quadrant: null })));
      return;
    }

    const urgencyValues = ratedTasks.map(t => t.urgency!);
    const importanceValues = ratedTasks.map(t => t.importance!);

    const urgencyThreshold = calculateMedian(urgencyValues);
    const importanceThreshold = calculateMedian(importanceValues);

    setTasksToProcess(prevTasks => {
      return prevTasks.map(task => {
        if (task.urgency !== null && task.importance !== null) {
          // Categorização baseada nos thresholds dinâmicos
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
    toast.success("Tarefas categorizadas na Matriz de Eisenhower!");
  }, [tasksToProcess]);

  const handleReset = useCallback(() => {
    setTasksToProcess([]);
    setCurrentView("setup");
    localStorage.removeItem(EISENHOWER_STORAGE_KEY);
    toast.info("Matriz de Eisenhower resetada.");
  }, []);

  const handleFinishRating = useCallback(() => {
    handleCategorizeTasks(); // Categoriza todas as tarefas (incluindo as já avaliadas)
    setCurrentView("matrix"); // Muda para a visualização da matriz
  }, [handleCategorizeTasks]);

  const ratedTasksCount = tasksToProcess.filter(t => t.urgency !== null && t.importance !== null).length;
  const canViewMatrixOrResults = ratedTasksCount >= 2; // Habilitar se pelo menos 2 tarefas foram avaliadas

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
            tasks={unratedTasks} // Passa apenas as tarefas não avaliadas
            onUpdateTaskRating={handleUpdateTaskRating}
            onFinishRating={handleFinishRating} // Usa a nova função handleFinishRating
            onBack={() => setCurrentView("setup")}
            onViewMatrix={() => {
              handleCategorizeTasks(); // Categoriza todas as tarefas antes de visualizar a matriz
              setCurrentView("matrix");
            }}
            canViewMatrix={canViewMatrixOrResults} // Passa a prop canViewMatrixOrResults
          />
        );
      case "matrix":
        return (
          <EisenhowerMatrixView
            tasks={tasksToProcess}
            onBack={() => setCurrentView("rating")}
            onViewResults={() => setCurrentView("results")}
          />
        );
      case "results":
        return (
          <ResultsScreen
            tasks={tasksToProcess}
            onBack={() => setCurrentView("matrix")}
            onViewDashboard={() => setCurrentView("dashboard")}
          />
        );
      case "dashboard":
        return (
          <DashboardScreen
            tasks={tasksToProcess}
            onBack={() => setCurrentView("results")}
            onReset={handleReset}
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
          onClick={() => { handleCategorizeTasks(); setCurrentView("matrix"); }} // Categoriza e vai para a matriz
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