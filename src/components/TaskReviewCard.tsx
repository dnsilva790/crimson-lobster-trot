"use client";

import React, { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { TodoistTask } from "@/lib/types";
import { cn } from "@/lib/utils";
import { format, parseISO, setHours, setMinutes } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Check, Trash2, ArrowRight, ExternalLink, Briefcase, Home, MinusCircle, CalendarIcon, Clock, XCircle } from "lucide-react"; // Adicionado CalendarIcon, Clock, XCircle
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"; // Importar Popover
import { Calendar } from "@/components/ui/calendar"; // Importar Calendar
import { Input } from "@/components/ui/input"; // Importar Input
import { Label } from "@/components/ui/label"; // Importar Label
import { toast } from "sonner"; // Importar toast

interface TaskReviewCardProps {
  task: TodoistTask;
  onKeep: (taskId: string) => void;
  onComplete: (taskId: string) => void;
  onDelete: (taskId: string) => void;
  onUpdateCategory: (taskId: string, newCategory: "pessoal" | "profissional" | "none") => void;
  onUpdatePriority: (taskId: string, newPriority: 1 | 2 | 3 | 4) => void;
  onUpdateTask: (taskId: string, data: { // Nova prop para atualização geral da tarefa
    content?: string;
    description?: string;
    priority?: 1 | 2 | 3 | 4;
    due_date?: string | null;
    due_datetime?: string | null;
    labels?: string[];
    duration?: number;
    duration_unit?: "minute" | "day";
  }) => Promise<TodoistTask | undefined>;
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

const TaskReviewCard: React.FC<TaskReviewCardProps> = ({
  task,
  onKeep,
  onComplete,
  onDelete,
  onUpdateCategory,
  onUpdatePriority,
  onUpdateTask, // Usando a nova prop
  isLoading,
}) => {
  const [selectedCategory, setSelectedCategory] = useState<"pessoal" | "profissional" | "none">("none");
  const [isReschedulePopoverOpen, setIsReschedulePopoverOpen] = useState(false);

  const initialDueDate = task.due?.date ? parseISO(task.due.date) : undefined;
  const initialDueTime = task.due?.datetime ? format(parseISO(task.due.datetime), "HH:mm") : "";

  const [selectedDueDate, setSelectedDueDate] = useState<Date | undefined>(initialDueDate);
  const [selectedDueTime, setSelectedDueTime] = useState<string>(initialDueTime);

  useEffect(() => {
    if (task.labels.includes("pessoal")) {
      setSelectedCategory("pessoal");
    } else if (task.labels.includes("profissional")) {
      setSelectedCategory("profissional");
    } else {
      setSelectedCategory("none");
    }
    // Reset reschedule popover states when task changes
    setSelectedDueDate(initialDueDate);
    setSelectedDueTime(initialDueTime);
  }, [task, initialDueDate, initialDueTime]);

  const handleCategoryChange = (newCategory: "pessoal" | "profissional" | "none") => {
    setSelectedCategory(newCategory);
    onUpdateCategory(task.id, newCategory);
  };

  const handleReschedule = async () => {
    const updateData: {
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

    if (changed) {
      await onUpdateTask(task.id, updateData);
      toast.success("Tarefa reagendada e atualizada!");
    } else {
      toast.info("Nenhuma alteração para reagendar.");
    }
    setIsReschedulePopoverOpen(false);
  };

  const handleClearDueDate = async () => {
    await onUpdateTask(task.id, { due_date: null, due_datetime: null });
    setSelectedDueDate(undefined);
    setSelectedDueTime("");
    toast.success("Data de vencimento removida!");
    setIsReschedulePopoverOpen(false);
  };

  const renderDueDate = () => {
    const dateElements: JSX.Element[] = [];

    if (task.deadline?.date) {
      dateElements.push(
        <span key="deadline" className="font-semibold text-red-600 block">
          Data Limite: {format(new Date(task.deadline.date), "dd/MM/yyyy", { locale: ptBR })}
        </span>
      );
    }

    if (task.due?.datetime) {
      dateElements.push(
        <span key="due-datetime" className="block">
          Vencimento: {format(new Date(task.due.datetime), "dd/MM/yyyy HH:mm", { locale: ptBR })}
        </span>
      );
    } else if (task.due?.date) { // Only show due.date if due.datetime is not present
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

  return (
    <Card className="p-6 rounded-xl shadow-lg bg-white flex flex-col h-full max-w-2xl mx-auto">
      <div className="flex-grow">
        <div className="flex items-center gap-2 mb-3">
          <h3 className="text-2xl font-bold text-gray-800">{task.content}</h3>
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

      <div className="mt-6">
        <p className="text-gray-700 mb-2">Definir Categoria:</p>
        <div className="grid grid-cols-3 gap-2">
          <Button
            onClick={() => handleCategoryChange("pessoal")}
            disabled={isLoading}
            variant={selectedCategory === "pessoal" ? "default" : "outline"}
            className={cn(
              "flex items-center justify-center",
              selectedCategory === "pessoal" ? "bg-blue-600 hover:bg-blue-700 text-white" : "text-blue-600 border-blue-600 hover:bg-blue-50"
            )}
          >
            <Home className="mr-2 h-4 w-4" /> Pessoal
          </Button>
          <Button
            onClick={() => handleCategoryChange("profissional")}
            disabled={isLoading}
            variant={selectedCategory === "profissional" ? "default" : "outline"}
            className={cn(
              "flex items-center justify-center",
              selectedCategory === "profissional" ? "bg-green-600 hover:bg-green-700 text-white" : "text-green-600 border-green-600 hover:bg-green-50"
            )}
          >
            <Briefcase className="mr-2 h-4 w-4" /> Profissional
          </Button>
          <Button
            onClick={() => handleCategoryChange("none")}
            disabled={isLoading}
            variant={selectedCategory === "none" ? "default" : "outline"}
            className={cn(
              "flex items-center justify-center",
              selectedCategory === "none" ? "bg-gray-600 hover:bg-gray-700 text-white" : "text-gray-600 border-gray-600 hover:bg-gray-50"
            )}
          >
            <MinusCircle className="mr-2 h-4 w-4" /> Manter Categoria
          </Button>
        </div>
      </div>

      <div className="mt-6">
        <p className="text-gray-700 mb-2">Definir Prioridade:</p>
        <div className="grid grid-cols-4 gap-2">
          {[4, 3, 2, 1].map((p) => (
            <Button
              key={p}
              onClick={() => onUpdatePriority(task.id, p as 1 | 2 | 3 | 4)}
              disabled={isLoading}
              variant={task.priority === p ? "default" : "outline"}
              className={cn(
                "flex items-center justify-center",
                task.priority === p ? PRIORITY_COLORS[p as 1 | 2 | 3 | 4] : "border-gray-300 text-gray-700 hover:bg-gray-100"
              )}
            >
              P{p}
            </Button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6">
        <Button
          onClick={() => onKeep(task.id)}
          disabled={isLoading}
          className="bg-gray-200 hover:bg-gray-300 text-gray-800 py-3 text-md flex items-center justify-center"
        >
          <ArrowRight className="mr-2 h-5 w-5" /> Manter
        </Button>
        <Button
          onClick={() => onComplete(task.id)}
          disabled={isLoading}
          className="bg-green-500 hover:bg-green-600 text-white py-3 text-md flex items-center justify-center"
        >
          <Check className="mr-2 h-5 w-5" /> Concluir
        </Button>
        <Button
          onClick={() => onDelete(task.id)}
          disabled={isLoading}
          className="bg-red-500 hover:bg-red-600 text-white py-3 text-md flex items-center justify-center"
        >
          <Trash2 className="mr-2 h-5 w-5" /> Excluir
        </Button>
      </div>
      <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4"> {/* Ajustado para 2 colunas */}
        <a href={task.url} target="_blank" rel="noopener noreferrer" className="w-full">
          <Button variant="outline" className="w-full py-3 text-md flex items-center justify-center">
            <ExternalLink className="mr-2 h-4 w-4" /> Abrir no Todoist
          </Button>
        </a>
        <Popover open={isReschedulePopoverOpen} onOpenChange={setIsReschedulePopoverOpen}>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              disabled={isLoading}
              className="w-full py-3 text-md flex items-center justify-center"
            >
              <CalendarIcon className="mr-2 h-4 w-4" /> Reagendar
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
              <Button onClick={handleReschedule} className="w-full">
                Salvar Reagendamento
              </Button>
              <Button onClick={handleClearDueDate} variant="outline" className="w-full">
                <XCircle className="mr-2 h-4 w-4" /> Limpar Data de Vencimento
              </Button>
            </div>
          </PopoverContent>
        </Popover>
      </div>
    </Card>
  );
};

export default TaskReviewCard;