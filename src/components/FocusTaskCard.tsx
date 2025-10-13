"use client";

import React from "react";
import { Card } from "@/components/ui/card";
import { TodoistTask } from "@/lib/types";
import { cn, getTaskCategory } from "@/lib/utils"; // Importar getTaskCategory
import { format, parseISO, isValid } from "date-fns";
import { ptBR } from "date-fns/locale";
import { ExternalLink, CalendarIcon, Clock } from "lucide-react"; // Importar CalendarIcon e Clock
import { Badge } from "@/components/ui/badge"; // Importar Badge

interface FocusTaskCardProps {
  task: TodoistTask;
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
}) => {
  const renderDueDateAndDuration = () => {
    const dateElements: JSX.Element[] = [];

    if (typeof task.due?.datetime === 'string' && task.due.datetime) {
      const parsedDate = parseISO(task.due.datetime);
      if (isValid(parsedDate)) {
        dateElements.push(
          <span key="due-datetime" className="flex items-center gap-1">
            <CalendarIcon className="h-3 w-3" /> {format(parsedDate, "dd/MM/yyyy HH:mm", { locale: ptBR })}
          </span>
        );
      }
    } else if (typeof task.due?.date === 'string' && task.due.date) {
      const parsedDate = parseISO(task.due.date);
      if (isValid(parsedDate)) {
        dateElements.push(
          <span key="due-date" className="flex items-center gap-1">
            <CalendarIcon className="h-3 w-3" /> {format(parsedDate, "dd/MM/yyyy", { locale: ptBR })}
          </span>
        );
      }
    }

    if (task.duration?.amount && task.duration.unit === "minute") {
      dateElements.push(
        <span key="duration" className="flex items-center gap-1">
          <Clock className="h-3 w-3" /> {task.duration.amount} min
        </span>
      );
    }

    if (dateElements.length === 0) {
      return <span>Sem prazo</span>;
    }

    return <div className="flex flex-wrap gap-x-4 gap-y-1">{dateElements}</div>;
  };

  const category = getTaskCategory(task);

  return (
    <Card className="p-6 rounded-xl shadow-lg bg-white flex flex-col h-full max-w-2xl mx-auto">
      <div className="flex-grow">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <h3 className="text-2xl font-bold text-gray-800">{task.content}</h3>
            {category && (
              <Badge
                className={cn(
                  "text-xs font-medium",
                  category === "pessoal" ? "bg-blue-100 text-blue-800" : "bg-green-100 text-green-800"
                )}
              >
                {category === "pessoal" ? "Pessoal" : "Profissional"}
              </Badge>
            )}
          </div>
          <a href={task.url} target="_blank" rel="noopener noreferrer" className="ml-2 text-indigo-600 hover:text-indigo-800">
            <ExternalLink className="h-5 w-5" />
          </a>
        </div>
        {task.description && (
          <p className="text-md text-gray-700 mb-4 whitespace-pre-wrap">{task.description}</p>
        )}
        {task.labels && task.labels.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-2 mb-4">
            {task.labels.map((label) => (
              <Badge key={label} variant="secondary" className="text-xs bg-gray-100 text-gray-700">
                {label}
              </Badge>
            ))}
          </div>
        )}
      </div>
      <div className="flex items-center justify-between text-sm text-gray-500 mt-auto pt-4 border-t border-gray-200">
        {renderDueDateAndDuration()}
        <span
          className={cn(
            "px-2 py-1 rounded-full text-white text-xs font-medium",
            PRIORITY_COLORS[task.priority],
          )}
        >
          {PRIORITY_LABELS[task.priority]}
        </span>
      </div>
    </Card>
  );
};

export default FocusTaskCard;