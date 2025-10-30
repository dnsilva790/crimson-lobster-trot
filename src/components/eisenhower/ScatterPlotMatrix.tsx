"use client";

import React, { useMemo } from "react";
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

const CustomTooltip = ({ active, payload }: any) => {
  if (active && payload && payload.length) {
    const task = payload[0].payload;
    return (
      <div className="p-3 bg-white border border-gray-200 rounded-md shadow-lg text-sm">
        <p className="font-semibold text-gray-800">{task.content}</p>
        <p className="text-gray-600">Urgência: {task.urgency}</p>
        <p className="text-gray-600">Importância: {task.importance}</p>
        <p className="text-gray-600">Quadrante: {task.quadrant ? task.quadrant.charAt(0).toUpperCase() + task.quadrant.slice(1) : 'N/A'}</p>
        <p className="text-blue-500 mt-1">Clique para abrir no Todoist</p>
      </div>
    );
  }
  return null;
};

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

  const handlePointClick = (payload: any) => {
    console.log("Eisenhower Scatter Plot: Ponto clicado! Payload:", payload);
    if (payload && payload.payload && payload.payload.url) {
      console.log("Eisenhower Scatter Plot: Abrindo URL:", payload.payload.url);
      window.open(payload.payload.url, '_blank');
    } else {
      console.warn("Eisenhower Scatter Plot: Nenhuma URL encontrada no payload para o ponto clicado:", payload);
    }
  };

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
        <Tooltip cursor={{ strokeDasharray: "3 3" }} content={<CustomTooltip />} />

        <Scatter
          name="Tarefas"
          data={data}
          shape="circle"
          isAnimationActive={false}
          onClick={handlePointClick}
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
  );
};

export default ScatterPlotMatrix;