"use client";

import React from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { TodoistTask } from "@/lib/types";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Check, ArrowRight, ExternalLink } from "lucide-react";

interface FocusTaskCardProps {
  task: TodoistTask;
  onComplete: (taskId: string) => void;
  onSkip: (taskId: string) => void;
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

const FocusTaskCard: React.FC<FocusTaskCardProps> = ({
  task,
  onComplete,
  onSkip,
  isLoading,
}) => {
  const renderDueDate = () => {
    if (task.deadline?.date) {
      return (
        <span className="font-semibold text-red-600">
          Prazo Final: {format(new Date(task.deadline.date), "dd/MM/yyyy", { locale: ptBR })}
        </span>
      );
    } else if (task.due?.datetime) {
      return (
        <span>
          Vencimento: {format(new Date(task.due.datetime), "dd/MM/yyyy HH:mm", { locale: ptBR })}
        </span>
      );
    } else if (task.due?.date) {
      return (
        <span>
          Vencimento: {format(new Date(task.due.date), "dd/MM/yyyy", { locale: ptBR })}
        </span>
      );
    }
    return <span>Sem prazo</span>;
  };

  return (
    <Card className="p-6 rounded-xl shadow-lg bg-white flex flex-col h-full max-w-2xl mx-auto">
      <div className="flex-grow">
        <h3 className="text-2xl font-bold mb-3 text-gray-800">{task.content}</h3>
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
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6">
        <Button
          onClick={() => onComplete(task.id)}
          disabled={isLoading}
          className="bg-green-500 hover:bg-green-600 text-white py-3 text-md flex items-center justify-center"
        >
          <Check className="mr-2 h-5 w-5" /> Concluir
        </Button>
        <Button
          onClick={() => onSkip(task.id)}
          disabled={isLoading}
          className="bg-gray-200 hover:bg-gray-300 text-gray-800 py-3 text-md flex items-center justify-center"
        >
          <ArrowRight className="mr-2 h-5 w-5" /> Pular
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

export default FocusTaskCard;