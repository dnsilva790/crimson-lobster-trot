"use client";

import React from "react";
import { TodoistTask } from "@/lib/types";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { format, parseISO, isValid, isBefore } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn, getDelegateNameFromLabels, getSolicitante, get5W2H } from "@/lib/utils"; // Removida a importação incorreta de getEisenhowerRating
import { getEisenhowerRating } from "@/utils/eisenhowerUtils"; // Importação correta
import { ExternalLink } from "lucide-react";

interface TaskTableComponentProps {
  tasks: TodoistTask[];
}

const PRIORITY_COLORS: Record<1 | 2 | 3 | 4, string> = {
  4: "bg-red-500 hover:bg-red-500",
  3: "bg-orange-500 hover:bg-orange-500",
  2: "bg-yellow-500 hover:bg-yellow-500",
  1: "bg-gray-400 hover:bg-gray-400",
};

const TaskTableComponent: React.FC<TaskTableComponentProps> = ({ tasks }) => {
  const formatDueDate = (task: TodoistTask) => {
    const dueDate = task.due?.datetime || task.due?.date;
    if (!dueDate) return "N/A";
    
    const parsedDate = parseISO(dueDate);
    if (!isValid(parsedDate)) return "Data Inválida";

    const formatString = task.due?.datetime ? "dd/MM/yyyy HH:mm" : "dd/MM/yyyy";
    return format(parsedDate, formatString, { locale: ptBR });
  };

  const formatDeadline = (deadline: string | null | undefined) => {
    if (!deadline) return "N/A";
    const parsedDate = parseISO(deadline);
    if (!isValid(parsedDate)) return "Data Inválida";
    return format(parsedDate, "dd/MM/yyyy", { locale: ptBR });
  };

  return (
    <div className="overflow-x-auto border rounded-lg">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-[40px]">P</TableHead>
            <TableHead className="min-w-[250px]">Conteúdo</TableHead>
            <TableHead className="min-w-[300px]">Descrição</TableHead>
            <TableHead className="w-[80px]">Urgência</TableHead>
            <TableHead className="w-[80px]">Importância</TableHead>
            <TableHead className="w-[80px]">Quadrante</TableHead>
            <TableHead className="min-w-[150px]">Vencimento</TableHead>
            <TableHead className="min-w-[150px]">Deadline</TableHead>
            <TableHead className="min-w-[150px]">Duração (min)</TableHead>
            <TableHead className="min-w-[150px]">Solicitante</TableHead>
            <TableHead className="min-w-[150px]">Responsável</TableHead>
            <TableHead className="min-w-[150px]">5W2H: O Quê</TableHead>
            <TableHead className="min-w-[150px]">5W2H: Por Quê</TableHead>
            <TableHead className="min-w-[150px]">5W2H: Quem</TableHead>
            <TableHead className="min-w-[150px]">5W2H: Onde</TableHead>
            <TableHead className="min-w-[150px]">5W2H: Quando</TableHead>
            <TableHead className="min-w-[150px]">5W2H: Como</TableHead>
            <TableHead className="min-w-[150px]">5W2H: Quanto</TableHead>
            <TableHead className="min-w-[200px]">Etiquetas</TableHead>
            <TableHead className="w-[50px]">Link</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {tasks.map((task) => {
            const { urgency, importance, quadrant } = getEisenhowerRating(task);
            const solicitante = getSolicitante(task);
            const delegateName = getDelegateNameFromLabels(task.labels);
            const w2h = get5W2H(task);

            return (
              <TableRow key={task.id}>
                <TableCell>
                  <Badge
                    className={cn(
                      "text-white font-bold",
                      PRIORITY_COLORS[task.priority]
                    )}
                  >
                    {task.priority}
                  </Badge>
                </TableCell>
                <TableCell className="font-medium">{task.content}</TableCell>
                <TableCell className="text-sm text-gray-600 max-w-xs truncate" title={task.description}>
                  {task.description || "N/A"}
                </TableCell>
                <TableCell className="text-sm font-semibold text-blue-600">
                  {urgency !== null ? urgency : "N/A"}
                </TableCell>
                <TableCell className="text-sm font-semibold text-green-600">
                  {importance !== null ? importance : "N/A"}
                </TableCell>
                <TableCell className="text-sm font-semibold">
                  {quadrant ? quadrant.charAt(0).toUpperCase() + quadrant.slice(1) : "N/A"}
                </TableCell>
                <TableCell className={cn(
                  "text-sm",
                  task.due?.datetime && isValid(parseISO(task.due.datetime)) && isBefore(parseISO(task.due.datetime), new Date()) && "text-red-600 font-semibold"
                )}>
                  {formatDueDate(task)}
                </TableCell>
                <TableCell className="text-sm text-red-700 font-semibold">
                  {formatDeadline(task.deadline)}
                </TableCell>
                <TableCell className="text-sm">
                  {task.estimatedDurationMinutes || "N/A"}
                </TableCell>
                <TableCell className="text-sm">{solicitante || "N/A"}</TableCell>
                <TableCell className="text-sm">{delegateName || "N/A"}</TableCell>
                <TableCell className="text-sm max-w-[150px] truncate" title={w2h.what}>{w2h.what || "N/A"}</TableCell>
                <TableCell className="text-sm max-w-[150px] truncate" title={w2h.why}>{w2h.why || "N/A"}</TableCell>
                <TableCell className="text-sm max-w-[150px] truncate" title={w2h.who}>{w2h.who || "N/A"}</TableCell>
                <TableCell className="text-sm max-w-[150px] truncate" title={w2h.where}>{w2h.where || "N/A"}</TableCell>
                <TableCell className="text-sm max-w-[150px] truncate" title={w2h.when}>{w2h.when || "N/A"}</TableCell>
                <TableCell className="text-sm max-w-[150px] truncate" title={w2h.how}>{w2h.how || "N/A"}</TableCell>
                <TableCell className="text-sm max-w-[150px] truncate" title={w2h.howMuch}>{w2h.howMuch || "N/A"}</TableCell>
                <TableCell>
                  <div className="flex flex-wrap gap-1">
                    {task.labels.map((label) => (
                      <Badge key={label} variant="secondary" className="text-xs">
                        {label}
                      </Badge>
                    ))}
                  </div>
                </TableCell>
                <TableCell>
                  <a href={task.url} target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:text-blue-700">
                    <ExternalLink className="h-4 w-4" />
                  </a>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
};

export default TaskTableComponent;