"use client";

import React, { useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Check, ExternalLink, CalendarIcon, Clock, Edit, XCircle } from "lucide-react";
import { TodoistTask } from "@/lib/types";
import { format, parseISO, setHours, setMinutes, isValid } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { calculateNext15MinInterval } from "@/utils/dateUtils";

interface FastTrackTaskCardProps {
  task: TodoistTask;
  isLoading: boolean;
  onComplete: (taskId: string) => Promise<void>;
  onUpdateTask: (taskId: string, data: {
    priority?: 1 | 2 | 3 | 4;
    due_date?: string | null;
    due_datetime?: string | null;
    duration?: number;
    duration_unit?: "minute" | "day";
    deadline?: string | null;
  }) => Promise<TodoistTask | undefined>;
  onPostpone: (taskId: string) => Promise<void>;
}

const PRIORITY_COLORS: Record<1 | 2 | 3 | 4, string> = {
  4: "bg-red-500",
  3: "bg-orange-500",
  2: "bg-yellow-500",
  1: "bg-gray-400",
};

const PRIORITY_LABELS: Record<1 | 2 | 3 | 4, string> = {
  4: "P1",
  3: "P2",
  2: "P3",
  1: "P4",
};

const FastTrackTaskCard: React.FC<FastTrackTaskCardProps> = ({
  task,
  isLoading,
  onComplete,
  onUpdateTask,
  onPostpone,
}) => {
  const [isEditPopoverOpen, setIsEditPopoverOpen] = useState(false);

  const initialDueDate = task.due?.date ? parseISO(task.due.date) : undefined;
  const initialDueTime = task.due?.datetime ? format(parseISO(task.due.datetime), "HH:mm") : "";
  const initialDuration = task.duration?.amount && task.duration.unit === "minute"
    ? String(task.duration.amount)
    : (task.estimatedDurationMinutes ? String(task.estimatedDurationMinutes) : "15");
  const initialDeadline = task.deadline ? parseISO(task.deadline) : undefined;

  const [selectedDueDate, setSelectedDueDate] = useState<Date | undefined>(initialDueDate);
  const [selectedDueTime, setSelectedDueTime] = useState<string>(initialDueTime);
  const [selectedPriority, setSelectedPriority] = useState<1 | 2 | 3 | 4>(task.priority);
  const [selectedDuration, setSelectedDuration] = useState<string>(initialDuration);
  const [selectedDeadlineDate, setSelectedDeadlineDate] = useState<Date | undefined>(initialDeadline);

  // Reset states when popover opens or task changes
  React.useEffect(() => {
    if (isEditPopoverOpen) {
      setSelectedDueDate(initialDueDate);
      setSelectedDueTime(initialDueTime);
      setSelectedPriority(task.priority);
      setSelectedDuration(initialDuration);
      setSelectedDeadlineDate(initialDeadline);
    }
  }, [isEditPopoverOpen, task, initialDueDate, initialDueTime, initialDuration, initialDeadline]);

  const handleUpdate = useCallback(async () => {
    const updateData: {
      priority?: 1 | 2 | 3 | 4;
      due_date?: string | null;
      due_datetime?: string | null;
      duration?: number;
      duration_unit?: "minute" | "day";
      deadline?: string | null;
    } = {};
    let changed = false;

    // Handle Due Date and Time
    if (selectedDueDate && isValid(selectedDueDate)) {
      let finalDate = selectedDueDate;
      if (selectedDueTime) {
        const [hours, minutes] = (selectedDueTime || '').split(":").map(Number);
        finalDate = setMinutes(setHours(selectedDueDate, hours), minutes);
        updateData.due_datetime = format(finalDate, "yyyy-MM-dd'T'HH:mm:ss");
        updateData.due_date = null;
      } else {
        updateData.due_date = format(finalDate, "yyyy-MM-dd");
        updateData.due_datetime = null;
      }

      const currentTaskDueDateTime = task.due?.datetime ? format(parseISO(task.due.datetime), "yyyy-MM-dd'T'HH:mm:ss") : null;
      const currentTaskDueDate = task.due?.date ? format(parseISO(task.due.date), "yyyy-MM-dd") : null;

      if (updateData.due_datetime && updateData.due_datetime !== currentTaskDueDateTime) {
        changed = true;
      } else if (updateData.due_date && updateData.due_date !== currentTaskDueDate && !currentTaskDueDateTime) {
        changed = true;
      } else if (!updateData.due_date && !updateData.due_datetime && (currentTaskDueDate || currentTaskDueDateTime)) {
        changed = true;
      }
    } else if (!selectedDueDate && (task.due?.date || task.due?.datetime)) {
      updateData.due_date = null;
      updateData.due_datetime = null;
      changed = true;
    }

    // Handle Priority
    if (selectedPriority !== task.priority) {
      updateData.priority = selectedPriority;
      changed = true;
    }

    // Handle Duration
    const newDurationAmount = parseInt(selectedDuration, 10);
    const currentDurationAmount = task.duration?.amount;
    const currentDurationUnit = task.duration?.unit;

    if (!isNaN(newDurationAmount) && newDurationAmount > 0) {
      if (newDurationAmount !== currentDurationAmount || currentDurationUnit !== "minute") {
        updateData.duration = newDurationAmount;
        updateData.duration_unit = "minute";
        changed = true;
      }
    } else if (currentDurationAmount !== undefined || currentDurationUnit !== undefined) {
      updateData.duration = null;
      updateData.duration_unit = undefined;
      changed = true;
    }

    // Handle Deadline
    if (selectedDeadlineDate && isValid(selectedDeadlineDate)) {
      const formattedDeadline = format(selectedDeadlineDate, "yyyy-MM-dd");
      if (formattedDeadline !== task.deadline) {
        updateData.deadline = formattedDeadline;
        changed = true;
      }
    } else if (!selectedDeadlineDate && task.deadline) {
      updateData.deadline = null;
      changed = true;
    }

    if (changed) {
      await onUpdateTask(task.id, updateData);
      toast.success("Tarefa atualizada!");
    } else {
      toast.info("Nenhuma alteração para salvar.");
    }
    setIsEditPopoverOpen(false);
  }, [selectedDueDate, selectedDueTime, selectedPriority, selectedDuration, selectedDeadlineDate, task, onUpdateTask]);

  const handleClearDueDate = useCallback(async () => {
    await onUpdateTask(task.id, { due_date: null, due_datetime: null });
    setSelectedDueDate(undefined);
    setSelectedDueTime("");
    toast.success("Data de vencimento removida!");
    setIsEditPopoverOpen(false);
  }, [task.id, onUpdateTask]);

  const handleClearDeadline = useCallback(async () => {
    await onUpdateTask(task.id, { deadline: null });
    setSelectedDeadlineDate(undefined);
    toast.success("Deadline removido!");
    setIsEditPopoverOpen(false);
  }, [task.id, onUpdateTask]);

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

    if (task.estimatedDurationMinutes) {
      dateElements.push(
        <span key="duration" className="flex items-center gap-1">
          <Clock className="h-3 w-3" /> {task.estimatedDurationMinutes} min
        </span>
      );
    }

    if (dateElements.length === 0) {
      return <span>Sem prazo</span>;
    }

    return <div className="flex flex-wrap gap-x-4 gap-y-1">{dateElements}</div>;
  };

  return (
    <Card className="p-4 rounded-xl shadow-sm bg-white flex flex-col h-full">
      <div className="flex-grow">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-lg font-bold text-gray-800">{task.content}</h3>
          <a href={task.url} target="_blank" rel="noopener noreferrer" className="ml-2 text-indigo-600 hover:text-indigo-800">
            <ExternalLink className="h-4 w-4" />
          </a>
        </div>
        {task.description && (
          <p className="text-sm text-gray-700 mb-3 whitespace-pre-wrap line-clamp-3">{task.description}</p>
        )}
      </div>
      <div className="flex items-center justify-between text-xs text-gray-500 mt-auto pt-3 border-t border-gray-200">
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
      <div className="grid grid-cols-2 gap-2 mt-4">
        <Button
          onClick={() => onComplete(task.id)}
          disabled={isLoading}
          className="bg-green-500 hover:bg-green-600 text-white py-2 text-sm flex items-center justify-center"
        >
          <Check className="mr-2 h-4 w-4" /> Concluir
        </Button>
        <Popover open={isEditPopoverOpen} onOpenChange={setIsEditPopoverOpen}>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              disabled={isLoading}
              className="py-2 text-sm flex items-center justify-center"
            >
              <Edit className="mr-2 h-4 w-4" /> Editar
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-80 p-4">
            <h4 className="font-semibold text-lg mb-3">Editar Tarefa</h4>
            <div className="grid gap-4">
              <div>
                <Label htmlFor="edit-duration">Duração Estimada (minutos)</Label>
                <Input
                  id="edit-duration"
                  type="number"
                  value={selectedDuration}
                  onChange={(e) => setSelectedDuration(e.target.value)}
                  min="1"
                  placeholder="Ex: 30"
                  className="mt-1"
                />
              </div>
              <div>
                <Label htmlFor="edit-priority">Prioridade</Label>
                <Select
                  value={String(selectedPriority)}
                  onValueChange={(value) => setSelectedPriority(Number(value) as 1 | 2 | 3 | 4)}
                >
                  <SelectTrigger className="w-full mt-1">
                    <SelectValue placeholder="Selecione a prioridade" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="4">P1 - Urgente</SelectItem>
                    <SelectItem value="3">P2 - Alto</SelectItem>
                    <SelectItem value="2">P3 - Médio</SelectItem>
                    <SelectItem value="1">P4 - Baixo</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="edit-due-date">Data de Vencimento</Label>
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
                <Label htmlFor="edit-due-time">Hora de Vencimento (Opcional)</Label>
                <Input
                  id="edit-due-time"
                  type="time"
                  value={selectedDueTime}
                  onChange={(e) => setSelectedDueTime(e.target.value)}
                  className="mt-1"
                />
              </div>
              <div>
                <Label htmlFor="edit-deadline">Deadline (Opcional)</Label>
                <Calendar
                  mode="single"
                  selected={selectedDeadlineDate}
                  onSelect={setSelectedDeadlineDate}
                  initialFocus
                  locale={ptBR}
                  className="rounded-md border shadow"
                />
              </div>
              <Button onClick={handleUpdate} className="w-full">
                Salvar Alterações
              </Button>
              <Button onClick={handleClearDueDate} variant="outline" className="w-full">
                <XCircle className="mr-2 h-4 w-4" /> Limpar Data de Vencimento
              </Button>
              <Button onClick={handleClearDeadline} variant="outline" className="w-full text-red-600 border-red-600 hover:bg-red-50">
                <XCircle className="mr-2 h-4 w-4" /> Limpar Deadline
              </Button>
            </div>
          </PopoverContent>
        </Popover>
        <Button
          onClick={() => onPostpone(task.id)}
          disabled={isLoading}
          className="bg-yellow-500 hover:bg-yellow-600 text-white py-2 text-sm flex items-center justify-center col-span-2"
        >
          <Clock className="mr-2 h-4 w-4" /> Postergue
        </Button>
      </div>
    </Card>
  );
};

export default FastTrackTaskCard;