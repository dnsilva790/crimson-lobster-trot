"use client";

import React from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, Scale } from "lucide-react";
import { EisenhowerTask } from "@/lib/types";
import TaskCard from "./TaskCard"; // Reutilizando o TaskCard

interface ComparisonScreenProps {
  tasks: EisenhowerTask[];
  onSelectWinner: (winnerId: string) => void;
  onBack: () => void;
  // Add props for the two tasks being compared
  taskA: EisenhowerTask;
  taskB: EisenhowerTask;
}

const ComparisonScreen: React.FC<ComparisonScreenProps> = ({
  tasks,
  onSelectWinner,
  onBack,
  taskA,
  taskB,
}) => {
  return (
    <div className="p-4">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
          <Scale className="h-6 w-6 text-indigo-600" /> Comparar Tarefas
        </h3>
        <Button onClick={onBack} variant="outline" className="flex items-center gap-2">
          <ArrowLeft className="h-4 w-4" /> Voltar
        </Button>
      </div>

      <p className="text-lg text-gray-700 mb-6 text-center">
        Qual destas duas tarefas é mais importante/urgente para você AGORA?
      </p>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="flex flex-col items-center">
          <TaskCard task={taskA} className="mb-4 w-full" />
          <Button onClick={() => onSelectWinner(taskA.id)} className="w-full bg-green-500 hover:bg-green-600 text-white py-3 text-lg">
            Escolher Esquerda
          </Button>
        </div>
        <div className="flex flex-col items-center">
          <TaskCard task={taskB} className="mb-4 w-full" />
          <Button onClick={() => onSelectWinner(taskB.id)} className="w-full bg-blue-500 hover:bg-blue-600 text-white py-3 text-lg">
            Escolher Direita
          </Button>
        </div>
      </div>

      <div className="mt-8 text-center text-gray-500 text-sm">
        <p>Você está comparando tarefas para refinar a priorização. Esta tela é opcional e pode ser integrada ao fluxo principal.</p>
      </div>
    </div>
  );
};

export default ComparisonScreen;