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
  manualThresholds: ManualThresholds | null; // Mantemos o prop, mas o usamos apenas para o rótulo
  diagonalOffset: number; // NOVO: Um único ponto de deslocamento
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

// Helper function to calculate dynamic domain and threshold (reintroduzida)
const getDynamicDomainAndThreshold = (values: number[]): { domain: [number, number], threshold: number } => {
  if (values.length === 0) {
    return { domain: [0, 100], threshold: 50 };
  }

  const minVal = Math.min(...values);
  const maxVal = Math.max(...values);

  if (minVal === maxVal) {
    const paddedMin = Math.max(0, minVal - 10);
    const paddedMax = Math.min(100, maxVal + 10);
    const domain: [number, number] = [paddedMin, paddedMax];
    const threshold = (domain[0] + domain[1]) / 2;
    return { domain, threshold };
  }

  const range = maxVal - minVal;
  const padding = range * 0.1;

  const domainMin = Math.max(0, minVal - padding);
  const domainMax = Math.min(100, maxVal + padding);

  const domain: [number, number] = [domainMin, domainMax];
  const threshold = (domain[0] + domain[1]) / 2;
  return { domain, threshold };
};


const ScatterPlotMatrix: React.FC<ScatterPlotMatrixProps> = ({ data, manualThresholds, diagonalOffset }) => { // NOVO: diagonalOffset
  const navigate = useNavigate();
  const clickTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // 1. Calcular Domínios Dinâmicos e Thresholds no ponto médio
  const urgencyValues = data.map(d => d.urgency);
  const importanceValues = data.map(d => d.importance);

  const { domain: urgencyDomain, threshold: dynamicUrgencyThreshold } = useMemo(() => getDynamicDomainAndThreshold(urgencyValues), [urgencyValues]);
  const { domain: importanceDomain, threshold: dynamicImportanceThreshold } = useMemo(() => getDynamicDomainAndThreshold(importanceValues), [importanceValues]);

  // Usar os thresholds dinâmicos para desenhar as linhas divisórias
  const finalUrgencyThreshold = dynamicUrgencyThreshold;
  const finalImportanceThreshold = dynamicImportanceThreshold;

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

  // Definir os limites do domínio para as ReferenceAreas (ainda usam os limites dinâmicos para as áreas de fundo)
  // No entanto, para as ReferenceAreas, precisamos que elas se estendam até os limites fixos [0,100]
  // para cobrir todo o gráfico.
  const xMin = 0; // Usar 0 para a área de referência
  const xMax = 100; // Usar 100 para a área de referência
  const yMin = 0; // Usar 0 para a área de referência
  const yMax = 100; // Usar 100 para a área de referência

  return (
    <div 
      className="w-full h-full" 
    >
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
          
          {/* Linhas de Threshold Ortogonais (Móveis, no ponto médio do eixo visível) */}
          <ReferenceLine x={finalUrgencyThreshold} stroke="#4b5563" strokeDasharray="5 5" />
          <ReferenceLine y={finalImportanceThreshold} stroke="#4b5563" strokeDasharray="5 5" />

          {/* Áreas de Quadrante (Ajustam-se aos thresholds dinâmicos) */}
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
            domain={urgencyDomain} // Revertido para domínio dinâmico
            label={{ value: `Urgência (Threshold: ${finalUrgencyThreshold.toFixed(0)})`, position: "bottom", offset: 0, fill: "#4b5563" }}
            className="text-sm text-gray-600"
          />
          <YAxis
            type="number"
            dataKey="importance"
            name="Importância"
            unit=""
            domain={importanceDomain} // Revertido para domínio dinâmico
            label={{ value: `Importância (Threshold: ${finalImportanceThreshold.toFixed(0)})`, angle: -90, position: "left", fill: "#4b5563" }}
            className="text-sm text-gray-600"
          />
          <ZAxis dataKey="content" name="Tarefa" />
          <Tooltip cursor={{ strokeDasharray: "3 3" }} content={<CustomTooltip />} />

          {/* Linha Diagonal Dinâmica REMOVIDA */}

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