"use client";

import React, { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { TodoistTask } from "@/lib/types";
import { cn, getTaskCategory } from "@/lib/utils";
import { format, setHours, setMinutes, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  Check,
  Trash2,
  Archive,
  CalendarIcon,
  ExternalLink,
  Clock,
  Users,
  Lightbulb,
  ChevronRight,
  FolderOpen,
  XCircle,
} from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge"; // Importar Badge

interface GTDTaskCardProps {
  task: TodoistTask;
  isLoading: boolean;
  onNotActionable: () => void;
  onActionable: () => void;
  onDelete: (taskId: string) => Promise<void>;
  onIncubate: (taskId: string) => Promise<void>;
  onArchive: (taskId: string) => Promise<void>;
  onDoNow: (taskId: string) => Promise<void>;
  onDelegate: (taskId: string, delegateTo: string) => Promise<void>;
  onSchedule: (taskId: string, dueDate: string | null, dueDateTime: string | null) => Promise<void>;
  onNextAction: (taskId: string) => Promise<void>;
  onEditTask: (taskId: string, content: string, description: string) => Promise<void>;
  onGoToProject: (taskId: string) => void; // Nova prop para "Projeto"
  gtdStep: "initial" | "actionable_decision" | "not_actionable_options" | "actionable_options";
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

const GTDTaskCard: React.FC<GTDTaskCardProps> = ({
  task,
  isLoading,
  onNotActionable,
  onActionable,
  onDelete,
  onIncubate,
  onArchive,
  onDoNow,
  onDelegate,
  onSchedule,
  onNextAction,
  onEditTask,
  onGoToProject,
  gtdStep,
}) => {
  const [isSchedulePopoverOpen, setIsSchedulePopoverOpen] = useState(false);
  const [isDelegatePopoverOpen, setIsDelegatePopoverOpen] = useState(false);
  const [isEditPopoverOpen, setIsEditPopoverOpen] = useState(false);

  const [selectedDueDate, setSelectedDueDate] = useState<Date | undefined>(
    task.due?.date ? parseISO(task.due.date) : undefined
  );
  const [selectedDueTime, setSelectedDueTime] = useState<string>(
    task.due?.datetime ? format(parseISO(task.due.datetime), "HH:mm") : ""
  );
  const [delegateTo, setDelegateTo] = useState<string>("");
  const [editedContent, setEditedContent] = useState(task.content);
  const [editedDescription, setEditedDescription] = useState(task.description || "");

  const handleSetSchedule = async () => {
    if (!selectedDueDate) {
      // toast.error("Por favor, selecione uma data para agendar.");
      return; // Let the parent handle the toast if needed
    }

    let finalDueDate: string | null = null;
    let finalDueDateTime: string | null = null;

    if (selectedDueTime) {
      const [hours, minutes] = selectedDueTime.split(":").map(Number);
      const dateWithTime = setMinutes(setHours(selectedDueDate, hours), minutes);
      finalDueDateTime = format(dateWithTime, "yyyy-MM-dd'T'HH:mm:ss");
    } else {
      finalDueDate = format(selectedDueDate, "yyyy-MM-dd");
    }

    await onSchedule(task.id, finalDueDate, finalDueDateTime);
    setIsSchedulePopoverOpen(false);
  };

  const handleClearSchedule = async () => {
    await onSchedule(task.id, null, null);
    setSelectedDueDate(undefined);
    setSelectedDueTime("");
    setIsSchedulePopoverOpen(false);
  };

  const handleDelegateAction = async () => {
    await onDelegate(task.id, delegateTo);
    setIsDelegatePopoverOpen(false);
    setDelegateTo("");
  };

  const handleEditAction = async () => {
    await onEditTask(task.id, editedContent, editedDescription);
    setIsEditPopoverOpen(false);
  };

  const renderDueDate = () => {
    const dateElements: JSX.Element[] = [];

    // Removido: if (task.deadline?.date) { ... }

    if (task.due?.datetime) {
      dateElements.push(
        <span key="due-datetime" className="block">
          Vencimento: {format(new Date(task.due.datetime), "dd/MM/yyyy HH:mm", { locale: ptBR })}
        </span>
      );
    } else if (task.due?.date) {
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

      {gtdStep === "actionable_decision" && (
        <div className="grid grid-cols-2 gap-4 mt-6">
          <Button
            onClick={onNotActionable}
            disabled={isLoading}
            className="bg-gray-200 hover:bg-gray-300 text-gray-800 py-3 text-md"
          >
            <XCircle className="mr-2 h-5 w-5" /> Não é Acionável
          </Button>
          <Button
            onClick={onActionable}
            disabled={isLoading}
            className="bg-green-600 hover:bg-green-700 text-white py-3 text-md"
          >
            <Check className="mr-2 h-5 w-5" /> Sim, é Acionável
          </Button>
        </div>
      )}

      {gtdStep === "not_actionable_options" && (
        <div className="grid grid-cols-3 gap-4 mt-6">
          <Button
            onClick={() => onDelete(task.id)}
            disabled={isLoading}
            className="bg-red-500 hover:bg-red-600 text-white py-3 text-md flex items-center justify-center"
          >
            <Trash2 className="mr-2 h-5 w-5" /> Eliminar
          </Button>
          <Button
            onClick={() => onIncubate(task.id)}
            disabled={isLoading}
            className="bg-yellow-500 hover:bg-yellow-600 text-white py-3 text-md flex items-center justify-center"
          >
            <Lightbulb className="mr-2 h-5 w-5" /> Incubar
          </Button>
          <Button
            onClick={() => onArchive(task.id)}
            disabled={isLoading}
            className="bg-blue-500 hover:bg-blue-600 text-white py-3 text-md flex items-center justify-center"
          >
            <Archive className="mr-2 h-5 w-5" /> Arquivar
          </Button>
        </div>
      )}

      {gtdStep === "actionable_options" && (
        <div className="grid grid-cols-2 gap-4 mt-6">
          <Popover open={isEditPopoverOpen} onOpenChange={setIsEditPopoverOpen}>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                disabled={isLoading}
                className="py-3 text-md flex items-center justify-center"
              >
                <FolderOpen className="mr-2 h-5 w-5" /> Projeto
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-80 p-4">
              <h4 className="font-semibold text-lg mb-3">Editar Tarefa (Projeto)</h4>
              <div className="grid gap-4">
                <div>
                  <Label htmlFor="edit-content">Conteúdo da Tarefa</Label>
                  <Input
                    id="edit-content"
                    value={editedContent}
                    onChange={(e) => setEditedContent(e.target.value)}
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label htmlFor="edit-description">Descrição</Label>
                  <Textarea
                    id="edit-description"
                    value={editedDescription}
                    onChange={(e) => setEditedDescription(e.target.value)}
                    rows={4}
                    className="mt-1"
                  />
                </div>
                <Button onClick={handleEditAction} className="w-full" disabled={isLoading}>
                  Salvar Edições
                </Button>
                <Button onClick={() => onGoToProject(task.id)} variant="outline" className="w-full" disabled={isLoading}>
                  <ExternalLink className="mr-2 h-4 w-4" /> Abrir no Todoist
                </Button>
              </div>
            </PopoverContent>
          </Popover>

          <Popover open={isDelegatePopoverOpen} onOpenChange={setIsDelegatePopoverOpen}>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                disabled={isLoading}
                className="py-3 text-md flex items-center justify-center"
              >
                <Users className="mr-2 h-5 w-5" /> Delegar
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-80 p-4">
              <h4 className="font-semibold text-lg mb-3">Delegar Tarefa</h4>
              <div className="grid gap-4">
                <div>
                  <Label htmlFor="delegate-to">Delegar para:</Label>
                  <Input
                    id="delegate-to"
                    value={delegateTo}
                    onChange={(e) => setDelegateTo(e.target.value)}
                    placeholder="Nome ou rótulo (ex: @joao)"
                    className="mt-1"
                  />
                </div>
                <Button onClick={handleDelegateAction} className="w-full" disabled={isLoading}>
                  Delegar e Próximo
                </Button>
              </div>
            </PopoverContent>
          </Popover>

          <Button
            onClick={() => onDoNow(task.id)}
            disabled={isLoading}
            className="bg-green-500 hover:bg-green-600 text-white py-3 text-md flex items-center justify-center"
          >
            <Check className="mr-2 h-5 w-5" /> Fazer (&lt;2min)
          </Button>

          <Popover open={isSchedulePopoverOpen} onOpenChange={setIsSchedulePopoverOpen}>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                disabled={isLoading}
                className="py-3 text-md flex items-center justify-center"
              >
                <CalendarIcon className="mr-2 h-5 w-5" /> Agendar
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-80 p-4">
              <h4 className="font-semibold text-lg mb-3">Agendar Tarefa</h4>
              <div className="grid gap-4">
                <div>
                  <Label htmlFor="schedule-date">Data de Vencimento</Label>
                  <Calendar
                    mode="single"
                    selected={selectedDueDate}
                    onSelect={setSelectedDueDate}
                    initialFocus
                    locale={ptBR}
                    className="rounded-md border shadow"
                  />
                </div>
                <div>
                  <Label htmlFor="schedule-time">Hora de Vencimento (Opcional)</Label>
                  <Input
                    id="schedule-time"
                    type="time"
                    value={selectedDueTime}
                    onChange={(e) => setSelectedDueTime(e.target.value)}
                    className="mt-1"
                  />
                </div>
                <Button onClick={handleSetSchedule} className="w-full" disabled={isLoading}>
                  Salvar Agendamento
                </Button>
                <Button onClick={handleClearSchedule} variant="outline" className="w-full" disabled={isLoading}>
                  <XCircle className="mr-2 h-4 w-4" /> Limpar Agendamento
                </Button>
              </div>
            </PopoverContent>
          </Popover>

          <Button
            onClick={() => onNextAction(task.id)}
            disabled={isLoading}
            className="bg-indigo-600 hover:bg-indigo-700 text-white py-3 text-md flex items-center justify-center col-span-2"
          >
            <ChevronRight className="mr-2 h-5 w-5" /> Próxima Ação
          </Button>
        </div>
      )}
    </Card>
  );
};

export default GTDTaskCard;