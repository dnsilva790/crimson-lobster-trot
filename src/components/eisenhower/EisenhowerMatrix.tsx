"use client";

import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EisenhowerTask, Quadrant } from "@/lib/types";
import { cn } from "@/lib/utils";
import { Check, X, Users, Clock } from "lucide-react";

interface EisenhowerMatrixProps {
  tasks: EisenhowerTask[];
  onTaskClick?: (task: EisenhowerTask) => void;
}

const quadrantDefinitions: Record<Quadrant, { title: string; description: string; color: string; icon: React.ElementType }> = {
  do: {
    title: "Fazer (Do)",
    description: "Urgente e Importante",
    color: "bg-blue-100 border-blue-400",
    icon: Check,
  },
  decide: {
    title: "Decidir (Decide)",
    description: "Não Urgente e Importante",
    color: "bg-green-100 border-green-400",
    icon: Clock,
  },
  delegate: {
    title: "Delegar (Delegate)",
    description: "Urgente e Não Importante",
    color: "bg-yellow-100 border-yellow-400",
    icon: Users,
  },
  delete: {
    title: "Eliminar (Delete)",
    description: "Não Urgente e Não Importante",
    color: "bg-red-100 border-red-400",
    icon: X,
  },
};

const EisenhowerMatrix: React.FC<EisenhowerMatrixProps> = ({ tasks, onTaskClick }) => {
  const getTasksInQuadrant = (quadrant: Quadrant) => {
    return tasks.filter(task => task.quadrant === quadrant);
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 h-full">
      {Object.entries(quadrantDefinitions).map(([key, def]) => {
        const quadrantTasks = getTasksInQuadrant(key as Quadrant);
        const Icon = def.icon;
        return (
          <Card key={key} className={cn("flex flex-col h-full", def.color)}>
            <CardHeader className="pb-2">
              <CardTitle className={cn("text-xl font-bold flex items-center gap-2", `text-${def.color.split('-')[1]}-800`)}>
                <Icon className="h-5 w-5" /> {def.title}
              </CardTitle>
              <p className={cn("text-sm", `text-${def.color.split('-')[1]}-700`)}>{def.description}</p>
            </CardHeader>
            <CardContent className="flex-grow overflow-y-auto custom-scroll p-4">
              {quadrantTasks.length > 0 ? (
                <div className="space-y-3">
                  {quadrantTasks.map(task => (
                    <div
                      key={task.id}
                      className={cn(
                        "p-3 rounded-md bg-white shadow-sm border border-gray-200",
                        onTaskClick && "cursor-pointer hover:bg-gray-50 transition-colors"
                      )}
                      onClick={() => onTaskClick?.(task)}
                    >
                      <h4 className="font-semibold text-gray-800">{task.content}</h4>
                      {task.description && <p className="text-xs text-gray-600 line-clamp-2">{task.description}</p>}
                      <div className="flex justify-between items-center text-xs text-gray-500 mt-1">
                        <span>Urgência: {task.urgency || 'N/A'}</span>
                        <span>Importância: {task.importance || 'N/A'}</span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-gray-500 italic">Nenhuma tarefa neste quadrante.</p>
              )}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
};

export default EisenhowerMatrix;