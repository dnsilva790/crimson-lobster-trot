"use client";

import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Check, ArrowRight, CalendarIcon, Clock, XCircle } from "lucide-react";
import { TodoistTask } from "@/lib/types";
import { format, parseISO, setHours, setMinutes, isValid } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface TaskActionButtonsProps {
  currentTask: TodoistTask;
  isLoading: boolean;
  onComplete: (taskId: string) => Promise<void>;
  onSkip: () => Promise<void>;
  onUpdateTask: (taskId: string, data: {
    priority?: 1 | 2 | 3 | 4;
    due_date?: string | null;
    due_datetime?: string | null;
    duration?: number; // Adicionado
    duration_unit?: "minute" | "day"; // Adicionado
    deadline?: string | null;
    recurrence_string?: string | null;
  }) => Promise<TodoistTask | undefined>;
  onPostpone: (taskId: string) => Promise<void>; // Nova prop para postergar
}

const TaskActionButtons: React.FC<TaskActionButtonsProps> = ({
  currentTask,
  isLoading,
  onComplete,
  onSkip,
  onUpdateTask,
  onPostpone, // Nova prop
}) => {
  const [isReschedulePopoverOpen, setIsReschedulePopoverOpen] = useState(false);

  const initialDuration = currentTask.duration?.amount && currentTask.duration.unit === "minute"
    ? String(currentTask.duration.amount)
    : "15"; // Default to 15 minutes
  const initialDeadline = currentTask.deadline ? parseISO(currentTask.deadline) : undefined;
  const initialDueString = currentTask.recurrence_string || currentTask.due?.string || "";

  const [selectedDueString, setSelectedDueString] = useState<string>(initialDueString);
  const [selectedPriority, setSelectedPriority] = useState<1 | 2 | 3 | 4>(currentTask.priority);
  const [selectedDuration, setSelectedDuration] = useState<string>(initialDuration); // Novo estado para duração
  const [selectedDeadlineDate, setSelectedDeadlineDate] = useState<Date | undefined>(initialDeadline);

  const handleReschedule = async () => {
    const updateData: {
      priority?: 1 | 2 | 3 | 4;
      due_date?: string | null;
      due_datetime?: string | null;
      duration?: number | null;
      duration_unit?: "minute" | "day";
      deadline?: string | null;
      recurrence_string?: string | null;
    } = {};
    let changed = false;

    // Handle Due Date/Time/Recurrence via string
    if (selectedDueString !== (currentTask.recurrence_string || currentTask.due?.string || "")) {
      updateData.recurrence_string = selectedDueString.trim() === "" ? null : selectedDueString.trim();
      // Clear explicit date/datetime fields if recurrence string is used
      updateData.due_date = null;
      updateData.due_datetime = null;
      changed = true;
    }

    // Handle Priority
    if (selectedPriority !== currentTask.priority) {
      updateData.priority = selectedPriority;
      changed = true;
    }

    // Handle Duration
    const newDurationAmount = parseInt(selectedDuration, 10);
    const currentDurationAmount = currentTask.duration?.amount;
    const currentDurationUnit = currentTask.duration?.unit;

    if (!isNaN(newDurationAmount) && newDurationAmount > 0) {
      if (newDurationAmount !== currentDurationAmount || currentDurationUnit !== "minute") {
        updateData.duration = newDurationAmount;
        updateData.duration_unit = "minute";
        changed = true;
      }
    } else if (currentDurationAmount !== undefined || currentDurationUnit !== undefined) {
      // If duration was present but now cleared or invalid
      updateData.duration = null;
      changed = true;
    }

    // Handle Deadline
    if (selectedDeadlineDate && isValid(selectedDeadlineDate)) {
      const formattedDeadline = format(selectedDeadlineDate, "yyyy-MM-dd");
      if (formattedDeadline !== currentTask.deadline) {
        updateData.deadline = formattedDeadline;
        changed = true;
      }
    } else if (!selectedDeadlineDate && currentTask.deadline) {
      updateData.deadline = null;
      changed = true;
    }

    if (changed) {
      await onUpdateTask(currentTask.id, updateData);
      toast.success("Tarefa reagendada e atualizada!");
    } else {
      toast.info("Nenhuma alteração para reagendar.");
    }
    setIsReschedulePopoverOpen(false);
  };

  const handleClearDueDate = async () => {
    await onUpdateTask(currentTask.id, { due_date: null, due_datetime: null, recurrence_string: null });
    setSelectedDueString("");
    toast.success("Prazo de vencimento removido!");
    setIsReschedulePopoverOpen(false);
  };

  const handleClearDeadline = async () => {
    await onUpdateTask(currentTask.id, { deadline: null });
    setSelectedDeadlineDate(undefined);
    toast.success("Deadline removido!");
    setIsReschedulePopoverOpen(false);
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mt-6">
      <Button
        onClick={() => onComplete(currentTask.id)}
        disabled={isLoading}
        className="bg-green-500 hover:bg-green-600 text-white py-3 text-md flex items-center justify-center"
      >
        <Check className="mr-2 h-5 w-5" /> Concluir
      </Button>
      <Popover open={isReschedulePopoverOpen} onOpenChange={setIsReschedulePopoverOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            disabled={isLoading}
            className="py-3 text-md flex items-center justify-center"
          >
            <CalendarIcon className="mr-2 h-5 w-5" /> Reagendar
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-80 p-4">
          <h4 className="font-semibold text-lg mb-3">Reagendar Tarefa</h4>
          <div className="grid gap-4">
            <div>
              <Label htmlFor="reschedule-due-string">Prazo (Linguagem Natural Todoist)</Label>
              <Input
                id="reschedule-due-string"
                type="text"
                value={selectedDueString}
                onChange={(e) => setSelectedDueString(e.target.value)}
                placeholder="Ex: 'today 9am', 'every day', 'next monday'"
                className="mt-1"
              />
              <p className="text-xs text-gray-500 mt-1">
                Use a sintaxe de prazo do Todoist.
              </p>
            </div>
            <div>
              <Label htmlFor="reschedule-priority">Prioridade</Label>
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
              <Label htmlFor="reschedule-duration">Duração Estimada (minutos)</Label>
              <Input
                id="reschedule-duration"
                type="number"
                value={selectedDuration}
                onChange={(e) => setSelectedDuration(e.target.value)}
                min="1"
                placeholder="Ex: 30"
                className="mt-1"
              />
            </div>
            <div>
              <Label htmlFor="reschedule-deadline">Deadline (Opcional)</Label>
              <Calendar
                mode="single"
                selected={selectedDeadlineDate}
                onSelect={setSelectedDeadlineDate}
                initialFocus
                locale={ptBR}
                className="rounded-md border shadow"
              />
            </div>
            <Button onClick={handleReschedule} className="w-full">
              Salvar Reagendamento
            </Button>
            <Button onClick={handleClearDueDate} variant="outline" className="w-full">
              <XCircle className="mr-2 h-4 w-4" /> Limpar Prazo
            </Button>
            <Button onClick={handleClearDeadline} variant="outline" className="w-full text-red-600 border-red-600 hover:bg-red-50">
              <XCircle className="mr-2 h-4 w-4" /> Limpar Deadline
            </Button>
          </div>
        </PopoverContent>
      </Popover>
      <Button
        onClick={() => onPostpone(currentTask.id)} // Usando a nova prop
        disabled={isLoading}
        className="bg-yellow-500 hover:bg-yellow-600 text-white py-3 text-md flex items-center justify-center"
      >
        <Clock className="mr-2 h-5 w-5" /> Postergue
      </Button>
      <Button
        onClick={onSkip}
        disabled={isLoading}
        className="bg-gray-200 hover:bg-gray-300 text-gray-800 py-3 text-md flex items-center justify-center"
      >
        <ArrowRight className="mr-2 h-5 w-5" /> Pular
      </Button>
    </div>
  );
};

export default TaskActionButtons;