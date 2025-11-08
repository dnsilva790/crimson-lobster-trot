"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  ArrowRight,
  Check,
  Trash2,
  CalendarIcon,
  Clock,
  Users,
  User,
  Save,
  XCircle,
  Lightbulb,
  FolderOpen,
  Scale,
  Tag,
  MessageSquare,
  Briefcase,
  Home,
  MinusCircle,
  ExternalLink,
  PlusCircle,
  ListTodo,
} from "lucide-react";
import { format, parseISO, setHours, setMinutes, isValid, isBefore, startOfDay, differenceInDays } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn, getTaskCategory, getDelegateNameFromLabels, getSolicitante, updateDescriptionWithSection } from "@/lib/utils";
import { EisenhowerTask } from "@/lib/types";
import { useTodoist } from "@/context/TodoistContext";
import { toast } from "sonner";
import { updateEisenhowerRating } from "@/utils/eisenhowerUtils";
import LoadingSpinner from "@/components/ui/loading-spinner";
import {
  FOCO_LABEL_ID,
  RAPIDA_LABEL_ID,
  CRONOGRAMA_HOJE_LABEL,
} from "@/lib/constants";
import { addLearningFeedback, getLearningContextForPrompt } from "@/utils/aiLearningStorage"; // Importar utilitário de aprendizado
import { suggestEisenhowerRating } from "@/services/aiService"; // Importar o novo serviço AI

interface TriagemProcessorProps {
  task: EisenhowerTask;
  onAdvance: () => void;
  onRemove: (taskId: string) => void;
  onUpdate: (updatedTask: EisenhowerTask) => void;
  onRefreshList: () => void;
}

const TRIAGEM_PROCESSED_LABEL = "triagem_processada";

const PRIORITY_COLORS: Record<1 | 2 | 3 | 4, string> = {
  4: "bg-red-500",
  3: "bg-orange-500",
  2: "bg-yellow-500",
  1: "bg-gray-400",
};

const TriagemProcessor: React.FC<TriagemProcessorProps> = ({
  task,
  onAdvance,
  onRemove,
  onUpdate,
  onRefreshList,
}) => {
  const navigate = useNavigate();
  const { updateTask, closeTask, deleteTask, createTodoistTask, isLoading: isLoadingTodoist } = useTodoist();

  // --- SEIRI/SEISO STATES ---
  const [localTask, setLocalTask] = useState<EisenhowerTask>(task);
  const [selectedCategory, setSelectedCategory] = useState<"pessoal" | "profissional" | "none">("none");
  const [selectedPriority, setSelectedPriority] = useState<1 | 2 | 3 | 4>(task.priority);
  const [selectedDuration, setSelectedDuration] = useState<string>(task.estimatedDurationMinutes ? String(task.estimatedDurationMinutes) : "15");
  const [solicitanteInput, setSolicitanteInput] = useState("");
  const [delegateNameInput, setDelegateNameInput] = useState("");
  const [observationInput, setObservationInput] = useState("");
  const [subtaskContent, setSubtaskContent] = useState("");
  
  const [isSchedulingPopoverOpen, setIsSchedulingPopoverOpen] = useState(false);
  const [isDelegatingPopoverOpen, setIsDelegatingPopoverOpen] = useState(false);
  const [isSolicitantePopoverOpen, setIsSolicitantePopoverOpen] = useState(false);
  const [isObservationPopoverOpen, setIsObservationPopoverOpen] = useState(false);

  // Scheduling states
  const [selectedDueDate, setSelectedDueDate] = useState<Date | undefined>(undefined);
  const [selectedDueTime, setSelectedDueTime] = useState<string>("");
  const [selectedDeadlineDate, setSelectedDeadlineDate] = useState<Date | undefined>(undefined);

  // --- EISENHOWER RATING STATES ---
  const [urgencyInput, setUrgencyInput] = useState<string>("50");
  const [importanceInput, setImportanceInput] = useState<string>("50");
  const [isAiThinking, setIsAiThinking] = useState(false);
  
  // --- AI LEARNING STATES ---
  const [aiSuggestedUrgency, setAiSuggestedUrgency] = useState<number | null>(null);
  const [aiSuggestedImportance, setAiSuggestedImportance] = useState<number | null>(null);
  const [isLearningPromptOpen, setIsLearningPromptOpen] = useState(false);
  const [learningReasonInput, setLearningReasonInput] = useState("");


  // --- EFFECTS ---
  useEffect(() => {
    setLocalTask(task);
    // Initialize Seiri states
    const category = getTaskCategory(task);
    setSelectedCategory(category || "none");
    setSelectedPriority(task.priority);
    setSelectedDuration(task.estimatedDurationMinutes ? String(task.estimatedDurationMinutes) : "15");
    setSolicitanteInput(getSolicitante(task) || "");
    setDelegateNameInput(getDelegateNameFromLabels(task.labels) || "");
    
    // Initialize Scheduling states
    setSelectedDueDate((typeof task.due?.date === 'string' && task.due.date) ? parseISO(task.due.date) : undefined);
    setSelectedDueTime((typeof task.due?.datetime === 'string' && task.due.datetime) ? format(parseISO(task.due.datetime), "HH:mm") : "");
    setSelectedDeadlineDate(task.deadline ? parseISO(task.deadline) : undefined);

    // Initialize Eisenhower states
    setUrgencyInput(task.urgency !== null ? String(task.urgency) : "50");
    setImportanceInput(task.importance !== null ? String(task.importance) : "50");
    
    // Reset AI suggestion tracking
    setAiSuggestedUrgency(null);
    setAiSuggestedImportance(null);
    setLearningReasonInput("");
    setIsLearningPromptOpen(false);
  }, [task]);

  // --- UTILS ---
  const validateAndGetNumber = (value: string): number | null => {
    const num = parseInt(value, 10);
    if (isNaN(num) || num < 0 || num > 100) {
      return null;
    }
    return num;
  };

  const getQuadrant = (urgency: number, importance: number): 'do' | 'decide' | 'delegate' | 'delete' => {
    const isUrgent = urgency >= 50;
    const isImportant = importance >= 50;

    if (isUrgent && isImportant) return 'do';
    if (!isUrgent && isImportant) return 'decide';
    if (isUrgent && !isImportant) return 'delegate';
    return 'delete';
  };

  // --- AI SUGGESTION (Uses AI Service) ---
  const handleSuggestWithAI = useCallback(async () => {
    if (!localTask) {
      toast.error("Nenhuma tarefa selecionada para avaliação da IA.");
      return;
    }

    setIsAiThinking(true);
    
    const learningContext = getLearningContextForPrompt();
    
    const suggestion = await suggestEisenhowerRating(localTask, learningContext);

    if (suggestion) {
      const finalU = Math.max(0, Math.min(100, Math.round(suggestion.urgency)));
      const finalI = Math.max(0, Math.min(100, Math.round(suggestion.importance)));

      setUrgencyInput(String(finalU));
      setImportanceInput(String(finalI));
      
      setAiSuggestedUrgency(finalU);
      setAiSuggestedImportance(finalI);

      toast.success("Sugestões da IA carregadas! Revise e salve.");
      toast.info(`Razão da IA: ${suggestion.reasoning}`, { duration: 5000 });
    } else {
      toast.error("Falha ao obter sugestão da IA. Usando valores padrão.");
      setUrgencyInput("50");
      setImportanceInput("50");
      setAiSuggestedUrgency(null);
      setAiSuggestedImportance(null);
    }

    setIsAiThinking(false);
  }, [localTask]);

  // --- SEISO ACTIONS ---
  const handleToggleLabel = useCallback(async (labelToToggle: string) => {
    const isLabelActive = localTask.labels.includes(labelToToggle);
    let newLabels: string[];

    if (isLabelActive) {
      newLabels = localTask.labels.filter(label => label !== labelToToggle);
    } else {
      newLabels = [...new Set([...localTask.labels, labelToToggle])];
    }

    const updated = await updateTask(localTask.id, { labels: newLabels });
    if (updated) {
      setLocalTask(prev => ({ ...prev, labels: newLabels }));
      toast.success(`Etiqueta "${labelToToggle}" ${isLabelActive ? 'removida' : 'adicionada'}!`);
    } else {
      toast.error(`Falha ao atualizar etiqueta "${labelToToggle}".`);
    }
  }, [localTask, updateTask]);

  const handleCreateSubtasks = useCallback(async () => {
    if (!localTask || !subtaskContent.trim()) {
      toast.error("Por favor, insira o conteúdo das subtarefas.");
      return;
    }

    const subtasksToCreate = subtaskContent.split('\n').map(s => s.trim()).filter(s => s.length > 0);
    if (subtasksToCreate.length === 0) {
      toast.error("Nenhuma subtarefa válida para criar.");
      return;
    }

    let createdCount = 0;
    for (const sub of subtasksToCreate) {
      const created = await createTodoistTask({
        content: sub,
        project_id: localTask.project_id,
        parent_id: localTask.id,
        priority: 2,
        labels: ["subtarefa"],
      });
      if (created) {
        createdCount++;
      } else {
        toast.error(`Falha ao criar subtarefa: "${sub}"`);
      }
    }

    if (createdCount > 0) {
      toast.success(`${createdCount} subtarefas criadas para "${localTask.content}"!`);
      setSubtaskContent("");
    } else {
      toast.info("Nenhuma subtarefa foi criada.");
    }
  }, [localTask, subtaskContent, createTodoistTask]);

  // --- CORE SAVE FUNCTION ---
  const handleSaveAndAdvance = useCallback(async (action: 'keep' | 'complete' | 'delete' | 'schedule' | 'delegate' | 'project' | 'next_action') => {
    if (isLoadingTodoist) return;

    const parsedUrgency = validateAndGetNumber(urgencyInput);
    const parsedImportance = validateAndGetNumber(importanceInput);
    const durationAmount = parseInt(selectedDuration, 10);

    if (parsedUrgency === null || parsedImportance === null) {
      toast.error("Por favor, insira valores de Urgência e Importância entre 0 e 100.");
      return;
    }

    // 1. Check for AI Learning Feedback
    const isAISuggestionModified = aiSuggestedUrgency !== null && aiSuggestedImportance !== null && 
                                  (aiSuggestedUrgency !== parsedUrgency || aiSuggestedImportance !== parsedImportance);

    if (isAISuggestionModified && !isLearningPromptOpen && action !== 'complete' && action !== 'delete') {
      // Se a sugestão da IA foi modificada e o prompt de aprendizado não está aberto, abra-o.
      setIsLearningPromptOpen(true);
      return;
    }
    
    // Se o prompt de aprendizado estava aberto, ele já foi tratado por handleSaveLearningCriteriaAndAdvance.
    // Se não foi modificado, ou se a ação é 'complete'/'delete', ou se já estamos no fluxo de aprendizado, continue.

    const quadrant = getQuadrant(parsedUrgency, parsedImportance);
    
    // 2. Prepare all updates (Description, Labels, Rating, Scheduling)
    let newDescription = localTask.description || "";
    let newLabels = [...localTask.labels];
    let updatePayload: any = {};

    // A. Update Eisenhower Rating in Description
    newDescription = updateEisenhowerRating(newDescription, parsedUrgency, parsedImportance, quadrant);
    
    // B. Update Seiri fields (Category, Solicitante, Duration)
    newLabels = newLabels.filter(label => label !== "pessoal" && label !== "profissional");
    if (selectedCategory === "pessoal") newLabels.push("pessoal");
    if (selectedCategory === "profissional") newLabels.push("profissional");
    
    newDescription = updateDescriptionWithSection(newDescription, '[SOLICITANTE]:', solicitanteInput);
    
    updatePayload.priority = selectedPriority;
    updatePayload.duration = isNaN(durationAmount) || durationAmount <= 0 ? null : durationAmount;
    updatePayload.duration_unit = isNaN(durationAmount) || durationAmount <= 0 ? undefined : "minute";
    
    // C. Handle Delegation Label
    newLabels = newLabels.filter(label => !label.startsWith("espera_de_"));
    if (delegateNameInput.trim()) {
      const delegateLabel = `espera_de_${delegateNameInput.trim().toLowerCase().replace(/\s/g, '_')}`;
      newLabels.push(delegateLabel);
      newDescription = updateDescriptionWithSection(newDescription, '[DELEGADO PARA]:', delegateNameInput);
    } else {
      newDescription = updateDescriptionWithSection(newDescription, '[DELEGADO PARA]:', '');
    }

    // D. Handle Scheduling (Due Date/Deadline)
    let finalDueDate: string | null = null;
    let finalDueDateTime: string | null = null;
    let finalDeadline: string | null = null;

    if (selectedDueDate && isValid(selectedDueDate)) {
      if (selectedDueTime) {
        const [hours, minutes] = selectedDueTime.split(":").map(Number);
        const finalDateTime = setMinutes(setHours(selectedDueDate, hours), minutes);
        finalDueDateTime = format(finalDateTime, "yyyy-MM-dd'T'HH:mm:ss");
      } else {
        finalDueDate = format(selectedDueDate, "yyyy-MM-dd");
      }
    }
    if (selectedDeadlineDate && isValid(selectedDeadlineDate)) {
      finalDeadline = format(selectedDeadlineDate, "yyyy-MM-dd");
    }

    updatePayload.due_date = finalDueDate;
    updatePayload.due_datetime = finalDueDateTime;
    updatePayload.deadline = finalDeadline;

    // E. Handle Action-specific labels and updates
    if (action === 'schedule') {
      if (!finalDueDate && !finalDueDateTime) {
        toast.error("Ação 'Agendar' requer uma data de vencimento.");
        return;
      }
      newLabels.push(CRONOGRAMA_HOJE_LABEL); // Usar a etiqueta de cronograma
    } else if (action === 'next_action') {
      newLabels.push(FOCO_LABEL_ID);
    } else if (action === 'project') {
      newLabels.push("projeto");
    }
    
    // F. Add Triagem Processed Label
    newLabels.push(TRIAGEM_PROCESSED_LABEL);
    updatePayload.labels = [...new Set(newLabels)];
    updatePayload.description = newDescription;

    // G. Handle Observation
    if (observationInput.trim()) {
      const timestamp = format(new Date(), "dd/MM/yyyy HH:mm", { locale: ptBR });
      updatePayload.description += `\n\n[${timestamp}] - ${observationInput.trim()}`;
    }

    // 3. Execute Todoist API calls based on action
    let success = false;
    let updatedTask: EisenhowerTask | undefined;

    if (action === 'complete') {
      await closeTask(task.id);
      success = true;
    } else if (action === 'delete') {
      await deleteTask(task.id);
      success = true;
    } else {
      updatedTask = await updateTask(task.id, updatePayload);
      success = !!updatedTask;
    }

    // 4. Update local state and advance
    if (success) {
      toast.success(`Tarefa "${localTask.content}" processada com sucesso!`);
      
      if (action === 'project' && updatedTask) {
        onRemove(task.id);
        navigate("/project-management/create", {
          state: {
            initialWhat: updatedTask.content,
            initialTodoistTaskId: updatedTask.id,
          },
        });
        return;
      }

      if (updatedTask) {
        onUpdate({ ...updatedTask, urgency: parsedUrgency, importance: parsedImportance, quadrant });
      }
      
      if (action === 'complete' || action === 'delete') {
        onRemove(task.id);
      } else {
        onAdvance();
      }
    } else {
      toast.error("Falha ao salvar alterações no Todoist.");
    }
  }, [localTask, urgencyInput, importanceInput, selectedDuration, selectedCategory, selectedPriority, solicitanteInput, delegateNameInput, selectedDueDate, selectedDueTime, selectedDeadlineDate, updateTask, closeTask, deleteTask, onUpdate, onAdvance, onRemove, navigate, observationInput, aiSuggestedUrgency, aiSuggestedImportance, isLearningPromptOpen]);

  const handleSaveLearningCriteriaAndAdvance = useCallback(async (action: 'keep' | 'complete' | 'delete' | 'schedule' | 'delegate' | 'project' | 'next_action') => {
    if (!learningReasonInput.trim()) {
      toast.error("Por favor, explique o motivo da correção para que a IA possa aprender.");
      return;
    }

    if (aiSuggestedUrgency !== null && aiSuggestedImportance !== null) {
      addLearningFeedback({
        taskId: localTask.id,
        aiUrgency: aiSuggestedUrgency,
        aiImportance: aiSuggestedImportance,
        userUrgency: validateAndGetNumber(urgencyInput)!,
        userImportance: validateAndGetNumber(importanceInput)!,
        reason: learningReasonInput.trim(),
        timestamp: new Date().toISOString(),
      });
      toast.info("Feedback de aprendizado salvo!");
    }

    setIsLearningPromptOpen(false);
    setAiSuggestedUrgency(null);
    setAiSuggestedImportance(null);
    setLearningReasonInput("");
    
    // Continue com o fluxo de salvamento original
    await handleSaveAndAdvance(action);
  }, [localTask, aiSuggestedUrgency, aiSuggestedImportance, urgencyInput, importanceInput, learningReasonInput, handleSaveAndAdvance]);


  // --- UI Helpers ---
  const renderTaskDetails = (t: EisenhowerTask) => {
    const category = getTaskCategory(t);
    const currentSolicitante = getSolicitante(t);
    const delegateName = getDelegateNameFromLabels(t.labels);

    return (
      <Card className="p-4 rounded-xl shadow-lg bg-white flex flex-col h-full">
        <div className="flex-grow">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <h3 className="text-xl font-bold text-gray-800">{t.content}</h3>
              {category && (
                <span
                  className={cn(
                    "px-2 py-1 rounded-full text-xs font-medium",
                    category === "pessoal" ? "bg-blue-100 text-blue-800" : "bg-green-100 text-green-800"
                  )}
                >
                  {category === "pessoal" ? "Pessoal" : "Profissional"}
                </span>
              )}
            </div>
            <a href={t.url} target="_blank" rel="noopener noreferrer" className="ml-2 text-indigo-600 hover:text-indigo-800">
              <ExternalLink className="h-4 w-4" />
            </a>
          </div>
          {t.description && (
            <p className="text-sm text-gray-700 mb-3 whitespace-pre-wrap max-h-24 overflow-y-auto">{t.description}</p>
          )}
        </div>
        <div className="flex flex-col gap-1 text-xs text-gray-600 mt-auto pt-2 border-t border-gray-200">
          {(currentSolicitante || delegateName) && (
            <div className="flex flex-wrap gap-3">
              {currentSolicitante && (
                <span className="flex items-center gap-1">
                  <User className="h-3 w-3 text-blue-500" /> Solicitante: <span className="font-semibold">{currentSolicitante}</span>
                </span>
              )}
              {delegateName && (
                <span className="flex items-center gap-1">
                  <Users className="h-3 w-3 text-orange-500" /> Delegado: <span className="font-semibold">{delegateName}</span>
                </span>
              )}
            </div>
          )}
          <div className="flex items-center justify-between text-xs text-gray-500 pt-1">
            <span>P{t.priority} | Duração: {t.estimatedDurationMinutes || 15} min</span>
            {t.deadline && isValid(parseISO(t.deadline)) && (
              <span className="text-red-600 font-semibold">Deadline: {format(parseISO(t.deadline), "dd/MM/yyyy", { locale: ptBR })}</span>
            )}
          </div>
        </div>
      </Card>
    );
  };

  const isFocoActive = localTask.labels?.includes(FOCO_LABEL_ID);
  const isRapidaActive = localTask.labels?.includes(RAPIDA_LABEL_ID);
  const isCronogramaActive = localTask.labels?.includes(CRONOGRAMA_HOJE_LABEL);

  return (
    <>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Coluna 1: Tarefa e Ações Finais */}
        <div className="lg:col-span-1 flex flex-col gap-4">
          {renderTaskDetails(localTask)}
          
          <Card className="p-4">
            <CardTitle className="text-lg font-bold mb-3">Ações Finais (Seiso)</CardTitle>
            <div className="grid grid-cols-2 gap-2">
              <Button onClick={() => handleSaveAndAdvance('complete')} disabled={isLoadingTodoist} className="bg-green-500 hover:bg-green-600 text-white flex items-center gap-2">
                <Check className="h-4 w-4" /> Concluir
              </Button>
              <Button onClick={() => handleSaveAndAdvance('delete')} disabled={isLoadingTodoist} variant="destructive" className="flex items-center gap-2">
                <Trash2 className="h-4 w-4" /> Excluir
              </Button>
              <Button onClick={() => handleSaveAndAdvance('keep')} disabled={isLoadingTodoist} variant="outline" className="flex items-center gap-2">
                <ArrowRight className="h-4 w-4" /> Pular
              </Button>
              <Button onClick={() => handleSaveAndAdvance('next_action')} disabled={isLoadingTodoist} className="bg-purple-600 hover:bg-purple-700 text-white flex items-center gap-2">
                <Tag className="h-4 w-4" /> Próxima Ação
              </Button>
              <Button onClick={() => handleSaveAndAdvance('project')} disabled={isLoadingTodoist} className="bg-blue-600 hover:bg-blue-700 text-white flex items-center gap-2">
                <FolderOpen className="h-4 w-4" /> É Projeto
              </Button>
              <Popover open={isSchedulingPopoverOpen} onOpenChange={setIsSchedulingPopoverOpen}>
                <PopoverTrigger asChild>
                  <Button variant="outline" disabled={isLoadingTodoist} className="flex items-center gap-2">
                    <CalendarIcon className="h-4 w-4" /> Agendar
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
                      <Label htmlFor="schedule-time">Hora (Opcional)</Label>
                      <Input
                        id="schedule-time"
                        type="time"
                        value={selectedDueTime}
                        onChange={(e) => setSelectedDueTime(e.target.value)}
                        className="mt-1"
                      />
                    </div>
                    <div className="mt-2">
                      <Label htmlFor="deadline-date">Deadline (Opcional)</Label>
                      <Calendar
                        mode="single"
                        selected={selectedDeadlineDate}
                        onSelect={setSelectedDeadlineDate}
                        initialFocus
                        locale={ptBR}
                        className="rounded-md border shadow"
                      />
                    </div>
                    <Button onClick={() => handleSaveAndAdvance('schedule')} className="w-full">
                      Salvar Agendamento
                    </Button>
                  </div>
                </PopoverContent>
              </Popover>
            </div>
          </Card>
        </div>

        {/* Coluna 2: Seiri (Classificação, Prioridade, Duração) */}
        <div className="lg:col-span-1 flex flex-col gap-4">
          <Card className="p-4">
            <CardTitle className="text-lg font-bold mb-3">Seiri (Classificação)</CardTitle>
            <CardContent className="grid gap-4 p-0">
              <div>
                <Label className="text-gray-700 mb-2 block">Categoria:</Label>
                <div className="grid grid-cols-3 gap-2">
                  <Button
                    onClick={() => setSelectedCategory("pessoal")}
                    disabled={isLoadingTodoist}
                    variant={selectedCategory === "pessoal" ? "default" : "outline"}
                    className={cn(selectedCategory === "pessoal" ? "bg-blue-600 hover:bg-blue-700 text-white" : "text-blue-600 border-blue-600 hover:bg-blue-50")}
                  >
                    <Home className="mr-1 h-4 w-4" /> Pessoal
                  </Button>
                  <Button
                    onClick={() => setSelectedCategory("profissional")}
                    disabled={isLoadingTodoist}
                    variant={selectedCategory === "profissional" ? "default" : "outline"}
                    className={cn(selectedCategory === "profissional" ? "bg-green-600 hover:bg-green-700 text-white" : "text-green-600 border-green-600 hover:bg-green-50")}
                  >
                    <Briefcase className="mr-1 h-4 w-4" /> Profissional
                  </Button>
                  <Button
                    onClick={() => setSelectedCategory("none")}
                    disabled={isLoadingTodoist}
                    variant={selectedCategory === "none" ? "default" : "outline"}
                    className={cn(selectedCategory === "none" ? "bg-gray-600 hover:bg-gray-700 text-white" : "text-gray-600 border-gray-600 hover:bg-gray-50")}
                  >
                    <MinusCircle className="mr-1 h-4 w-4" /> Nenhuma
                  </Button>
                </div>
              </div>

              <div>
                <Label className="text-gray-700 mb-2 block">Prioridade Todoist (P1-P4):</Label>
                <div className="grid grid-cols-4 gap-2">
                  {[4, 3, 2, 1].map((p) => (
                    <Button
                      key={p}
                      onClick={() => setSelectedPriority(p as 1 | 2 | 3 | 4)}
                      disabled={isLoadingTodoist}
                      variant={selectedPriority === p ? "default" : "outline"}
                      className={cn(selectedPriority === p ? PRIORITY_COLORS[p as 1 | 2 | 3 | 4] : "border-gray-300 text-gray-700 hover:bg-gray-100")}
                    >
                      P{p}
                    </Button>
                  ))}
                </div>
              </div>

              <div>
                <Label htmlFor="task-duration" className="text-gray-700">Duração Estimada (minutos)</Label>
                <Input
                  id="task-duration"
                  type="number"
                  value={selectedDuration}
                  onChange={(e) => setSelectedDuration(e.target.value)}
                  min="1"
                  placeholder="Ex: 30"
                  className="mt-1"
                  disabled={isLoadingTodoist}
                />
              </div>

              <Popover open={isSolicitantePopoverOpen} onOpenChange={setIsSolicitantePopoverOpen}>
                <PopoverTrigger asChild>
                  <Button variant="outline" disabled={isLoadingTodoist} className="w-full flex items-center gap-2">
                    <User className="h-4 w-4" /> Solicitante
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-80 p-4">
                  <h4 className="font-semibold text-lg mb-3">Definir Solicitante</h4>
                  <div className="grid gap-4">
                    <Input
                      value={solicitanteInput}
                      onChange={(e) => setSolicitanteInput(e.target.value)}
                      placeholder="Ex: João Silva"
                    />
                    <Button onClick={() => setIsSolicitantePopoverOpen(false)} className="w-full">
                      <Save className="h-4 w-4 mr-2" /> Salvar
                    </Button>
                  </div>
                </PopoverContent>
              </Popover>

              <Popover open={isDelegatingPopoverOpen} onOpenChange={setIsDelegatingPopoverOpen}>
                <PopoverTrigger asChild>
                  <Button variant="outline" disabled={isLoadingTodoist} className="w-full flex items-center gap-2">
                    <Users className="h-4 w-4" /> Delegar Para
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-80 p-4">
                  <h4 className="font-semibold text-lg mb-3">Delegar Tarefa</h4>
                  <div className="grid gap-4">
                    <Input
                      value={delegateNameInput}
                      onChange={(e) => setDelegateNameInput(e.target.value)}
                      placeholder="Ex: joao_silva (para etiqueta)"
                    />
                    <Button onClick={() => setIsDelegatingPopoverOpen(false)} className="w-full">
                      <Save className="h-4 w-4 mr-2" /> Salvar
                    </Button>
                  </div>
                </PopoverContent>
              </Popover>

              <Popover open={isObservationPopoverOpen} onOpenChange={setIsObservationPopoverOpen}>
                <PopoverTrigger asChild>
                  <Button variant="outline" disabled={isLoadingTodoist} className="w-full flex items-center gap-2">
                    <MessageSquare className="h-4 w-4" /> Observação
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-80 p-4">
                  <h4 className="font-semibold text-lg mb-3">Adicionar Observação</h4>
                  <div className="grid gap-4">
                    <Textarea
                      value={observationInput}
                      onChange={(e) => setObservationInput(e.target.value)}
                      placeholder="Adicione uma nota rápida à descrição da tarefa..."
                      rows={3}
                    />
                    <Button onClick={() => setIsObservationPopoverOpen(false)} className="w-full">
                      <Save className="h-4 w-4 mr-2" /> Salvar
                    </Button>
                  </div>
                </PopoverContent>
              </Popover>
            </CardContent>
          </Card>
        </div>

        {/* Coluna 3: Avaliação Eisenhower e Ações Seiso */}
        <div className="lg:col-span-1 flex flex-col gap-4">
          <Card className="p-4">
            <CardHeader>
              <CardTitle className="text-lg font-bold mb-3 flex items-center gap-2">
                <Scale className="h-5 w-5 text-indigo-600" /> Avaliação Eisenhower
              </CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4 p-0">
              <div>
                <Label htmlFor="urgency-input" className="text-lg font-semibold text-gray-700 flex justify-between items-center">
                  Urgência: <span className="text-blue-600 text-xl font-bold">{urgencyInput}</span>
                </Label>
                <Input
                  id="urgency-input"
                  type="number"
                  min="0"
                  max="100"
                  step="1"
                  value={urgencyInput}
                  onChange={(e) => setUrgencyInput(e.target.value)}
                  className="mt-2"
                  disabled={isLoadingTodoist}
                />
              </div>

              <div>
                <Label htmlFor="importance-input" className="text-lg font-semibold text-gray-700 flex justify-between items-center">
                  Importância: <span className="text-green-600 text-xl font-bold">{importanceInput}</span>
                </Label>
                <Input
                  id="importance-input"
                  type="number"
                  min="0"
                  max="100"
                  step="1"
                  value={importanceInput}
                  onChange={(e) => setImportanceInput(e.target.value)}
                  className="mt-2"
                  disabled={isLoadingTodoist}
                />
              </div>
              <Button
                onClick={handleSuggestWithAI}
                disabled={isAiThinking || isLoadingTodoist}
                className="w-full py-2 text-md bg-purple-600 hover:bg-purple-700 text-white flex items-center justify-center gap-2"
              >
                {isAiThinking ? (
                  <LoadingSpinner size={20} className="text-white" />
                ) : (
                  <Lightbulb className="h-4 w-4" />
                )}
                Sugerir com IA
              </Button>
              <div className="text-center mt-2">
                <p className="text-sm font-semibold text-gray-700">
                  Quadrante Sugerido: <span className="text-indigo-600">{getQuadrant(validateAndGetNumber(urgencyInput) || 0, validateAndGetNumber(importanceInput) || 0).toUpperCase()}</span>
                </p>
              </div>
            </CardContent>
          </Card>

          <Card className="p-4">
            <CardTitle className="text-lg font-bold mb-3 flex items-center gap-2">
              <ListTodo className="h-5 w-5 text-purple-600" /> Quebrar em Subtarefas
            </CardTitle>
            <CardContent className="grid gap-4 p-0">
              <div>
                <Label htmlFor="subtask-content">Conteúdo das Subtarefas (uma por linha)</Label>
                <Textarea
                  id="subtask-content"
                  value={subtaskContent}
                  onChange={(e) => setSubtaskContent(e.target.value)}
                  placeholder="Ex:&#10;- Pesquisar fornecedores&#10;- Contatar 3 fornecedores&#10;- Analisar propostas"
                  rows={4}
                  className="mt-1"
                  disabled={isLoadingTodoist}
                />
              </div>
              <Button onClick={handleCreateSubtasks} className="w-full flex items-center gap-2" disabled={isLoadingTodoist || !subtaskContent.trim()}>
                <PlusCircle className="h-4 w-4" /> Criar Subtarefas
              </Button>
            </CardContent>
          </Card>
          
          <Button 
            onClick={() => handleSaveAndAdvance('keep')} 
            disabled={isLoadingTodoist} 
            className="w-full py-3 text-lg bg-indigo-600 hover:bg-indigo-700 text-white flex items-center justify-center gap-2"
          >
            <Save className="h-5 w-5" /> Salvar Tudo e Próximo
          </Button>
        </div>
      </div>
      
      {/* Popover de Aprendizagem da IA */}
      <Popover open={isLearningPromptOpen} onOpenChange={setIsLearningPromptOpen}>
        <PopoverTrigger asChild>
          <Button variant="ghost" className="hidden"></Button>
        </PopoverTrigger>
        <PopoverContent className="w-96 p-4 bg-yellow-50 border-yellow-400 shadow-xl">
          <h4 className="font-bold text-lg mb-3 text-yellow-800 flex items-center gap-2">
            <Lightbulb className="h-5 w-5" /> Feedback de Aprendizagem da IA
          </h4>
          <p className="text-sm text-gray-700 mb-4">
            Você alterou a sugestão da IA (U:{aiSuggestedUrgency} -> {urgencyInput}, I:{aiSuggestedImportance} -> {importanceInput}).
            Por favor, explique o motivo da sua correção para que a IA possa aprender e melhorar futuras sugestões.
          </p>
          <div className="grid gap-4">
            <div>
              <Label htmlFor="learning-reason">Motivo da Correção</Label>
              <Textarea
                id="learning-reason"
                value={learningReasonInput}
                onChange={(e) => setLearningReasonInput(e.target.value)}
                placeholder="Ex: 'A urgência é maior porque o cliente ligou hoje, o que a IA não sabia.'"
                rows={4}
                className="mt-1"
              />
            </div>
            <Button 
              onClick={() => handleSaveLearningCriteriaAndAdvance('keep')} 
              className="w-full bg-green-600 hover:bg-green-700 text-white"
              disabled={!learningReasonInput.trim()}
            >
              <Save className="h-4 w-4 mr-2" /> Salvar Feedback e Continuar
            </Button>
          </div>
        </PopoverContent>
      </Popover>
    </>
  );
};

export default TriagemProcessor;