"use client";

import React from "react";
import { Card } from "@/components/ui/card";
import { EisenhowerTask } from "@/lib/types";
import { cn, getDelegateNameFromLabels, getSolicitante } from "@/lib/utils"; // Importar getSolicitante e getDelegateNameFromLabels
import { format, parseISO, isValid } from "date-fns";
import { ptBR } from "date-fns/locale";
import { CalendarIcon, Clock, ExternalLink, User, Users, Repeat2 } from "lucide-react"; // Adicionado Repeat2
import { Badge } from "@/components/ui/badge";

interface TaskCardProps {
  task: EisenhowerTask;
  className?: string;
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

const TaskCard: React.FC<TaskCardProps> = ({ task, className }) => {
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

  const delegateName = getDelegateNameFromLabels(task.labels);
  const solicitante = getSolicitante(task);
  const isRecurring = task.due?.is_recurring === true; // Adicionado

  return (
    <Card className={cn("p-6 rounded-xl shadow-lg bg-white flex flex-col h-full", className)}>
      <div className="flex-grow">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <h3 className="text-2xl font-bold text-gray-800">{task.content}</h3>
            {isRecurring && ( // Adicionado
              <Badge
                className="text-xs font-medium bg-purple-100 text-purple-800 flex items-center gap-1"
                title="Tarefa Recorrente"
              >
                <Repeat2 className="h-3 w-3" /> Recorrente
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
      <div className="flex flex-col gap-2 text-sm text-gray-600 mt-auto pt-4 border-t border-gray-200">
        {(solicitante || delegateName) && (
          <div className="flex flex-wrap gap-4">
            {solicitante && (
              <span className="flex items-center gap-1">
                <User className="h-4 w-4 text-blue-500" /> Solicitante: <span className="font-semibold">{solicitante}</span>
              </span>
            )}
            {delegateName && (
              <span className="flex items-center gap-1">
                <Users className="h-4 w-4 text-orange-500" /> Responsável: <span className="font-semibold">{delegateName}</span>
              </span>
            )}
          </div>
        )}
        <div className="flex items-center justify-between text-sm text-gray-500 pt-2">
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
      </div>
      {(task.urgency !== null || task.importance !== null) && (
        <div className="mt-4 pt-4 border-t border-gray-100 text-sm text-gray-600 flex justify-between">
          <span>Urgência: <span className="font-semibold">{task.urgency || 'N/A'}</span></span>
          <span>Importância: <span className="font-semibold">{task.importance || 'N/A'}</span></span>
        </div>
      )}
    </Card>
  );
};

export default TaskCard;