"use client";

import React from "react";
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
      </div>
    );
  }
  return null;
};

const ScatterPlotMatrix: React.FC<ScatterPlotMatrixProps> = ({ data }) => {
  // Threshold for quadrants (consistent with Eisenhower.tsx)
  const threshold = 50; // Alterado para 50 para centralizar a matriz
  
  // Forcing fixed domain [0, 100] for a true 2x2 matrix visualization
  const fixedDomain = [0, 100];

  return (
    <ResponsiveContainer width="100%" height={400}>
      <ScatterChart
        margin={{
          top: 20,
          right: 20,
          bottom: 20,
          left: 20,
        }}
      >
        <CartesianGrid strokeDasharray="3 3" className="stroke-gray-200" />
        
        {/* Linhas de Referência para o Threshold */}
        <ReferenceArea x1={threshold} x2={threshold} stroke="#4b5563" strokeDasharray="5 5" />
        <ReferenceArea y1={threshold} y2={threshold} stroke="#4b5563" strokeDasharray="5 5" />

        <XAxis
          type="number"
          dataKey="urgency"
          name="Urgência"
          unit=""
          domain={fixedDomain} // Eixo fixo de 0 a 100
          tickCount={11}
          label={{ value: "Urgência", position: "bottom", offset: 0, fill: "#4b5563" }}
          className="text-sm text-gray-600"
        />
        <YAxis
          type="number"
          dataKey="importance"
          name="Importância"
          unit=""
          domain={fixedDomain} // Eixo fixo de 0 a 100
          tickCount={11}
          label={{ value: "Importância", angle: -90, position: "left", fill: "#4b5563" }}
          className="text-sm text-gray-600"
        />
        <ZAxis dataKey="content" name="Tarefa" />
        <Tooltip cursor={{ strokeDasharray: "3 3" }} content={<CustomTooltip />} />

        {/* Quadrant Reference Areas with Labels */}
        
        {/* Q1: Do (Urgente [>=50] e Importante [>=50]) - Top Right */}
        <ReferenceArea 
          x1={threshold} x2={100} y1={threshold} y2={100} 
          fill={quadrantBackgroundColors.do} stroke={quadrantColors.do} strokeOpacity={0.5} 
          label={{ value: "Q1: Fazer (Do)", position: 'top', fill: quadrantColors.do, fontSize: 14, fontWeight: 'bold', dx: 40, dy: 10 }}
        />
        
        {/* Q2: Decide (Não Urgente [<50] e Importante [>=50]) - Top Left */}
        <ReferenceArea 
          x1={0} x2={threshold} y1={threshold} y2={100} 
          fill={quadrantBackgroundColors.decide} stroke={quadrantColors.decide} strokeOpacity={0.5} 
          label={{ value: "Q2: Decidir", position: 'top', fill: quadrantColors.decide, fontSize: 14, fontWeight: 'bold', dx: -40, dy: 10 }}
        />
        
        {/* Q3: Delegate (Urgente [>=50] e Não Importante [<50]) - Bottom Right */}
        <ReferenceArea 
          x1={threshold} x2={100} y1={0} y2={threshold} 
          fill={quadrantBackgroundColors.delegate} stroke={quadrantColors.delegate} strokeOpacity={0.5} 
          label={{ value: "Q3: Delegar", position: 'bottom', fill: quadrantColors.delegate, fontSize: 14, fontWeight: 'bold', dx: 40, dy: -10 }}
        />
        
        {/* Q4: Delete (Não Urgente [<50] e Não Importante [<50]) - Bottom Left */}
        <ReferenceArea 
          x1={0} x2={threshold} y1={0} y2={threshold} 
          fill={quadrantBackgroundColors.delete} stroke={quadrantColors.delete} strokeOpacity={0.5} 
          label={{ value: "Q4: Eliminar", position: 'bottom', fill: quadrantColors.delete, fontSize: 14, fontWeight: 'bold', dx: -40, dy: -10 }}
        />

        <Scatter
          name="Tarefas"
          data={data}
          shape="circle"
          isAnimationActive={false}
        >
          {data.map((entry, index) => (
            <Scatter
              key={`scatter-${index}`}
              data={[entry]}
              fill={entry.quadrant ? quadrantColors[entry.quadrant] : "#9ca3af"} // Default gray for unassigned
            />
          ))}
        </Scatter>
      </ScatterChart>
    </ResponsiveContainer>
  );
};

export default ScatterPlotMatrix;