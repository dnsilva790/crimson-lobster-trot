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
import { format, parseISO, setHours, setMinutes } from "date-fns";
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
  }) => Promise<TodoistTask | undefined>;
}

const TaskActionButtons: React.FC<TaskActionButtonsProps> = ({
  currentTask,
  isLoading,
  onComplete,
  onSkip,
  onUpdateTask,
}) => {
  const [isReschedulePopoverOpen, setIsReschedulePopoverOpen] = useState(false);
  const [isDeadlinePopoverOpen, setIsDeadlinePopoverOpen] = useState(false);

  const initialDueDate = currentTask.due?.date ? parseISO(currentTask.due.date) : undefined;
  const initialDueTime = currentTask.due?.datetime ? format(parseISO(currentTask.due.datetime), "HH:mm") : "";

  const [selectedDueDate, setSelectedDueDate] = useState<Date | undefined>(initialDueDate);
  const [selectedDueTime, setSelectedDueTime] = useState<string>(initialDueTime);
  const [selectedPriority, setSelectedPriority] = useState<1 | 2 | 3 | 4>(currentTask.priority);

  const handleReschedule = async () => {
    const updateData: {
      priority?: 1 | 2 | 3 | 4;
      due_date?: string | null;
      due_datetime?: string | null;
    } = {};
    let changed = false;

    if (selectedDueDate) {
      let finalDate = selectedDueDate;
      if (selectedDueTime) {
        const [hours, minutes] = selectedDueTime.split(":").map(Number);
        finalDate = setMinutes(setHours(selectedDueDate, hours), minutes);
        updateData.due_datetime = format(finalDate, "yyyy-MM-dd'T'HH:mm:ss");
        updateData.due_date = null;
      } else {
        updateData.due_date = format(finalDate, "yyyy-MM-dd");
        updateData.due_datetime = null;
      }

      const currentTaskDueDateTime = currentTask.due?.datetime ? format(parseISO(currentTask.due.datetime), "yyyy-MM-dd'T'HH:mm:ss") : null;
      const currentTaskDueDate = currentTask.due?.date ? format(parseISO(currentTask.due.date), "yyyy-MM-dd") : null;

      if (updateData.due_datetime && updateData.due_datetime !== currentTaskDueDateTime) {
        changed = true;
      } else if (updateData.due_date && updateData.due_date !== currentTaskDueDate && !currentTaskDueDateTime) {
        changed = true;
      } else if (!updateData.due_date && !updateData.due_datetime && (currentTaskDueDate || currentTaskDueDateTime)) {
        changed = true;
      }
    } else if (!selectedDueDate && (currentTask.due?.date || currentTask.due?.datetime)) {
      updateData.due_date = null;
      updateData.due_datetime = null;
      changed = true;
    }

    if (selectedPriority !== currentTask.priority) {
      updateData.priority = selectedPriority;
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
    await onUpdateTask(currentTask.id, { due_date: null, due_datetime: null });
    setSelectedDueDate(undefined);
    setSelectedDueTime("");
    toast.success("Data de vencimento removida!");
    setIsReschedulePopoverOpen(false);
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6">
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
              <Label htmlFor="reschedule-date">Data de Vencimento</Label>
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
              <Label htmlFor="reschedule-time">Hora de Vencimento (Opcional)</Label>
              <Input
                id="reschedule-time"
                type="time"
                value={selectedDueTime}
                onChange={(e) => setSelectedDueTime(e.target.value)}
                className="mt-1"
              />
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
            <Button onClick={handleReschedule} className="w-full">
              Salvar Reagendamento
            </Button>
            <Button onClick={handleClearDueDate} variant="outline" className="w-full">
              <XCircle className="mr-2 h-4 w-4" /> Limpar Data de Vencimento
            </Button>
          </div>
        </PopoverContent>
      </Popover>
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