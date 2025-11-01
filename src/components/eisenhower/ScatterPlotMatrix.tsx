"use client";

import React, { useMemo, useRef } from "react"; // Importar useRef
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
        <p className="text-purple-500">Duplo clique para planejar no SEISO</p>
      </div>
    );
  }
  return null;
};

const ScatterPlotMatrix: React.FC<ScatterPlotMatrixProps> = ({ data }) => {
  const navigate = useNavigate();
  const clickTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const { urgencyDomain, importanceDomain, urgencyThreshold, importanceThreshold } = useMemo(() => {
    const urgencyValues = data.map(d => d.urgency).filter(v => v !== null) as number[];
    const importanceValues = data.map(d => d.importance).filter(v => v !== null) as number[];

    // Helper para calcular o domínio dinâmico e o threshold (ponto médio)
    const getDynamicDomainAndThreshold = (values: number[]): { domain: [number, number], threshold: number } => {
      if (values.length === 0) {
        return { domain: [0, 100], threshold: 50 }; // Default se não houver dados
      }

      const minVal = Math.min(...values);
      const maxVal = Math.max(...values);

      // Se todos os valores forem iguais, cria uma pequena faixa ao redor
      if (minVal === maxVal) {
        const paddedMin = Math.max(0, minVal - 10);
        const paddedMax = Math.min(100, maxVal + 10);
        const domain: [number, number] = [paddedMin, paddedMax];
        const threshold = (domain[0] + domain[1]) / 2;
        return { domain, threshold };
      }

      // Adiciona 10% de padding à faixa, mas limita a 0-100
      const range = maxVal - minVal;
      const padding = range * 0.1; // 10% de padding

      const domainMin = Math.max(0, minVal - padding);
      const domainMax = Math.min(100, maxVal + padding);

      const domain: [number, number] = [domainMin, domainMax];
      const threshold = (domainMin + domainMax) / 2; // Ponto médio do eixo exibido
      return { domain, threshold };
    };

    const { domain: uDomain, threshold: uThreshold } = getDynamicDomainAndThreshold(urgencyValues);
    const { domain: iDomain, threshold: iThreshold } = getDynamicDomainAndThreshold(importanceValues);

    return { 
      urgencyDomain: uDomain, 
      importanceDomain: iDomain,
      urgencyThreshold: uThreshold,
      importanceThreshold: iThreshold,
    };
  }, [data]);

  const safeUrgencyThreshold = urgencyThreshold;
  const safeImportanceThreshold = importanceThreshold;
  const safeUrgencyDomain: [number, number] = urgencyDomain;
  const safeImportanceDomain: [number, number] = importanceDomain;

  const handleSingleClick = (payload: any) => {
    if (clickTimer.current) {
      clearTimeout(clickTimer.current);
      clickTimer.current = null;
    }
    clickTimer.current = setTimeout(() => {
      console.log("Eisenhower Scatter Plot: Clique único! Payload:", payload);
      if (payload && payload.payload && payload.payload.url) {
        window.open(payload.payload.url, '_blank');
      } else {
        console.warn("Eisenhower Scatter Plot: Nenhuma URL encontrada no payload para o clique único:", payload);
      }
    }, 200); // Atraso de 200ms para detectar duplo clique
  };

  const handleDoubleClick = (payload: any) => {
    if (clickTimer.current) {
      clearTimeout(clickTimer.current);
      clickTimer.current = null;
    }
    console.log("Eisenhower Scatter Plot: Duplo clique! Payload:", payload);
    if (payload && payload.payload && payload.payload.id) {
      const taskId = payload.payload.id;
      navigate(`/seiso/${taskId}`);
    } else {
      console.warn("Eisenhower Scatter Plot: Nenhum ID de tarefa encontrado no payload para o duplo clique:", payload);
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
        
        {/* Linhas de Threshold Dinâmicas */}
        <ReferenceArea x1={safeUrgencyThreshold} x2={safeUrgencyThreshold} stroke="#4b5563" strokeDasharray="5 5" />
        <ReferenceArea y1={safeImportanceThreshold} y2={safeImportanceThreshold} stroke="#4b5563" strokeDasharray="5 5" />

        <XAxis
          type="number"
          dataKey="urgency"
          name="Urgência"
          unit=""
          domain={safeUrgencyDomain}
          label={{ value: `Urgência (Threshold: ${safeUrgencyThreshold.toFixed(0)})`, position: "bottom", offset: 0, fill: "#4b5563" }}
          className="text-sm text-gray-600"
        />
        <YAxis
          type="number"
          dataKey="importance"
          name="Importância"
          unit=""
          domain={safeImportanceDomain}
          label={{ value: `Importância (Threshold: ${safeImportanceThreshold.toFixed(0)})`, angle: -90, position: "left", fill: "#4b5563" }}
          className="text-sm text-gray-600"
        />
        <ZAxis dataKey="content" name="Tarefa" />
        <Tooltip cursor={{ strokeDasharray: "3 3" }} content={<CustomTooltip />} />

        {/* Áreas de Quadrante */}
        <ReferenceArea 
          x1={safeUrgencyThreshold} x2={safeUrgencyDomain[1]} y1={safeImportanceThreshold} y2={safeImportanceDomain[1]} 
          fill={quadrantBackgroundColors.do} stroke={quadrantColors.do} strokeOpacity={0.5} 
          label={{ value: "Q1: Fazer (Do)", position: 'top', fill: quadrantColors.do, fontSize: 14, fontWeight: 'bold', dx: 40, dy: 10 }}
        />
        <ReferenceArea 
          x1={safeUrgencyDomain[0]} x2={safeUrgencyThreshold} y1={safeImportanceThreshold} y2={safeImportanceDomain[1]} 
          fill={quadrantBackgroundColors.decide} stroke={quadrantColors.decide} strokeOpacity={0.5} 
          label={{ value: "Q2: Decidir", position: 'top', fill: quadrantColors.decide, fontSize: 14, fontWeight: 'bold', dx: -40, dy: 10 }}
        />
        <ReferenceArea 
          x1={safeUrgencyThreshold} x2={safeUrgencyDomain[1]} y1={safeImportanceDomain[0]} y2={safeImportanceThreshold} 
          fill={quadrantBackgroundColors.delegate} stroke={quadrantColors.delegate} strokeOpacity={0.5} 
          label={{ value: "Q3: Delegar", position: 'bottom', fill: quadrantColors.delegate, fontSize: 14, fontWeight: 'bold', dx: 40, dy: -10 }}
        />
        <ReferenceArea 
          x1={safeUrgencyDomain[0]} x2={safeUrgencyThreshold} y1={safeImportanceDomain[0]} y2={safeImportanceThreshold} 
          fill={quadrantBackgroundColors.delete} stroke={quadrantColors.delete} strokeOpacity={0.5} 
          label={{ value: "Q4: Eliminar", position: 'bottom', fill: quadrantColors.delete, fontSize: 14, fontWeight: 'bold', dx: -40, dy: -10 }}
        />

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
  );
};

export default ScatterPlotMatrix;