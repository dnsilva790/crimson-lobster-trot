"use client";

import React, { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ArrowLeft, ArrowRight, Scale, Check, Lightbulb, LayoutDashboard, RefreshCw } from "lucide-react";
import { EisenhowerTask, DisplayFilter } from "@/lib/types";
import TaskCard from "@/components/eisenhower/TaskCard"; // Reutilizando o TaskCard
import { toast } from "sonner";
import LoadingSpinner from "@/components/ui/loading-spinner";
import { useTodoist } from "@/context/TodoistContext";
import { format, parseISO, isValid, isPast, isToday, isTomorrow } from 'date-fns';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import SetupScreen from "@/components/eisenhower/SetupScreen"; // Reutilizando o SetupScreen

type AiEisenhowerView = "setup" | "rating" | "results";

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
  const [currentTaskIndex, setCurrentTaskIndex] = useState(0);
  const [urgencyInput, setUrgencyInput] = useState<string>("50");
  const [importanceInput, setImportanceInput] = useState<string>("50");
  const [isAiThinking, setIsAiThinking] = useState(false);

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
        setCurrentTaskIndex(parsedState.currentTaskIndex || 0);
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
      localStorage.setItem(AI_EISENHOWER_STORAGE_KEY, JSON.stringify({ tasksToProcess, currentView, currentTaskIndex }));
    }
  }, [tasksToProcess, currentView, currentTaskIndex]);

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

  const handleLoadTasks = useCallback(async (filter: string) => {
    setIsLoading(true);
    try {
      const fetchedTodoistTasks = await fetchTasks(filter, { includeSubtasks: false, includeRecurring: false });
      const initialEisenhowerTasks: EisenhowerTask[] = fetchedTodoistTasks.map(task => ({
        ...task,
        urgency: null,
        importance: null,
        quadrant: null,
        url: task.url,
      }));
      
      const sortedTasks = sortEisenhowerTasks(initialEisenhowerTasks);
      
      setTasksToProcess(sortedTasks);
      setCurrentTaskIndex(0); // Reset index when loading new tasks
      setCurrentView("rating");
      toast.success(`Carregadas ${sortedTasks.length} tarefas para a Matriz de Eisenhower (IA).`);
    } catch (error) {
      console.error("Failed to load tasks for AI Eisenhower Matrix:", error);
      toast.error("Falha ao carregar tarefas.");
    } finally {
      setIsLoading(false);
    }
  }, [fetchTasks, sortEisenhowerTasks]);

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

  const handleReset = useCallback(() => {
    setTasksToProcess([]);
    setCurrentView("setup");
    setCurrentTaskIndex(0);
    localStorage.removeItem(AI_EISENHOWER_STORAGE_KEY);
    toast.info("Matriz de Eisenhower (IA) resetada.");
  }, []);

  const currentTask = tasksToProcess[currentTaskIndex];

  useEffect(() => {
    if (currentTask) {
      setUrgencyInput(currentTask.urgency !== null ? String(currentTask.urgency) : "50");
      setImportanceInput(currentTask.importance !== null ? String(currentTask.importance) : "50");
    }
  }, [currentTaskIndex, currentTask]);

  const validateAndGetNumber = (value: string): number | null => {
    const num = parseInt(value, 10);
    if (isNaN(num) || num < 0 || num > 100) {
      return null;
    }
    return num;
  };

  const handleUpdateTaskRating = useCallback((taskId: string, urgency: number | null, importance: number | null) => {
    setTasksToProcess(prevTasks => {
      const updatedTasks = prevTasks.map(task =>
        task.id === taskId ? { ...task, urgency, importance } : task
      );
      return updatedTasks;
    });
  }, []);

  const handleNextTask = useCallback(() => {
    if (!currentTask) return;

    const parsedUrgency = validateAndGetNumber(urgencyInput);
    const parsedImportance = validateAndGetNumber(importanceInput);

    if (parsedUrgency === null || parsedImportance === null) {
      toast.error("Por favor, insira valores de Urgência e Importância entre 0 e 100.");
      return;
    }

    handleUpdateTaskRating(currentTask.id, parsedUrgency, parsedImportance);

    if (currentTaskIndex < tasksToProcess.length - 1) {
      setCurrentTaskIndex(prev => prev + 1);
    } else {
      toast.success("Todas as tarefas foram avaliadas!");
      setTasksToProcess(handleCategorizeTasks(tasksToProcess)); // Categoriza ao finalizar
      setCurrentView("results");
    }
  }, [currentTask, currentTaskIndex, tasksToProcess, urgencyInput, importanceInput, handleUpdateTaskRating, handleCategorizeTasks]);

  const handlePreviousTask = useCallback(() => {
    if (currentTaskIndex > 0) {
      setCurrentTaskIndex(prev => prev - 1);
    } else {
      setCurrentView("setup");
    }
  }, [currentTaskIndex]);

  const handleSuggestWithAI = useCallback(async () => {
    if (!currentTask) {
      toast.error("Nenhuma tarefa selecionada para avaliação da IA.");
      return;
    }

    setIsAiThinking(true);
    try {
      const response = await fetch(GEMINI_CHAT_FUNCTION_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          eisenhowerRatingRequest: true,
          currentTask: currentTask,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `Erro na função Edge: ${response.statusText}`);
      }

      const data = await response.json();
      const aiSuggestion = data.response;

      if (aiSuggestion && typeof aiSuggestion.urgency === 'number' && typeof aiSuggestion.importance === 'number') {
        setUrgencyInput(String(Math.max(0, Math.min(100, Math.round(aiSuggestion.urgency)))));
        setImportanceInput(String(Math.max(0, Math.min(100, Math.round(aiSuggestion.importance)))));
        toast.success("Sugestões da IA carregadas! Revise e salve.");
        if (aiSuggestion.reasoning) {
          toast.info(`Razão da IA: ${aiSuggestion.reasoning}`, { duration: 5000 });
        }
      } else {
        toast.error("A IA não retornou sugestões válidas de urgência e importância.");
      }

    } catch (error: any) {
      console.error("Erro ao chamar a função Gemini Chat para Eisenhower:", error);
      toast.error(`Erro no Assistente IA: ${error.message || "Não foi possível obter uma resposta."}`);
    } finally {
      setIsAiThinking(false);
    }
  }, [currentTask]);

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
      case "rating":
        if (!currentTask && tasksToProcess.length === 0) {
          return (
            <div className="text-center p-8">
              <p className="text-lg text-gray-600 mb-4">Nenhuma tarefa pendente de avaliação.</p>
              <Button onClick={() => setCurrentView("setup")} className="flex items-center gap-2 mx-auto">
                <ArrowLeft className="h-4 w-4" /> Voltar
              </Button>
              {tasksToProcess.length > 0 && (
                <Button onClick={() => {
                  setTasksToProcess(handleCategorizeTasks(tasksToProcess));
                  setCurrentView("results");
                }} className="mt-4 flex items-center gap-2 mx-auto bg-purple-600 hover:bg-purple-700 text-white">
                  <LayoutDashboard className="h-4 w-4" /> Ver Resultados
                </Button>
              )}
            </div>
          );
        }
        return (
          <div className="p-4">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
                <Scale className="h-6 w-6 text-indigo-600" /> Avaliar Tarefas com IA
              </h3>
              <Button onClick={() => setCurrentView("setup")} variant="outline" className="flex items-center gap-2">
                <ArrowLeft className="h-4 w-4" /> Voltar
              </Button>
            </div>

            <p className="text-lg text-gray-700 mb-6 text-center">
              Avalie a tarefa {currentTaskIndex + 1} de {tasksToProcess.length}
            </p>

            <div className="w-full bg-gray-200 rounded-full h-2.5 mb-6">
              <div className="bg-blue-600 h-2.5 rounded-full" style={{ width: `${((currentTaskIndex + 1) / tasksToProcess.length) * 100}%` }}></div>
            </div>

            <TaskCard task={currentTask} className="mb-8 max-w-2xl mx-auto" />

            <Card className="p-6 max-w-2xl mx-auto">
              <CardHeader>
                <CardTitle className="text-xl font-bold text-gray-800">Avaliação</CardTitle>
              </CardHeader>
              <CardContent className="grid gap-6">
                <div>
                  <Label htmlFor="urgency-input" className="text-lg font-semibold text-gray-700 flex justify-between items-center">
                    Urgência: <span className="text-blue-600 text-2xl font-bold">{urgencyInput}</span>
                  </Label>
                  <Input
                    id="urgency-input"
                    type="number"
                    min="0"
                    max="100"
                    value={urgencyInput}
                    onChange={(e) => setUrgencyInput(e.target.value)}
                    className="mt-2 text-center text-lg"
                  />
                  <p className="text-sm text-gray-500 mt-2">
                    (0 = Nada Urgente, 100 = Extremamente Urgente)
                  </p>
                </div>

                <div>
                  <Label htmlFor="importance-input" className="text-lg font-semibold text-gray-700 flex justify-between items-center">
                    Importância: <span className="text-green-600 text-2xl font-bold">{importanceInput}</span>
                  </Label>
                  <Input
                    id="importance-input"
                    type="number"
                    min="0"
                    max="100"
                    value={importanceInput}
                    onChange={(e) => setImportanceInput(e.target.value)}
                    className="mt-2 text-center text-lg"
                  />
                  <p className="text-sm text-gray-500 mt-2">
                    (0 = Nada Importante, 100 = Extremamente Importante)
                  </p>
                </div>

                <Button
                  onClick={handleSuggestWithAI}
                  disabled={isAiThinking || !currentTask}
                  className="w-full py-3 text-lg bg-purple-600 hover:bg-purple-700 text-white flex items-center justify-center gap-2"
                >
                  {isAiThinking ? (
                    <LoadingSpinner size={20} className="text-white" />
                  ) : (
                    <Lightbulb className="h-5 w-5" />
                  )}
                  Sugerir com IA
                </Button>

                <div className="flex justify-between gap-4 mt-4">
                  <Button onClick={handlePreviousTask} variant="outline" className="flex-1 flex items-center gap-2">
                    <ArrowLeft className="h-4 w-4" /> Anterior
                  </Button>
                  <Button onClick={handleNextTask} className="flex-1 flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white">
                    {currentTaskIndex < tasksToProcess.length - 1 ? (
                      <>Próxima Tarefa <ArrowRight className="h-4 w-4" /></>
                    ) : (
                      <>Finalizar Avaliação <Check className="h-4 w-4" /></>
                    )}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        );
      case "results":
        return (
          <div className="p-4">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
                <LayoutDashboard className="h-6 w-6 text-indigo-600" /> Resultados da Matriz (IA)
              </h3>
              <div className="flex gap-2">
                <Button onClick={() => setCurrentView("rating")} variant="outline" className="flex items-center gap-2">
                  <ArrowLeft className="h-4 w-4" /> Voltar para Avaliação
                </Button>
                <Button onClick={handleReset} variant="destructive" className="flex items-center gap-2">
                  <RefreshCw className="h-4 w-4" /> Resetar Matriz
                </Button>
              </div>
            </div>

            <p className="text-lg text-gray-700 mb-6 text-center">
              Suas tarefas categorizadas pela IA.
            </p>

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

            {filteredTasksForDisplay.length === 0 ? (
              <div className="text-center p-8 border rounded-lg bg-gray-50">
                <p className="text-gray-600 text-lg mb-4">
                  Nenhuma tarefa encontrada para exibir com o filtro atual.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredTasksForDisplay.map(task => (
                  <TaskCard key={task.id} task={task} />
                ))}
              </div>
            )}
          </div>
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
          variant={currentView === "rating" ? "default" : "outline"}
          onClick={() => setCurrentView("rating")}
          disabled={isLoading || isLoadingTodoist || tasksToProcess.length === 0}
          className="flex items-center gap-2"
        >
          <Scale className="h-4 w-4" /> Avaliar com IA
        </Button>
        <Button
          variant={currentView === "results" ? "default" : "outline"}
          onClick={() => {
            setTasksToProcess(handleCategorizeTasks(tasksToProcess));
            setCurrentView("results");
          }}
          disabled={isLoading || isLoadingTodoist || tasksToProcess.filter(t => t.urgency !== null && t.importance !== null).length === 0}
          className="flex items-center gap-2"
        >
          <LayoutDashboard className="h-4 w-4" /> Resultados
        </Button>
      </div>

      <Card className="p-6">
        <CardContent className="p-0">
          {renderContent()}
        </CardContent>
      </Card>
    </div>
  );
};

export default AiEisenhower;