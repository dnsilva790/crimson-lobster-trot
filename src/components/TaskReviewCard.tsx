"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { TodoistTask } from "@/lib/types";
import { cn, getDelegateNameFromLabels, getSolicitante, updateDescriptionWithSection } from "@/lib/utils"; // Importar updateDescriptionWithSection
import { format, setHours, setMinutes, parseISO, isValid, parse } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Check, Trash2, ArrowRight, ExternalLink, Briefcase, Home, MinusCircle, CalendarIcon, Clock, RotateCcw, Tag, MessageSquare, User, Users, Save, XCircle } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { toast } from "sonner";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea"; // Importar Textarea
import {
  FOCO_LABEL_ID,
  RAPIDA_LABEL_ID,
  CRONOGRAMA_HOJE_LABEL,
} from "@/lib/constants"; // Importar as constantes das etiquetas

interface TaskReviewCardProps {
  task: TodoistTask;
  onKeep: (taskId: string) => void;
  onComplete: (taskId: string) => void;
  onDelete: (taskId: string) => void;
  onUpdateCategory: (taskId: string, newCategory: "pessoal" | "profissional" | "none") => void;
  onUpdatePriority: (taskId: string, newPriority: 1 | 2 | 3 | 4) => void;
  onUpdateDeadline: (taskId: string, dueDate: string | null, dueDateTime: string | null) => Promise<void>;
  onUpdateFieldDeadline: (taskId: string, deadlineDate: string | null) => Promise<void>;
  onReschedule: (taskId: string) => Promise<void>;
  onUpdateDuration: (taskId: string, duration: number | null) => Promise<void>;
  onUpdateTaskDescription: (taskId: string, newDescription: string, newLabels?: string[]) => Promise<TodoistTask | undefined>; // Nova prop
  onToggleFoco: (taskId: string, currentLabels: string[]) => Promise<void>;
  onToggleRapida: (taskId: string, currentLabels: string[]) => Promise<void>;
  onToggleCronograma: (taskId: string, currentLabels: string[]) => Promise<void>;
  isLoading: boolean;
}

const PRIORITY_COLORS: Record<1 | 2 | 3 | 4, string> = {
  4: "bg-red-500",
  3: "bg-orange-500",
  2: "bg-yellow-500",
  1: "bg-gray-400",
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
  onReschedule,
  onUpdateDuration,
  onUpdateTaskDescription, // Nova prop
  onToggleFoco,
  onToggleRapida,
  onToggleCronograma,
  isLoading,
}) => {
  console.log(`TaskReviewCard: Rendering task ${task.id} (${task.content})`, task);

  const [selectedCategory, setSelectedCategory] = useState<"pessoal" | "profissional" | "none">("none");
  const [selectedDueDate, setSelectedDueDate] = useState<Date | undefined>(undefined);
  const [selectedDueTime, setSelectedDueTime] = useState<string>("");
  const [isDeadlinePopoverOpen, setIsDeadlinePopoverOpen] = useState(false);

  const [selectedFieldDeadlineDate, setSelectedFieldDeadlineDate] = useState<Date | undefined>(undefined);
  const [isFieldDeadlinePopoverOpen, setIsFieldDeadlinePopoverOpen] = useState(false);

  const [selectedDuration, setSelectedDuration] = useState<string>(
    task.estimatedDurationMinutes
      ? String(task.estimatedDurationMinutes)
      : ""
  );
  const [observationInput, setObservationInput] = useState(""); // Novo estado para observação
  const [solicitanteInput, setSolicitanteInput] = useState(""); // Novo estado para Solicitante
  const [isSolicitantePopoverOpen, setIsSolicitantePopoverOpen] = useState(false);
  
  const [delegateNameInput, setDelegateNameInput] = useState(""); // Novo estado para Delegado
  const [isDelegatingPopoverOpen, setIsDelegatingPopoverOpen] = useState(false); // Novo estado para popover Delegado

  const debounceTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    console.log("TaskReviewCard: Task prop changed. Updating local states.");
    console.log(`TaskReviewCard: Task ID: ${task.id}, current task.deadline: ${task.deadline}`);
    if (task.labels.includes("pessoal")) {
      setSelectedCategory("pessoal");
    } else if (task.labels.includes("profissional")) {
      setSelectedCategory("profissional");
    } else {
      setSelectedCategory("none");
    }
    
    // Revertendo para usar due_date/datetime
    setSelectedDueDate((typeof task.due?.date === 'string' && task.due.date) ? parseISO(task.due.date) : undefined);
    setSelectedDueTime((typeof task.due?.datetime === 'string' && task.due.datetime) ? format(parseISO(task.due.datetime), "HH:mm") : "");

    setSelectedFieldDeadlineDate((typeof task.deadline === 'string' && task.deadline) ? parseISO(task.deadline) : undefined);
    setSelectedDuration(
      task.estimatedDurationMinutes
        ? String(task.estimatedDurationMinutes)
        : ""
    );
    setSolicitanteInput(getSolicitante(task) || "");
    setDelegateNameInput(getDelegateNameFromLabels(task.labels) || ""); // Inicializa o input do delegado
    console.log("TaskReviewCard: New task.deadline:", task.deadline);
    console.log("TaskReviewCard: New selectedFieldDeadlineDate:", (typeof task.deadline === 'string' && task.deadline) ? parseISO(task.deadline) : undefined);
  }, [task]);

  const handleCategoryChange = (newCategory: "pessoal" | "profissional" | "none") => {
    setSelectedCategory(newCategory);
    onUpdateCategory(task.id, newCategory);
  };

  const handleSetDeadline = async () => {
    let finalDueDate: string | null = null;
    let finalDueDateTime: string | null = null;

    if (selectedDueDate && isValid(selectedDueDate)) {
      if (selectedDueTime) {
        const [hours, minutes] = selectedDueTime.split(":").map(Number);
        const finalDateTime = setMinutes(setHours(selectedDueDate, hours), minutes);
        finalDueDateTime = format(finalDateTime, "yyyy-MM-dd'T'HH:mm:ss");
      } else {
        finalDueDate = format(selectedDueDate, "yyyy-MM-dd");
      }
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
        await onUpdateDuration(task.id, null);
      }
    }, 500);
  }, [onUpdateDuration, task.id]);

  const handleSaveObservation = useCallback(async () => {
    if (!observationInput.trim()) {
      toast.error("A observação não pode ser vazia.");
      return;
    }

    const timestamp = format(new Date(), "dd/MM/yyyy HH:mm", { locale: ptBR });
    const newObservation = `\n\n[${timestamp}] - ${observationInput.trim()}`;
    const updatedDescription = (task.description || "") + newObservation;

    await onUpdateTaskDescription(task.id, updatedDescription);
    setObservationInput("");
    toast.success("Observação adicionada à descrição da tarefa!");
  }, [observationInput, task.id, task.description, onUpdateTaskDescription]);

  const handleSaveSolicitante = useCallback(async () => {
    const newSolicitante = solicitanteInput.trim();
    const updatedDescription = updateDescriptionWithSection(
      task.description || "",
      '[SOLICITANTE]:',
      newSolicitante
    );

    await onUpdateTaskDescription(task.id, updatedDescription);
    setIsSolicitantePopoverOpen(false);
    toast.success("Solicitante atualizado!");
  }, [solicitanteInput, task.id, task.description, onUpdateTaskDescription]);

  const handleSaveDelegate = useCallback(async () => {
    const newDelegateName = delegateNameInput.trim();
    
    if (!newDelegateName) {
      toast.error("O nome do responsável não pode ser vazio.");
      return;
    }

    const delegateLabel = `espera_de_${newDelegateName.toLowerCase().replace(/\s/g, '_')}`;
    
    // Remove qualquer etiqueta de delegação existente
    let updatedLabels = task.labels.filter(label => !label.startsWith("espera_de_"));
    
    // Adiciona a nova etiqueta de delegação
    updatedLabels.push(delegateLabel);

    // Adiciona a informação de delegação na descrição (opcional, mas útil para contexto)
    let newDescription = task.description || "";
    newDescription = updateDescriptionWithSection(newDescription, '[DELEGADO PARA]:', newDelegateName);

    const updated = await onUpdateTaskDescription(task.id, newDescription, updatedLabels);
    if (updated) {
      toast.success(`Tarefa delegada para ${newDelegateName}!`);
      setIsDelegatingPopoverOpen(false);
    } else {
      toast.error("Falha ao delegar a tarefa.");
    }
  }, [delegateNameInput, task.id, task.labels, task.description, onUpdateTaskDescription]);

  const handleClearDelegate = useCallback(async () => {
    // Remove qualquer etiqueta de delegação existente
    let updatedLabels = task.labels.filter(label => !label.startsWith("espera_de_"));
    
    // Remove a seção [DELEGADO PARA] da descrição
    let newDescription = task.description || "";
    newDescription = updateDescriptionWithSection(newDescription, '[DELEGADO PARA]:', '');

    const updated = await onUpdateTaskDescription(task.id, newDescription, updatedLabels);
    if (updated) {
      toast.info("Delegação removida!");
      setDelegateNameInput("");
      setIsDelegatingPopoverOpen(false);
    } else {
      toast.error("Falha ao remover delegação.");
    }
  }, [task.id, task.labels, task.description, onUpdateTaskDescription]);


  const renderDueDate = () => {
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
    } 
    else if (typeof task.due?.date === 'string' && task.due.date) {
      const parsedDate = parseISO(task.due.date);
      if (isValid(parsedDate)) {
        dateElements.push(
          <span key="due-date" className="block">
            Vencimento: {format(parsedDate, "dd/MM/yyyy", { locale: ptBR })}
          </span>
        );
      }
    }
    else if (typeof task.due?.string === 'string' && task.due.string) {
      dateElements.push(
        <span key="due-string-raw" className="block">
          Recorrência: {task.due.string}
        </span>
      );
    }

    if (typeof task.deadline === 'string' && task.deadline) {
      const parsedDeadline = parseISO(task.deadline);
      if (isValid(parsedDeadline)) {
        dateElements.push(
          <span key="field-deadline" className="block text-red-600 font-semibold">
            Deadline: {format(parsedDeadline, "dd/MM/yyyy", { locale: ptBR })}
          </span>
        );
      }
    }

    if (task.estimatedDurationMinutes) {
      dateElements.push(
        <span key="duration" className="block">
          Duração: {task.estimatedDurationMinutes} min
        </span>
      );
    }

    if (dateElements.length === 0) {
      return <span>Sem prazo</span>;
    }

    return <div className="space-y-1">{dateElements}</div>;
  };

  const isFocoActive = task.labels?.includes(FOCO_LABEL_ID);
  const isRapidaActive = task.labels?.includes(RAPIDA_LABEL_ID);
  const isCronogramaActive = task.labels?.includes(CRONOGRAMA_HOJE_LABEL);
  const delegateName = getDelegateNameFromLabels(task.labels);
  const currentSolicitante = getSolicitante(task);

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
      
      <div className="flex flex-col gap-2 text-sm text-gray-600 mt-auto pt-4 border-t border-gray-200">
        {(currentSolicitante || delegateName) && (
          <div className="flex flex-wrap gap-4 mb-2">
            {currentSolicitante && (
              <span className="flex items-center gap-1">
                <User className="h-4 w-4 text-blue-500" /> Solicitante: <span className="font-semibold">{currentSolicitante}</span>
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
        <p className="text-gray-700 mb-2">Gerenciar Etiquetas:</p>
        <div className="grid grid-cols-3 gap-2">
          <Button
            onClick={() => onToggleFoco(task.id, task.labels || [])}
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
            onClick={() => onToggleRapida(task.id, task.labels || [])}
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
            onClick={() => onToggleCronograma(task.id, task.labels || [])}
            disabled={isLoading}
            variant={isCronogramaActive ? "default" : "outline"}
            className={cn(
              "py-3 text-sm flex items-center justify-center",
              isCronogramaActive ? "bg-teal-600 hover:bg-teal-700 text-white" : "text-teal-600 border-teal-600 hover:bg-teal-50"
            )}
          >
            <Tag className="mr-1 h-4 w-4" /> {CRONOGRAMA_HOJE_LABEL}
          </Button>
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

      <div className="mt-6">
        <Label htmlFor="task-observation" className="text-gray-700">Adicionar Observação</Label>
        <Textarea
          id="task-observation"
          value={observationInput}
          onChange={(e) => setObservationInput(e.target.value)}
          placeholder="Adicione uma nota rápida à descrição da tarefa..."
          rows={3}
          className="mt-1"
          disabled={isLoading}
        />
        <Button onClick={handleSaveObservation} className="w-full mt-2 flex items-center gap-2" disabled={isLoading || !observationInput.trim()}>
          <MessageSquare className="mr-2 h-4 w-4" /> Adicionar Observação
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6">
        <Button
          onClick={() => onKeep(task.id)}
          disabled={isLoading}
          className="bg-gray-200 hover:bg-gray-300 text-gray-800 py-3 text-md flex items-center justify-center"
        >
          <ArrowRight className="mr-2 h-5 w-5" /> Pular Revisão
        </Button>
        <Button
          onClick={() => onComplete(task.id)}
          disabled={isLoading}
          className="bg-green-500 hover:bg-green-600 text-white py-3 text-md flex items-center justify-center"
        >
          <Check className="mr-2 h-5 w-5" /> Concluir
        </Button>
        <Button
          onClick={() => onReschedule(task.id)}
          disabled={isLoading}
          className="bg-yellow-500 hover:bg-yellow-600 text-white py-3 text-md flex items-center justify-center"
        >
          <RotateCcw className="mr-2 h-5 w-5" /> Reprogramar (Próx. Hora)
        </Button>
      </div>
      <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-4">
        <Popover open={isDeadlinePopoverOpen} onOpenChange={setIsDeadlinePopoverOpen}>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              disabled={isLoading}
              className="w-full py-3 text-md flex items-center justify-center"
            >
              <CalendarIcon className="mr-2 h-4 w-4" />
              {task.due?.string ? (
                <span>Prazo: {task.due.string}</span>
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
                <XCircle className="mr-2 h-4 w-4" /> Limpar Prazo
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
                <XCircle className="h-4 w-4 mr-2" /> Limpar Deadline
              </Button>
            </div>
          </PopoverContent>
        </Popover>

        <Popover open={isSolicitantePopoverOpen} onOpenChange={setIsSolicitantePopoverOpen}>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              disabled={isLoading}
              className="w-full py-3 text-md flex items-center justify-center text-blue-600 border-blue-600 hover:bg-blue-50"
            >
              <User className="mr-2 h-4 w-4" />
              {currentSolicitante ? (
                <span>Solicitante: {currentSolicitante}</span>
              ) : (
                <span>Definir Solicitante</span>
              )}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-4">
            <h4 className="font-semibold text-lg mb-3">Definir Solicitante</h4>
            <div className="grid gap-4">
              <div>
                <Label htmlFor="solicitante-input">Nome do Solicitante</Label>
                <Input
                  id="solicitante-input"
                  value={solicitanteInput}
                  onChange={(e) => setSolicitanteInput(e.target.value)}
                  placeholder="Ex: João Silva"
                  className="mt-1"
                />
              </div>
              <Button onClick={handleSaveSolicitante} className="w-full" disabled={isLoading}>
                <Save className="h-4 w-4 mr-2" /> Salvar Solicitante
              </Button>
            </div>
          </PopoverContent>
        </Popover>
      </div>
      
      {/* Novo botão de Delegação */}
      <div className="mt-4">
        <Popover open={isDelegatingPopoverOpen} onOpenChange={setIsDelegatingPopoverOpen}>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              disabled={isLoading}
              className="w-full py-3 text-md flex items-center justify-center text-orange-600 border-orange-600 hover:bg-orange-50"
            >
              <Users className="mr-2 h-4 w-4" />
              {delegateName ? (
                <span>Delegado para: {delegateName}</span>
              ) : (
                <span>Delegar Tarefa</span>
              )}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-4">
            <h4 className="font-semibold text-lg mb-3">Delegar Tarefa</h4>
            <div className="grid gap-4">
              <div>
                <Label htmlFor="delegate-input">Nome do Responsável (para etiqueta espera_de_)</Label>
                <Input
                  id="delegate-input"
                  value={delegateNameInput}
                  onChange={(e) => setDelegateNameInput(e.target.value)}
                  placeholder="Ex: joao_silva"
                  className="mt-1"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Use letras minúsculas e underscores.
                </p>
              </div>
              <Button onClick={handleSaveDelegate} className="w-full" disabled={isLoading || !delegateNameInput.trim()}>
                <Save className="h-4 w-4 mr-2" /> Salvar Delegação
              </Button>
              {delegateName && (
                <Button onClick={handleClearDelegate} variant="outline" className="w-full" disabled={isLoading}>
                  <XCircle className="h-4 w-4 mr-2" /> Remover Delegação
                </Button>
              )}
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