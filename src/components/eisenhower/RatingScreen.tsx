"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ArrowLeft, ArrowRight, Scale, Check, LayoutDashboard, Lightbulb, Filter } from "lucide-react"; // Importar Filter
import { EisenhowerTask } from "@/lib/types";
import TaskCard from "./TaskCard";
import { toast } from "sonner";
import LoadingSpinner from "@/components/ui/loading-spinner"; // Importar LoadingSpinner
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"; // Importar Select components
import { format, parseISO, isValid, isPast, isToday, isTomorrow, isBefore, startOfDay, differenceInDays } from 'date-fns'; // Importar funções de data

interface RatingScreenProps {
  tasks: EisenhowerTask[]; // Agora recebe a lista FILTRADA de tarefas
  onUpdateTaskRating: (taskId: string, urgency: number | null, importance: number | null) => void;
  onFinishRating: () => void;
  onBack: () => void;
  onViewMatrix: () => void;
  canViewMatrix: boolean;
  ratingFilter: "all" | "unrated"; // Nova prop para o filtro
  onRatingFilterChange: (filter: "all" | "unrated") => void; // Nova prop para mudar o filtro
}

const RatingScreen: React.FC<RatingScreenProps> = ({
  tasks,
  onUpdateTaskRating,
  onFinishRating,
  onBack,
  onViewMatrix,
  canViewMatrix,
  ratingFilter,
  onRatingFilterChange,
}) => {
  const [currentTaskIndex, setCurrentTaskIndex] = useState(0);
  const [urgencyInput, setUrgencyInput] = useState<string>("50");
  const [importanceInput, setImportanceInput] = useState<string>("50");
  const [isAiThinking, setIsAiThinking] = useState(false);

  const currentTask = useMemo(() => {
    // Garante que o índice esteja dentro dos limites
    const safeIndex = Math.min(currentTaskIndex, tasks.length - 1);
    return tasks[safeIndex] || null;
  }, [tasks, currentTaskIndex]);

  // Inicializa o índice e os inputs quando a lista de tarefas muda
  useEffect(() => {
    if (tasks.length > 0) {
      // Se o índice atual for inválido (ex: tasks diminuiu), resetamos para 0
      if (currentTaskIndex >= tasks.length) {
        setCurrentTaskIndex(0);
      }
    } else {
      setCurrentTaskIndex(0); // Reset index if list is empty
    }
  }, [tasks]);

  useEffect(() => {
    if (currentTask) {
      // Carrega os valores existentes ou define 50 como padrão
      setUrgencyInput(currentTask.urgency !== null ? String(currentTask.urgency) : "50");
      setImportanceInput(currentTask.importance !== null ? String(currentTask.importance) : "50");
    }
  }, [currentTask]); // Depender de currentTask (useMemo) para atualizar inputs

  const validateAndGetNumber = (value: string): number | null => {
    const num = parseInt(value, 10);
    if (isNaN(num) || num < 0 || num > 100) {
      return null;
    }
    return num;
  };

  const handleNextTask = useCallback(() => {
    if (!currentTask) return;

    const parsedUrgency = validateAndGetNumber(urgencyInput);
    const parsedImportance = validateAndGetNumber(importanceInput);

    if (parsedUrgency === null || parsedImportance === null) {
      toast.error("Por favor, insira valores de Urgência e Importância entre 0 e 100.");
      return;
    }

    // 1. Atualiza o rating no estado pai
    onUpdateTaskRating(currentTask.id, parsedUrgency, parsedImportance);

    // 2. Avança para a próxima tarefa ou finaliza
    if (currentTaskIndex < tasks.length - 1) {
      setCurrentTaskIndex(prev => prev + 1);
    } else {
      toast.success("Revisão de tarefas concluída!");
      onFinishRating(); // Chamar onFinishRating para categorizar e ir para a matriz
    }
  }, [currentTask, currentTaskIndex, tasks.length, urgencyInput, importanceInput, onUpdateTaskRating, onFinishRating]);

  const handlePreviousTask = useCallback(() => {
    if (currentTaskIndex > 0) {
      setCurrentTaskIndex(prev => prev - 1);
    } else {
      // Se estiver na primeira tarefa, volta para a tela de setup
      onBack();
    }
  }, [currentTaskIndex, onBack]);

  const handleSuggestWithAI = useCallback(async () => {
    if (!currentTask) {
      toast.error("Nenhuma tarefa selecionada para avaliação da IA.");
      return;
    }

    setIsAiThinking(true);
    
    // --- Lógica de Sugestão de IA Simplificada (Front-end) ---
    let urgencyScore = 50;
    let importanceScore = 50;
    let reasoning = "Avaliação baseada em heurísticas de produtividade.";

    const now = new Date();
    const startOfToday = startOfDay(now);

    // 1. Urgência baseada no prazo/deadline
    let effectiveDate: Date | null = null;
    if (currentTask.deadline) {
      effectiveDate = parseISO(currentTask.deadline);
    } else if (currentTask.due?.datetime) {
      effectiveDate = parseISO(currentTask.due.datetime);
    } else if (currentTask.due?.date) {
      effectiveDate = parseISO(currentTask.due.date);
    }

    if (effectiveDate && isValid(effectiveDate)) {
      const daysUntilDue = differenceInDays(effectiveDate, startOfToday);
      
      if (isBefore(effectiveDate, now)) {
        urgencyScore = 95; // Atrasada
        reasoning = "Urgência alta devido ao prazo já ter passado.";
      } else if (daysUntilDue === 0) {
        urgencyScore = 85; // Hoje
        reasoning = "Urgência alta devido ao prazo ser hoje.";
      } else if (daysUntilDue === 1) {
        urgencyScore = 70; // Amanhã
        reasoning = "Urgência moderada devido ao prazo ser amanhã.";
      } else if (daysUntilDue > 1 && daysUntilDue <= 7) {
        urgencyScore = 55; // Próxima semana
        reasoning = "Urgência média, prazo na próxima semana.";
      } else {
        urgencyScore = 30; // Longo prazo
        reasoning = "Urgência baixa, prazo distante.";
      }
    } else {
      urgencyScore = 20; // Sem prazo
      reasoning = "Urgência baixa, pois a tarefa não tem prazo definido.";
    }

    // 2. Importância baseada na Prioridade Todoist e Conteúdo
    switch (currentTask.priority) {
      case 4: // P1
        importanceScore = Math.min(100, urgencyScore + 15); // P1 geralmente é importante
        reasoning += " Importância aumentada devido à prioridade P1 do Todoist.";
        break;
      case 3: // P2
        importanceScore = Math.min(90, urgencyScore + 5);
        break;
      case 2: // P3
        importanceScore = Math.max(30, urgencyScore - 10);
        break;
      case 1: // P4
        importanceScore = Math.max(10, urgencyScore - 20);
        reasoning += " Importância reduzida devido à prioridade P4 do Todoist.";
        break;
    }

    // 3. Ajuste final para garantir 0-100
    urgencyScore = Math.max(0, Math.min(100, urgencyScore));
    importanceScore = Math.max(0, Math.min(100, importanceScore));

    // Simular tempo de pensamento da IA
    await new Promise(resolve => setTimeout(resolve, 500));

    setUrgencyInput(String(Math.round(urgencyScore)));
    setImportanceInput(String(Math.round(importanceScore)));
    toast.success("Sugestões da IA carregadas! Revise e salve.");
    toast.info(`Razão da IA: ${reasoning}`, { duration: 5000 });

    setIsAiThinking(false);
    // --- Fim da Lógica de Sugestão de IA Simplificada ---

  }, [currentTask]);

  if (tasks.length === 0) {
    return (
      <div className="text-center p-8">
        <p className="text-lg text-gray-600 mb-4">
          {ratingFilter === "unrated" 
            ? "Parabéns! Todas as tarefas foram avaliadas." 
            : "Nenhuma tarefa pendente de avaliação."
          }
        </p>
        <div className="flex flex-col gap-4 max-w-xs mx-auto">
          <Button onClick={onBack} className="flex items-center gap-2">
            <ArrowLeft className="h-4 w-4" /> Voltar para Configuração
          </Button>
          {canViewMatrix && (
            <Button onClick={onViewMatrix} className="flex items-center gap-2 bg-purple-600 hover:bg-purple-700 text-white">
              <LayoutDashboard className="h-4 w-4" /> Ver Matriz
            </Button>
          )}
        </div>
      </div>
    );
  }
  
  const progress = ((currentTaskIndex + 1) / tasks.length) * 100;

  return (
    <div className="p-4">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
          <Scale className="h-6 w-6 text-indigo-600" /> Avaliar Tarefas
        </h3>
        <div className="flex items-center gap-2">
          <Select value={ratingFilter} onValueChange={(value: "all" | "unrated") => onRatingFilterChange(value)}>
            <SelectTrigger className="w-[180px]">
              <Filter className="h-4 w-4 mr-2" />
              <SelectValue placeholder="Filtrar Avaliação" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="unrated">Apenas Não Avaliadas</SelectItem>
              <SelectItem value="all">Todas as Tarefas</SelectItem>
            </SelectContent>
          </Select>
          <Button onClick={handlePreviousTask} variant="outline" className="flex items-center gap-2">
            <ArrowLeft className="h-4 w-4" /> Anterior
          </Button>
        </div>
      </div>

      <p className="text-lg text-gray-700 mb-6 text-center">
        Avalie a tarefa {currentTaskIndex + 1} de {tasks.length}
      </p>

      <div className="w-full bg-gray-200 rounded-full h-2.5 mb-6">
        <div className="bg-blue-600 h-2.5 rounded-full" style={{ width: `${progress}%` }}></div>
      </div>

      <TaskCard task={currentTask!} className="mb-8 max-w-2xl mx-auto" />

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
              {currentTaskIndex < tasks.length - 1 ? (
                <>Próxima Tarefa <ArrowRight className="h-4 w-4" /></>
              ) : (
                <>Finalizar Avaliação <Check className="h-4 w-4" /></>
              )}
            </Button>
          </div>
          {canViewMatrix && (
            <Button onClick={onViewMatrix} className="w-full mt-4 flex items-center justify-center gap-2 bg-purple-600 hover:bg-purple-700 text-white">
              <LayoutDashboard className="h-4 w-4" /> Ver Matriz
            </Button>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default RatingScreen;