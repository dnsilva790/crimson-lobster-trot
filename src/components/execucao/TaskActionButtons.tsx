"use client";

import React, { useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea"; // Importar Textarea
import { Check, ArrowRight, CalendarIcon, Clock, XCircle, Target, Tag, MessageSquare } from "lucide-react"; // Importar o ícone Target e Tag
import { TodoistTask } from "@/lib/types";
import { format, parseISO, setHours, setMinutes, isValid } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import {
  FOCO_LABEL_ID,
  RAPIDA_LABEL_ID,
  CRONOGRAMA_HOJE_LABEL,
} from "@/lib/constants"; // Importar as constantes das etiquetas do local correto

interface TaskActionButtonsProps {
  currentTask: TodoistTask;
  isLoading: boolean;
  onComplete: (taskId: string) => Promise<void>;
  onSkip: () => Promise<void>;
  onUpdateTask: (taskId: string, data: {
    content?: string;
    description?: string;
    priority?: 1 | 2 | 3 | 4;
    due_date?: string | null;
    due_datetime?: string | null;
    duration?: number;
    duration_unit?: "minute" | "day";
    deadline?: string | null;
    recurrence_string?: string | null; // Adicionado
  }) => Promise<TodoistTask | undefined>;
  onPostpone: (taskId: string) => Promise<void>;
  onEmergencyFocus: (taskId: string) => Promise<void>;
  onToggleFoco: (taskId: string, currentLabels: string[]) => Promise<void>;
  onToggleRapida: (taskId: string, currentLabels: string[]) => Promise<void>;
  onToggleCronograma: (taskId: string, currentLabels: string[]) => Promise<void>;
}

const TaskActionButtons: React.FC<TaskActionButtonsProps> = ({
  currentTask,
  isLoading,
  onComplete,
  onSkip,
  onUpdateTask,
  onPostpone,
  onEmergencyFocus,
  onToggleFoco,
  onToggleRapida,
  onToggleCronograma,
}) => {
  const [isReschedulePopoverOpen, setIsReschedulePopoverOpen] = useState(false);
  const [isAddNotePopoverOpen, setIsAddNotePopoverOpen] = useState(false); // Novo estado para o popover de nota
  const [noteInput, setNoteInput] = useState(""); // Novo estado para o input da nota

  const initialDueDate = currentTask.due?.date ? parseISO(currentTask.due.date) : undefined;
  const initialDueTime = currentTask.due?.datetime ? format(parseISO(currentTask.due.datetime), "HH:mm") : "";
  const initialDuration = currentTask.duration?.amount && currentTask.duration.unit === "minute"
    ? String(currentTask.duration.amount)
    : "15"; // Default to 15 minutes
  const initialDeadline = currentTask.deadline ? parseISO(currentTask.deadline) : undefined;
  const initialRecurrenceString = currentTask.recurrence_string || ""; // Novo estado para recorrência

  const [selectedDueDate, setSelectedDueDate] = useState<Date | undefined>(initialDueDate);
  const [selectedDueTime, setSelectedDueTime] = useState<string>(initialDueTime);
  const [selectedPriority, setSelectedPriority] = useState<1 | 2 | 3 | 4>(currentTask.priority);
  const [selectedDuration, setSelectedDuration] = useState<string>(initialDuration);
  const [selectedDeadlineDate, setSelectedDeadlineDate] = useState<Date | undefined>(initialDeadline);
  const [selectedRecurrenceString, setSelectedRecurrenceString] = useState<string>(initialRecurrenceString); // Novo estado para recorrência

  // Helper to get the canonical due string for comparison
  const getCanonicalDueString = useCallback((date: Date | undefined, time: string | undefined, recurrenceString: string | undefined, taskDue: TodoistTask['due']) => {
    if (recurrenceString && recurrenceString.trim() !== "") {
      return recurrenceString.trim();
    }
    if (date && isValid(date)) {
      if (time) {
        const [hours, minutes] = time.split(":").map(Number);
        const dateTime = setMinutes(setHours(date, hours), minutes);
        return format(dateTime, "yyyy-MM-dd'T'HH:mm:ss");
      } else {
        return format(date, "yyyy-MM-dd");
      }
    } else if (taskDue?.datetime) {
      return format(parseISO(taskDue.datetime), "yyyy-MM-dd'T'HH:mm:ss");
    } else if (taskDue?.date) {
      return format(parseISO(taskDue.date), "yyyy-MM-dd");
    }
    return null;
  }, []);


  const handleReschedule = async () => {
    const updateData: {
      priority?: 1 | 2 | 3 | 4;
      due_date?: string | null;
      due_datetime?: string | null;
      duration?: number | null; // Changed to allow null
      duration_unit?: "minute" | "day";
      deadline?: string | null;
      recurrence_string?: string | null; // Adicionado
    } = {};
    let changed = false;

    // --- Handle Recurrence String ---
    if (selectedRecurrenceString !== (currentTask.recurrence_string || "")) {
      updateData.recurrence_string = selectedRecurrenceString.trim() === "" ? null : selectedRecurrenceString.trim();
      changed = true;
      // If recurrence_string is set, clear due_date and due_datetime
      updateData.due_date = null;
      updateData.due_datetime = null;
    } else if (selectedRecurrenceString.trim() === "" && currentTask.recurrence_string) {
      // If recurrence_string was present but now cleared
      updateData.recurrence_string = null;
      changed = true;
    }

    // --- Handle Due Date and Time (only if recurrence_string is NOT being set/updated) ---
    if (updateData.recurrence_string === undefined) { // Only process if recurrence_string wasn't explicitly handled
      const oldDueString = getCanonicalDueString(undefined, undefined, currentTask.recurrence_string, currentTask.due);
      const newDueString = getCanonicalDueString(selectedDueDate, selectedDueTime, undefined, null); // Pass undefined for recurrenceString here

      if (oldDueString !== newDueString) {
        changed = true;
        if (newDueString) {
          if (newDueString.includes('T')) { // It's a datetime
            updateData.due_datetime = newDueString;
            updateData.due_date = null;
          } else { // It's a date
            updateData.due_date = newDueString;
            updateData.due_datetime = null;
          }
        } else { // newDueString is null, meaning cleared
          updateData.due_date = null;
          updateData.due_datetime = null;
        }
      }
    }

    // --- Handle Priority ---
    if (selectedPriority !== currentTask.priority) {
      updateData.priority = selectedPriority;
      changed = true;
    }

    // --- Handle Duration ---
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
      updateData.duration = null; // Explicitly set to null to clear
      // Do NOT set updateData.duration_unit here if duration is null, let the API handle default or omit.
      changed = true;
    }

    // --- Handle Deadline ---
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
    setSelectedDueDate(undefined);
    setSelectedDueTime("");
    setSelectedRecurrenceString(""); // Limpar recorrência
    toast.success("Data de vencimento removida!");
    setIsReschedulePopoverOpen(false);
  };

  const handleClearDeadline = async () => {
    await onUpdateTask(currentTask.id, { deadline: null });
    setSelectedDeadlineDate(undefined);
    toast.success("Deadline removido!");
    setIsReschedulePopoverOpen(false);
  };

  const handleAddNote = useCallback(async () => {
    if (!noteInput.trim()) {
      toast.error("A nota não pode estar vazia.");
      return;
    }

    const timestamp = format(new Date(), "dd/MM/yyyy HH:mm", { locale: ptBR });
    const newNote = `\n\n[${timestamp}] - ${noteInput.trim()}`;
    const updatedDescription = (currentTask.description || "") + newNote;

    await onUpdateTask(currentTask.id, { description: updatedDescription });
    setNoteInput("");
    setIsAddNotePopoverOpen(false);
    toast.success("Nota adicionada à descrição da tarefa!");
  }, [noteInput, currentTask.id, currentTask.description, onUpdateTask]);

  const isFocoActive = currentTask.labels?.includes(FOCO_LABEL_ID);
  const isRapidaActive = currentTask.labels?.includes(RAPIDA_LABEL_ID);
  const isCronogramaActive = currentTask.labels?.includes(CRONOGRAMA_HOJE_LABEL);

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-4 gap-4 mt-6">
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
              <Label htmlFor="reschedule-recurrence-string">Recorrência (Todoist string)</Label>
              <Input
                id="reschedule-recurrence-string"
                type="text"
                value={selectedRecurrenceString}
                onChange={(e) => setSelectedRecurrenceString(e.target.value)}
                placeholder="Ex: 'every day', 'every mon'"
                className="mt-1"
              />
              <p className="text-xs text-gray-500 mt-1">
                Use a sintaxe de recorrência do Todoist. Ex: "every day", "every mon", "every 2 weeks".
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
              <XCircle className="mr-2 h-4 w-4" /> Limpar Data de Vencimento
            </Button>
            <Button onClick={handleClearDeadline} variant="outline" className="w-full text-red-600 border-red-600 hover:bg-red-50">
              <XCircle className="mr-2 h-4 w-4" /> Limpar Deadline
            </Button>
          </div>
        </PopoverContent>
      </Popover>
      <Button
        onClick={() => onPostpone(currentTask.id)}
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
      <Button
        onClick={() => onEmergencyFocus(currentTask.id)}
        disabled={isLoading}
        className="bg-red-600 hover:bg-red-700 text-white py-3 text-md flex items-center justify-center"
      >
        <Target className="mr-2 h-5 w-5" /> Foco de Emergência
      </Button>

      {/* Novos botões para etiquetas */}
      <Button
        onClick={() => onToggleFoco(currentTask.id, currentTask.labels || [])}
        disabled={isLoading}
        variant={isFocoActive ? "default" : "outline"}
        className={cn(
          "py-3 text-sm flex items-center justify-center",
          isFocoActive ? "bg-indigo-600 hover:bg-indigo-700 text-white" : "text-indigo-600 border-indigo-600 hover:bg-indigo-50"
        )}
      >
        <Tag className="mr-1 h-4 w-4" /> {FOCO_LABEL_ID}
      </Button>
      <Button
        onClick={() => onToggleRapida(currentTask.id, currentTask.labels || [])}
        disabled={isLoading}
        variant={isRapidaActive ? "default" : "outline"}
        className={cn(
          "py-3 text-sm flex items-center justify-center",
          isRapidaActive ? "bg-purple-600 hover:bg-purple-700 text-white" : "text-purple-600 border-purple-600 hover:bg-purple-50"
        )}
      >
        <Tag className="mr-1 h-4 w-4" /> {RAPIDA_LABEL_ID}
      </Button>
      <Button
        onClick={() => onToggleCronograma(currentTask.id, currentTask.labels || [])}
        disabled={isLoading}
        variant={isCronogramaActive ? "default" : "outline"}
        className={cn(
          "py-3 text-sm flex items-center justify-center",
          isCronogramaActive ? "bg-teal-600 hover:bg-teal-700 text-white" : "text-teal-600 border-teal-600 hover:bg-teal-50"
        )}
      >
        <Tag className="mr-1 h-4 w-4" /> {CRONOGRAMA_HOJE_LABEL}
      </Button>

      {/* Novo botão para adicionar nota */}
      <Popover open={isAddNotePopoverOpen} onOpenChange={setIsAddNotePopoverOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            disabled={isLoading}
            className="py-3 text-md flex items-center justify-center col-span-2 md:col-span-2 lg:col-span-2"
          >
            <MessageSquare className="mr-2 h-5 w-5" /> Adicionar Nota
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-80 p-4">
          <h4 className="font-semibold text-lg mb-3">Adicionar Nota à Descrição</h4>
          <div className="grid gap-4">
            <div>
              <Label htmlFor="note-input">Sua Nota</Label>
              <Textarea
                id="note-input"
                value={noteInput}
                onChange={(e) => setNoteInput(e.target.value)}
                placeholder="Ex: 'Reunião com João sobre este item.'"
                rows={4}
                className="mt-1"
              />
            </div>
            <Button onClick={handleAddNote} className="w-full" disabled={isLoading || !noteInput.trim()}>
              Salvar Nota
            </Button>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
};

export default TaskActionButtons;