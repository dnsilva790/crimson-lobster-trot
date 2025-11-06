"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useTodoist } from "@/context/TodoistContext";
import { EisenhowerTask, TodoistTask, DisplayFilter, CategoryDisplayFilter, ManualThresholds } from "@/lib/types"; // Importar ManualThresholds
import LoadingSpinner from "@/components/ui/loading-spinner";
import { toast } from "sonner";
import { LayoutDashboard, Settings, ListTodo, Scale, Lightbulb, RefreshCw, Search, RotateCcw } from "lucide-react"; // Importar Search e RotateCcw
import { format, parseISO, isValid, isPast, isToday, isTomorrow, isBefore, startOfDay } from 'date-fns'; // Importar format, parseISO, isValid, isPast, isTomorrow, isBefore, startOfDay
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"; // Importar Select components
import { Input } from "@/components/ui/input"; // Importar Input
import { getTaskCategory, getEisenhowerRating, updateEisenhowerRating } from "@/lib/utils"; // Importar getTaskCategory e novas funções de Eisenhower
import { useSupabaseAuth } from "@/hooks/useSupabaseAuth"; // Importar o hook de auth

// Importar os componentes do Eisenhower
import SetupScreen from "@/components/eisenhower/SetupScreen";
import RatingScreen from "@/components/eisenhower/RatingScreen";
import EisenhowerMatrixView from "@/components/eisenhower/EisenhowerMatrixView";
import DashboardScreen from "@/components/eisenhower/DashboardScreen";
import AiAssistantModal from "@/components/eisenhower/AiAssistantModal";
import ResultsScreen from "@/components/eisenhower/ResultsScreen";

type EisenhowerView = "setup" | "rating" | "matrix" | "results" | "dashboard";
type RatingFilter = "all" | "unrated"; // Novo tipo de filtro para avaliação
type PriorityFilter = "all" | "p1" | "p2" | "p3" | "p4"; // Novo tipo de filtro de prioridade
type DeadlineFilter = "all" | "has_deadline" | "no_deadline"; // Novo tipo de filtro de deadline

// Removendo EISENHOWER_STORAGE_KEY e usando Supabase
const EISENHOWER_FILTER_INPUT_STORAGE_KEY = "eisenhower_filter_input";
const EISENHOWER_STATUS_FILTER_STORAGE_KEY = "eisenhower_status_filter";
const EISENHOWER_CATEGORY_FILTER_STORAGE_KEY = "eisenhower_category_filter";
const EISENHOWER_DISPLAY_FILTER_STORAGE_KEY = "eisenhower_display_filter";
const EISENHOWER_RATING_FILTER_STORAGE_KEY = "eisenhower_rating_filter";
const EISENHOWER_CATEGORY_DISPLAY_FILTER_STORAGE_KEY = "eisenhower_category_display_filter";
const EISENHOWER_DISPLAY_PRIORITY_FILTER_STORAGE_KEY = "eisenhower_display_priority_filter";
const EISENHOWER_DISPLAY_DEADLINE_FILTER_STORAGE_KEY = "eisenhower_display_deadline_filter";
const EISENHOWER_MANUAL_THRESHOLDS_STORAGE_KEY = "eisenhower_manual_thresholds";
const EISENHOWER_DIAGONAL_X_POINT_STORAGE_KEY = "eisenhower_diagonal_x_point";
const EISENHOWER_DIAGONAL_Y_POINT_STORAGE_KEY = "eisenhower_diagonal_y_point";

const defaultManualThresholds: ManualThresholds = { urgency: 50, importance: 50 };

// Função de ordenação para tarefas Eisenhower
const sortEisenhowerTasks = (tasks: EisenhowerTask[]): EisenhowerTask[] => {
  return [...tasks].sort((a, b) => {
    // 1. Tarefas não avaliadas primeiro
    const isARated = a.urgency !== null && a.importance !== null;
    const isBRated = b.urgency !== null && b.importance !== null;
    if (isARated && !isBRated) return 1;
    if (!isARated && isBRated) return -1;

    // 2. Se ambas avaliadas, ordenar por Urgência (decrescente)
    if (isARated && isBRated) {
      if (b.urgency! !== a.urgency!) return b.urgency! - a.urgency!;
      if (b.importance! !== a.importance!) return b.importance! - a.importance!;
    }

    // Helper para obter valor de data
    const getDateValue = (dateString: string | null | undefined) => {
      if (typeof dateString === 'string' && dateString) {
        const parsedDate = parseISO(dateString);
        return isValid(parsedDate) ? parsedDate.getTime() : Infinity;
      }
      return Infinity;
    };

    // 3. Deadline: mais cedo primeiro
    const deadlineA = getDateValue(a.deadline);
    const deadlineB = getDateValue(b.deadline);
    if (deadlineA !== deadlineB) {
      return deadlineA - deadlineB;
    }

    // 4. Prioridade Todoist: P1 (4) > P4 (1)
    if (b.priority !== a.priority) {
      return b.priority - a.priority;
    }

    // 5. Due date/time: mais cedo primeiro
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

    return 0;
  });
};


const Eisenhower = () => {
  const { fetchTasks, updateTask, isLoading: isLoadingTodoist } = useTodoist();
  const { user, isLoading: isLoadingAuth } = useSupabaseAuth();
  
  const [currentView, setCurrentView] = useState<EisenhowerView>(() => {
    if (typeof window !== 'undefined') {
      return (localStorage.getItem('eisenhower_current_view') as EisenhowerView) || "setup";
    }
    return "setup";
  });
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
      localStorage.setItem('eisenhower_current_view', currentView);
      localStorage.setItem(EISENHOWER_FILTER_INPUT_STORAGE_KEY, filterInput);
      localStorage.setItem(EISENHOWER_STATUS_FILTER_STORAGE_KEY, statusFilter);
      localStorage.setItem(EISENHOWER_CATEGORY_FILTER_STORAGE_KEY, categoryFilter);
      localStorage.setItem(EISENHOWER_DISPLAY_FILTER_STORAGE_KEY, displayFilter);
      localStorage.setItem(EISENHOWER_RATING_FILTER_STORAGE_KEY, ratingFilter);
      localStorage.setItem(EISENHOWER_CATEGORY_DISPLAY_FILTER_STORAGE_KEY, categoryDisplayFilter);
      localStorage.setItem(EISENHOWER_DISPLAY_PRIORITY_FILTER_STORAGE_KEY, displayPriorityFilter);
      localStorage.setItem(EISENHOWER_DISPLAY_DEADLINE_FILTER_STORAGE_KEY, displayDeadlineFilter);
      localStorage.setItem(EISENHOWER_MANUAL_THRESHOLDS_STORAGE_KEY, JSON.stringify(manualThresholds));
      localStorage.setItem(EISENHOWER_DIAGONAL_X_POINT_STORAGE_KEY, String(diagonalXPoint));
      localStorage.setItem(EISENHOWER_DIAGONAL_Y_POINT_STORAGE_KEY, String(diagonalYPoint));
    }
  }, [currentView, filterInput, statusFilter, categoryFilter, displayFilter, ratingFilter, categoryDisplayFilter, displayPriorityFilter, displayDeadlineFilter, manualThresholds, diagonalXPoint, diagonalYPoint]);

  // --- Lógica de Carregamento e Persistência Todoist Description ---

  // 1. Função para carregar tarefas e mesclar com ratings da descrição
  const handleLoadTasks = useCallback(async (filter: string) => {
    setIsLoading(true);
    try {
      const fetchedTodoistTasks = await fetchTasks(filter, { includeSubtasks: false, includeRecurring: false });
      
      const initialEisenhowerTasks: EisenhowerTask[] = fetchedTodoistTasks.map(task => {
        const { urgency, importance, quadrant } = getEisenhowerRating(task);
        return {
          ...task,
          urgency: urgency,
          importance: importance,
          quadrant: quadrant,
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
  }, [fetchTasks]);

  // 2. Função para salvar a pontuação e categorizar
  const handleUpdateTaskRating = useCallback(async (taskId: string, urgency: number | null, importance: number | null, extraUpdates?: { description?: string, labels?: string[] }) => {
    const taskToUpdate = tasksToProcess.find(t => t.id === taskId);
    if (!taskToUpdate) return;

    // 1. Atualiza o estado local (sem quadrante ainda)
    setTasksToProcess(prevTasks => {
      return prevTasks.map(task =>
        task.id === taskId ? { ...task, urgency, importance, ...extraUpdates } : task
      );
    });

    // 2. Persiste no Todoist (incluindo pontuações, descrição e etiquetas)
    let finalDescription = extraUpdates?.description || taskToUpdate.description || '';
    
    // Ensure the Eisenhower rating is always included in the description update
    finalDescription = updateEisenhowerRating(
      finalDescription,
      urgency,
      importance,
      null // Não salva o quadrante ainda
    );

    const updatePayload: { description: string, labels?: string[] } = {
        description: finalDescription,
    };
    
    if (extraUpdates?.labels) {
        updatePayload.labels = extraUpdates.labels;
    }

    const updated = await updateTask(taskId, updatePayload);
    if (!updated) {
      toast.error("Falha ao salvar pontuação/dados no Todoist.");
    }

    // 3. Recalcula e persiste o quadrante para todas as tarefas avaliadas
    // Chamamos handleCategorizeTasks após um pequeno delay para garantir que o estado local (tasksToProcess)
    // tenha sido atualizado com a nova pontuação antes de recalcular os thresholds.
    setTimeout(() => {
      handleCategorizeTasks();
    }, 100);

  }, [tasksToProcess, updateTask, handleCategorizeTasks]);

  // 3. Função para categorizar (calcula thresholds dinâmicos e salva o quadrante na descrição)
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

    const updatesToTodoist: Promise<any>[] = [];

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
          
          // Persiste o novo quadrante na descrição do Todoist
          if (task.quadrant !== quadrant) {
            const newDescription = updateEisenhowerRating(
              task.description || '',
              task.urgency,
              task.importance,
              quadrant
            );
            updatesToTodoist.push(updateTask(task.id, { description: newDescription }));
          }

          return { ...task, quadrant };
        }
        return task;
      });
    });

    // Executa todas as atualizações de quadrante no Todoist
    if (updatesToTodoist.length > 0) {
      Promise.all(updatesToTodoist).then(() => {
        console.log(`Persistidos ${updatesToTodoist.length} quadrantes no Todoist.`);
      }).catch(e => {
        console.error("Failed to persist quadrants to Todoist:", e);
        toast.error("Falha ao salvar quadrantes no Todoist.");
      });
    }
  }, [tasksToProcess, getDynamicDomainAndThreshold, updateTask]);

  const handleReset = useCallback(async () => {
    if (confirm("Tem certeza que deseja resetar a Matriz de Eisenhower? Isso apagará todas as avaliações salvas nas descrições das tarefas.")) {
      setIsLoading(true);
      try {
        const tasksToClear = tasksToProcess.filter(t => t.urgency !== null || t.importance !== null);
        const updatesToTodoist: Promise<any>[] = [];

        for (const task of tasksToClear) {
          const newDescription = updateEisenhowerRating(task.description || '', null, null, null);
          updatesToTodoist.push(updateTask(task.id, { description: newDescription }));
        }

        await Promise.all(updatesToTodoist);

        setTasksToProcess([]); // Limpa a lista de tarefas
        setCurrentView("setup");
        setManualThresholds(defaultManualThresholds);
        setDiagonalXPoint(50);
        setDiagonalYPoint(50);
        localStorage.removeItem('eisenhower_current_view');
        localStorage.removeItem(EISENHOWER_MANUAL_THRESHOLDS_STORAGE_KEY);
        localStorage.removeItem(EISENHOWER_DIAGONAL_X_POINT_STORAGE_KEY);
        localStorage.removeItem(EISENHOWER_DIAGONAL_Y_POINT_STORAGE_KEY);
        toast.success("Matriz de Eisenhower resetada e dados apagados das descrições.");
      } catch (e) {
        toast.error("Erro ao resetar a matriz.");
      } finally {
        setIsLoading(false);
      }
    }
  }, [tasksToProcess, updateTask]);

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
  }, [handleCategorizeTasks, handleLoadTasks, filterInput, statusFilter, categoryFilter]);

  const ratedTasksCount = tasksToProcess.filter(t => t.urgency !== null && t.importance !== null).length;
  const canViewMatrixOrResults = tasksToProcess.length > 0;

  // Função auxiliar para construir o filtro final (para o Todoist API)
  const buildFinalFilter = useCallback((
    input: string,
    status: "all" | "overdue",
    category: "all" | "pessoal" | "profissional",
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

    const finalFilter = filterParts.join(" & ");
    return finalFilter || undefined as unknown as string; // Retorna undefined se o filtro estiver vazio
  }, []);

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
  }, [tasksToProcess, ratingFilter]);


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