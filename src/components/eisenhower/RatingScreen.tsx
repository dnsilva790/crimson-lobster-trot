"use client";

import React, { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Slider } from "@/components/ui/slider";
import { Label } from "@/components/ui/label";
import { ArrowLeft, ArrowRight, Scale, Check } from "lucide-react";
import { EisenhowerTask } from "@/lib/types";
import TaskCard from "./TaskCard"; // Reutilizando o TaskCard
import { toast } from "sonner";

interface RatingScreenProps {
  tasks: EisenhowerTask[];
  onUpdateTaskRating: (taskId: string, urgency: number | null, importance: number | null) => void;
  onFinishRating: () => void;
  onBack: () => void;
}

const RatingScreen: React.FC<RatingScreenProps> = ({
  tasks,
  onUpdateTaskRating,
  onFinishRating,
  onBack,
}) => {
  const [currentTaskIndex, setCurrentTaskIndex] = useState(0);
  const [urgency, setUrgency] = useState<number[]>([5]);
  const [importance, setImportance] = useState<number[]>([5]);

  const currentTask = tasks[currentTaskIndex];

  useEffect(() => {
    if (currentTask) {
      setUrgency([currentTask.urgency !== null ? currentTask.urgency : 5]);
      setImportance([currentTask.importance !== null ? currentTask.importance : 5]);
    }
  }, [currentTaskIndex, tasks]);

  const handleNextTask = useCallback(() => {
    if (!currentTask) return;

    onUpdateTaskRating(currentTask.id, urgency[0], importance[0]);

    if (currentTaskIndex < tasks.length - 1) {
      setCurrentTaskIndex(prev => prev + 1);
    } else {
      toast.success("Todas as tarefas foram avaliadas!");
      onFinishRating();
    }
  }, [currentTask, currentTaskIndex, tasks.length, urgency, importance, onUpdateTaskRating, onFinishRating]);

  const handlePreviousTask = useCallback(() => {
    if (currentTaskIndex > 0) {
      setCurrentTaskIndex(prev => prev - 1);
    } else {
      onBack();
    }
  }, [currentTaskIndex, onBack]);

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
            <Label htmlFor="urgency-slider" className="text-lg font-semibold text-gray-700 flex justify-between items-center">
              Urgência: <span className="text-blue-600 text-2xl font-bold">{urgency[0]}</span>
            </Label>
            <Slider
              id="urgency-slider"
              min={1}
              max={10}
              step={1}
              value={urgency}
              onValueChange={setUrgency}
              className="mt-2"
            />
            <p className="text-sm text-gray-500 mt-2">
              (1 = Nada Urgente, 10 = Extremamente Urgente)
            </p>
          </div>

          <div>
            <Label htmlFor="importance-slider" className="text-lg font-semibold text-gray-700 flex justify-between items-center">
              Importância: <span className="text-green-600 text-2xl font-bold">{importance[0]}</span>
            </Label>
            <Slider
              id="importance-slider"
              min={1}
              max={10}
              step={1}
              value={importance}
              onValueChange={setImportance}
              className="mt-2"
            />
            <p className="text-sm text-gray-500 mt-2">
              (1 = Nada Importante, 10 = Extremamente Importante)
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
        </CardContent>
      </Card>
    </div>
  );
};

export default RatingScreen;