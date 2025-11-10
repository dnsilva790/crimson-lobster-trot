"use client";

import React, { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { TodoistTask } from "@/lib/types";
import { cn, isURL } from "@/lib/utils"; // Importar isURL
import { format, setHours, setMinutes, parseISO, isValid } from "date-fns";
import { ptBR } from "date-fns/locale";
import { CalendarIcon, ExternalLink, Repeat2 } from "lucide-react"; // Adicionado Repeat2
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge"; // Importar Badge

interface TaskStandardizationCardProps {
  task: TodoistTask;
  onUpdate: (taskId: string, data: {
    content?: string;
    description?: string;
    priority?: 1 | 2 | 3 | 4;
    due_date?: string | null;
    due_datetime?: string | null;
  }) => void;
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

const TaskStandardizationCard: React.FC<TaskStandardizationCardProps> = ({
  task,
  onUpdate,
  onSkip,
  isLoading,
}) => {
  const initialDueDate = (typeof task.due?.date === 'string' && task.due.date) ? parseISO(task.due.date) : undefined;
  const initialDueTime = (typeof task.due?.datetime === 'string' && task.due.datetime) ? format(parseISO(task.due.datetime), "HH:mm") : "";

  const [selectedDueDate, setSelectedDueDate] = useState<Date | undefined>(initialDueDate);
  const [selectedDueTime, setSelectedDueTime] = useState<string>(initialDueTime);
  const [selectedPriority, setSelectedPriority] = useState<1 | 2 | 3 | 4>(task.priority);

  const handleSave = () => {
    const updateData: {
      priority?: 1 | 2 | 3 | 4;
      due_date?: string | null;
      due_datetime?: string | null;
    } = {};
    let changed = false;

    // Handle Due Date and Time
    if (selectedDueDate && isValid(selectedDueDate)) {
      let finalDate = selectedDueDate;
      if (selectedDueTime) {
        const [hours, minutes] = (selectedDueTime || '').split(":").map(Number);
        finalDate = setMinutes(setHours(selectedDueDate, hours), minutes);
        updateData.due_datetime = format(finalDate, "yyyy-MM-dd'T'HH:mm:ss");
        updateData.due_date = null; // Clear due_date if due_datetime is set
      } else {
        updateData.due_date = format(finalDate, "yyyy-MM-dd");
        updateData.due_datetime = null; // Clear due_datetime if only due_date is set
      }

      // Check if due date/time actually changed
      const currentTaskDueDateTime = (typeof task.due?.datetime === 'string' && task.due.datetime) ? format(parseISO(task.due.datetime), "yyyy-MM-dd'T'HH:mm:ss") : null;
      const currentTaskDueDate = (typeof task.due?.date === 'string' && task.due.date) ? format(parseISO(task.due.date), "yyyy-MM-dd") : null;

      if (updateData.due_datetime && updateData.due_datetime !== currentTaskDueDateTime) {
        changed = true;
      } else if (updateData.due_date && updateData.due_date !== currentTaskDueDate && !currentTaskDueDateTime) {
        changed = true;
      } else if (!updateData.due_date && !updateData.due_datetime && (currentTaskDueDate || currentTaskDueDateTime)) {
        // If both are cleared but task had a due date/time
        changed = true;
      }
    } else if (!selectedDueDate && (task.due?.date || task.due?.datetime)) {
      // If due date was removed
      updateData.due_date = null;
      updateData.due_datetime = null;
      changed = true;
    }

    // Handle Priority
    if (selectedPriority !== task.priority) {
      updateData.priority = selectedPriority;
      changed = true;
    }

    if (changed) {
      onUpdate(task.id, updateData);
    } else {
      onSkip(task.id); // If no changes, just skip
    }
  };

  const renderCurrentDates = () => {
    const dateElements: JSX.Element[] = [];

    if (typeof task.due?.datetime === 'string' && task.due.datetime) {
      const parsedDate = parseISO(task.due.datetime);
      if (isValid(parsedDate)) {
        dateElements.push(
          <span key="due-datetime" className="block">
            Vencimento: {format(parsedDate, "dd/MM/yyyy HH:mm", { locale: ptBR })}
          </span>
        );
      }
    } else if (typeof task.due?.date === 'string' && task.due.date) {
      const parsedDate = parseISO(task.due.date);
      if (isValid(parsedDate)) {
        dateElements.push(
          <span key="due-date" className="block">
            Vencimento: {format(parsedDate, "dd/MM/yyyy", { locale: ptBR })}
          </span>
        );
      }
    }

    if (dateElements.length === 0) {
      return <span>Sem prazo</span>;
    }

    return <div className="space-y-1">{dateElements}</div>;
  };

  const isContentURL = isURL(task.content);
  const isRecurring = task.due?.is_recurring === true; // Adicionado

  return (
    <Card className="p-6 rounded-xl shadow-lg bg-white flex flex-col h-full max-w-2xl mx-auto">
      <div className="flex-grow">
        <div className="flex items-center gap-2 mb-3">
          {isContentURL ? (
            <a href={task.content} target="_blank" rel="noopener noreferrer" className="text-2xl font-bold text-indigo-600 hover:underline">
              {task.content}
            </a>
          ) : (
            <h3 className="text-2xl font-bold text-gray-800">{task.content}</h3>
          )}
          {isRecurring && ( // Adicionado
            <Badge
              className="text-xs font-medium bg-purple-100 text-purple-800 flex items-center gap-1"
              title="Tarefa Recorrente"
            >
              <Repeat2 className="h-3 w-3" /> Recorrente
            </Badge>
          )}
        </div>
        {task.description && (
          <p className="text-md text-gray-700 mb-4 whitespace-pre-wrap">{task.description}</p>
        )}
      </div>

      <div className="flex items-center justify-between text-sm text-gray-500 mt-auto pt-4 border-t border-gray-200">
        {renderCurrentDates()}
        <span
          className={cn(
            "px-2 py-1 rounded-full text-white text-xs font-medium",
            PRIORITY_COLORS[task.priority],
          )}
        >
          {PRIORITY_LABELS[task.priority]}
        </span>
      </div>

      <div className="mt-6 space-y-4">
        <div>
          <Label htmlFor="due-date" className="text-gray-700">Definir Data de Vencimento (Due Date)</Label>
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant={"outline"}
                className={cn(
                  "w-full justify-start text-left font-normal mt-1",
                  !selectedDueDate && "text-muted-foreground"
                )}
                disabled={isLoading}
              >
                <CalendarIcon className="mr-2 h-4 w-4" />
                {selectedDueDate && isValid(selectedDueDate) ? format(selectedDueDate, "PPP", { locale: ptBR }) : <span>Escolha uma data</span>}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0">
              <Calendar
                mode="single"
                selected={selectedDueDate}
                onSelect={setSelectedDueDate}
                initialFocus
                locale={ptBR}
              />
            </PopoverContent>
          </Popover>
        </div>

        <div>
          <Label htmlFor="due-time" className="text-gray-700">Definir Hora de Vencimento (Opcional)</Label>
          <Input
            id="due-time"
            type="time"
            value={selectedDueTime}
            onChange={(e) => setSelectedDueTime(e.target.value)}
            className="mt-1"
            disabled={isLoading}
          />
        </div>

        <div>
          <Label htmlFor="priority" className="text-gray-700">Definir Prioridade</Label>
          <Select
            value={String(selectedPriority)}
            onValueChange={(value) => setSelectedPriority(Number(value) as 1 | 2 | 3 | 4)}
            disabled={isLoading}
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
      </div>

      <div className="grid grid-cols-2 gap-4 mt-6">
        <Button
          onClick={() => onSkip(task.id)}
          disabled={isLoading}
          className="bg-gray-200 hover:bg-gray-300 text-gray-800 py-3 text-md"
        >
          Pular
        </Button>
        <Button
          onClick={handleSave}
          disabled={isLoading}
          className="bg-blue-600 hover:bg-blue-700 text-white py-3 text-md"
        >
          Salvar e Próximo
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

export default TaskStandardizationCard;