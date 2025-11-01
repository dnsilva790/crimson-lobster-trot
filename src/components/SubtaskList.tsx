"use client";

import React from "react";
import { TodoistTask } from "@/lib/types";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { format, parseISO, isValid } from "date-fns";
import { ptBR } from "date-fns/locale";
import { CalendarIcon, Clock, ExternalLink } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface SubtaskListProps {
  subtasks: TodoistTask[];
  level?: number;
}

const PRIORITY_COLORS: Record<1 | 2 | 3 | 4, string> = {
  4: "bg-red-500", // P1 - Urgente
  3: "bg-orange-500", // P2 - Alto
  2: "bg-yellow-500", // P3 - Médio
  1: "bg-gray-400", // P4 - Baixo
};

const PRIORITY_LABELS: Record<1 | 2 | 3 | 4, string> = {
  4: "P1",
  3: "P2",
  2: "P3",
  1: "P4",
};

const SubtaskList: React.FC<SubtaskListProps> = ({ subtasks, level = 0 }) => {
  if (!subtasks || subtasks.length === 0) {
    return null;
  }

  const renderDueDateAndDuration = (task: TodoistTask) => {
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

    if (typeof task.deadline === 'string' && task.deadline) {
      const parsedDeadline = parseISO(task.deadline);
      if (isValid(parsedDeadline)) {
        dateElements.push(
          <span key="field-deadline" className="flex items-center gap-1 text-red-600 font-semibold">
            <CalendarIcon className="h-3 w-3" /> Deadline: {format(parsedDeadline, "dd/MM/yyyy", { locale: ptBR })}
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

  return (
    <div className="space-y-2">
      {subtasks.map((subtask) => (
        <Card
          key={subtask.id}
          className={cn(
            "p-4 rounded-lg shadow-sm bg-gray-50 border border-gray-200",
            `ml-${level * 4}` // Indent based on level
          )}
        >
          <CardContent className="p-0">
            <div className="flex items-center justify-between mb-2">
              <h4 className="font-semibold text-gray-800">{subtask.content}</h4>
              <a href={subtask.url} target="_blank" rel="noopener noreferrer" className="ml-2 text-indigo-600 hover:text-indigo-800">
                <ExternalLink className="h-4 w-4" />
              </a>
            </div>
            {subtask.description && (
              <p className="text-xs text-gray-700 mb-2 whitespace-pre-wrap">{subtask.description}</p>
            )}
            <div className="flex items-center justify-between text-xs text-gray-500 mt-auto pt-2 border-t border-gray-100">
              {renderDueDateAndDuration(subtask)}
              <span
                className={cn(
                  "px-2 py-1 rounded-full text-white text-xs font-medium",
                  PRIORITY_COLORS[subtask.priority],
                )}
              >
                {PRIORITY_LABELS[subtask.priority]}
              </span>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
};

export default SubtaskList;