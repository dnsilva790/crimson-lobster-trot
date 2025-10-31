"use client";

import React from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, LayoutDashboard, ListTodo } from "lucide-react";
import { EisenhowerTask, Quadrant } from "@/lib/types";
import TaskCard from "./TaskCard"; // Reutilizando o TaskCard
import { cn } from "@/lib/utils";

interface ResultsScreenProps {
  tasks: EisenhowerTask[];
  onBack: () => void;
  onViewDashboard: () => void;
  displayFilter: "all" | "overdue" | "today" | "tomorrow"; // Adicionado
  onDisplayFilterChange: (value: "all" | "overdue" | "today" | "tomorrow") => void; // Adicionado
}

const quadrantDefinitions: Record<Quadrant, { title: string; description: string; color: string }> = {
  do: {
    title: "Fazer (Do)",
    description: "Urgente e Importante",
    color: "bg-blue-50 border-blue-400",
  },
  decide: {
    title: "Decidir (Decide)",
    description: "Não Urgente e Importante",
    color: "bg-green-50 border-green-400",
  },
  delegate: {
    title: "Delegar (Delegate)",
    description: "Urgente e Não Importante",
    color: "bg-yellow-50 border-yellow-400",
  },
  delete: {
    title: "Eliminar (Delete)",
    description: "Não Urgente e Não Importante",
    color: "bg-red-50 border-red-400",
  },
};

const ResultsScreen: React.FC<ResultsScreenProps> = ({ tasks, onBack, onViewDashboard, displayFilter, onDisplayFilterChange }) => {
  const getTasksInQuadrant = (quadrant: Quadrant) => {
    return tasks.filter(task => task.quadrant === quadrant);
  };

  return (
    <div className="p-4">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
          <ListTodo className="h-6 w-6 text-indigo-600" /> Resultados da Matriz
        </h3>
        <div className="flex gap-2">
          <Button onClick={onBack} variant="outline" className="flex items-center gap-2">
            <ArrowLeft className="h-4 w-4" /> Voltar para Matriz
          </Button>
          <Button onClick={onViewDashboard} className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white">
            <LayoutDashboard className="h-4 w-4" /> Ver Dashboard
          </Button>
        </div>
      </div>

      <p className="text-lg text-gray-700 mb-6 text-center">
        Aqui estão suas tarefas categorizadas e prontas para ação.
      </p>

      <div className="space-y-8">
        {Object.entries(quadrantDefinitions).map(([key, def]) => {
          const quadrantTasks = getTasksInQuadrant(key as Quadrant);
          return (
            <Card key={key} className={cn("border-l-4", def.color)}>
              <CardHeader>
                <CardTitle className={cn("text-xl font-bold", `text-${def.color.split('-')[1]}-800`)}>
                  {def.title} ({quadrantTasks.length})
                </CardTitle>
                <p className={cn("text-sm", `text-${def.color.split('-')[1]}-700`)}>{def.description}</p>
              </CardHeader>
              <CardContent className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {quadrantTasks.length > 0 ? (
                  quadrantTasks.map(task => (
                    <TaskCard key={task.id} task={task} />
                  ))
                ) : (
                  <p className="text-gray-500 italic col-span-full">Nenhuma tarefa neste quadrante.</p>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
};

export default ResultsScreen;