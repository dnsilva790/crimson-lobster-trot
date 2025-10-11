"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { TodoistTask } from "@/lib/types";
import { cn } from "@/lib/utils";
import { format, setHours, setMinutes, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Check, Trash2, ArrowRight, ExternalLink, Briefcase, Home, MinusCircle, CalendarIcon, Clock } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { toast } from "sonner";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";

interface TaskReviewCardProps {
  task: TodoistTask;
  onKeep: (taskId: string) => void;
  onComplete: (taskId: string) => void;
  onDelete: (taskId: string) => void;
  onUpdateCategory: (taskId: string, newCategory: "pessoal" | "profissional" | "none") => void;
  onUpdatePriority: (taskId: string, newPriority: 1 | 2 | 3 | 4) => void;
  onUpdateDeadline: (taskId: string, dueDate: string | null, dueDateTime: string | null) => Promise<void>;
  onUpdateFieldDeadline: (taskId: string, deadlineDate: string | null) => Promise<void>;
  onPostpone: (taskId: string) => Promise<void>;
  onUpdateDuration: (taskId: string, duration: number | null) => Promise<void>;
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
  onUpdateDeadline,
  onUpdateFieldDeadline,
  onPostpone,
  onUpdateDuration,
  isLoading,
}) => {
  const [selectedCategory, setSelectedCategory] = useState<"pessoal" | "profissional" | "none">("none");
  const [selectedDueDate, setSelectedDueDate] = useState<Date | undefined>(
    task.due?.date ? parseISO(task.due.date) : undefined
  );
  const [selectedDueTime, setSelectedDueTime] = useState<string>(
    task.due?.datetime ? format(parseISO(task.due.datetime), "HH:mm") : ""
  );
  const [isDeadlinePopoverOpen, setIsDeadlinePopoverOpen] = useState(false);

  const [selectedFieldDeadlineDate, setSelectedFieldDeadlineDate] = useState<Date | undefined>(
    task.deadline ? parseISO(task.deadline) : undefined
  );
  const [isFieldDeadlinePopoverOpen, setIsFieldDeadlinePopoverOpen] = useState(false);

  const [selectedDuration, setSelectedDuration] = useState<string>(
    task.duration?.amount && task.duration.unit === "minute"
      ? String(task.duration.amount)
      : ""
  );

  const debounceTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    console.log("TaskReviewCard: Task prop changed. Updating local states.");
    if (task.labels.includes("pessoal")) {
      setSelectedCategory("pessoal");
    } else if (task.labels.includes("profissional")) {
      setSelectedCategory("profissional");
    } else {
      setSelectedCategory("none");
    }
    setSelectedDueDate(task.due?.date ? parseISO(task.due.date) : undefined);
    setSelectedDueTime(task.due?.datetime ? format(parseISO(task.due.datetime), "HH:mm") : "");
    setSelectedFieldDeadlineDate(task.deadline ? parseISO(task.deadline) : undefined);
    setSelectedDuration(
      task.duration?.amount && task.duration.unit === "minute"
        ? String(task.duration.amount)
        : ""
    );
    console.log("TaskReviewCard: New task.deadline:", task.deadline);
    console.log("TaskReviewCard: New selectedFieldDeadlineDate:", task.deadline ? parseISO(task.deadline) : undefined);
  }, [task]);

  const handleCategoryChange = (newCategory: "pessoal" | "profissional" | "none") => {
    setSelectedCategory(newCategory);
    onUpdateCategory(task.id, newCategory);
  };

  const handleSetDeadline = async () => {
    if (!selectedDueDate) {
      toast.error("Por favor, selecione uma data para o prazo.");
      return;
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

    await onUpdateDeadline(task.id, finalDueDate, finalDueDateTime);
    setIsDeadlinePopoverOpen(false);
  };

  const handleClearDeadline = async () => {
    await onUpdateDeadline(task.id, null, null);
    setSelectedDueDate(undefined);
    setSelectedDueTime("");
    setIsDeadlinePopoverOpen(false);
  };

  const handleSetFieldDeadline = async () => {
    console.log("TaskReviewCard: handleSetFieldDeadline called.");
    if (!selectedFieldDeadlineDate) {
      toast.error("Por favor, selecione uma data para o deadline.");
      return;
    }
    const formattedDeadline = format(selectedFieldDeadlineDate, "yyyy-MM-dd");
    console.log("TaskReviewCard: Calling onUpdateFieldDeadline with taskId:", task.id, "deadlineDate:", formattedDeadline);
    await onUpdateFieldDeadline(task.id, formattedDeadline);
    setIsFieldDeadlinePopoverOpen(false);
  };

  const handleClearFieldDeadline = async () => {
    console.log("TaskReviewCard: handleClearFieldDeadline called.");
    await onUpdateFieldDeadline(task.id, null);
    setSelectedFieldDeadlineDate(undefined);
    setIsFieldDeadlinePopoverOpen(false);
  };

  const handleDurationChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setSelectedDuration(value);

    if (debounceTimeout.current) {
      clearTimeout(debounceTimeout.current);
    }

    debounceTimeout.current = setTimeout(async () => {
      const duration = parseInt(value, 10);
      if (!isNaN(duration) && duration > 0) {
        await onUpdateDuration(task.id, duration);
      } else if (value === "") {
        await onUpdateDuration(task.id, null); // Clear duration if input is empty
      }
    }, 500); // 500ms debounce
  }, [onUpdateDuration, task.id]);

  const renderDueDate = () => {
    const dateElements: JSX.Element[] = [];

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

    if (task.deadline) {
      dateElements.push(
        <span key="field-deadline" className="block text-red-600 font-semibold">
          Deadline: {format(parseISO(task.deadline), "dd/MM/yyyy", { locale: ptBR })}
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

      <div className="mt-6">
        <Label htmlFor="task-duration" className="text-gray-700">Duração Estimada (minutos)</Label>
        <Input
          id="task-duration"
          type="number"
          value={selectedDuration}
          onChange={handleDurationChange}
          min="1"
          placeholder="Ex: 30"
          className="mt-1"
          disabled={isLoading}
        />
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
          onClick={() => onPostpone(task.id)}
          disabled={isLoading}
          className="bg-yellow-500 hover:bg-yellow-600 text-white py-3 text-md flex items-center justify-center"
        >
          <Clock className="mr-2 h-5 w-5" /> Postergue
        </Button>
      </div>
      <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
        <Popover open={isDeadlinePopoverOpen} onOpenChange={setIsDeadlinePopoverOpen}>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              disabled={isLoading}
              className="w-full py-3 text-md flex items-center justify-center"
            >
              <CalendarIcon className="mr-2 h-4 w-4" />
              {selectedDueDate ? (
                <span>
                  {format(selectedDueDate, "dd/MM/yyyy", { locale: ptBR })}
                  {selectedDueTime && ` às ${selectedDueTime}`}
                </span>
              ) : (
                <span>Definir Prazo</span>
              )}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-4">
            <h4 className="font-semibold text-lg mb-3">Definir Prazo da Tarefa</h4>
            <div className="grid gap-4">
              <div>
                <Label htmlFor="due-date">Data de Vencimento</Label>
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
                <Label htmlFor="due-time">Hora de Vencimento (Opcional)</Label>
                <Input
                  id="due-time"
                  type="time"
                  value={selectedDueTime}
                  onChange={(e) => setSelectedDueTime(e.target.value)}
                  className="mt-1"
                />
              </div>
              <Button onClick={handleSetDeadline} className="w-full" disabled={isLoading}>
                Salvar Prazo
              </Button>
              <Button onClick={handleClearDeadline} variant="outline" className="w-full" disabled={isLoading}>
                Limpar Prazo
              </Button>
            </div>
          </PopoverContent>
        </Popover>

        <Popover open={isFieldDeadlinePopoverOpen} onOpenChange={setIsFieldDeadlinePopoverOpen}>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              disabled={isLoading}
              className="w-full py-3 text-md flex items-center justify-center text-red-600 border-red-600 hover:bg-red-50"
            >
              <CalendarIcon className="mr-2 h-4 w-4" />
              {selectedFieldDeadlineDate ? (
                <span>Deadline: {format(selectedFieldDeadlineDate, "dd/MM/yyyy", { locale: ptBR })}</span>
              ) : (
                <span>Definir Deadline</span>
              )}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-4">
            <h4 className="font-semibold text-lg mb-3">Definir Deadline (Campo Todoist)</h4>
            <div className="grid gap-4">
              <div>
                <Label htmlFor="field-deadline-date">Data do Deadline</Label>
                <Calendar
                  mode="single"
                  selected={selectedFieldDeadlineDate}
                  onSelect={setSelectedFieldDeadlineDate}
                  initialFocus
                  locale={ptBR}
                  className="rounded-md border shadow"
                />
              </div>
              <Button onClick={handleSetFieldDeadline} className="w-full" disabled={isLoading}>
                Salvar Deadline
              </Button>
              <Button onClick={handleClearFieldDeadline} variant="outline" className="w-full" disabled={isLoading}>
                Limpar Deadline
              </Button>
            </div>
          </PopoverContent>
        </Popover>
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

export default TaskReviewCard;