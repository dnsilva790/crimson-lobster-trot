"use client";

import React, { useMemo, useState, useEffect, useCallback } from "react";
import {
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  CartesianGrid,
  ResponsiveContainer,
  ZAxis,
  ReferenceArea,
} from "recharts";
import { Quadrant } from "@/lib/types";

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
}

const quadrantColors: Record<Quadrant, string> = {
  do: "#ef4444", // red-500 (Urgente e Importante)
  decide: "#22c55e", // green-500 (Não Urgente e Importante)
  delegate: "#eab308", // yellow-500 (Urgente e Não Importante)
  delete: "#6b7280", // gray-500 (Não Urgente e Não Importante)
};

const quadrantBackgroundColors: Record<Quadrant, string> = {
  do: "rgba(239, 68, 68, 0.1)", // red-100 with transparency
  decide: "rgba(34, 197, 94, 0.1)", // green-100 with transparency
  delegate: "rgba(234, 179, 8, 0.1)", // yellow-100 with transparency
  delete: "rgba(107, 114, 128, 0.1)", // gray-100 with transparency
};

// Função auxiliar para calcular a mediana
const calculateMedian = (values: number[]): number => {
  if (values.length === 0) return 50;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  
  if (sorted.length % 2 === 0) {
    return (sorted[mid - 1] + sorted[mid]) / 2;
  }
  return sorted[mid];
};

const ScatterPlotMatrix: React.FC<ScatterPlotMatrixProps> = ({ data }) => {
  const [fixedTooltip, setFixedTooltip] = useState<{
    task: ScatterPlotData;
    x: number;
    y: number;
  } | null>(null);

  // 1. Calcular domínios dinâmicos e thresholds (mediana)
  const { urgencyDomain, importanceDomain, urgencyThreshold, importanceThreshold } = useMemo(() => {
    if (data.length === 0) {
      return { urgencyDomain: [0, 100], importanceDomain: [0, 100], urgencyThreshold: 50, importanceThreshold: 50 };
    }

    const urgencyValues = data.map(d => d.urgency);
    const importanceValues = data.map(d => d.importance);

    const minU = Math.min(...urgencyValues);
    const maxU = Math.max(...urgencyValues);
    const minI = Math.min(...importanceValues);
    const maxI = Math.max(...importanceValues);

    const uThreshold = calculateMedian(urgencyValues);
    const iThreshold = calculateMedian(importanceValues);

    const getDomain = (min: number, max: number, threshold: number): [number, number] => {
      let dMin = Math.max(0, min - 5);
      let dMax = Math.min(100, max + 5);
      
      dMin = Math.min(dMin, threshold);
      dMax = Math.max(dMax, threshold);

      if (dMax - dMin < 10) {
        const center = (dMin + dMax) / 2;
        dMin = Math.max(0, center - 5);
        dMax = Math.min(100, center + 5);
      }
      return [dMin, dMax];
    };

    return { 
      urgencyDomain: getDomain(minU, maxU, uThreshold), 
      importanceDomain: getDomain(minI, maxI, iThreshold),
      urgencyThreshold: uThreshold,
      importanceThreshold: iThreshold,
    };

  }, [data]);

  const finalUrgencyDomain = urgencyDomain;
  const finalImportanceDomain = importanceDomain;

  const handlePointClick = useCallback((payload: any, event: React.MouseEvent) => {
    if (payload && payload.payload) {
      const clickedTask = payload.payload;
      const { clientX, clientY } = event;

      if (fixedTooltip?.task.id === clickedTask.id) {
        setFixedTooltip(null); // Toggle off if same task clicked
      } else {
        setFixedTooltip({ task: clickedTask, x: clientX, y: clientY });
      }
    }
  }, [fixedTooltip]);

  const handleOutsideClick = useCallback((event: MouseEvent) => {
    // Check if the click is outside the tooltip itself
    const tooltipElement = document.getElementById('fixed-eisenhower-tooltip');
    if (tooltipElement && !tooltipElement.contains(event.target as Node)) {
      setFixedTooltip(null);
    }
  }, []);

  useEffect(() => {
    document.addEventListener('mousedown', handleOutsideClick);
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
    };
  }, [handleOutsideClick]);

  // Função para determinar a cor de preenchimento de cada ponto
  const getFillColor = (entry: ScatterPlotData) => {
    return entry.quadrant ? quadrantColors[entry.quadrant] : "#9ca3af";
  };

  return (
    <ResponsiveContainer width="100%" height="100%">
      <ScatterChart
        margin={{
          top: 20,
          right: 20,
          bottom: 20,
          left: 20,
        }}
      >
        <CartesianGrid strokeDasharray="3 3" className="stroke-gray-200" />
        
        <ReferenceArea x1={urgencyThreshold} x2={urgencyThreshold} stroke="#4b5563" strokeDasharray="5 5" />
        <ReferenceArea y1={importanceThreshold} y2={importanceThreshold} stroke="#4b5563" strokeDasharray="5 5" />

        <XAxis
          type="number"
          dataKey="urgency"
          name="Urgência"
          unit=""
          domain={finalUrgencyDomain}
          label={{ value: `Urgência (Threshold: ${urgencyThreshold.toFixed(0)})`, position: "bottom", offset: 0, fill: "#4b5563" }}
          className="text-sm text-gray-600"
        />
        <YAxis
          type="number"
          dataKey="importance"
          name="Importância"
          unit=""
          domain={finalImportanceDomain}
          label={{ value: `Importância (Threshold: ${importanceThreshold.toFixed(0)})`, angle: -90, position: "left", fill: "#4b5563" }}
          className="text-sm text-gray-600"
        />
        <ZAxis dataKey="content" name="Tarefa" />
        {/* Removido o Tooltip padrão do Recharts */}

        {/* Quadrant Reference Areas com Thresholds Dinâmicos */}
        <ReferenceArea 
          x1={urgencyThreshold} x2={finalUrgencyDomain[1]} y1={importanceThreshold} y2={finalImportanceDomain[1]} 
          fill={quadrantBackgroundColors.do} stroke={quadrantColors.do} strokeOpacity={0.5} 
          label={{ value: "Q1: Fazer (Do)", position: 'top', fill: quadrantColors.do, fontSize: 14, fontWeight: 'bold', dx: 40, dy: 10 }}
        />
        <ReferenceArea 
          x1={finalUrgencyDomain[0]} x2={urgencyThreshold} y1={importanceThreshold} y2={finalImportanceDomain[1]} 
          fill={quadrantBackgroundColors.decide} stroke={quadrantColors.decide} strokeOpacity={0.5} 
          label={{ value: "Q2: Decidir", position: 'top', fill: quadrantColors.decide, fontSize: 14, fontWeight: 'bold', dx: -40, dy: 10 }}
        />
        <ReferenceArea 
          x1={urgencyThreshold} x2={finalUrgencyDomain[1]} y1={finalImportanceDomain[0]} y2={importanceThreshold} 
          fill={quadrantBackgroundColors.delegate} stroke={quadrantColors.delegate} strokeOpacity={0.5} 
          label={{ value: "Q3: Delegar", position: 'bottom', fill: quadrantColors.delegate, fontSize: 14, fontWeight: 'bold', dx: 40, dy: -10 }}
        />
        <ReferenceArea 
          x1={finalUrgencyDomain[0]} x2={urgencyThreshold} y1={finalImportanceDomain[0]} y2={importanceThreshold} 
          fill={quadrantBackgroundColors.delete} stroke={quadrantColors.delete} strokeOpacity={0.5} 
          label={{ value: "Q4: Eliminar", position: 'bottom', fill: quadrantColors.delete, fontSize: 14, fontWeight: 'bold', dx: -40, dy: -10 }}
        />

        <Scatter
          name="Tarefas"
          data={data}
          shape="circle"
          isAnimationActive={false}
          onClick={handlePointClick}
          fill={getFillColor(data[0])} // Cor padrão, será sobrescrita por fill individual
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

      {fixedTooltip && (
        <div
          id="fixed-eisenhower-tooltip"
          className="absolute z-50 p-3 bg-white border border-gray-300 rounded-md shadow-xl text-sm max-w-xs"
          style={{ left: fixedTooltip.x + 10, top: fixedTooltip.y + 10 }}
          onClick={(e) => e.stopPropagation()} // Prevent closing when clicking inside tooltip
        >
          <p className="font-semibold text-gray-800">{fixedTooltip.task.content}</p>
          <p className="text-gray-600">Urgência: {fixedTooltip.task.urgency}</p>
          <p className="text-gray-600">Importância: {fixedTooltip.task.importance}</p>
          <p className="text-gray-600">Quadrante: {fixedTooltip.task.quadrant ? fixedTooltip.task.quadrant.charAt(0).toUpperCase() + fixedTooltip.task.quadrant.slice(1) : 'N/A'}</p>
          <a
            href={fixedTooltip.task.url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-600 hover:underline mt-2 block"
            onClick={() => setFixedTooltip(null)} // Close tooltip when link is clicked
          >
            Abrir no Todoist
          </a>
        </div>
      )}
    </ResponsiveContainer>
  );
};

export default ScatterPlotMatrix;