"use client";

import React, { useMemo, useRef, useState } from "react";
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
  diagonalOffset?: number; // Nova prop para o offset da linha diagonal
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
  const padding = (maxVal - minVal) * 0.1;
  const domainMin = Math.max(0, minVal - padding);
  const domainMax = Math.min(100, maxVal + padding);

  // If minVal and maxVal are the same, create a small range around it
  if (domainMin === domainMax) {
    const adjustedMin = Math.max(0, domainMin - 5);
    const adjustedMax = Math.min(100, domainMax + 5);
    const domain: [number, number] = [adjustedMin, adjustedMax];
    const threshold = (adjustedMin + adjustedMax) / 2;
    return { domain, threshold };
  }

  const domain: [number, number] = [domainMin, domainMax];
  const threshold = (domainMin + domainMax) / 2; // Threshold is the midpoint of the dynamic domain
  return { domain, threshold };
};


const ScatterPlotMatrix: React.FC<ScatterPlotMatrixProps> = ({ data, manualThresholds, diagonalOffset = 114 }) => {
  const navigate = useNavigate();
  const clickTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // State to hold the actual dimensions of the ResponsiveContainer
  const [containerDimensions, setContainerDimensions] = useState({ width: 0, height: 0 });

  // 1. Calcular Domínios Dinâmicos e Thresholds no ponto médio
  const urgencyValues = data.map(d => d.urgency);
  const importanceValues = data.map(d => d.importance);

  const { domain: urgencyDomain, threshold: dynamicUrgencyThreshold } = useMemo(() => getDynamicDomainAndThreshold(urgencyValues), [urgencyValues]);
  const { domain: importanceDomain, threshold: dynamicImportanceThreshold } = useMemo(() => getDynamicDomainAndThreshold(importanceValues), [importanceValues]);

  // Usar os thresholds dinâmicos para desenhar as linhas divisórias
  const finalUrgencyThreshold = manualThresholds?.urgency ?? dynamicUrgencyThreshold;
  const finalImportanceThreshold = manualThresholds?.importance ?? dynamicImportanceThreshold;

  const handleSingleClick = (payload: any) => {
    if (clickTimer.current) {
      clearTimeout(clickTimer.current);
      clickTimer.current = null;
    }
    clickTimer.current = setTimeout(() => {
      console.log("Eisenhower Scatter Plot: Clique único! Payload:", payload);
      if (payload && payload.payload && payload.payload.id) {
        navigate(`/seiso/${payload.payload.id}`);
      } else {
        console.warn("Eisenhower Scatter Plot: Nenhum ID de tarefa encontrado no payload para o clique único:", payload);
      }
    }, 200); // Atraso de 200ms para detectar duplo clique
  };

  const handleDoubleClick = (payload: any) => {
    if (clickTimer.current) {
      clearTimeout(clickTimer.current);
      clickTimer.current = null;
    }
    console.log("Eisenhower Scatter Plot: Duplo clique! Payload:", payload);
    if (payload && payload.payload && payload.payload.url) {
      window.open(payload.payload.url, '_blank');
    } else {
      console.warn("Eisenhower Scatter Plot: Nenhuma URL encontrada no payload para o duplo clique:", payload);
    }
  };

  const getFillColor = (entry: ScatterPlotData) => {
    return entry.quadrant ? quadrantColors[entry.quadrant] : "#6b7280";
  };

  // Definir os limites do domínio para as ReferenceAreas
  const xMin = urgencyDomain[0];
  const xMax = urgencyDomain[1];
  const yMin = importanceDomain[0];
  const yMax = importanceDomain[1];

  // --- Dynamic calculation for the diagonal line ---
  // These margins should match the ScatterChart's internal margins
  const CHART_MARGIN = { top: 20, right: 20, bottom: 20, left: 20 }; // Default margins for Recharts ScatterChart

  // Calculate plot area dimensions
  const plotWidth = containerDimensions.width - CHART_MARGIN.left - CHART_MARGIN.right;
  const plotHeight = containerDimensions.height - CHART_MARGIN.top - CHART_MARGIN.bottom;

  // Calculate pixels per unit for X and Y axes
  const xPixelsPerUnit = plotWidth / (urgencyDomain[1] - urgencyDomain[0]);
  const yPixelsPerUnit = plotHeight / (importanceDomain[1] - importanceDomain[0]);

  // Points for the diagonal line: y = -x + diagonalOffset
  // We need to find two points on this line that are within the chart's data domain
  // and convert them to pixel coordinates.
  // Let's use the intersections with the chart's data boundaries.

  // Point 1: Intersection with the left data boundary (x = urgencyDomain[0])
  const x1_data = urgencyDomain[0];
  const y1_data = -x1_data + diagonalOffset;

  // Point 2: Intersection with the right data boundary (x = urgencyDomain[1])
  const x2_data = urgencyDomain[1];
  const y2_data = -x2_data + diagonalOffset;

  // Convert data coordinates to pixel coordinates
  const x1Pixel = CHART_MARGIN.left + (x1_data - urgencyDomain[0]) * xPixelsPerUnit;
  const y1Pixel = CHART_MARGIN.top + (importanceDomain[1] - y1_data) * yPixelsPerUnit; // Y-axis is inverted in SVG

  const x2Pixel = CHART_MARGIN.left + (x2_data - urgencyDomain[0]) * xPixelsPerUnit;
  const y2Pixel = CHART_MARGIN.top + (importanceDomain[1] - y2_data) * yPixelsPerUnit; // Y-axis is inverted in SVG

  return (
    <div
      className="w-full h-full"
      style={{ position: 'relative' }} // Ensure relative positioning for absolute SVG
    >
      {/* SVG with the diagonal line */}
      {containerDimensions.width > 0 && containerDimensions.height > 0 && (
        <svg
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            pointerEvents: 'none',
            zIndex: 1, // Ensure SVG is below Recharts elements if needed, or above for visibility
          }}
          viewBox={`0 0 ${containerDimensions.width} ${containerDimensions.height}`} // Set viewBox to match container
        >
          <line
            x1={x1Pixel}
            y1={y1Pixel}
            x2={x2Pixel}
            y2={y2Pixel}
            stroke="#000000"
            strokeWidth={2}
            strokeDasharray="5 5"
          />
        </svg>
      )}

      {/* Gráfico Scatter */}
      <ResponsiveContainer width="100%" height="100%" onResize={(width, height) => setContainerDimensions({ width, height })}>
        <ScatterChart
          margin={CHART_MARGIN} // Use the defined margin
        >
          <CartesianGrid strokeDasharray="3 3" className="stroke-gray-200" />
          
          {/* Linhas de Threshold Ortogonais (Móveis, no ponto médio do eixo visível) */}
          <ReferenceLine x={finalUrgencyThreshold} stroke="#4b5563" strokeDasharray="5 5" />
          <ReferenceLine y={finalImportanceThreshold} stroke="#4b5563" strokeDasharray="5 5" />

          {/* Áreas de Quadrante (Ajustam-se aos thresholds dinâmicos e domínios) */}
          <ReferenceArea 
            x1={finalUrgencyThreshold} x2={xMax} y1={finalImportanceThreshold} y2={yMax} 
            fill={quadrantBackgroundColors.do} stroke={quadrantColors.do} strokeOpacity={0.5} 
            label={{ value: "Q1: Fazer (Do)", position: 'top', fill: quadrantColors.do, fontSize: 14, fontWeight: 'bold', dx: 40, dy: 10 }}
          />
          <ReferenceArea 
            x1={xMin} x2={finalUrgencyThreshold} y1={finalImportanceThreshold} y2={yMax} 
            fill={quadrantBackgroundColors.decide} stroke={quadrantColors.decide} strokeOpacity={0.5} 
            label={{ value: "Q2: Decidir", position: 'top', fill: quadrantColors.decide, fontSize: 14, fontWeight: 'bold', dx: -40, dy: 10 }}
          />
          <ReferenceArea 
            x1={xMin} x2={finalUrgencyThreshold} y1={yMin} y2={finalImportanceThreshold} 
            fill={quadrantBackgroundColors.delete} stroke={quadrantColors.delete} strokeOpacity={0.5} 
            label={{ value: "Q4: Eliminar", position: 'bottom', fill: quadrantColors.delete, fontSize: 14, fontWeight: 'bold', dx: -40, dy: -10 }}
          />
          <ReferenceArea 
            x1={finalUrgencyThreshold} x2={xMax} y1={yMin} y2={finalImportanceThreshold} 
            fill={quadrantBackgroundColors.delegate} stroke={quadrantColors.delegate} strokeOpacity={0.5} 
            label={{ value: "Q3: Delegar", position: 'bottom', fill: quadrantColors.delegate, fontSize: 14, fontWeight: 'bold', dx: 40, dy: -10 }}
          />

          <XAxis
            type="number"
            dataKey="urgency"
            name="Urgência"
            unit=""
            domain={urgencyDomain}
            label={{ value: `Urgência (Threshold: ${finalUrgencyThreshold.toFixed(0)})`, position: "bottom", offset: 0, fill: "#4b5563" }}
            className="text-sm text-gray-600"
          />
          <YAxis
            type="number"
            dataKey="importance"
            name="Importância"
            unit=""
            domain={importanceDomain}
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
            onClick={handleSingleClick}
            onDoubleClick={handleDoubleClick}
          >
            {data.map((entry, index) => (
              <Scatter
                key={`scatter-point-${index}`}
                data={[entry]}
                fill={getFillColor(entry)}
              />
            ))}
          </Scatter>
        </ScatterChart>
      </ResponsiveContainer>
    </div>
  );
};

export default ScatterPlotMatrix;