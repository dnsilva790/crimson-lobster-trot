"use client";

import React from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, ListTodo, LayoutDashboard, RefreshCw } from "lucide-react"; // Importar RefreshCw
import { EisenhowerTask } from "@/lib/types";
import ScatterPlotMatrix from "./ScatterPlotMatrix"; // Importar o ScatterPlotMatrix

interface EisenhowerMatrixViewProps {
  tasks: EisenhowerTask[];
  onBack: () => void;
  onViewResults: () => void;
  displayFilter: "all" | "overdue" | "today" | "tomorrow" | "overdue_and_today"; // Adicionado
  onDisplayFilterChange: (value: "all" | "overdue" | "today" | "tomorrow" | "overdue_and_today") => void; // Adicionado
  onRefreshMatrix: (filter: string) => Promise<void>; // Nova prop para a função de atualização
}

const EisenhowerMatrixView: React.FC<EisenhowerMatrixViewProps> = ({ tasks, onBack, onViewResults, displayFilter, onDisplayFilterChange, onRefreshMatrix }) => {
  const dataForScatterPlot = tasks
    .filter(task => task.urgency !== null && task.importance !== null)
    .map(task => ({
      id: task.id,
      content: task.content,
      urgency: task.urgency!,
      importance: task.importance!,
      quadrant: task.quadrant,
      url: task.url, // ADICIONADO: Passa a URL para o ScatterPlotMatrix
    }));

  return (
    <div className="p-4">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
          <LayoutDashboard className="h-6 w-6 text-indigo-600" /> Sua Matriz de Eisenhower
        </h3>
        <div className="flex gap-2">
          <Button onClick={onBack} variant="outline" className="flex items-center gap-2">
            <ArrowLeft className="h-4 w-4" /> Voltar para Resultados
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
        Suas tarefas categorizadas por Urgência e Importância.
      </p>

      {dataForScatterPlot.length === 0 ? (
        <div className="text-center p-8 border rounded-lg bg-gray-50">
          <p className="text-gray-600 text-lg mb-4">
            Nenhuma tarefa encontrada para exibir no gráfico com o filtro atual.
            Ajuste seus filtros ou avalie mais tarefas.
          </p>
        </div>
      ) : (
        <div className="aspect-square max-h-[750px] mx-auto">
          <ScatterPlotMatrix data={dataForScatterPlot} />
        </div>
      )}
    </div>
  );
};

export default EisenhowerMatrixView;