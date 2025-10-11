"use client";

import React, { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { useTodoist } from "@/context/TodoistContext";
import { TodoistTask } from "@/lib/types";
import LoadingSpinner from "@/components/ui/loading-spinner";
import { toast } from "sonner";
import TaskCompletionChart from "@/components/TaskCompletionChart";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { format, subDays, parseISO, isValid } from "date-fns";

interface DailyCompletionData {
  date: string;
  completedTasks: number;
}

const Seiso = () => {
  const { fetchTasks, isLoading } = useTodoist();
  const [completedTasksData, setCompletedTasksData] = useState<DailyCompletionData[]>([]);
  const [totalCompletedToday, setTotalCompletedToday] = useState<number>(0);
  const [totalCompletedLast7Days, setTotalCompletedLast7Days] = useState<number>(0);
  const [seisoState, setSeisoState] = useState<"initial" | "loading" | "loaded" | "empty">("initial");

  const analyzeTaskCompletion = useCallback((tasks: TodoistTask[]) => {
    const today = new Date();
    const sevenDaysAgo = subDays(today, 6);

    const dummyData: DailyCompletionData[] = [];
    for (let i = 6; i >= 0; i--) {
      const date = subDays(today, i);
      dummyData.push({
        date: format(date, "yyyy-MM-dd"),
        completedTasks: Math.floor(Math.random() * 10) + 1,
      });
    }

    setCompletedTasksData(dummyData);
    setTotalCompletedToday(dummyData[dummyData.length - 1]?.completedTasks || 0);
    setTotalCompletedLast7Days(dummyData.reduce((sum, day) => sum + day.completedTasks, 0));
    setSeisoState("loaded");
  }, []);

  const loadSeisoData = useCallback(async () => {
    setSeisoState("loading");
    
    setTimeout(() => {
      analyzeTaskCompletion([]);
      toast.success("Dados de progresso carregados!");
    }, 1000);

  }, [analyzeTaskCompletion]);

  useEffect(() => {
    loadSeisoData();
  }, [loadSeisoData]);

  return (
    <div className="p-4">
      <h2 className="text-3xl font-bold mb-2 text-gray-800">✨ SEISO - Limpeza e Revisão</h2>
      <p className="text-lg text-gray-600 mb-6">
        Visualize seu progresso e mantenha o ambiente de trabalho limpo.
      </p>

      {isLoading || seisoState === "loading" ? (
        <div className="flex justify-center items-center h-48">
          <LoadingSpinner size={40} />
        </div>
      ) : seisoState === "empty" ? (
        <div className="text-center mt-10">
          <p className="text-2xl font-semibold text-gray-700 mb-4">
            Nenhum dado de conclusão de tarefas encontrado.
          </p>
          <p className="text-lg text-gray-600 mb-6">
            Comece a concluir tarefas para ver seu progresso aqui!
          </p>
          <Button
            onClick={loadSeisoData}
            className="px-8 py-4 text-xl bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors duration-200"
          >
            Recarregar Dados
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mt-8">
          <Card className="col-span-1">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                Concluídas Hoje
              </CardTitle>
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                className="h-4 w-4 text-muted-foreground"
              >
                <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
              </svg>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{totalCompletedToday}</div>
              <p className="text-xs text-muted-foreground">
                Tarefas concluídas hoje
              </p>
            </CardContent>
          </Card>
          <Card className="col-span-1">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                Concluídas Últimos 7 Dias
              </CardTitle>
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                className="h-4 w-4 text-muted-foreground"
              >
                <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
                <circle cx="9" cy="7" r="4" />
                <path d="M22 21v-2a4 4 0 0 0-3-3.87m-3-12a4 4 0 0 1 0 7.75" />
              </svg>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{totalCompletedLast7Days}</div>
              <p className="text-xs text-muted-foreground">
                Total de tarefas concluídas na última semana
              </p>
            </CardContent>
          </Card>
          <Card className="col-span-1">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                Média Diária (7 dias)
              </CardTitle>
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                className="h-4 w-4 text-muted-foreground"
              >
                <rect width="20" height="14" x="2" y="6" rx="2" />
                <path d="M22 10H2" />
              </svg>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {(totalCompletedLast7Days / 7).toFixed(1)}
              </div>
              <p className="text-xs text-muted-foreground">
                Média de tarefas concluídas por dia
              </p>
            </CardContent>
          </Card>
          <div className="col-span-full">
            <TaskCompletionChart data={completedTasksData} />
          </div>
        </div>
      )}
    </div>
  );
};

export default Seiso;