"use client";

import React from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, LayoutDashboard, RotateCcw } from "lucide-react";
import { EisenhowerTask, Quadrant, ManualThresholds } from "@/lib/types";
import ScatterPlotMatrix from "./ScatterPlotMatrix"; // Importar o ScatterPlotMatrix
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";

interface DashboardScreenProps {
  tasks: EisenhowerTask[];
  onBack: () => void;
  onReset: () => void;
  displayFilter: "all" | "overdue" | "today" | "tomorrow" | "overdue_and_today"; // Adicionado
  onDisplayFilterChange: (value: "all" | "overdue" | "today" | "tomorrow" | "overdue_and_today") => void; // Adicionado
  manualThresholds: ManualThresholds; // Novo prop
  diagonalOffset: number; // NOVO: Um único ponto de deslocamento
  onDiagonalXChange: (value: number) => void; // Mantido para compatibilidade, mas agora atualiza o offset
  onDiagonalYChange: (value: number) => void; // Mantido para compatibilidade, mas agora atualiza o offset
}

const DashboardScreen: React.FC<DashboardScreenProps> = ({ 
  tasks, 
  onBack, 
  onReset, 
  displayFilter, 
  onDisplayFilterChange, 
  manualThresholds,
  diagonalOffset, // NOVO
  onDiagonalXChange, // Agora atualiza o offset
  onDiagonalYChange, // Agora atualiza o offset
}) => {
  const quadrantCounts = tasks.reduce((acc, task) => {
    if (task.quadrant) {
      acc[task.quadrant] = (acc[task.quadrant] || 0) + 1;
    }
    return acc;
  }, {} as Record<Quadrant, number>);

  const totalTasks = tasks.length;

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

  const handleDiagonalOffsetChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseInt(e.target.value, 10);
    if (!isNaN(value) && value >= 0 && value <= 200) { // Range de 0 a 200 para C em y = -x + C
      onDiagonalXChange(value); // Usa a função de callback para atualizar o offset
    }
  };

  return (
    <div className="p-4">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
          <LayoutDashboard className="h-6 w-6 text-indigo-600" /> Dashboard da Matriz
        </h3>
        <div className="flex gap-2">
          <Button onClick={onBack} variant="outline" className="flex items-center gap-2">
            <ArrowLeft className="h-4 w-4" /> Voltar
          </Button>
          <Button onClick={onReset} variant="destructive" className="flex items-center gap-2">
            <RotateCcw className="h-4 w-4" /> Resetar Matriz
          </Button>
        </div>
      </div>

      {totalTasks === 0 ? (
        <div className="text-center p-8 border rounded-lg bg-gray-50">
          <p className="text-gray-600 text-lg mb-4">
            Nenhuma tarefa encontrada para exibir no dashboard.
            Comece carregando e avaliando tarefas na tela de Configuração.
          </p>
        </div>
      ) : (
        <>
          <Card className="mb-6 p-6">
            <CardTitle className="text-xl font-bold mb-4 text-gray-800">
              Configuração da Linha Diagonal
            </CardTitle>
            <div className="grid grid-cols-1 gap-4 max-w-md"> {/* Apenas um input agora */}
              <div>
                <Label htmlFor="diagonal-offset">Deslocamento Diagonal (0-200)</Label>
                <Input
                  id="diagonal-offset"
                  type="number"
                  min="0"
                  max="200"
                  value={diagonalOffset}
                  onChange={handleDiagonalOffsetChange}
                  className="mt-1"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Controla a posição da linha diagonal (y = -x + C).
                  Valores maiores movem a linha para cima/direita.
                </p>
              </div>
            </div>
          </Card>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            <Card className="bg-blue-50 border-blue-200">
              <CardHeader>
                <CardTitle className="text-lg font-semibold text-blue-800">Fazer (Do)</CardTitle>
              </CardHeader>
              <CardContent className="text-4xl font-bold text-blue-700">
                {quadrantCounts.do || 0}
              </CardContent>
            </Card>
            <Card className="bg-green-50 border-green-200">
              <CardHeader>
                <CardTitle className="text-lg font-semibold text-green-800">Decidir (Decide)</CardTitle>
              </CardHeader>
              <CardContent className="text-4xl font-bold text-green-700">
                {quadrantCounts.decide || 0}
              </CardContent>
            </Card>
            <Card className="bg-yellow-50 border-yellow-200">
              <CardHeader>
                <CardTitle className="text-lg font-semibold text-yellow-800">Delegar (Delegate)</CardTitle>
              </CardHeader>
              <CardContent className="text-4xl font-bold text-yellow-700">
                {quadrantCounts.delegate || 0}
              </CardContent>
            </Card>
            <Card className="bg-red-50 border-red-200">
              <CardHeader>
                <CardTitle className="text-lg font-semibold text-red-800">Eliminar (Delete)</CardTitle>
              </CardHeader>
              <CardContent className="text-4xl font-bold text-red-700">
                {quadrantCounts.delete || 0}
              </CardContent>
            </Card>
          </div>

          <Card className="mb-8">
            <CardHeader>
              <CardTitle className="text-xl font-bold text-gray-800">Distribuição Urgência vs. Importância</CardTitle>
            </CardHeader>
            <CardContent>
              {dataForScatterPlot.length === 0 ? (
                <div className="text-center p-8">
                  <p className="text-gray-600 text-lg mb-4">
                    Nenhuma tarefa avaliada para exibir no gráfico.
                    Ajuste seus filtros ou avalie mais tarefas.
                  </p>
                </div>
              ) : (
                <ScatterPlotMatrix 
                  data={dataForScatterPlot} 
                  manualThresholds={manualThresholds} 
                  diagonalOffset={diagonalOffset} // NOVO: Passa o offset diagonal
                />
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-xl font-bold text-gray-800">Resumo das Tarefas</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-gray-700">Total de tarefas analisadas: <span className="font-semibold">{totalTasks}</span></p>
              <p className="text-gray-700">Tarefas sem avaliação: <span className="font-semibold">{tasks.filter(t => t.urgency === null || t.importance === null).length}</span></p>
              <p className="text-700">Tarefas categorizadas: <span className="font-semibold">{tasks.filter(t => t.quadrant !== null).length}</span></p>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
};

export default DashboardScreen;