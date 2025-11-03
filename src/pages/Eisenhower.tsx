"use client";

import React, { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useTodoist } from "@/context/TodoistContext";
import { EisenhowerTask, TodoistTask, DisplayFilter } from "@/lib/types"; // Importar DisplayFilter
import LoadingSpinner from "@/components/ui/loading-spinner";
import { toast } from "sonner";
import { LayoutDashboard, Settings, ListTodo, Scale, Lightbulb, RefreshCw, Search, RotateCcw } from "lucide-react"; // Importar Search e RotateCcw
import { format, parseISO, isValid, isPast, isToday, isTomorrow, isBefore } from 'date-fns'; // Importar format, parseISO, isValid, isPast, isToday, isTomorrow
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"; // Importar Select components
import { Input } from "@/components/ui/input"; // Importar Input

// Importar os componentes do Eisenhower
import SetupScreen from "@/components/eisenhower/SetupScreen";
import RatingScreen from "@/components/eisenhower/RatingScreen";
import EisenhowerMatrixView from "@/components/eisenhower/EisenhowerMatrixView";
import ResultsScreen from "@/components/eisenhower/ResultsScreen";
import DashboardScreen from "@/components/eisenhower/DashboardScreen";
import AiAssistantModal from "@/components/eisenhower/AiAssistantModal";

type EisenhowerView = "setup" | "rating" | "matrix" | "results" | "dashboard";

const EISENHOWER_STORAGE_KEY = "eisenhowerMatrixState";
const EISENHOWER_FILTER_INPUT_STORAGE_KEY = "eisenhower_filter_input"; // Corrected typo here
const EISENHOWER_STATUS_FILTER_STORAGE_KEY = "eisenhower_status_filter";
const EISENHOWER_CATEGORY_FILTER_STORAGE_KEY = "eisenhower_category_filter";
const EISENHOWER_DISPLAY_FILTER_STORAGE_KEY = "eisenhower_display_filter"; // Nova chave para o localStorage

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

  const handleCategorizeTasks = useCallback(() => {
    const ratedTasks = tasksToProcess.filter(t => t.urgency !== null && t.importance !== null);
    
    if (ratedTasks.length === 0) {
      setTasksToProcess(prev => prev.map(t => ({ ...t, quadrant: null })));
      return;
    }

    // Calculate dynamic thresholds based on the *rated tasks* data
    const urgencyValues = ratedTasks.map(t => t.urgency!).filter(v => v !== null) as number[];
    const importanceValues = ratedTasks.map(t => t.importance!).filter(v => v !== null) as number[];

    const { threshold: urgencyThreshold } = getDynamicDomainAndThreshold(urgencyValues);
    const { threshold: importanceThreshold } = getDynamicDomainAndThreshold(importanceValues);

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
  }, [tasksToProcess, getDynamicDomainAndThreshold]);

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

  // Função para filtrar as tarefas com base no displayFilter
  const getFilteredTasksForDisplay = useCallback((tasks: EisenhowerTask[], filter: DisplayFilter): EisenhowerTask[] => {
    let filteredByDate = tasks;

    const now = new Date();
    
    // 1. Filtragem por Data/Status (displayFilter)
    if (filter !== "all") {
      filteredByDate = tasks.filter(task => {
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
        if (filter === "overdue") {
          // Uma tarefa é atrasada se a data/hora efetiva for no passado (isPast)
          // e não for uma data futura (para evitar problemas com datas sem hora)
          return isPast(effectiveDate) && !isToday(effectiveDate);
        }
        if (filter === "today") {
          // Uma tarefa é para hoje se a data efetiva for hoje.
          return isToday(effectiveDate);
        }
        if (filter === "tomorrow") {
          return isTomorrow(effectiveDate);
        }
        if (filter === "overdue_and_today") { // Nova lógica para "Atrasadas e Hoje"
          // Inclui todas as tarefas que já passaram (overdue) OU que vencem hoje (isToday)
          return isPast(effectiveDate) || isToday(effectiveDate);
        }
        return true;
      });
    }

    // 2. Filtragem por Termo de Busca (searchTerm)
    const lowerCaseSearchTerm = searchTerm.toLowerCase();
    if (lowerCaseSearchTerm.trim() === "") {
      return filteredByDate;
    }

    return filteredByDate.filter(task => 
      task.content.toLowerCase().includes(lowerCaseSearchTerm) ||
      task.description.toLowerCase().includes(lowerCaseSearchTerm) ||
      task.labels.some(label => label.toLowerCase().includes(lowerCaseSearchTerm))
    );

  }, [tasksToProcess, displayFilter, searchTerm]);

  const filteredTasksForDisplay = getFilteredTasksForDisplay(tasksToProcess, displayFilter);

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
      handleCategorizeTasks(); // Recategoriza as tarefas após a atualização
      toast.success("Matriz atualizada com as últimas tarefas do Todoist!");
    } catch (error) {
      console.error("Failed to refresh Eisenhower Matrix:", error);
      toast.error("Falha ao atualizar a matriz.");
    } finally {
      setIsLoading(false);
    }
  }, [filterInput, statusFilter, categoryFilter, fetchTasks, tasksToProcess, sortEisenhowerTasks, handleCategorizeTasks]);

  const handleStartReview = useCallback(() => {
    setCurrentView("rating");
    toast.info("Iniciando revisão de avaliação.");
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
            tasks={tasksToProcess} // Passa TODAS as tarefas para revisão
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
            tasks={filteredTasksForDisplay} // Passa as tarefas filtradas para exibição
            onBack={handleStartReview} // Volta para a tela de avaliação
            onViewResults={() => setCurrentView("results")}
            displayFilter={displayFilter} // Passa o filtro de exibição
            onDisplayFilterChange={setDisplayFilter} // Passa a função para alterar o filtro
            onRefreshMatrix={handleRefreshMatrix} // Passa a nova função de atualização
          />
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

      {/* Seletor de filtro de exibição e busca */}
      {(currentView === "matrix" || currentView === "results" || currentView === "dashboard") && (
        <div className="mb-6 grid grid-cols-1 md:grid-cols-3 gap-4">
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