"use client";

import React from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface DailyCompletionData {
  date: string;
  completedTasks: number;
}

interface TaskCompletionChartProps {
  data: DailyCompletionData[];
}

const TaskCompletionChart: React.FC<TaskCompletionChartProps> = ({ data }) => {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-xl font-bold text-gray-800">
          Tarefas Concluídas por Dia
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={300}>
          <LineChart
            data={data}
            margin={{
              top: 5,
              right: 30,
              left: 20,
              bottom: 5,
            }}
          >
            <CartesianGrid strokeDasharray="3 3" className="stroke-gray-200" />
            <XAxis
              dataKey="date"
              tickFormatter={(value) =>
                format(new Date(value), "dd/MM", { locale: ptBR })
              }
              className="text-sm text-gray-600"
            />
            <YAxis className="text-sm text-gray-600" />
            <Tooltip
              labelFormatter={(label) =>
                format(new Date(label), "dd/MM/yyyy", { locale: ptBR })
              }
              formatter={(value: number) => [`${value} tarefas`, "Concluídas"]}
              wrapperClassName="rounded-md shadow-md border border-gray-200 bg-white p-2 text-sm"
            />
            <Line
              type="monotone"
              dataKey="completedTasks"
              stroke="#8884d8"
              activeDot={{ r: 8 }}
              strokeWidth={2}
            />
          </LineChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
};

export default TaskCompletionChart;