"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
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
import { eisenhowerService } from "@/services/eisenhowerService"; // Importar o novo service
import { useSupabaseAuth } from "@/hooks/useSupabaseAuth"; // Importar o hook de auth

// Importar os componentes do Eisenhower
import SetupScreen from "@/components/eisenhower/SetupScreen";
import RatingScreen from "@/components/eisenhower/RatingScreen";
import EisenhowerMatrixView from "@/components/eisenhower/EisenhowerMatrixView";
import ResultsScreen from "@/components/eisenhower/ResultsScreen";
import DashboardScreen from "@/components/eisenhower/DashboardScreen";
import AiAssistantModal from "@/components/eisenhower/AiAssistantModal";
// import ThresholdSlider from "@/components/eisenhower/ThresholdSlider"; // Removido

type EisenhowerView = "setup" | "rating" | "matrix" | "results" | "dashboard";
type RatingFilter = "all" | "unrated"; // Novo tipo de filtro para avaliação
type PriorityFilter = "all" | "p1" | "p2" | "p3" | "p4"; // Novo tipo de filtro de prioridade
type DeadlineFilter = "all" | "has_deadline" | "no_deadline"; // Novo tipo de filtro de deadline

// Removendo EISENHOWER_STORAGE_KEY e usando Supabase
const EISENHOWER_FILTER_INPUT_STORAGE_KEY = "eisenhower_filter_input";
const EISENHOWER_STATUS_FILTER_STORAGE_KEY = "eisenhower_status_filter";
const EISENHOWER_CATEGORY_FILTER_STORAGE_KEY = "eisenhower_category_filter";
// Removidos: EISENHOWER_PRIORITY_FILTER_STORAGE_KEY, EISENHOWER_DEADLINE_FILTER_STORAGE_KEY
const EISENHOWER_DISPLAY_FILTER_STORAGE_KEY = "eisenhower_display_filter";
const EISENHOWER_RATING_FILTER_STORAGE_KEY = "eisenhower_rating_filter";
const EISENHOWER_CATEGORY_DISPLAY_FILTER_STORAGE_KEY = "eisenhower_category_display_filter";
const EISENHOWER_DISPLAY_PRIORITY_FILTER_STORAGE_KEY = "eisenhower_display_priority_filter";
const EISENHOWER_DISPLAY_DEADLINE_FILTER_STORAGE_KEY = "eisenhower_display_deadline_filter";
const EISENHOWER_MANUAL_THRESHOLDS_STORAGE_KEY = "eisenhower_manual_thresholds";
const EISENHOWER_DIAGONAL_X_POINT_STORAGE_KEY = "eisenhower_diagonal_x_point";
const EISENHOWER_DIAGONAL_Y_POINT_STORAGE_KEY = "eisenhower_diagonal_y_point";

const defaultManualThresholds: ManualThresholds = { urgency: 50, importance: 50 };

const Eisenhower = () => {
  const { fetchTasks, isLoading: isLoadingTodoist } = useTodoist();
  const { user, isLoading: isLoadingAuth } = useSupabaseAuth();
  
  const [currentView, setCurrentView] = useState<EisenhowerView>("setup");
  const [tasksToProcess, setTasksToProcess] = useState<EisenhowerTask[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isAiModalOpen, setIsAiModalOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");

  // Estados para os filtros de carregamento (SetupScreen)
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
  // Removidos: priorityFilter, deadlineFilter

  // Estados para os filtros de exibição (Matrix/Results/Dashboard)
  const [displayFilter, setDisplayFilter] = useState<DisplayFilter>(() => {
    if (typeof window !== 'undefined') {
      return (localStorage.getItem(EISENHOWER_DISPLAY_FILTER_STORAGE_KEY) as DisplayFilter) || "all";
    }
    return "all";
  });
  const [categoryDisplayFilter, setCategoryDisplayFilter] = useState<CategoryDisplayFilter>(() => {
    if (typeof window !== 'undefined') {
      return (localStorage.getItem(EISENHOWER_CATEGORY_DISPLAY_FILTER_STORAGE_KEY) as CategoryDisplayFilter) || "all";
    }
    return "all";
  });
  const [displayPriorityFilter, setDisplayPriorityFilter] = useState<PriorityFilter>(() => {
    if (typeof window !== 'undefined') {
      return (localStorage.getItem(EISENHOWER_DISPLAY_PRIORITY_FILTER_STORAGE_KEY) as PriorityFilter) || "all";
    }
    return "all";
  });
  const [displayDeadlineFilter, setDisplayDeadlineFilter] = useState<DeadlineFilter>(() => {
    if (typeof window !== 'undefined') {
      return (localStorage.getItem(EISENHOWER_DISPLAY_DEADLINE_FILTER_STORAGE_KEY) as DeadlineFilter) || "all";
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

  // NOVOS ESTADOS PARA LINHA DIAGONAL
  const [diagonalXPoint, setDiagonalXPoint] = useState<number>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem(EISENHOWER_DIAGONAL_X_POINT_STORAGE_KEY);
      return saved ? parseInt(saved, 10) : 50;
    }
    return 50;
  });
  const [diagonalYPoint, setDiagonalYPoint] = useState<number>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem(EISENHOWER_DIAGONAL_Y_POINT_STORAGE_KEY);
      return saved ? parseInt(saved, 10) : 50;
    }
    return 50;
  });

  // Efeitos para salvar os filtros no localStorage
  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem(EISENHOWER_FILTER_INPUT_STORAGE_KEY, filterInput);
      localStorage.setItem(EISENHOWER_STATUS_FILTER_STORAGE_KEY, statusFilter);
      localStorage.setItem(EISENHOWER_CATEGORY_FILTER_STORAGE_KEY, categoryFilter);
      // Removidos: localStorage.setItem(EISENHOWER_PRIORITY_FILTER_STORAGE_KEY, priorityFilter);
      // Removidos: localStorage.setItem(EISENHOWER_DEADLINE_FILTER_STORAGE_KEY, deadlineFilter);
      localStorage.setItem(EISENHOWER_DISPLAY_FILTER_STORAGE_KEY, displayFilter);
      localStorage.setItem(EISENHOWER_RATING_FILTER_STORAGE_KEY, ratingFilter);
      localStorage.setItem(EISENHOWER_CATEGORY_DISPLAY_FILTER_STORAGE_KEY, categoryDisplayFilter);
      localStorage.setItem(EISENHOWER_DISPLAY_PRIORITY_FILTER_STORAGE_KEY, displayPriorityFilter);
      localStorage.setItem(EISENHOWER_DISPLAY_DEADLINE_FILTER_STORAGE_KEY, displayDeadlineFilter);
      localStorage.setItem(EISENHOWER_MANUAL_THRESHOLDS_STORAGE_KEY, JSON.stringify(manualThresholds));
      localStorage.setItem(EISENHOWER_DIAGONAL_X_POINT_STORAGE_KEY, String(diagonalXPoint));
      localStorage.setItem(EISENHOWER_DIAGONAL_Y_POINT_STORAGE_KEY, String(diagonalYPoint));
    }
  }, [filterInput, statusFilter, categoryFilter, displayFilter, ratingFilter, categoryDisplayFilter, displayPriorityFilter, displayDeadlineFilter, manualThresholds, diagonalXPoint, diagonalYPoint]);

  // --- Lógica de Carregamento e Persistência Supabase ---

  // 1. Carregar avaliações do Supabase na inicialização
  const loadRatingsFromSupabase = useCallback(async () => {
    if (!user) return new Map<string, any>();
    try {
      return await eisenhowerService.fetchAllRatings();
    } catch (e) {
      console.error("Failed to load ratings from Supabase:", e);
      toast.error("Falha ao carregar avaliações da nuvem.");
      return new Map();
    }
  }, [user]);

  // 2. Função para salvar o estado atual (apenas a view, pois as ratings são salvas individualmente)
  const saveCurrentViewToLocalStorage = useCallback(() => {
    // Mantemos a view no localStorage para persistência de sessão
    localStorage.setItem('eisenhower_current_view', currentView);
  }, [currentView]);

  // 3. Carregar estado inicial (view)
  useEffect(() => {
    const savedView = localStorage.getItem('eisenhower_current_view');
    if (savedView) {
      setCurrentView(savedView as EisenhowerView);
    }
  }, []);

  // 4. Salvar view quando ela muda
  useEffect(() => {
    saveCurrentViewToLocalStorage();
  }, [currentView, saveCurrentViewToLocalStorage]);


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

  // Função auxiliar para construir o filtro final (para o Todoist API)
  const buildFinalFilter = useCallback((
    input: string,
    status: "all" | "overdue",
    category: "all" | "pessoal" | "profissional",
    // Removidos: priority: PriorityFilter, deadline: DeadlineFilter
  ): string => {
    const filterParts: string[] = [];

    if (input.trim()) {
      filterParts.push(`(${input.trim()})`);
    }
    
    if (status === "overdue") {
      filterParts.push("due before: in 0 min");
    }

    if (category === "pessoal") {
      filterParts.push("@pessoal");
    } else if (category === "profissional") {
      filterParts.push("@profissional");
    }

    // Removidos: Lógica de filtro de prioridade e deadline

    const finalFilter = filterParts.join(" & ");
    return finalFilter || undefined as unknown as string; // Retorna undefined se o filtro estiver vazio
  }, []);

  const handleLoadTasks = useCallback(async (filter: string) => {
    if (isLoadingAuth || !user) {
      toast.error("Usuário não autenticado. Não é possível carregar tarefas.");
      return;
    }
    setIsLoading(true);
    try {
      const [fetchedTodoistTasks, existingRatingsMap] = await Promise.all([
        fetchTasks(filter, { includeSubtasks: false, includeRecurring: false }),
        loadRatingsFromSupabase(),
      ]);
      
      const initialEisenhowerTasks: EisenhowerTask[] = fetchedTodoistTasks.map(task => {
        const existingRating = existingRatingsMap.get(task.id);
        return {
          ...task,
          urgency: existingRating?.urgency ?? null,
          importance: existingRating?.importance ?? null,
          quadrant: existingRating?.quadrant as EisenhowerTask['quadrant'] ?? null,
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
  }, [fetchTasks, sortEisenhowerTasks, loadRatingsFromSupabase, user, isLoadingAuth]);

  const handleUpdateTaskRating = useCallback(async (taskId: string, urgency: number | null, importance: number | null) => {
    // 1. Atualiza o estado local imediatamente
    setTasksToProcess(prevTasks => {
      return prevTasks.map(task =>
        task.id === taskId ? { ...task, urgency, importance } : task
      );
    });

    // 2. Persiste no Supabase
    if (user) {
      const taskToUpdate = tasksToProcess.find(t => t.id === taskId);
      if (taskToUpdate) {
        await eisenhowerService.upsertRating({
          todoist_task_id: taskId,
          urgency,
          importance,
          quadrant: taskToUpdate.quadrant, // Mantém o quadrante atual (será recalculado em handleCategorizeTasks)
        });
      }
    }
  }, [tasksToProcess, user]);

  // Helper function to calculate dynamic domain and threshold (reintroduzida)
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

  // Categorização usando o threshold dinâmico (ponto médio do domínio dos dados)
  const handleCategorizeTasks = useCallback(async () => {
    const ratedTasks = tasksToProcess.filter(t => t.urgency !== null && t.importance !== null);
    
    if (ratedTasks.length === 0) {
      setTasksToProcess(prev => prev.map(t => ({ ...t, quadrant: null })));
      return;
    }

    // Calcula o threshold dinâmico (ponto médio do domínio dos dados)
    const urgencyValues = ratedTasks.map(t => t.urgency!).filter(v => v !== null) as number[];
    const importanceValues = ratedTasks.map(t => t.importance!).filter(v => v !== null) as number[];

    const { threshold: dynamicUrgencyThreshold } = getDynamicDomainAndThreshold(urgencyValues);
    const { threshold: dynamicImportanceThreshold } = getDynamicDomainAndThreshold(importanceValues);
    
    const urgencyThreshold = dynamicUrgencyThreshold;
    const importanceThreshold = dynamicImportanceThreshold;

    const updatesToSupabase: Promise<any>[] = [];

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
          
          // Persiste o novo quadrante no Supabase
          if (user && task.quadrant !== quadrant) {
            updatesToSupabase.push(eisenhowerService.upsertRating({
              todoist_task_id: task.id,
              urgency: task.urgency,
              importance: task.importance,
              quadrant: quadrant,
            }));
          }

          return { ...task, quadrant };
        }
        return task;
      });
    });

    // Executa todas as atualizações de quadrante no Supabase
    if (updatesToSupabase.length > 0) {
      Promise.all(updatesToSupabase).then(() => {
        console.log(`Persistidos ${updatesToSupabase.length} quadrantes no Supabase.`);
      }).catch(e => {
        console.error("Failed to persist quadrants to Supabase:", e);
        toast.error("Falha ao salvar quadrantes na nuvem.");
      });
    }
  }, [tasksToProcess, getDynamicDomainAndThreshold, user]);

  const handleReset = useCallback(async () => {
    if (!user) {
      toast.error("Usuário não autenticado.");
      return;
    }
    if (confirm("Tem certeza que deseja resetar a Matriz de Eisenhower? Isso apagará todas as avaliações salvas na nuvem.")) {
      setIsLoading(true);
      try {
        await eisenhowerService.deleteAllRatings();
        setTasksToProcess([]);
        setCurrentView("setup");
        setManualThresholds(defaultManualThresholds);
        setDiagonalXPoint(50);
        setDiagonalYPoint(50);
        localStorage.removeItem('eisenhower_current_view');
        localStorage.removeItem(EISENHOWER_MANUAL_THRESHOLDS_STORAGE_KEY);
        localStorage.removeItem(EISENHOWER_DIAGONAL_X_POINT_STORAGE_KEY);
        localStorage.removeItem(EISENHOWER_DIAGONAL_Y_POINT_STORAGE_KEY);
        toast.success("Matriz de Eisenhower resetada e dados apagados da nuvem.");
      } catch (e) {
        toast.error("Erro ao resetar a matriz e apagar dados da nuvem.");
      } finally {
        setIsLoading(false);
      }
    }
  }, [user]);

  const handleFinishRating = useCallback(() => {
    handleCategorizeTasks(); // Categoriza todas as tarefas (usando thresholds dinâmicos)
    setCurrentView("matrix"); // Muda para a visualização da matriz
  }, [handleCategorizeTasks]);

  const handleStartReview = useCallback(() => {
    setCurrentView("rating");
  }, []);

  const handleRefreshMatrix = useCallback(async () => {
    const currentFilter = buildFinalFilter(filterInput, statusFilter, categoryFilter);
    await handleLoadTasks(currentFilter); // Recarrega as tarefas do Todoist
    handleCategorizeTasks(); // Recategoriza as tarefas recém-carregadas
    toast.success("Matriz atualizada com os dados mais recentes do Todoist.");
  }, [handleCategorizeTasks, handleLoadTasks, filterInput, statusFilter, categoryFilter, buildFinalFilter]);

  const ratedTasksCount = tasksToProcess.filter(t => t.urgency !== null && t.importance !== null).length;
  const canViewMatrixOrResults = tasksToProcess.length > 0;

  // Função para filtrar as tarefas com base no displayFilter e categoryDisplayFilter
  const getFilteredTasksForDisplay = useCallback((tasks: EisenhowerTask[], dateFilter: DisplayFilter, categoryFilter: CategoryDisplayFilter, priorityFilter: PriorityFilter, deadlineFilter: DeadlineFilter): EisenhowerTask[] => {
    let filteredTasks = tasks;

    // 1. Filtragem por Categoria (categoryDisplayFilter)
    if (categoryFilter !== "all") {
      filteredTasks = filteredTasks.filter(task => {
        const category = getTaskCategory(task);
        return category === categoryFilter;
      });
    }

    // 2. Filtragem por Prioridade (displayPriorityFilter)
    if (priorityFilter !== "all") {
      const targetPriority = parseInt(priorityFilter.replace('p', ''), 10);
      filteredTasks = filteredTasks.filter(task => task.priority === targetPriority);
    }

    // 3. Filtragem por Deadline (displayDeadlineFilter)
    if (deadlineFilter === "has_deadline") {
      filteredTasks = filteredTasks.filter(task => task.deadline !== null && task.deadline !== undefined);
    } else if (deadlineFilter === "no_deadline") {
      filteredTasks = filteredTasks.filter(task => task.deadline === null || task.deadline === undefined);
    }

    // 4. Filtragem por Data/Status (dateFilter)
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

    // 5. Filtragem por Termo de Busca (searchTerm)
    const lowerCaseSearchTerm = searchTerm.toLowerCase();
    if (lowerCaseSearchTerm.trim() === "") {
      return filteredTasks;
    }

    return filteredTasks.filter(task => 
      task.content.toLowerCase().includes(lowerCaseSearchTerm) ||
      task.description.toLowerCase().includes(lowerCaseSearchTerm) ||
      task.labels.some(label => label.toLowerCase().includes(lowerCaseSearchTerm))
    );

  }, [tasksToProcess, displayFilter, categoryDisplayFilter, displayPriorityFilter, displayDeadlineFilter, searchTerm]);

  const filteredTasksForDisplay = getFilteredTasksForDisplay(tasksToProcess, displayFilter, categoryDisplayFilter, displayPriorityFilter, displayDeadlineFilter);

  // Tarefas para a tela de avaliação (RatingScreen)
  const tasksForRatingScreen = useMemo(() => {
    let tasks = tasksToProcess;
    if (ratingFilter === "unrated") {
      tasks = tasks.filter(t => t.urgency === null || t.importance === null);
    }
    // Aplica a ordenação padrão para a tela de rating
    return sortEisenhowerTasks(tasks);
  }, [tasksToProcess, ratingFilter, sortEisenhowerTasks]);


  const renderContent = () => {
    if (isLoading || isLoadingTodoist || isLoadingAuth) {
      return (
        <div className="flex justify-center items-center h-96">
          <LoadingSpinner size={40} />
        </div>
      );
    }

    // Recalcula o threshold dinâmico para o ScatterPlotMatrix
    const ratedTasks = tasksToProcess.filter(t => t.urgency !== null && t.importance !== null);
    const urgencyValues = ratedTasks.map(t => t.urgency!).filter(v => v !== null) as number[];
    const importanceValues = ratedTasks.map(t => t.importance!).filter(v => v !== null) as number[];
    const { threshold: dynamicUrgencyThreshold } = getDynamicDomainAndThreshold(urgencyValues);
    const { threshold: dynamicImportanceThreshold } = getDynamicDomainAndThreshold(importanceValues);


    switch (currentView) {
      case "setup":
        return <SetupScreen 
          onStart={handleLoadTasks} 
          initialFilterInput={filterInput}
          initialStatusFilter={statusFilter}
          initialCategoryFilter={categoryFilter}
          initialPriorityFilter={"all"} // Removido
          initialDeadlineFilter={"all"} // Removido
          onFilterInputChange={setFilterInput}
          onStatusFilterChange={setStatusFilter}
          onCategoryFilterChange={setCategoryFilter}
          onPriorityFilterChange={() => {}} // Removido
          onDeadlineFilterChange={() => {}} // Removido
        />;
      case "rating":
        return (
          <RatingScreen
            tasks={tasksForRatingScreen} // Passa as tarefas filtradas para revisão
            onUpdateTaskRating={handleUpdateTaskRating}
            onFinishRating={handleFinishRating} // Usa a nova função handleFinishRating
            onBack={() => setCurrentView("setup")}
            onViewMatrix={() => {
              handleCategorizeTasks(); // Categoriza todas as tarefas antes de visualizar a matriz
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
            <div className="flex">
              <div className="flex-grow">
                <EisenhowerMatrixView
                  tasks={filteredTasksForDisplay} // Passa as tarefas filtradas para exibição
                  onBack={handleStartReview} // Volta para a tela de avaliação
                  onViewResults={() => setCurrentView("results")}
                  displayFilter={displayFilter} // Passa o filtro de exibição
                  onDisplayFilterChange={setDisplayFilter} // Passa a função para alterar o filtro
                  onRefreshMatrix={handleRefreshMatrix} // Passa a nova função de atualização
                  manualThresholds={{ urgency: dynamicUrgencyThreshold, importance: dynamicImportanceThreshold }} // Passa o threshold dinâmico para o gráfico
                  diagonalXPoint={diagonalXPoint} // Novo
                  diagonalYPoint={diagonalYPoint} // Novo
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
            onBack={handleStartReview}
            onReset={handleReset}
            displayFilter={displayFilter} // Passa o filtro de exibição
            onDisplayFilterChange={setDisplayFilter} // Passa a função para alterar o filtro
            manualThresholds={{ urgency: dynamicUrgencyThreshold, importance: dynamicImportanceThreshold }} // Passa o threshold dinâmico para o gráfico
            diagonalXPoint={diagonalXPoint} // Novo
            diagonalYPoint={diagonalYPoint} // Novo
            onDiagonalXChange={setDiagonalXPoint} // Novo
            onDiagonalYChange={setDiagonalYPoint} // Novo
          />
        );
      default:
        return <SetupScreen 
          onStart={handleLoadTasks} 
          initialFilterInput={filterInput}
          initialStatusFilter={statusFilter}
          initialCategoryFilter={categoryFilter}
          initialPriorityFilter={"all"} // Removido
          initialDeadlineFilter={"all"} // Removido
          onFilterInputChange={setFilterInput}
          onStatusFilterChange={setStatusFilter}
          onCategoryFilterChange={setCategoryFilter}
          onPriorityFilterChange={() => {}} // Removido
          onDeadlineFilterChange={() => {}} // Removido
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
          disabled={isLoading || isLoadingTodoist || isLoadingAuth}
          className="flex items-center gap-2"
        >
          <Settings className="h-4 w-4" /> Configurar
        </Button>
        <Button
          variant={currentView === "rating" ? "default" : "outline"}
          onClick={() => setCurrentView("rating")}
          disabled={isLoading || isLoadingTodoist || tasksToProcess.length === 0 || isLoadingAuth}
          className="flex items-center gap-2"
        >
          <Scale className="h-4 w-4" /> Avaliar
        </Button>
        <Button
          variant={currentView === "matrix" ? "default" : "outline"}
          onClick={() => { handleCategorizeTasks(); setCurrentView("matrix"); }} // Categoriza e vai para a matriz
          disabled={isLoading || isLoadingTodoist || !canViewMatrixOrResults || isLoadingAuth}
          className="flex items-center gap-2"
        >
          <LayoutDashboard className="h-4 w-4" /> Matriz
        </Button>
        <Button
          variant={currentView === "results" ? "default" : "outline"}
          onClick={() => setCurrentView("results")}
          disabled={isLoading || isLoadingTodoist || !canViewMatrixOrResults || isLoadingAuth}
          className="flex items-center gap-2"
        >
          <ListTodo className="h-4 w-4" /> Resultados
        </Button>
        <Button
          variant={currentView === "dashboard" ? "default" : "outline"}
          onClick={() => setCurrentView("dashboard")}
          disabled={isLoading || isLoadingTodoist || !canViewMatrixOrResults || isLoadingAuth}
          className="flex items-center gap-2"
        >
          <LayoutDashboard className="h-4 w-4" /> Dashboard
        </Button>
        <Button
          variant="outline"
          onClick={() => setIsAiModalOpen(true)}
          disabled={isLoading || isLoadingTodoist || isLoadingAuth}
          className="flex items-center gap-2 ml-auto"
        >
          <Lightbulb className="h-4 w-4" /> Assistente IA
        </Button>
      </div>

      {/* Seletor de filtro de exibição e busca */}
      {(currentView === "matrix" || currentView === "results" || currentView === "dashboard") && (
        <div className="mb-6 grid grid-cols-1 md:grid-cols-6 gap-4">
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
              <SelectItem value="all">Todas as Datas</SelectItem>
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
          <Select value={displayPriorityFilter} onValueChange={(value: PriorityFilter) => setDisplayPriorityFilter(value)}>
            <SelectTrigger className="w-full mt-1">
              <SelectValue placeholder="Filtrar por Prioridade" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas as Prioridades</SelectItem>
              <SelectItem value="p4">P4 (Baixa)</SelectItem>
              <SelectItem value="p3">P3 (Média)</SelectItem>
              <SelectItem value="p2">P2 (Alta)</SelectItem>
              <SelectItem value="p1">P1 (Urgente)</SelectItem>
            </SelectContent>
          </Select>
          <Select value={displayDeadlineFilter} onValueChange={(value: DeadlineFilter) => setDisplayDeadlineFilter(value)}>
            <SelectTrigger className="w-full mt-1">
              <SelectValue placeholder="Filtrar por Deadline" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os Deadlines</SelectItem>
              <SelectItem value="has_deadline">Com Deadline Definido</SelectItem>
              <SelectItem value="no_deadline">Sem Deadline Definido</SelectItem>
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