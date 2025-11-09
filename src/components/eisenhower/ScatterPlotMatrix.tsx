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

interface ScatterPlotData {
  id: string;
  content: string;
  urgency: number;
  importance: number;
  quadrant: Quadrant | null;
  url: string;
}

interface ScatterPlotMatrixProps {
  data: ScatterPlotData[];
  manualThresholds: ManualThresholds | null;
  diagonalOffset: number; // NEW: diagonalOffset prop
  onDiagonalOffsetChange?: (offset: number) => void; // NEW: handler for diagonal offset change
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
  chartWidth: number, // Largura total do SVG
  chartHeight: number, // Altura total do SVG
  margin: { top: number; right: number; bottom: number; left: number },
  xDomain: [number, number], // Usar domínio dinâmico
  yDomain: [number, number]  // Usar domínio dinâmico
): DiagonalCalculation => {
  const [xMin, xMax] = xDomain;
  const [yMin, yMax] = yDomain;

  // Dimensões reais da área de plotagem (sem margins)
  const graphWidth = chartWidth - margin.left - margin.right;
  const graphHeight = chartHeight - margin.top - margin.bottom;

  // Escala: pixels por unidade de dados
  const xScale = graphWidth / (xMax - xMin);
  const yScale = graphHeight / (yMax - yMin);

  // Pontos da linha no sistema de coordenadas de dados (Urgência, Importância)
  // importance = -urgency + diagonalOffset
  
  let p1_urgency = xMin;
  let p1_importance = diagonalOffset - xMin;

  let p2_urgency = xMax;
  let p2_importance = diagonalOffset - xMax;

  // Ajusta os pontos para que fiquem dentro dos limites do domínio Y
  p1_importance = Math.max(yMin, Math.min(yMax, p1_importance));
  p2_importance = Math.max(yMin, Math.min(yMax, p2_importance));

  // Ajusta os pontos para que fiquem dentro dos limites do domínio X
  p1_urgency = Math.max(xMin, Math.min(xMax, diagonalOffset - p1_importance));
  p2_urgency = Math.max(xMin, Math.min(xMax, diagonalOffset - p2_importance));

  // Converte para pixels respeitando a proporção visual
  const x1 = margin.left + (p1_urgency - xMin) * xScale;
  const y1 = margin.top + (yMax - p1_importance) * yScale; // Y-axis is inverted in SVG

  const x2 = margin.left + (p2_urgency - xMin) * xScale;
  const y2 = margin.top + (yMax - p2_importance) * yScale; // Y-axis is inverted in SVG

  return { x1, y1, x2, y2 };
};


const ScatterPlotMatrix: React.FC<ScatterPlotMatrixProps> = ({ data, manualThresholds, diagonalOffset, onDiagonalOffsetChange }) => {
  const navigate = useNavigate();
  const clickTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [chartDimensions, setChartDimensions] = useState({ width: 0, height: 0 });
  const [isDraggingLine, setIsDraggingLine] = useState(false); // Renamed to avoid conflict
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const CHART_MARGIN = { top: 20, right: 20, bottom: 20, left: 20 };

  const urgencyValues = data.map(d => d.urgency);
  const importanceValues = data.map(d => d.importance);

  // Fixed domains for X and Y axes to ensure 45-degree line
  const X_MIN = 0;
  const X_MAX = 100;
  const Y_MIN = 0;
  const Y_MAX = 100;

  const urgencyDomain: [number, number] = [X_MIN, X_MAX];
  const importanceDomain: [number, number] = [Y_MIN, Y_MAX];

  const { threshold: dynamicUrgencyThreshold } = useMemo(() => getDynamicDomainAndThreshold(urgencyValues), [urgencyValues]);
  const { threshold: dynamicImportanceThreshold } = useMemo(() => getDynamicDomainAndThreshold(importanceValues), [importanceValues]);

  const finalUrgencyThreshold = manualThresholds?.urgency ?? dynamicUrgencyThreshold;
  const finalImportanceThreshold = manualThresholds?.importance ?? dynamicImportanceThreshold;

  const diagonalLine = useMemo(() => {
    if (chartDimensions.width === 0 || chartDimensions.height === 0) {
      return { x1: 0, y1: 0, x2: 0, y2: 0 };
    }
    return calculateDiagonalLine45Degrees(
      diagonalOffset,
      chartDimensions.width,
      chartDimensions.height,
      CHART_MARGIN,
      urgencyDomain,
      importanceDomain
    );
  }, [diagonalOffset, chartDimensions, CHART_MARGIN, urgencyDomain, importanceDomain]);

  const handleSingleClick = (payload: any) => {
    if (clickTimer.current) {
      clearTimeout(clickTimer.current);
      clickTimer.current = null;
    }
    clickTimer.current = setTimeout(() => {
      if (payload && payload.payload && payload.payload.id) {
        navigate(`/seiso/${payload.payload.id}`);
      }
    }, 200);
  };

  const handleDoubleClick = (payload: any) => {
    if (clickTimer.current) {
      clearTimeout(clickTimer.current);
      clickTimer.current = null;
    }
    if (payload && payload.payload && payload.payload.url) {
      window.open(payload.payload.url, '_blank');
    }
  };

  const getFillColor = (entry: ScatterPlotData) => {
    // Fallback para cinza claro para tarefas não avaliadas
    return entry.quadrant ? quadrantColors[entry.quadrant] : "#9ca3af"; 
  };

  const midX = (diagonalLine.x1 + diagonalLine.x2) / 2;
  const midY = (diagonalLine.y1 + diagonalLine.y2) / 2;

  const handleMouseDownOnCircle = useCallback((e: React.MouseEvent<SVGCircleElement>) => {
    if (!onDiagonalOffsetChange || !svgRef.current) return;

    e.stopPropagation(); // Impede que o evento se propague para elementos subjacentes
    setIsDraggingLine(true);

    const rect = svgRef.current.getBoundingClientRect();
    const initialMouseX = e.clientX;
    const initialMouseY = e.clientY;
    const initialOffset = diagonalOffset;

    const graphWidth = chartDimensions.width - CHART_MARGIN.left - CHART_MARGIN.right;
    const graphHeight = chartDimensions.height - CHART_MARGIN.top - CHART_MARGIN.bottom;

    const xScale = graphWidth / (X_MAX - X_MIN);
    const yScale = graphHeight / (Y_MAX - Y_MIN);

    const onDragMove = (moveEvent: MouseEvent) => {
      if (!isDraggingLine) return;

      const dx_pixels = moveEvent.clientX - initialMouseX;
      const dy_pixels = moveEvent.clientY - initialMouseY;

      const dU = dx_pixels / xScale;
      const dI = -dy_pixels / yScale; // O eixo Y é invertido no SVG

      const newOffset = initialOffset + dU + dI;
      onDiagonalOffsetChange(Math.max(0, Math.min(200, newOffset)));
    };

    const onDragEnd = () => {
      setIsDraggingLine(false);
      document.removeEventListener('mousemove', onDragMove);
      document.removeEventListener('mouseup', onDragEnd);
    };

    document.addEventListener('mousemove', onDragMove);
    document.addEventListener('mouseup', onDragEnd);
  }, [onDiagonalOffsetChange, chartDimensions, diagonalOffset, isDraggingLine, X_MAX, Y_MAX, X_MIN, Y_MIN]);

  return (
    <div
      ref={containerRef}
      className="w-full h-full"
      style={{ position: 'relative' }}
    >
      <ResponsiveContainer width="100%" height="100%" onResize={(width, height) => setChartDimensions({ width, height })}>
        <ScatterChart
          margin={CHART_MARGIN}
        >
          <CartesianGrid strokeDasharray="3 3" className="stroke-gray-200" />
          
          <ReferenceLine x={finalUrgencyThreshold} stroke="#4b5563" strokeDasharray="5 5" />
          <ReferenceLine y={finalImportanceThreshold} stroke="#4b5563" strokeDasharray="5 5" />

          <ReferenceArea 
            x1={finalUrgencyThreshold} x2={X_MAX} y1={finalImportanceThreshold} y2={Y_MAX} 
            fill={quadrantBackgroundColors.do} stroke={quadrantColors.do} strokeOpacity={0.5} 
            label={{ value: "Q1: Fazer (Do)", position: 'top', fill: quadrantColors.do, fontSize: 14, fontWeight: 'bold', dx: 40, dy: 10 }}
          />
          <ReferenceArea 
            x1={X_MIN} x2={finalUrgencyThreshold} y1={finalImportanceThreshold} y2={Y_MAX} 
            fill={quadrantBackgroundColors.decide} stroke={quadrantColors.decide} strokeOpacity={0.5} 
            label={{ value: "Q2: Decidir", position: 'top', fill: quadrantColors.decide, fontSize: 14, fontWeight: 'bold', dx: -40, dy: 10 }}
          />
          <ReferenceArea 
            x1={X_MIN} x2={finalUrgencyThreshold} y1={Y_MIN} y2={finalImportanceThreshold} 
            fill={quadrantBackgroundColors.delete} stroke={quadrantColors.delete} strokeOpacity={0.5} 
            label={{ value: "Q4: Eliminar", position: 'bottom', fill: quadrantColors.delete, fontSize: 14, fontWeight: 'bold', dx: -40, dy: -10 }}
          />
          <ReferenceArea 
            x1={finalUrgencyThreshold} x2={X_MAX} y1={Y_MIN} y2={finalImportanceThreshold} 
            fill={quadrantBackgroundColors.delegate} stroke={quadrantColors.delegate} strokeOpacity={0.5} 
            label={{ value: "Q3: Delegar", position: 'bottom', fill: quadrantColors.delegate, fontSize: 14, fontWeight: 'bold', dx: 40, dy: -10 }}
          />

          <XAxis
            type="number"
            dataKey="urgency"
            name="Urgência"
            unit=""
            domain={[X_MIN, X_MAX]}
            label={{ value: `Urgência (Threshold: ${finalUrgencyThreshold.toFixed(0)})`, position: "bottom", offset: 0, fill: "#4b5563" }}
            className="text-sm text-gray-600"
          />
          <YAxis
            type="number"
            dataKey="importance"
            name="Importância"
            unit=""
            domain={[Y_MIN, Y_MAX]}
            label={{ value: `Importância (Threshold: ${finalImportanceThreshold.toFixed(0)})`, angle: -90, position: "left", fill: "#4b5563" }}
            className="text-sm text-gray-600"
          />
          <ZAxis dataKey="content" name="Tarefa" />
          <Tooltip cursor={{ strokeDasharray: "3 3" }} content={<CustomTooltip />} />

          <Scatter
            name="Tarefas"
            data={data}
            shape="circle"
            isAnimationActive={false}
            // onClick e onDoubleClick são tratados pelos componentes Scatter individuais no mapa
          >
            {data.map((entry, index) => (
              <Scatter
                key={`scatter-point-${index}`}
                data={[entry]}
                fill={getFillColor(entry)}
                onClick={handleSingleClick} // Anexar manipuladores de clique aqui
                onDoubleClick={handleDoubleClick} // Anexar manipuladores de duplo clique aqui
              />
            ))}
          </Scatter>
        </ScatterChart>
      </ResponsiveContainer>

      {/* SVG com linha diagonal em 45 graus VISUAIS (sobreposição) */}
      {chartDimensions.width > 0 && chartDimensions.height > 0 && (
        <svg
          ref={svgRef}
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: chartDimensions.width,
            height: chartDimensions.height,
            pointerEvents: 'none', // Por padrão, não captura eventos, permitindo cliques no gráfico
            zIndex: 1,
          }}
        >
          {/* Linha diagonal */}
          <line
            x1={diagonalLine.x1}
            y1={diagonalLine.y1}
            x2={diagonalLine.x2}
            y2={diagonalLine.y2}
            stroke="#000000"
            strokeWidth={2}
            strokeDasharray="5 5"
            pointerEvents="none" // A linha em si não é interativa
          />

          {/* Ponto de controle */}
          <circle
            cx={midX}
            cy={midY}
            r={8}
            fill="#FF6B6B"
            fillOpacity={0.8}
            cursor="grab"
            pointerEvents="all" // Este círculo deve capturar eventos
            onMouseDown={handleMouseDownOnCircle}
          />

          {/* Label */}
          <text
            x={midX + 15}
            y={midY - 10}
            fill="#000"
            fontSize="12"
            fontWeight="bold"
            pointerEvents="none"
          >
            U+I = {Math.round(diagonalOffset)}
          </text>
        </svg>
      )}
    </div>
  );
};

export default ScatterPlotMatrix;