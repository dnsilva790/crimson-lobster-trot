"use client";

import React, { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ArrowLeft, ArrowRight, Scale, Check, LayoutDashboard } from "lucide-react"; // Importar LayoutDashboard
import { EisenhowerTask } from "@/lib/types";
import TaskCard from "./TaskCard";
import { toast } from "sonner";

interface RatingScreenProps {
  tasks: EisenhowerTask[];
  onUpdateTaskRating: (taskId: string, urgency: number | null, importance: number | null) => void;
  onFinishRating: () => void;
  onBack: () => void;
  onViewMatrix: () => void; // Nova prop para ver a matriz antes de finalizar
}

const RatingScreen: React.FC<RatingScreenProps> = ({
  tasks,
  onUpdateTaskRating,
  onFinishRating,
  onBack,
  onViewMatrix, // Usar a nova prop
}) => {
  const [currentTaskIndex, setCurrentTaskIndex] = useState(0);
  const [urgencyInput, setUrgencyInput] = useState<string>("50");
  const [importanceInput, setImportanceInput] = useState<string>("50");

  const currentTask = tasks[currentTaskIndex];

  useEffect(() => {
    if (currentTask) {
      setUrgencyInput(currentTask.urgency !== null ? String(currentTask.urgency) : "50");
      setImportanceInput(currentTask.importance !== null ? String(currentTask.importance) : "50");
    }
  }, [currentTaskIndex, tasks]);

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

    onUpdateTaskRating(currentTask.id, parsedUrgency, parsedImportance);

    if (currentTaskIndex < tasks.length - 1) {
      setCurrentTaskIndex(prev => prev + 1);
    } else {
      toast.success("Todas as tarefas foram avaliadas!");
      onFinishRating(); // Chamar onFinishRating apenas quando todas as tarefas forem avaliadas
    }
  }, [currentTask, currentTaskIndex, tasks.length, urgencyInput, importanceInput, onUpdateTaskRating, onFinishRating]);

  const handlePreviousTask = useCallback(() => {
    if (currentTaskIndex > 0) {
      setCurrentTaskIndex(prev => prev - 1);
    } else {
      onBack();
    }
  }, [currentTaskIndex, onBack]);

  const ratedTasksCount = tasks.filter(t => t.urgency !== null && t.importance !== null).length;
  const canViewMatrix = ratedTasksCount >= 2; // Habilitar se pelo menos 2 tarefas foram avaliadas

  if (!currentTask) {
    return (
      <div className="text-center p-8">
        <p className="text-lg text-gray-600 mb-4">Nenhuma tarefa para avaliar.</p>
        <Button onClick={onBack} className="flex items-center gap-2 mx-auto">
          <ArrowLeft className="h-4 w-4" /> Voltar
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