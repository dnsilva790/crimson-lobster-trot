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
  const threshold = 50;

  // 1. Calcular domínios dinâmicos
  const { urgencyDomain, importanceDomain } = useMemo(() => {
    if (data.length === 0) {
      return { urgencyDomain: [0, 100], importanceDomain: [0, 100] };
    }

    const minU = Math.min(...data.map(d => d.urgency));
    const maxU = Math.max(...data.map(d => d.urgency));
    const minI = Math.min(...data.map(d => d.importance));
    const maxI = Math.max(...data.map(d => d.importance));

    // Garantir que o domínio sempre inclua 0 e 100, e o threshold de 50,
    // mas se ajustando aos dados.
    const finalMinU = Math.min(0, minU - 5);
    const finalMaxU = Math.max(100, maxU + 5);
    const finalMinI = Math.min(0, minI - 5);
    const finalMaxI = Math.max(100, maxI + 5);

    // Se o usuário realmente quer um eixo dinâmico, ajustamos para os dados,
    // mas garantimos que o 0 e 100 sejam os limites absolutos.
    const dynamicMinU = Math.max(0, minU - 5);
    const dynamicMaxU = Math.min(100, maxU + 5);
    const dynamicMinI = Math.max(0, minI - 5);
    const dynamicMaxI = Math.min(100, maxI + 5);

    // Usamos o domínio que se ajusta aos dados, mas garantimos que o 50 esteja visível
    // se os dados estiverem próximos a ele.
    const uDomain: [number, number] = [
      Math.min(dynamicMinU, threshold),
      Math.max(dynamicMaxU, threshold)
    ];
    const iDomain: [number, number] = [
      Math.min(dynamicMinI, threshold),
      Math.max(dynamicMaxI, threshold)
    ];

    // Se o domínio for muito estreito, forçamos um buffer mínimo de 10
    if (uDomain[1] - uDomain[0] < 10) {
      uDomain[0] = Math.max(0, uDomain[0] - 5);
      uDomain[1] = Math.min(100, uDomain[1] + 5);
    }
    if (iDomain[1] - iDomain[0] < 10) {
      iDomain[0] = Math.max(0, iDomain[0] - 5);
      iDomain[1] = Math.min(100, iDomain[1] + 5);
    }

    // Se o domínio dinâmico não incluir 0 ou 100, forçamos a inclusão se os dados estiverem próximos
    // Para simplificar e garantir que a matriz seja sempre visualmente completa (0-100),
    // vamos usar a abordagem de 'dataMin' e 'dataMax' do Recharts, mas com limites absolutos de 0 e 100.
    // No entanto, para que o Recharts calcule o domínio dinamicamente, passamos 'auto' ou 'dataMin'/'dataMax'.
    // Para manter a Matriz de Eisenhower funcional, vamos usar [0, 100] como limites absolutos,
    // mas permitindo que o Recharts ajuste o zoom se os dados estiverem muito concentrados.
    
    // Para um eixo dinâmico que respeite 0 e 100 como limites absolutos:
    return { 
      urgencyDomain: [Math.max(0, minU - 5), Math.min(100, maxU + 5)], 
      importanceDomain: [Math.max(0, minI - 5), Math.min(100, maxI + 5)] 
    };

  }, [data]);

  // Função para garantir que o domínio não seja invertido e tenha um buffer mínimo
  const getSafeDomain = (domain: [number, number]): [number, number] => {
    let [min, max] = domain;
    if (min > max) [min, max] = [max, min];
    if (max - min < 10) {
      const center = (min + max) / 2;
      min = Math.max(0, center - 5);
      max = Math.min(100, center + 5);
    }
    return [min, max];
  };

  const finalUrgencyDomain = getSafeDomain(urgencyDomain);
  const finalImportanceDomain = getSafeDomain(importanceDomain);

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
        
        {/* Linhas de Referência para o Threshold */}
        <ReferenceArea x1={threshold} x2={threshold} stroke="#4b5563" strokeDasharray="5 5" />
        <ReferenceArea y1={threshold} y2={threshold} stroke="#4b5563" strokeDasharray="5 5" />

        <XAxis
          type="number"
          dataKey="urgency"
          name="Urgência"
          unit=""
          domain={finalUrgencyDomain} // Domínio dinâmico
          label={{ value: "Urgência", position: "bottom", offset: 0, fill: "#4b5563" }}
          className="text-sm text-gray-600"
        />
        <YAxis
          type="number"
          dataKey="importance"
          name="Importância"
          unit=""
          domain={finalImportanceDomain} // Domínio dinâmico
          label={{ value: "Importância", angle: -90, position: "left", fill: "#4b5563" }}
          className="text-sm text-gray-600"
        />
        <ZAxis dataKey="content" name="Tarefa" />
        <Tooltip cursor={{ strokeDasharray: "3 3" }} content={<CustomTooltip />} />

        {/* Quadrant Reference Areas with Labels */}
        
        {/* Q1: Do (Urgente [>=50] e Importante [>=50]) - Top Right */}
        <ReferenceArea 
          x1={threshold} x2={finalUrgencyDomain[1]} y1={threshold} y2={finalImportanceDomain[1]} 
          fill={quadrantBackgroundColors.do} stroke={quadrantColors.do} strokeOpacity={0.5} 
          label={{ value: "Q1: Fazer (Do)", position: 'top', fill: quadrantColors.do, fontSize: 14, fontWeight: 'bold', dx: 40, dy: 10 }}
        />
        
        {/* Q2: Decide (Não Urgente [<50] e Importante [>=50]) - Top Left */}
        <ReferenceArea 
          x1={finalUrgencyDomain[0]} x2={threshold} y1={threshold} y2={finalImportanceDomain[1]} 
          fill={quadrantBackgroundColors.decide} stroke={quadrantColors.decide} strokeOpacity={0.5} 
          label={{ value: "Q2: Decidir", position: 'top', fill: quadrantColors.decide, fontSize: 14, fontWeight: 'bold', dx: -40, dy: 10 }}
        />
        
        {/* Q3: Delegate (Urgente [>=50] e Não Importante [<50]) - Bottom Right */}
        <ReferenceArea 
          x1={threshold} x2={finalUrgencyDomain[1]} y1={finalImportanceDomain[0]} y2={threshold} 
          fill={quadrantBackgroundColors.delegate} stroke={quadrantColors.delegate} strokeOpacity={0.5} 
          label={{ value: "Q3: Delegar", position: 'bottom', fill: quadrantColors.delegate, fontSize: 14, fontWeight: 'bold', dx: 40, dy: -10 }}
        />
        
        {/* Q4: Delete (Não Urgente [<50] e Não Importante [<50]) - Bottom Left */}
        <ReferenceArea 
          x1={finalUrgencyDomain[0]} x2={threshold} y1={finalImportanceDomain[0]} y2={threshold} 
          fill={quadrantBackgroundColors.delete} stroke={quadrantColors.delete} strokeOpacity={0.5} 
          label={{ value: "Q4: Eliminar", position: 'bottom', fill: quadrantBackgroundColors.delete, fontSize: 14, fontWeight: 'bold', dx: -40, dy: -10 }}
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