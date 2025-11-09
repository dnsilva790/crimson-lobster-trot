"use client";

import React from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, ListTodo, LayoutDashboard, RefreshCw, Scale } from "lucide-react";
import { EisenhowerTask, ManualThresholds } from "@/lib/types";
import ScatterPlotMatrix from "./ScatterPlotMatrix";
import { Slider } from "@/components/ui/slider";
import { Label } from "@/components/ui/label";
import ThresholdSlider from "./ThresholdSlider"; // Import ThresholdSlider

interface EisenhowerMatrixViewProps {
  tasks: EisenhowerTask[];
  onBack: () => void;
  onViewResults: () => void;
  displayFilter: "all" | "overdue" | "today" | "tomorrow" | "overdue_and_today";
  onDisplayFilterChange: (value: "all" | "overdue" | "today" | "tomorrow" | "overdue_and_today") => void;
  onRefreshMatrix: (filter: string) => Promise<void>;
  manualThresholds: ManualThresholds;
  diagonalOffset: number; // NEW
  onDiagonalOffsetChange: (value: number) => void; // NEW
}

const EisenhowerMatrixView: React.FC<EisenhowerMatrixViewProps> = ({ 
  tasks, 
  onBack, 
  onViewResults, 
  onRefreshMatrix, 
  manualThresholds,
  diagonalOffset, // NEW
  onDiagonalOffsetChange, // NEW
}) => {
  const dataForScatterPlot = tasks
    .filter(task => task.urgency !== null && task.importance !== null)
    .map(task => ({
      id: task.id,
      content: task.content,
      urgency: task.urgency!,
      importance: task.importance!,
      quadrant: task.quadrant,
      url: task.url,
    }));

  return (
    <div className="p-4">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
          <LayoutDashboard className="h-6 w-6 text-indigo-600" /> Sua Matriz de Eisenhower
        </h3>
        <div className="flex gap-2">
          <Button onClick={onBack} variant="outline" className="flex items-center gap-2">
            <Scale className="h-4 w-4" /> Revisar Avaliação
          </Button>
          <Button onClick={onViewResults} className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white">
            <ListTodo className="h-4 w-4" /> Ver Lista
          </Button>
          <Button onClick={() => onRefreshMatrix("")} variant="outline" className="flex items-center gap-2">
            <RefreshCw className="h-4 w-4" /> Atualizar Matriz
          </Button>
        </div>
      </div>

      <p className="text-lg text-gray-700 mb-6 text-center">
        A divisão dos quadrantes é calculada dinamicamente com base na distribuição dos seus dados.
      </p>

      {dataForScatterPlot.length === 0 ? (
        <div className="text-center p-8 border rounded-lg bg-gray-50">
          <p className="text-gray-600 text-lg mb-4">
            Nenhuma tarefa encontrada para exibir no gráfico com o filtro atual.
            Ajuste seus filtros ou avalie mais tarefas.
          </p>
        </div>
      ) : (
        <>
          <div className="aspect-square max-h-[750px] mx-auto">
            <ScatterPlotMatrix 
              data={dataForScatterPlot} 
              manualThresholds={manualThresholds} 
              diagonalOffset={diagonalOffset} // NEW
            />
          </div>
          {/* NEW: Diagonal Offset Slider */}
          <Card className="mt-6 p-4 max-w-md mx-auto">
            <CardTitle className="text-lg font-bold mb-3 flex items-center gap-2">
              <Scale className="h-5 w-5 text-indigo-600" /> Linha de Prioridade Diagonal
            </CardTitle>
            <CardContent className="p-0">
              <ThresholdSlider
                value={diagonalOffset}
                onValueChange={onDiagonalOffsetChange}
                label="Urgência + Importância"
                orientation="horizontal"
                max={200} // NEW: Set max to 200
                className="w-full"
              />
              <p className="text-sm text-gray-500 mt-2">
                Ajuste esta linha para definir o limite de "próxima ação" (tarefas abaixo da linha).
              </p>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
};

export default EisenhowerMatrixView;