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
  ReferenceArea, // Importar ReferenceArea
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
  // Calculate dynamic domain for axes
  const allUrgencies = data.map(d => d.urgency);
  const allImportances = data.map(d => d.importance);

  const minUrgency = Math.min(0, ...allUrgencies);
  const maxUrgency = Math.max(100, ...allUrgencies);
  const minImportance = Math.min(0, ...allImportances);
  const maxImportance = Math.max(100, ...allImportances);

  // Add some padding to the domain
  const urgencyDomain = [Math.max(0, minUrgency - 5), Math.min(100, maxUrgency + 5)];
  const importanceDomain = [Math.max(0, minImportance - 5), Math.min(100, maxImportance + 5)];

  // Threshold for quadrants (consistent with Eisenhower.tsx)
  const threshold = 70;

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
        <XAxis
          type="number"
          dataKey="urgency"
          name="Urgência"
          unit=""
          domain={urgencyDomain} // Dynamic domain
          tickCount={11} // For 0-100 scale, 11 ticks (0, 10, ..., 100)
          label={{ value: "Urgência", position: "bottom", offset: 0, fill: "#4b5563" }}
          className="text-sm text-gray-600"
        />
        <YAxis
          type="number"
          dataKey="importance"
          name="Importância"
          unit=""
          domain={importanceDomain} // Dynamic domain
          tickCount={11} // For 0-100 scale, 11 ticks (0, 10, ..., 100)
          label={{ value: "Importância", angle: -90, position: "left", fill: "#4b5563" }}
          className="text-sm text-gray-600"
        />
        <ZAxis dataKey="content" name="Tarefa" />
        <Tooltip cursor={{ strokeDasharray: "3 3" }} content={<CustomTooltip />} />

        {/* Quadrant Reference Areas */}
        {/* Do: Urgente (>=70) e Importante (>=70) */}
        <ReferenceArea x1={threshold} x2={100} y1={threshold} y2={100} fill={quadrantBackgroundColors.do} stroke={quadrantColors.do} strokeOpacity={0.5} />
        {/* Decide: Não Urgente (<70) e Importante (>=70) */}
        <ReferenceArea x1={0} x2={threshold} y1={threshold} y2={100} fill={quadrantBackgroundColors.decide} stroke={quadrantColors.decide} strokeOpacity={0.5} />
        {/* Delegate: Urgente (>=70) e Não Importante (<70) */}
        <ReferenceArea x1={threshold} x2={100} y1={0} y2={threshold} fill={quadrantBackgroundColors.delegate} stroke={quadrantColors.delegate} strokeOpacity={0.5} />
        {/* Delete: Não Urgente (<70) e Não Importante (<70) */}
        <ReferenceArea x1={0} x2={threshold} y1={0} y2={threshold} fill={quadrantBackgroundColors.delete} stroke={quadrantColors.delete} strokeOpacity={0.5} />

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