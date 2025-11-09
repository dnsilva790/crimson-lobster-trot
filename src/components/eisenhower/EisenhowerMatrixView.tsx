"use client";

import React from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, ListTodo, LayoutDashboard, RefreshCw, Scale, Search, Filter } from "lucide-react";
import { EisenhowerTask, ManualThresholds, DisplayFilter, CategoryDisplayFilter, PriorityFilter, DeadlineFilter } from "@/lib/types";
import ScatterPlotMatrix from "./ScatterPlotMatrix";
import { Slider } from "@/components/ui/slider";
import { Label } from "@/components/ui/label";
import ThresholdSlider from "./ThresholdSlider"; // Import ThresholdSlider
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface EisenhowerMatrixViewProps {
  tasks: EisenhowerTask[];
  onBack: () => void;
  onViewResults: () => void;
  displayFilter: DisplayFilter;
  onDisplayFilterChange: (value: DisplayFilter) => void;
  onRefreshMatrix: (filter: string) => Promise<void>;
  manualThresholds: ManualThresholds;
  diagonalOffset: number;
  onDiagonalOffsetChange: (value: number) => void;
  searchTerm: string; // NEW
  setSearchTerm: (value: string) => void; // NEW
  categoryDisplayFilter: CategoryDisplayFilter; // NEW
  setCategoryDisplayFilter: (value: CategoryDisplayFilter) => void; // NEW
  displayPriorityFilter: PriorityFilter; // NEW
  setDisplayPriorityFilter: (value: PriorityFilter) => void; // NEW
  displayDeadlineFilter: DeadlineFilter; // NEW
  setDisplayDeadlineFilter: (value: DeadlineFilter) => void; // NEW
}

const EisenhowerMatrixView: React.FC<EisenhowerMatrixViewProps> = ({ 
  tasks, 
  onBack, 
  onViewResults, 
  onRefreshMatrix, 
  manualThresholds,
  diagonalOffset,
  onDiagonalOffsetChange,
  searchTerm, // NEW
  setSearchTerm, // NEW
  displayFilter, // NEW
  onDisplayFilterChange, // NEW
  categoryDisplayFilter, // NEW
  setCategoryDisplayFilter, // NEW
  displayPriorityFilter, // NEW
  setDisplayPriorityFilter, // NEW
  displayDeadlineFilter, // NEW
  setDisplayDeadlineFilter, // NEW
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

      {/* Seletor de filtro de exibição e busca - MOVIDO AQUI */}
      <div className="mb-6 grid grid-cols-1 md:grid-cols-6 gap-4">
        <div className="relative md:col-span-2">
          <Input
            type="text"
            placeholder="Buscar tarefas por conteúdo, descrição ou etiqueta..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500" />
        </div>
        <Select value={displayFilter} onValueChange={(value: DisplayFilter) => onDisplayFilterChange(value)}>
          <SelectTrigger className="w-full mt-1">
            <SelectValue placeholder="Filtrar por Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas as Datas</SelectItem>
            <SelectItem value="overdue">Apenas Atrasadas</SelectItem>
            <SelectItem value="today">Apenas Vencem Hoje</SelectItem>
            <SelectItem value="tomorrow">Apenas Vencem Amanhã</SelectItem>
            <SelectItem value="overdue_and_today">Atrasadas e Hoje</SelectItem>
          </SelectContent>
        </Select>
        <Select value={categoryDisplayFilter} onValueChange={(value: CategoryDisplayFilter) => setCategoryDisplayFilter(value)}>
          <SelectTrigger className="w-full mt-1">
            <SelectValue placeholder="Filtrar por Categoria" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas as Categorias</SelectItem>
            <SelectItem value="pessoal">Pessoal</SelectItem>
            <SelectItem value="profissional">Profissional</SelectItem>
          </SelectContent>
        </Select>
        <Select value={displayPriorityFilter} onValueChange={(value: PriorityFilter) => setDisplayPriorityFilter(value)}>
          <SelectTrigger className="w-full mt-1">
            <SelectValue placeholder="Filtrar por Prioridade" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas as Prioridades</SelectItem>
            <SelectItem value="p4">P4 (Baixa)</SelectItem>
            <SelectItem value="p3">P3 (Média)</SelectItem>
            <SelectItem value="p2">P2 (Alta)</SelectItem>
            <SelectItem value="p1">P1 (Urgente)</SelectItem>
          </SelectContent>
        </Select>
        <Select value={displayDeadlineFilter} onValueChange={(value: DeadlineFilter) => setDisplayDeadlineFilter(value)}>
          <SelectTrigger className="w-full mt-1">
            <SelectValue placeholder="Filtrar por Deadline" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os Deadlines</SelectItem>
            <SelectItem value="has_deadline">Com Deadline Definido</SelectItem>
            <SelectItem value="no_deadline">Sem Deadline Definido</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <p className="text-lg text-gray-700 mb-6 text-center">
        A divisão dos quadrantes é calculada dinamicamente com base na distribuição dos seus dados.
      </p>

      {/* Card do ThresholdSlider movido para cima do gráfico */}
      <Card className="mb-6 p-4 max-w-md mx-auto">
        <CardTitle className="text-lg font-bold mb-3 flex items-center gap-2">
          <Scale className="h-5 w-5 text-indigo-600" /> Linha de Prioridade Diagonal
        </CardTitle>
        <CardContent className="p-0">
          <ThresholdSlider
            value={diagonalOffset}
            onValueChange={onDiagonalOffsetChange}
            label="Urgência + Importância"
            orientation="horizontal"
            max={200}
            min={0} // Adicionado min
            className="w-full"
          />
          <p className="text-sm text-gray-500 mt-2">
            Ajuste esta linha para definir o limite de "próxima ação" (tarefas abaixo da linha).
          </p>
        </CardContent>
      </Card>

      {dataForScatterPlot.length === 0 ? (
        <div className="text-center p-8 border rounded-lg bg-gray-50">
          <p className="text-gray-600 text-lg mb-4">
            Nenhuma tarefa encontrada para exibir no gráfico com o filtro atual.
            Ajuste seus filtros ou avalie mais tarefas.
          </p>
        </div>
      ) : (
        <div className="aspect-square max-h-[750px] mx-auto">
          <ScatterPlotMatrix 
            data={dataForScatterPlot} 
            manualThresholds={manualThresholds} 
            diagonalOffset={diagonalOffset}
          />
        </div>
      )}
    </div>
  );
};

export default EisenhowerMatrixView;