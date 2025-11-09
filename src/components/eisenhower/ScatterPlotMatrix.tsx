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
  diagonalOffset?: number; // NEW: diagonalOffset prop
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


const ScatterPlotMatrix: React.FC<ScatterPlotMatrixProps> = ({ data, manualThresholds, diagonalOffset = 114 }) => { // Default value for safety
  const navigate = useNavigate();
  const clickTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [containerDimensions, setContainerDimensions] = useState({ width: 0, height: 0 });

  const urgencyValues = data.map(d => d.urgency);
  const importanceValues = data.map(d => d.importance);

  const { domain: urgencyDomain, threshold: dynamicUrgencyThreshold } = useMemo(() => getDynamicDomainAndThreshold(urgencyValues), [urgencyValues]);
  const { domain: importanceDomain, threshold: dynamicImportanceThreshold } = useMemo(() => getDynamicDomainAndThreshold(importanceValues), [importanceValues]);

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
    }, 200);
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

  const xMin = urgencyDomain[0];
  const xMax = urgencyDomain[1];
  const yMin = importanceDomain[0];
  const yMax = importanceDomain[1];

  const CHART_MARGIN = { top: 20, right: 20, bottom: 20, left: 20 };

  // Calculate plot area dimensions
  const plotWidth = containerDimensions.width - CHART_MARGIN.left - CHART_MARGIN.right;
  const plotHeight = containerDimensions.height - CHART_MARGIN.top - CHART_MARGIN.bottom;

  // Calculate pixels per unit for X and Y axes
  const xPixelsPerUnit = plotWidth / (xMax - xMin);
  const yPixelsPerUnit = plotHeight / (yMax - yMin);

  // Calculate points for the diagonal line (y = -x + diagonalOffset)
  // We need to find the intersection points with the chart's data boundaries.
  // Start with points on the line and then clip them to the domain.

  let linePoints: { x: number; y: number }[] = [];

  // Intersection with x = xMin
  let yAtXMin = -xMin + diagonalOffset;
  if (yAtXMin >= yMin && yAtXMin <= yMax) {
    linePoints.push({ x: xMin, y: yAtXMin });
  }

  // Intersection with x = xMax
  let yAtXMax = -xMax + diagonalOffset;
  if (yAtXMax >= yMin && yAtXMax <= yMax) {
    linePoints.push({ x: xMax, y: yAtXMax });
  }

  // Intersection with y = yMin
  let xAtYMin = diagonalOffset - yMin;
  if (xAtYMin >= xMin && xAtYMin <= xMax) {
    linePoints.push({ x: xAtYMin, y: yMin });
  }

  // Intersection with y = yMax
  let xAtYMax = diagonalOffset - yMax;
  if (xAtYMax >= xMin && xAtYMax <= xMax) {
    linePoints.push({ x: xAtYMax, y: yMax });
  }

  // Remove duplicate points and sort them to ensure correct line drawing
  const uniqueLinePoints = Array.from(new Set(linePoints.map(p => `${p.x},${p.y}`)))
    .map(s => {
      const [x, y] = s.split(',').map(Number);
      return { x, y };
    })
    .sort((a, b) => a.x - b.x); // Sort by x-coordinate

  // Convert data coordinates to pixel coordinates
  const pixelPoints = uniqueLinePoints.map(p => ({
    x: CHART_MARGIN.left + (p.x - xMin) * xPixelsPerUnit,
    y: CHART_MARGIN.top + (yMax - p.y) * yPixelsPerUnit, // Y-axis is inverted in SVG
  }));

  return (
    <div
      className="w-full h-full"
      style={{ position: 'relative' }}
    >
      {/* SVG with the diagonal line */}
      {containerDimensions.width > 0 && containerDimensions.height > 0 && pixelPoints.length >= 2 && (
        <svg
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            pointerEvents: 'none',
            zIndex: 1,
          }}
          viewBox={`0 0 ${containerDimensions.width} ${containerDimensions.height}`}
        >
          <line
            x1={pixelPoints[0].x}
            y1={pixelPoints[0].y}
            x2={pixelPoints[1].x}
            y2={pixelPoints[1].y}
            stroke="#000000"
            strokeWidth={2}
            strokeDasharray="5 5"
          />
        </svg>
      )}

      {/* Gráfico Scatter */}
      <ResponsiveContainer width="100%" height="100%" onResize={(width, height) => setContainerDimensions({ width, height })}>
        <ScatterChart
          margin={CHART_MARGIN}
        >
          <CartesianGrid strokeDasharray="3 3" className="stroke-gray-200" />
          
          <ReferenceLine x={finalUrgencyThreshold} stroke="#4b5563" strokeDasharray="5 5" />
          <ReferenceLine y={finalImportanceThreshold} stroke="#4b5563" strokeDasharray="5 5" />

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