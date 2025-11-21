"use client";

import React, { useMemo, useRef, useState, useEffect, useCallback } from "react";
import {
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ZAxis,
  ReferenceArea,
  ReferenceLine,
} from "recharts";
import { Quadrant, ManualThresholds } from "@/lib/types";
import { useNavigate } from "react-router-dom";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, Filter, Settings, Scale, RefreshCw, LayoutDashboard, ListTodo } from "lucide-react"; // LayoutDashboard e ListTodo adicionados aqui
import ThresholdSlider from "./ThresholdSlider"; // Import ThresholdSlider
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"; // Adicionado: Importação do componente Card

interface ScatterPlotData {
  id: string;
  content: string;
  urgency: number;
  importance: number;
  quadrant: Quadrant | null;
  url: string;
}

interface EisenhowerMatrixViewProps {
  tasks: ScatterPlotData[];
  onBack: () => void;
  onViewResults: () => void;
  displayFilter: "all" | "overdue" | "today" | "tomorrow" | "overdue_and_today";
  onDisplayFilterChange: (value: "all" | "overdue" | "today" | "tomorrow" | "overdue_and_today") => void;
  onRefreshMatrix: (filter: string) => Promise<void>;
  diagonalOffset: number;
  onDiagonalOffsetChange: (value: number) => void;
  searchTerm: string;
  setSearchTerm: (value: string) => void;
  categoryDisplayFilter: "all" | "pessoal" | "profissional";
  setCategoryDisplayFilter: (value: "all" | "pessoal" | "profissional") => void;
  displayPriorityFilter: "all" | "p1" | "p2" | "p3" | "p4";
  setDisplayPriorityFilter: (value: "all" | "p1" | "p2" | "p3" | "p4") => void;
  displayDeadlineFilter: "all" | "has_deadline" | "no_deadline";
  setDisplayDeadlineFilter: (value: "all" | "has_deadline" | "no_deadline") => void;
  todoistFilterInput: string;
  setTodoistFilterInput: (value: string) => void;
  onApplyFilter: () => void;
}

const quadrantColors: Record<Quadrant, string> = {
  do: "#ef4444", // red-500 (Urgente e Importante)
  decide: "#22c55e", // green-500 (Não Urgente e Importante)
  delegate: "#eab308", // yellow-500 (Urgente e Não Importante)
  delete: "#6b7280", // gray-500 (Não Urgente e Não Importante)
};

const quadrantBackgroundColors: Record<Quadrant, string> = {
  do: "#fee2e2", // red-100
  decide: "#d1fae5", // green-100
  delegate: "#fef9c3", // yellow-100
  delete: "#f3f4f6", // gray-100
};

const CustomTooltip = ({ active, payload }: any) => {
  if (active && payload && payload.length) {
    const task = payload[0].payload;
    return (
      <div className="p-3 bg-white border border-gray-200 rounded-md shadow-lg text-sm">
        <p className="font-semibold text-gray-800">{task.content}</p>
        <p className="text-gray-600">Urgência: {task.urgency}</p>
        <p className="text-gray-600">Importância: {task.importance}</p>
        <p className="text-gray-600">Quadrante: {task.quadrant ? task.quadrant.charAt(0).toUpperCase() + task.quadrant.slice(1) : 'N/A'}</p>
        <p className="text-purple-500 mt-1">Clique para planejar no SEISO</p>
        <p className="text-blue-500">Duplo clique para abrir no Todoist</p>
      </div>
    );
  }
  return null;
};

// Helper function to calculate dynamic domain and threshold
const getDynamicDomainAndThreshold = (values: number[]): { domain: [number, number], threshold: number } => {
  if (values.length === 0) {
    return { domain: [0, 100], threshold: 50 };
  }

  const minVal = Math.min(...values);
  const maxVal = Math.max(...values);

  // Add padding to the domain, but ensure it stays within 0-100
  const range = maxVal - minVal;
  const padding = range * 0.1; // 10% padding

  let domainMin = Math.max(0, minVal - padding);
  let domainMax = Math.min(100, maxVal + padding);

  // If minVal and maxVal are the same, create a small range around it
  if (domainMin === domainMax) {
    domainMin = Math.max(0, domainMin - 5);
    domainMax = Math.min(100, domainMax + 5);
  }

  const domain: [number, number] = [domainMin, domainMax];
  const threshold = (domain[0] + domain[1]) / 2; // Threshold is the midpoint of the dynamic domain
  return { domain, threshold };
};

interface DiagonalCalculation {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

const calculateDiagonalLine45Degrees = (
  diagonalOffset: number,
  chartWidth: number,
  chartHeight: number,
  margin: { top: number; right: number; bottom: number; left: number },
  xDomain: [number, number], // Use dynamic domain
  yDomain: [number, number]  // Use dynamic domain
): DiagonalCalculation => {
  const [xMin, xMax] = xDomain;
  const [yMin, yMax] = yDomain;

  const graphWidth = chartWidth - margin.left - margin.right;
  const graphHeight = chartHeight - margin.top - margin.bottom;

  const xScale = graphWidth / (xMax - xMin);
  const yScale = graphHeight / (yMax - yMin);

  // importance = -urgency + diagonalOffset
  
  // Calculate points that intersect the domain boundaries
  // Point 1: when urgency = xMin
  let p1_urgency = xMin;
  let p1_importance = diagonalOffset - xMin;

  // Point 2: when urgency = xMax
  let p2_urgency = xMax;
  let p2_importance = diagonalOffset - xMax;

  // Adjust points to be within Y domain
  p1_importance = Math.max(yMin, Math.min(yMax, p1_importance));
  p2_importance = Math.max(yMin, Math.min(yMax, p2_importance));

  // Re-adjust urgency based on clamped importance to ensure points are on the line and within X domain
  p1_urgency = Math.max(xMin, Math.min(xMax, diagonalOffset - p1_importance));
  p2_urgency = Math.max(xMin, Math.min(xMax, diagonalOffset - p2_importance));

  // Convert to pixels
  const x1 = margin.left + (p1_urgency - xMin) * xScale;
  const y1 = margin.top + (yMax - p1_importance) * yScale; // Y-axis is inverted in SVG

  const x2 = margin.left + (p2_urgency - xMin) * xScale;
  const y2 = margin.top + (yMax - p2_importance) * yScale; // Y-axis is inverted in SVG

  return { x1, y1, x2, y2 };
};


const EisenhowerMatrixView: React.FC<EisenhowerMatrixViewProps> = ({ 
  tasks, 
  onBack, 
  onViewResults, 
  onRefreshMatrix, 
  diagonalOffset,
  onDiagonalOffsetChange,
  searchTerm, 
  setSearchTerm, 
  displayFilter, 
  onDisplayFilterChange, 
  categoryDisplayFilter, 
  setCategoryDisplayFilter, 
  displayPriorityFilter, 
  setDisplayPriorityFilter, 
  displayDeadlineFilter, 
  setDisplayDeadlineFilter, 
  todoistFilterInput,
  setTodoistFilterInput,
  onApplyFilter,
}) => {
  const navigate = useNavigate();
  const clickTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [chartDimensions, setChartDimensions] = useState({ width: 0, height: 0 });
  const [isDraggingLine, setIsDraggingLine] = useState(false);
  const svgRef = useRef<SVGCircleElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const CHART_MARGIN = { top: 20, right: 20, bottom: 20, left: 20 };

  const urgencyValues = tasks.map(d => d.urgency);
  const importanceValues = tasks.map(d => d.importance);

  // Calculate dynamic domains and thresholds
  const { domain: urgencyDomain, threshold: urgencyThreshold } = useMemo(() => getDynamicDomainAndThreshold(urgencyValues), [urgencyValues]);
  const { domain: importanceDomain, threshold: importanceThreshold } = useMemo(() => getDynamicDomainAndThreshold(importanceValues), [importanceValues]);

  // The final thresholds for the reference lines are now always dynamic
  const finalUrgencyThreshold = urgencyThreshold;
  const finalImportanceThreshold = importanceThreshold;

  const diagonalLine = useMemo(() => {
    if (chartDimensions.width === 0 || chartDimensions.height === 0) {
      return { x1: 0, y1: 0, x2: 0, y2: 0 };
    }
    return calculateDiagonalLine45Degrees(
      diagonalOffset,
      chartDimensions.width,
      chartDimensions.height,
      CHART_MARGIN,
      urgencyDomain, // Pass dynamic domain
      importanceDomain // Pass dynamic domain
    );
  }, [diagonalOffset, chartDimensions, CHART_MARGIN, urgencyDomain, importanceDomain]); // Add dynamic domains to dependencies

  const handleSingleClick = useCallback((payload: any) => {
    if (clickTimer.current) {
      clearTimeout(clickTimer.current);
      clickTimer.current = null;
    }
    clickTimer.current = setTimeout(() => {
      if (payload && payload.id) { // payload is the entry itself
        navigate(`/seiso/${payload.id}`);
      }
    }, 200);
  }, [navigate]);

  const handleDoubleClick = useCallback((payload: any) => {
    if (clickTimer.current) {
      clearTimeout(clickTimer.current);
      clickTimer.current = null;
    }
    if (payload && payload.url) { // payload is the entry itself
      window.open(payload.url, '_blank');
    }
  }, []);

  const getFillColor = (entry: ScatterPlotData) => {
    // Fallback para cinza claro para tarefas não avaliadas
    return entry.quadrant ? quadrantColors[entry.quadrant] : "#9ca3af"; 
  };

  const midX = (diagonalLine.x1 + diagonalLine.x2) / 2;
  const midY = (diagonalLine.y1 + diagonalLine.y2) / 2;

  const handleMouseDownOnCircle = useCallback((e: React.MouseEvent<SVGCircleElement>) => {
    if (!onDiagonalOffsetChange || !svgRef.current) return;

    e.stopPropagation();
    setIsDraggingLine(true);

    const rect = svgRef.current.getBoundingClientRect();
    const initialMouseX = e.clientX;
    const initialMouseY = e.clientY;
    const initialOffset = diagonalOffset;

    const graphWidth = chartDimensions.width - CHART_MARGIN.left - CHART_MARGIN.right;
    const graphHeight = chartDimensions.height - CHART_MARGIN.top - CHART_MARGIN.bottom;

    // Use dynamic domains for scaling
    const xScale = graphWidth / (urgencyDomain[1] - urgencyDomain[0]);
    const yScale = graphHeight / (importanceDomain[1] - importanceDomain[0]);

    const onDragMove = (moveEvent: MouseEvent) => {
      if (!isDraggingLine) return;

      const dx_pixels = moveEvent.clientX - initialMouseX;
      const dy_pixels = moveEvent.clientY - initialMouseY;

      const dU = dx_pixels / xScale;
      const dI = -dy_pixels / yScale;

      const newOffset = initialOffset + dU + dI;
      // Clamp newOffset to a reasonable range, e.g., 0 to 200 (min U + min I to max U + max I)
      onDiagonalOffsetChange(Math.max(0, Math.min(200, newOffset)));
    };

    const onDragEnd = () => {
      setIsDraggingLine(false);
      document.removeEventListener('mousemove', onDragMove);
      document.removeEventListener('mouseup', onDragEnd);
    };

    document.addEventListener('mousemove', onDragMove);
    document.addEventListener('mouseup', onDragEnd);
  }, [onDiagonalOffsetChange, chartDimensions, diagonalOffset, isDraggingLine, urgencyDomain, importanceDomain]); // Add dynamic domains to dependencies

  return (
    <div
      ref={containerRef}
      className="w-full h-full"
      style={{ position: 'relative' }}
    >
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
          <LayoutDashboard className="h-6 w-6 text-indigo-600" /> Sua Matriz de Eisenhower
        </h3>
        <div className="flex gap-2">
          <Button onClick={onBack} variant="outline" className="flex items-center gap-2">
            <Scale className="h-4 w-4" /> Voltar
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
        <Select value={displayFilter} onValueChange={(value: "all" | "overdue" | "today" | "tomorrow" | "overdue_and_today") => onDisplayFilterChange(value)}>
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
        <Select value={categoryDisplayFilter} onValueChange={(value: "all" | "pessoal" | "profissional") => setCategoryDisplayFilter(value)}>
          <SelectTrigger className="w-full mt-1">
            <SelectValue placeholder="Filtrar por Categoria" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas as Categorias</SelectItem>
            <SelectItem value="pessoal">Pessoal</SelectItem>
            <SelectItem value="profissional">Profissional</SelectItem>
          </SelectContent>
        </Select>
        <Select value={displayPriorityFilter} onValueChange={(value: "all" | "p1" | "p2" | "p3" | "p4") => setDisplayPriorityFilter(value)}>
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
        <Select value={displayDeadlineFilter} onValueChange={(value: "all" | "has_deadline" | "no_deadline") => setDisplayDeadlineFilter(value)}>
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

      {/* NOVO: Campo de filtro Todoist */}
      <div className="mb-6 grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
        <div className="md:col-span-2">
          <Label htmlFor="todoist-filter-input" className="text-gray-700">
            Filtro Todoist (para carregar tarefas)
          </Label>
          <Input
            id="todoist-filter-input"
            type="text"
            placeholder="Ex: 'hoje & p1', 'all', 'completed'"
            value={todoistFilterInput}
            onChange={(e) => setTodoistFilterInput(e.target.value)}
            className="mt-1"
          />
          <p className="text-sm text-gray-500 mt-1">
            Este filtro carrega as tarefas do Todoist. Use 'all' para todas as tarefas (incluindo concluídas).
          </p>
        </div>
        <Button onClick={onApplyFilter} className="w-full py-3 text-lg bg-indigo-600 hover:bg-indigo-700 text-white flex items-center justify-center gap-2">
          <Filter className="h-5 w-5" /> Aplicar Filtro
        </Button>
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
            min={0}
            className="w-full"
          />
          <p className="text-sm text-gray-500 mt-2">
            Ajuste esta linha para definir o limite de "próxima ação" (tarefas abaixo da linha).
          </p>
        </CardContent>
      </Card>

      {tasks.length === 0 ? (
        <div className="text-center p-8 border rounded-lg bg-gray-50">
          <p className="text-gray-600 text-lg mb-4">
            Nenhuma tarefa encontrada para exibir no gráfico com o filtro atual.
            Ajuste seus filtros ou avalie mais tarefas.
          </p>
        </div>
      ) : (
        <div className="aspect-square max-h-[750px] mx-auto">
          <ScatterPlotMatrix 
            data={tasks} 
            diagonalOffset={diagonalOffset}
            onDiagonalOffsetChange={onDiagonalOffsetChange} // Pass onDiagonalOffsetChange
          />
        </div>
      )}
    </div>
  );
};

export default EisenhowerMatrixView;