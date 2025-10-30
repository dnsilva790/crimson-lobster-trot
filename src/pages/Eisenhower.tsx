"use client";

import React, { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useTodoist } from "@/context/TodoistContext";
import { EisenhowerTask, TodoistTask } from "@/lib/types";
import LoadingSpinner from "@/components/ui/loading-spinner";
import { toast } from "sonner";
import { LayoutDashboard, Settings, ListTodo, Scale, Lightbulb } from "lucide-react"; // Alterado de Matrix para LayoutDashboard

// Importar os componentes do Eisenhower
import SetupScreen from "@/components/eisenhower/SetupScreen";
import RatingScreen from "@/components/eisenhower/RatingScreen";
import EisenhowerMatrixView from "@/components/eisenhower/EisenhowerMatrixView";
import ResultsScreen from "@/components/eisenhower/ResultsScreen";
import DashboardScreen from "@/components/eisenhower/DashboardScreen";
import AiAssistantModal from "@/components/eisenhower/AiAssistantModal";

// Importar a função calculateMedian do ScatterPlotMatrix para evitar duplicação
import { calculateMedian } from "@/components/eisenhower/ScatterPlotMatrix";

type EisenhowerView = "setup" | "rating" | "matrix" | "results" | "dashboard";

const EISENHOWER_STORAGE_KEY = "eisenhowerMatrixState";

// A função calculateMedian duplicada foi removida daqui.

const Eisenhower = () => {
  const { fetchTasks, isLoading: isLoadingTodoist } = useTodoist();
  const [currentView, setCurrentView] = useState<EisenhowerView>("setup");
  const [tasksToProcess, setTasksToProcess] = useState<EisenhowerTask[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isAiModalOpen, setIsAiModalOpen] = useState(false);

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

  const handleLoadTasks = useCallback(async (filter: string) => {
    setIsLoading(true);
    try {
      const fetchedTodoistTasks = await fetchTasks(filter, { includeSubtasks: false, includeRecurring: false });
      const initialEisenhowerTasks: EisenhowerTask[] = fetchedTodoistTasks.map(task => ({
        ...task,
        urgency: null,
        importance: null,
        quadrant: null,
        url: task.url, // Garantir que a URL seja passada
      }));
      setTasksToProcess(initialEisenhowerTasks);
      setCurrentView("rating");
      toast.success(`Carregadas ${initialEisenhowerTasks.length} tarefas para a Matriz de Eisenhower.`);
    } catch (error) {
      console.error("Failed to load tasks for Eisenhower Matrix:", error);
      toast.error("Falha ao carregar tarefas.");
    } finally {
      setIsLoading(false);
    }
  }, [fetchTasks]);

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

  const handleViewMatrixFromRating = useCallback(() => {
    handleCategorizeTasks(); // Categoriza as tarefas avaliadas
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
        return <SetupScreen onStart={handleLoadTasks} />;
      case "rating":
        return (
          <RatingScreen
            tasks={tasksToProcess}
            onUpdateTaskRating={handleUpdateTaskRating}
            onFinishRating={handleViewMatrixFromRating} // Ao finalizar, vai para a matriz
            onBack={() => setCurrentView("setup")}
            onViewMatrix={handleViewMatrixFromRating} // Nova prop
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
        return <SetupScreen onStart={handleLoadTasks} />;
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