"use client";

import React from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, ListTodo, LayoutDashboard } from "lucide-react";
import { EisenhowerTask } from "@/lib/types";
import ScatterPlotMatrix from "./ScatterPlotMatrix"; // Importar o ScatterPlotMatrix

interface EisenhowerMatrixViewProps {
  tasks: EisenhowerTask[];
  onBack: () => void;
  onViewResults: () => void;
}

const EisenhowerMatrixView: React.FC<EisenhowerMatrixViewProps> = ({ tasks, onBack, onViewResults }) => {
  const dataForScatterPlot = tasks
    .filter(task => task.urgency !== null && task.importance !== null)
    .map(task => ({
      id: task.id,
      content: task.content,
      urgency: task.urgency!,
      importance: task.importance!,
      quadrant: task.quadrant,
    }));

  return (
    <div className="p-4">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
          <LayoutDashboard className="h-6 w-6 text-indigo-600" /> Sua Matriz de Eisenhower
        </h3>
        <div className="flex gap-2">
          <Button onClick={onBack} variant="outline" className="flex items-center gap-2">
            <ArrowLeft className="h-4 w-4" /> Voltar para Avaliação
          </Button>
          <Button onClick={onViewResults} className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white">
            <ListTodo className="h-4 w-4" /> Ver Resultados
          </Button>
        </div>
      </div>

      <p className="text-lg text-gray-700 mb-6 text-center">
        Suas tarefas categorizadas por Urgência e Importância.
      </p>

      <div className="h-[calc(100vh-350px)]"> {/* Ajuste a altura conforme necessário */}
        <ScatterPlotMatrix data={dataForScatterPlot} />
      </div>
    </div>
  );
};

export default EisenhowerMatrixView;