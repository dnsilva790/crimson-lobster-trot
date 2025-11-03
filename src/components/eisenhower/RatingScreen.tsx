"use client";

import React, { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ArrowLeft, ArrowRight, Scale, Check, LayoutDashboard, Lightbulb } from "lucide-react"; // Importar LayoutDashboard e Lightbulb
import { EisenhowerTask } from "@/lib/types";
import TaskCard from "./TaskCard";
import { toast } from "sonner";
import LoadingSpinner from "@/components/ui/loading-spinner"; // Importar LoadingSpinner

interface RatingScreenProps {
  tasks: EisenhowerTask[]; // Agora recebe a lista COMPLETA de tarefas
  onUpdateTaskRating: (taskId: string, urgency: number | null, importance: number | null) => void;
  onFinishRating: () => void;
  onBack: () => void;
  onViewMatrix: () => void; // Nova prop para ver a matriz antes de finalizar
  canViewMatrix: boolean; // Nova prop para controlar a visibilidade do botão "Ver Matriz"
}

// URL da função Edge do Supabase
const GEMINI_CHAT_FUNCTION_URL = "https://nesiwmsujsulwncbmcnc.supabase.co/functions/v1/gemini-chat";

const RatingScreen: React.FC<RatingScreenProps> = ({
  tasks,
  onUpdateTaskRating,
  onFinishRating,
  onBack,
  onViewMatrix,
  canViewMatrix, // Usar a nova prop
}) => {
  const [currentTaskIndex, setCurrentTaskIndex] = useState(0);
  const [urgencyInput, setUrgencyInput] = useState<string>("50");
  const [importanceInput, setImportanceInput] = useState<string>("50");
  const [isAiThinking, setIsAiThinking] = useState(false); // Novo estado para o loading da IA

  // Inicializa o índice e os inputs quando a lista de tarefas muda
  useEffect(() => {
    // Sempre comece no índice 0 para permitir a revisão sequencial.
    if (tasks.length > 0) {
      setCurrentTaskIndex(0);
    }
  }, [tasks]);

  const currentTask = tasks[currentTaskIndex];

  useEffect(() => {
    if (currentTask) {
      // Carrega os valores existentes ou define 50 como padrão
      setUrgencyInput(currentTask.urgency !== null ? String(currentTask.urgency) : "50");
      setImportanceInput(currentTask.importance !== null ? String(currentTask.importance) : "50");
    }
  }, [currentTaskIndex, currentTask]); // Depender de currentTask para atualizar inputs

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
    try {
      const response = await fetch(GEMINI_CHAT_FUNCTION_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          eisenhowerRatingRequest: true, // Sinaliza para a função Edge que é uma requisição de avaliação Eisenhower
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

  if (!currentTask && tasks.length === 0) {
    return (
      <div className="text-center p-8">
        <p className="text-lg text-gray-600 mb-4">Nenhuma tarefa pendente de avaliação.</p>
        <Button onClick={onBack} className="flex items-center gap-2 mx-auto">
          <ArrowLeft className="h-4 w-4" /> Voltar
        </Button>
        {canViewMatrix && (
          <Button onClick={onViewMatrix} className="mt-4 flex items-center gap-2 mx-auto bg-purple-600 hover:bg-purple-700 text-white">
            <LayoutDashboard className="h-4 w-4" /> Ver Matriz
          </Button>
        )}
      </div>
    );
  }
  
  if (!currentTask) {
    // Caso todas as tarefas tenham sido avaliadas e o usuário esteja na última tela
    return (
      <div className="text-center p-8">
        <p className="text-lg text-gray-600 mb-4">Todas as {tasks.length} tarefas foram avaliadas.</p>
        <Button onClick={onFinishRating} className="flex items-center gap-2 mx-auto bg-indigo-600 hover:bg-indigo-700 text-white">
          <Check className="h-4 w-4" /> Finalizar Avaliação
        </Button>
        <Button onClick={onBack} variant="outline" className="mt-4 flex items-center gap-2 mx-auto">
          <ArrowLeft className="h-4 w-4" /> Voltar para Configuração
        </Button>
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
        <Button onClick={onBack} variant="outline" className="flex items-center gap-2">
          <ArrowLeft className="h-4 w-4" /> Voltar
        </Button>
      </div>

      <p className="text-lg text-gray-700 mb-6 text-center">
        Avalie a tarefa {currentTaskIndex + 1} de {tasks.length}
      </p>

      <div className="w-full bg-gray-200 rounded-full h-2.5 mb-6">
        <div className="bg-blue-600 h-2.5 rounded-full" style={{ width: `${progress}%` }}></div>
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