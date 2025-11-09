"use client";

import React from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, ListTodo, LayoutDashboard, RefreshCw, Scale } from "lucide-react"; // Importar Scale
import { EisenhowerTask, ManualThresholds } from "@/lib/types";
import ScatterPlotMatrix from "./ScatterPlotMatrix";
import { Slider } from "@/components/ui/slider"; // Importar Slider
import { Label } from "@/components/ui/label"; // Importar Label

interface EisenhowerMatrixViewProps {
  tasks: EisenhowerTask[];
  onBack: () => void; // Agora leva para a tela de avaliação
  onViewResults: () => void;
  displayFilter: "all" | "overdue" | "today" | "tomorrow" | "overdue_and_today";
  onDisplayFilterChange: (value: "all" | "overdue" | "today" | "tomorrow" | "overdue_and_today") => void;
  onRefreshMatrix: (filter: string) => Promise<void>;
  manualThresholds: ManualThresholds; // Novo prop
  // diagonalOffset: number; // REMOVIDO
  // onDiagonalOffsetChange: (value: number) => void; // REMOVIDO
}

const EisenhowerMatrixView: React.FC<EisenhowerMatrixViewProps> = ({ tasks, onBack, onViewResults, onRefreshMatrix, manualThresholds }) => { // Removido diagonalOffset e onDiagonalOffsetChange
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
          {/* Removido o Card de controle da linha diagonal */}
          {/* <Card className="mb-8 p-4">
            <Label htmlFor="diagonal-offset-slider" className="text-lg font-semibold text-gray-700 flex justify-between items-center mb-2">
              Linha Diagonal (Urgência + Importância = {diagonalOffset.toFixed(0)})
            </Label>
            <Slider
              id="diagonal-offset-slider"
              defaultValue={[diagonalOffset]}
              max={200} // Max value for U+I (100+100)
              min={0}   // Min value for U+I (0+0)
              step={1}
              onValueChange={(value) => onDiagonalOffsetChange(value[0])}
              className="w-full"
            />
            <p className="text-sm text-gray-500 mt-2">
              Ajuste esta linha para visualizar tarefas onde a soma de Urgência e Importância é constante.
            </p>
          </Card> */}

          <div className="aspect-square max-h-[750px] mx-auto">
            <ScatterPlotMatrix 
              data={dataForScatterPlot} 
              manualThresholds={manualThresholds} 
              // diagonalOffset={diagonalOffset} // REMOVIDO
            />
          </div>
        </>
      )}
    </div>
  );
};

export default EisenhowerMatrixView;