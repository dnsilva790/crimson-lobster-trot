"use client";

import React from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { TodoistTask } from "@/lib/types";
import { cn } from "@/lib/utils"; // Removido getTaskType
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Check, Trash2, ArrowRight, ExternalLink } from "lucide-react";
// Removido: import { Badge } from "@/components/ui/badge"; // Importar Badge

interface TaskReviewCardProps {
  task: TodoistTask;
  onKeep: (taskId: string) => void;
  onComplete: (taskId: string) => void;
  onDelete: (taskId: string) => void;
  isLoading: boolean;
}

const PRIORITY_COLORS: Record<1 | 2 | 3 | 4, string> = {
  4: "bg-red-500", // P1 - Urgente
  3: "bg-orange-500", // P2 - Alto
  2: "bg-yellow-500", // P3 - Médio
  1: "bg-gray-400", // P4 - Baixo
};

const PRIORITY_LABELS: Record<1 | 2 | 3 | 4, string> = {
  4: "P1 - Urgente",
  3: "P2 - Alto",
  2: "P3 - Médio",
  1: "P4 - Baixo",
};

const TaskReviewCard: React.FC<TaskReviewCardProps> = ({
  task,
  onKeep,
  onComplete,
  onDelete,
  isLoading,
}) => {
  const renderDueDate = () => {
    const dateElements: JSX.Element[] = [];

    if (task.deadline?.date) {
      dateElements.push(
        <span key="deadline" className="font-semibold text-red-600 block">
          Data Limite: {format(new Date(task.deadline.date), "dd/MM/yyyy", { locale: ptBR })}
        </span>
      );
    }

    if (task.due?.datetime) {
      dateElements.push(
        <span key="due-datetime" className="block">
          Vencimento: {format(new Date(task.due.datetime), "dd/MM/yyyy HH:mm", { locale: ptBR })}
        </span>
      );
    } else if (task.due?.date) { // Only show due.date if due.datetime is not present
      dateElements.push(
        <span key="due-date" className="block">
          Vencimento: {format(new Date(task.due.date), "dd/MM/yyyy", { locale: ptBR })}
        </span>
      );
    }

    if (dateElements.length === 0) {
      return <span>Sem prazo</span>;
    }

    return <div className="space-y-1">{dateElements}</div>;
  };

  // Removido: const taskType = getTaskType(task);

  return (
    <Card className="p-6 rounded-xl shadow-lg bg-white flex flex-col h-full max-w-2xl mx-auto">
      <div className="flex-grow">
        <div className="flex items-center gap-2 mb-3">
          <h3 className="text-2xl font-bold text-gray-800">{task.content}</h3>
          {/* Removido: {taskType && ( ... )} */}
        </div>
        {task.description && (
          <p className="text-md text-gray-700 mb-4 whitespace-pre-wrap">{task.description}</p>
        )}
      </div>
      <div className="flex items-center justify-between text-sm text-gray-500 mt-auto pt-4 border-t border-gray-200">
        {renderDueDate()}
        <span
          className={cn(
            "px-2 py-1 rounded-full text-white text-xs font-medium",
            PRIORITY_COLORS[task.priority],
          )}
        >
          {PRIORITY_LABELS[task.priority]}
        </span>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6">
        <Button
          onClick={() => onKeep(task.id)}
          disabled={isLoading}
          className="bg-gray-200 hover:bg-gray-300 text-gray-800 py-3 text-md flex items-center justify-center"
        >
          <ArrowRight className="mr-2 h-5 w-5" /> Manter
        </Button>
        <Button
          onClick={() => onComplete(task.id)}
          disabled={isLoading}
          className="bg-green-500 hover:bg-green-600 text-white py-3 text-md flex items-center justify-center"
        >
          <Check className="mr-2 h-5 w-5" /> Concluir
        </Button>
        <Button
          onClick={() => onDelete(task.id)}
          disabled={isLoading}
          className="bg-red-500 hover:bg-red-600 text-white py-3 text-md flex items-center justify-center"
        >
          <Trash2 className="mr-2 h-5 w-5" /> Excluir
        </Button>
      </div>
      <div className="mt-4">
        <a href={task.url} target="_blank" rel="noopener noreferrer" className="w-full">
          <Button variant="outline" className="w-full py-3 text-md flex items-center justify-center">
            <ExternalLink className="mr-2 h-4 w-4" /> Abrir no Todoist
          </Button>
        </a>
      </div>
    </Card>
  );
};

export default TaskReviewCard;