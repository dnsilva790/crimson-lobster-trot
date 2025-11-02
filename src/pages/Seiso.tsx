"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  ArrowLeft,
  Users,
  CalendarIcon,
  ListTodo,
  Save,
  PlusCircle,
  XCircle,
  Clock,
  Tag,
  ExternalLink,
  MessageSquare,
} from "lucide-react";
import { format, parseISO, setHours, setMinutes, isValid } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn, getTaskCategory, isURL } from "@/lib/utils"; // Importar isURL
import { TodoistTask } from "@/lib/types";
import { useTodoist } from "@/context/TodoistContext";
import LoadingSpinner from "@/components/ui/loading-spinner";
import { toast } from "sonner";
import {
  FOCO_LABEL_ID,
  RAPIDA_LABEL_ID,
  CRONOGRAMA_HOJE_LABEL,
} from "@/lib/constants";
import SubtaskList from "@/components/SubtaskList"; // Import the new SubtaskList component

const SEISO_PROCESSED_LABEL = "seiso_processada";

// Helper to extract content from a specific tag in the description
const extractSectionContent = (description: string, tag: string): string => {
  const escapedTag = tag.replace(/\[/g, '\\[').replace(/\]/g, '\\]');
  const regex = new RegExp(`${escapedTag}\\s*([\\s\\S]*?)(?=\\n\\[[A-Z_]+\\]:|$|\\n\\n)`, 'i');
  const match = description.match(regex);
  return match && match[1] ? match[1].trim() : '';
};

// Helper to update or add a section in the description, preserving other content
const updateDescriptionWithSection = (
  fullDescription: string,
  tag: string,
  newContent: string
): string => {
  const escapedTag = tag.replace(/\[/g, '\\[').replace(/\]/g, '\\]');
  const regex = new RegExp(`(${escapedTag}\\s*)([\\s\\S]*?)(?=\\n\\[[A-Z_]+\\]:|$|\\n\\n)`, 'i');

  if (newContent.trim()) {
    if (fullDescription.match(regex)) {
      // Replace existing section
      return fullDescription.replace(regex, `${tag} ${newContent.trim()}\n`);
    } else {
      // Add new section at the end if it doesn't exist
      return `${fullDescription.trim()}\n\n${tag} ${newContent.trim()}\n`;
    }
  } else {
    // Remove section if newContent is empty
    return fullDescription.replace(regex, '').trim();
  }
};

const Seiso = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { taskId: paramTaskId } = useParams<{ taskId: string }>();
  const { fetchTaskById, fetchTasks, updateTask, createTodoistTask, isLoading: isLoadingTodoist } = useTodoist();

  const [currentTask, setCurrentTask] = useState<TodoistTask | null>(null);
  const [subtasks, setSubtasks] = useState<TodoistTask[]>([]); // New state for subtasks
  const [isLoadingTask, setIsLoadingTask] = useState(true);

  // New states for Objective and Next Step
  const [objectiveInput, setObjectiveInput] = useState("");
  const [nextStepSeisoInput, setNextStepSeisoInput] = useState("");
  const [observationInput, setObservationInput] = useState("");

  // Delegation states
  const [delegateName, setDelegateName] = useState("");
  const [isDelegatingPopoverOpen, setIsDelegatingPopoverOpen] = useState(false);

  // Scheduling states
  const [selectedDueDate, setSelectedDueDate] = useState<Date | undefined>(undefined);
  const [selectedDueTime, setSelectedDueTime] = useState<string>("");
  const [selectedDeadlineDate, setSelectedDeadlineDate] = useState<Date | undefined>(undefined);
  const [selectedPriority, setSelectedPriority] = useState<1 | 2 | 3 | 4>(1);
  const [selectedDuration, setSelectedDuration] = useState<string>("15");
  const [selectedRecurrenceString, setSelectedRecurrenceString] = useState<string>(""); // Novo estado para recorrência
  const [isSchedulingPopoverOpen, setIsSchedulingPopoverOpen] = useState(false);

  // Subtask creation states
  const [subtaskContent, setSubtaskContent] = useState("");

  // Initial task loading
  useEffect(() => {
    const loadTask = async () => {
      setIsLoadingTask(true);
      const idToFetch = paramTaskId || (location.state as { taskId?: string })?.taskId;
      if (idToFetch) {
        console.log("Seiso: Attempting to fetch main task with ID:", idToFetch);
        const task = await fetchTaskById(idToFetch);
        if (task) {
          console.log("Seiso: Main task fetched:", task);
          setCurrentTask(task);
          // Fetch subtasks for the current task
          console.log("Seiso: Attempting to fetch subtasks for parent ID:", task.id);
          const fetchedSubtasks = await fetchTasks(`parent_id: ${task.id}`, { includeSubtasks: false, includeRecurring: false });
          console.log("Seiso: Subtasks fetched:", fetchedSubtasks);
          setSubtasks(fetchedSubtasks || []);

          // Initialize scheduling states with task's current values
          let initialDueDate: Date | undefined = undefined;
          let initialDueTime: string = "";

          if (typeof task.due?.datetime === 'string' && task.due.datetime) {
            const parsed = parseISO(task.due.datetime);
            if (isValid(parsed)) {
              initialDueDate = parsed;
              initialDueTime = format(parsed, "HH:mm");
            }
          } else if (initialDueDate === undefined && typeof task.due?.date === 'string' && task.due.date) {
            const parsed = parseISO(task.due.date);
            if (isValid(parsed)) {
              initialDueDate = parsed;
            }
          }

          setSelectedDueDate(initialDueDate);
          setSelectedDueTime(initialDueTime);
          setSelectedDeadlineDate(task.deadline ? parseISO(task.deadline) : undefined);
          setSelectedPriority(task.priority);
          setSelectedDuration(task.duration?.amount ? String(task.duration.amount) : "15");
          setSelectedRecurrenceString(task.recurrence_string || ""); // Inicializar recorrência

          // Initialize new fields from description
          const description = task.description || "";
          setObjectiveInput(extractSectionContent(description, '[OBJETIVO]:'));
          setNextStepSeisoInput(extractSectionContent(description, '[PRÓXIMO PASSO SEISO]:'));

        } else {
          toast.error("Tarefa não encontrada.");
          navigate(-1); // Go back if task not found
        }
      } else {
        toast.info("Nenhuma tarefa selecionada para planejamento.");
        setCurrentTask(null);
      }
      setIsLoadingTask(false);
    };
    loadTask();
  }, [paramTaskId, location.state, fetchTaskById, fetchTasks, navigate]);

  const handleSaveObjectiveAndNextStep = useCallback(async () => {
    if (!currentTask) return;

    let newDescription = currentTask.description || "";
    newDescription = updateDescriptionWithSection(newDescription, '[OBJETIVO]:', objectiveInput);
    newDescription = updateDescriptionWithSection(newDescription, '[PRÓXIMO PASSO SEISO]:', nextStepSeisoInput);

    const updated = await updateTask(currentTask.id, { description: newDescription });
    if (updated) {
      toast.success("Objetivo e Próximo Passo atualizados na descrição da tarefa!");
      setCurrentTask(updated); // Update local state with new description
    } else {
      toast.error("Falha ao atualizar objetivo e próximo passo.");
    }
  }, [currentTask, objectiveInput, nextStepSeisoInput, updateTask]);

  const handleSaveObservation = useCallback(async () => {
    if (!currentTask || !observationInput.trim()) {
      toast.error("A observação não pode estar vazia.");
      return;
    }

    const timestamp = format(new Date(), "dd/MM/yyyy HH:mm", { locale: ptBR });
    const newObservation = `\n\n[${timestamp}] - ${observationInput.trim()}`;
    const updatedDescription = (currentTask.description || "") + newObservation;

    const updated = await updateTask(currentTask.id, { description: updatedDescription });
    if (updated) {
      toast.success("Observação adicionada à descrição da tarefa!");
      setCurrentTask(updated); // Update local state with new description
      setObservationInput("");
    } else {
      toast.error("Falha ao adicionar observação.");
    }
  }, [currentTask, observationInput, updateTask]);

  const handleDelegateTask = useCallback(async () => {
    if (!currentTask || !delegateName.trim()) {
      toast.error("Por favor, insira o nome do responsável.");
      return;
    }

    // Save objective/next step before delegating
    let newDescription = currentTask.description || "";
    newDescription = updateDescriptionWithSection(newDescription, '[OBJETIVO]:', objectiveInput);
    newDescription = updateDescriptionWithSection(newDescription, '[PRÓXIMO PASSO SEISO]:', nextStepSeisoInput);
    newDescription = currentTask.description ? `${newDescription}\n\n[DELEGADO PARA]: ${delegateName.trim()}` : `[DELEGADO PARA]: ${delegateName.trim()}`;

    const updatedLabels = [...currentTask.labels.filter(l => !l.startsWith("espera_de_")), `espera_de_${delegateName.trim().toLowerCase().replace(/\s/g, '_')}`, SEISO_PROCESSED_LABEL];

    const updated = await updateTask(currentTask.id, {
      description: newDescription,
      labels: updatedLabels,
    });
    if (updated) {
      toast.success(`Tarefa "${currentTask.content}" delegada para ${delegateName.trim()}.`);
      setCurrentTask(updated);
      setIsDelegatingPopoverOpen(false);
      setDelegateName("");
    } else {
      toast.error("Falha ao delegar a tarefa.");
    }
  }, [currentTask, delegateName, objectiveInput, nextStepSeisoInput, updateTask]);

  const handleScheduleTask = useCallback(async () => {
    if (!currentTask) {
      toast.error("Nenhuma tarefa selecionada para agendar.");
      return;
    }

    // Save objective/next step before scheduling
    let newDescription = currentTask.description || "";
    newDescription = updateDescriptionWithSection(newDescription, '[OBJETIVO]:', objectiveInput);
    newDescription = updateDescriptionWithSection(newDescription, '[PRÓXIMO PASSO SEISO]:', nextStepSeisoInput);

    let finalDueDate: string | null = null;
    let finalDueDateTime: string | null = null;
    let finalDeadline: string | null = null;
    let finalRecurrenceString: string | null = null;

    if (selectedRecurrenceString.trim() !== "") {
      finalRecurrenceString = selectedRecurrenceString.trim();
      finalDueDate = null;
      finalDueDateTime = null;
    } else if (selectedDueDate && isValid(selectedDueDate)) {
      if (selectedDueTime) {
        const [hours, minutes] = (selectedDueTime || '').split(":").map(Number);
        const dateWithTime = setMinutes(setHours(selectedDueDate, hours), minutes);
        finalDueDateTime = format(dateWithTime, "yyyy-MM-dd'T'HH:mm:ss");
        finalDueDate = null; // Clear due_date if due_datetime is set
      } else {
        finalDueDate = format(selectedDueDate, "yyyy-MM-dd");
        finalDueDateTime = null; // Clear due_datetime if only due_date is set
      }
    }

    if (selectedDeadlineDate && isValid(selectedDeadlineDate)) {
      finalDeadline = format(selectedDeadlineDate, "yyyy-MM-dd");
    }

    const durationAmount = parseInt(selectedDuration, 10);
    const updatedLabels = [...new Set([...currentTask.labels, SEISO_PROCESSED_LABEL])];

    const updated = await updateTask(currentTask.id, {
      description: newDescription, // Update description here
      due_date: finalDueDate,
      due_datetime: finalDueDateTime,
      deadline: finalDeadline,
      priority: selectedPriority,
      duration: isNaN(durationAmount) || durationAmount <= 0 ? undefined : durationAmount,
      duration_unit: isNaN(durationAmount) || durationAmount <= 0 ? undefined : "minute",
      labels: updatedLabels,
      recurrence_string: finalRecurrenceString, // Adicionado
    });
    if (updated) {
      toast.success(`Tarefa "${currentTask.content}" agendada e atualizada.`);
      setCurrentTask(updated);
      setIsSchedulingPopoverOpen(false);
    } else {
      toast.error("Falha ao agendar a tarefa.");
    }
  }, [currentTask, selectedDueDate, selectedDueTime, selectedDeadlineDate, selectedPriority, selectedDuration, selectedRecurrenceString, objectiveInput, nextStepSeisoInput, updateTask]);

  const handleCreateSubtasks = useCallback(async () => {
    if (!currentTask || !subtaskContent.trim()) {
      toast.error("Por favor, insira o conteúdo das subtarefas.");
      return;
    }

    // Save objective/next step before creating subtasks
    let newDescription = currentTask.description || "";
    newDescription = updateDescriptionWithSection(newDescription, '[OBJETIVO]:', objectiveInput);
    newDescription = updateDescriptionWithSection(newDescription, '[PRÓXIMO PASSO SEISO]:', nextStepSeisoInput);
    const updatedParentDescription = await updateTask(currentTask.id, { description: newDescription });
    if (updatedParentDescription) setCurrentTask(updatedParentDescription);


    const subtasksToCreate = subtaskContent.split('\n').map(s => s.trim()).filter(s => s.length > 0);
    if (subtasksToCreate.length === 0) {
      toast.error("Nenhuma subtarefa válida para criar.");
      return;
    }

    let createdCount = 0;
    for (const sub of subtasksToCreate) {
      const created = await createTodoistTask({
        content: sub,
        project_id: currentTask.project_id, // Usa o project_id da tarefa pai
        parent_id: currentTask.id,
        priority: 2, // Default P2 for subtasks
        labels: ["subtarefa"],
      });
      if (created) {
        createdCount++;
      } else {
        toast.error(`Falha ao criar subtarefa: "${sub}"`);
      }
    }

    if (createdCount > 0) {
      // Mark parent task as processed
      const updatedLabels = [...new Set([...currentTask.labels, SEISO_PROCESSED_LABEL])];
      const updatedParent = await updateTask(currentTask.id, { labels: updatedLabels });
      if (updatedParent) setCurrentTask(updatedParent);

      toast.success(`${createdCount} subtarefas criadas para "${currentTask.content}"!`);
      setSubtaskContent("");
      // Refresh subtasks list after creation
      const fetchedSubtasks = await fetchTasks(`parent_id: ${currentTask.id}`, { includeSubtasks: false, includeRecurring: false });
      setSubtasks(fetchedSubtasks || []);
    } else {
      toast.info("Nenhuma subtarefa foi criada.");
    }
  }, [currentTask, subtaskContent, createTodoistTask, objectiveInput, nextStepSeisoInput, updateTask, fetchTasks]);

  const handleMarkAsProcessed = useCallback(async () => {
    if (!currentTask) return;

    // Save objective/next step before marking as processed
    let newDescription = currentTask.description || "";
    newDescription = updateDescriptionWithSection(newDescription, '[OBJETIVO]:', objectiveInput);
    newDescription = updateDescriptionWithSection(newDescription, '[PRÓXIMO PASSO SEISO]:', nextStepSeisoInput);
    const updatedParentDescription = await updateTask(currentTask.id, { description: newDescription });
    if (updatedParentDescription) setCurrentTask(updatedParentDescription);

    const updatedLabels = [...new Set([...currentTask.labels, SEISO_PROCESSED_LABEL])];
    const updated = await updateTask(currentTask.id, { labels: updatedLabels });
    if (updated) {
      toast.success(`Tarefa "${currentTask.content}" marcada como processada pelo SEISO.`);
      setCurrentTask(updated);
    } else {
      toast.error("Falha ao marcar tarefa como processada.");
    }
  }, [currentTask, objectiveInput, nextStepSeisoInput, updateTask]);

  // Funções para toggle de etiquetas
  const handleToggleLabel = useCallback(async (taskId: string, currentLabels: string[], labelToToggle: string) => {
    const isLabelActive = currentLabels.includes(labelToToggle);
    let newLabels: string[];

    if (isLabelActive) {
      newLabels = currentLabels.filter(label => label !== labelToToggle);
    } else {
      newLabels = [...new Set([...currentLabels, labelToToggle])];
    }

    const updated = await updateTask(taskId, { labels: newLabels });
    if (updated) {
      setCurrentTask(prevTask => prevTask ? { ...prevTask, labels: newLabels } : null);
      toast.success(`Etiqueta "${labelToToggle}" ${isLabelActive ? 'removida' : 'adicionada'}!`);
    } else {
      toast.error(`Falha ao atualizar etiqueta "${labelToToggle}".`);
    }
  }, [updateTask]);

  const renderTaskDetails = (task: TodoistTask) => {
    const category = getTaskCategory(task);
    const isFocoActive = task.labels?.includes(FOCO_LABEL_ID);
    const isRapidaActive = task.labels?.includes(RAPIDA_LABEL_ID);
    const isCronogramaActive = task.labels?.includes(CRONOGRAMA_HOJE_LABEL);

    const isContentURL = isURL(task.content); // Check if content is a URL

    return (
      <Card className="p-6 rounded-xl shadow-lg bg-white flex flex-col h-full">
        <div className="flex-grow">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              {isContentURL ? (
                <a href={task.content} target="_blank" rel="noopener noreferrer" className="text-2xl font-bold text-indigo-600 hover:underline">
                  {task.content}
                </a>
              ) : (
                <h3 className="text-2xl font-bold text-gray-800">{task.content}</h3>
              )}
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
            <a href={task.url} target="_blank" rel="noopener noreferrer" className="ml-2 text-indigo-600 hover:text-indigo-800">
              <ExternalLink className="h-5 w-5" />
            </a>
          </div>
          {task.description && (
            <p className="text-md text-gray-700 mb-4 whitespace-pre-wrap">{task.description}</p>
          )}
          {task.labels && task.labels.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-2 mb-4">
              {task.labels.map((label) => (
                <span key={label} className="px-2 py-1 rounded-full text-xs bg-gray-100 text-gray-700">
                  {label}
                </span>
              ))}
            </div>
          )}
        </div>
        <div className="flex items-center justify-between text-sm text-gray-500 mt-auto pt-4 border-t border-gray-200">
          <div className="flex flex-col gap-1">
            {task.due?.datetime && isValid(parseISO(task.due.datetime)) && (
              <span className="flex items-center gap-1">
                <CalendarIcon className="h-3 w-3" /> Vencimento: {format(parseISO(task.due.datetime), "dd/MM/yyyy HH:mm", { locale: ptBR })}
              </span>
            )}
            {task.due?.date && !task.due?.datetime && isValid(parseISO(task.due.date)) && (
              <span className="flex items-center gap-1">
                <CalendarIcon className="h-3 w-3" /> Vencimento: {format(parseISO(task.due.date), "dd/MM/yyyy", { locale: ptBR })}
              </span>
            )}
            {task.deadline && isValid(parseISO(task.deadline)) && (
              <span className="flex items-center gap-1 text-red-600 font-semibold">
                <CalendarIcon className="h-3 w-3" /> Deadline: {format(parseISO(task.deadline), "dd/MM/yyyy", { locale: ptBR })}
              </span>
            )}
            {task.recurrence_string && (
              <span className="flex items-center gap-1">
                <Clock className="h-3 w-3" /> Recorrência: {task.recurrence_string}
              </span>
            )}
            {!task.due?.date && !task.due?.datetime && !task.deadline && !task.recurrence_string && <span>Sem prazo</span>}
          </div>
          <span
            className={cn(
              "px-2 py-1 rounded-full text-white text-xs font-medium",
              task.priority === 4 && "bg-red-500",
              task.priority === 3 && "bg-orange-500",
              task.priority === 2 && "bg-yellow-500",
              task.priority === 1 && "bg-gray-400",
            )}
          >
            P{task.priority}
          </span>
        </div>
      </Card>
    );
  };

  const isLoadingCombined = isLoadingTodoist || isLoadingTask;

  if (isLoadingCombined) {
    return (
      <div className="flex justify-center items-center h-screen">
        <LoadingSpinner size={40} />
      </div>
    );
  }

  if (!currentTask) {
    return (
      <div className="p-4 text-center">
        <h2 className="text-3xl font-bold mb-4 text-gray-800">SEISO - Planejamento de Ação</h2>
        <p className="text-lg text-gray-600 mb-6">
          Nenhuma tarefa selecionada para planejamento. Por favor, selecione uma tarefa de outro módulo (ex: Eisenhower) ou insira o ID de uma tarefa do Todoist.
        </p>
        <Button onClick={() => navigate(-1)} className="flex items-center gap-2 mx-auto">
          <ArrowLeft className="h-4 w-4" /> Voltar
        </Button>
      </div>
    );
  }

  const isProcessed = currentTask.labels?.includes(SEISO_PROCESSED_LABEL);

  return (
    <div className="p-4">
      <h2 className="text-3xl font-bold mb-2 text-gray-800">
        <ListTodo className="inline-block h-8 w-8 mr-2 text-indigo-600" /> SEISO - Planejamento de Ação
      </h2>
      <p className="text-lg text-gray-600 mb-6">
        Defina os próximos passos para a tarefa selecionada: delegar, agendar ou quebrar em subtarefas.
      </p>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="flex flex-col gap-6">
          <h3 className="text-2xl font-bold text-gray-800">Tarefa em Foco</h3>
          {renderTaskDetails(currentTask)}

          {subtasks.length > 0 && (
            <Card className="p-6">
              <CardTitle className="text-xl font-bold mb-4 flex items-center gap-2">
                <ListTodo className="h-5 w-5 text-indigo-600" /> Subtarefas
              </CardTitle>
              <CardContent className="p-0">
                <SubtaskList subtasks={subtasks} />
              </CardContent>
            </Card>
          )}

          <Card className="p-6">
            <CardTitle className="text-xl font-bold mb-4 flex items-center gap-2">
              <Tag className="h-5 w-5 text-orange-600" /> Definir Objetivo e Próximo Passo
            </CardTitle>
            <CardContent className="grid gap-4">
              <div>
                <Label htmlFor="objective-input">Objetivo da Tarefa</Label>
                <Textarea
                  id="objective-input"
                  value={objectiveInput}
                  onChange={(e) => setObjectiveInput(e.target.value)}
                  placeholder="Qual é o resultado desejado para esta tarefa?"
                  rows={3}
                  className="mt-1"
                  disabled={isLoadingTodoist}
                />
              </div>
              <div>
                <Label htmlFor="next-step-seiso-input">Próximo Passo SEISO (Ação Imediata)</Label>
                <Textarea
                  id="next-step-seiso-input"
                  value={nextStepSeisoInput}
                  onChange={(e) => setNextStepSeisoInput(e.target.value)}
                  placeholder="Qual é a próxima micro-ação concreta e sob seu controle?"
                  rows={3}
                  className="mt-1"
                  disabled={isLoadingTodoist}
                />
              </div>
              <Button onClick={handleSaveObjectiveAndNextStep} className="w-full flex items-center gap-2" disabled={isLoadingTodoist}>
                <Save className="h-4 w-4" /> Salvar Objetivo e Próximo Passo
              </Button>
            </CardContent>
          </Card>

          <Card className="p-6">
            <CardTitle className="text-xl font-bold mb-4 flex items-center gap-2">
              <MessageSquare className="h-5 w-5 text-indigo-600" /> Adicionar Observação
            </CardTitle>
            <CardContent className="grid gap-4">
              <div>
                <Label htmlFor="seiso-observation-input">Sua Observação</Label>
                <Textarea
                  id="seiso-observation-input"
                  value={observationInput}
                  onChange={(e) => setObservationInput(e.target.value)}
                  placeholder="Adicione uma nota rápida à descrição da tarefa..."
                  rows={3}
                  className="mt-1"
                  disabled={isLoadingTodoist}
                />
              </div>
              <Button onClick={handleSaveObservation} className="w-full flex items-center gap-2" disabled={isLoadingTodoist || !observationInput.trim()}>
                <Save className="h-4 w-4" /> Adicionar Observação
              </Button>
            </CardContent>
          </Card>

          {/* Nova seção para Gerenciar Etiquetas */}
          <Card className="p-6">
            <CardTitle className="text-xl font-bold mb-4 flex items-center gap-2">
              <Tag className="h-5 w-5 text-purple-600" /> Gerenciar Etiquetas
            </CardTitle>
            <CardContent className="grid grid-cols-3 gap-2">
              <Button
                onClick={() => handleToggleLabel(currentTask.id, currentTask.labels || [], CRONOGRAMA_HOJE_LABEL)}
                disabled={isLoadingTodoist}
                variant={currentTask.labels?.includes(CRONOGRAMA_HOJE_LABEL) ? "default" : "outline"}
                className={cn(
                  "py-3 text-sm flex items-center justify-center",
                  currentTask.labels?.includes(CRONOGRAMA_HOJE_LABEL) ? "bg-teal-600 hover:bg-teal-700 text-white" : "text-teal-600 border-teal-600 hover:bg-teal-50"
                )}
              >
                <Tag className="mr-1 h-4 w-4" /> {CRONOGRAMA_HOJE_LABEL}
              </Button>
              <Button
                onClick={() => handleToggleLabel(currentTask.id, currentTask.labels || [], RAPIDA_LABEL_ID)}
                disabled={isLoadingTodoist}
                variant={currentTask.labels?.includes(RAPIDA_LABEL_ID) ? "default" : "outline"}
                className={cn(
                  "py-3 text-sm flex items-center justify-center",
                  currentTask.labels?.includes(RAPIDA_LABEL_ID) ? "bg-purple-600 hover:bg-purple-700 text-white" : "text-purple-600 border-purple-600 hover:bg-purple-50"
                )}
              >
                <Tag className="mr-1 h-4 w-4" /> {RAPIDA_LABEL_ID}
              </Button>
              <Button
                onClick={() => handleToggleLabel(currentTask.id, currentTask.labels || [], FOCO_LABEL_ID)}
                disabled={isLoadingTodoist}
                variant={currentTask.labels?.includes(FOCO_LABEL_ID) ? "default" : "outline"}
                className={cn(
                  "py-3 text-sm flex items-center justify-center",
                  currentTask.labels?.includes(FOCO_LABEL_ID) ? "bg-indigo-600 hover:bg-indigo-700 text-white" : "text-indigo-600 border-indigo-600 hover:bg-indigo-50"
                )}
              >
                <Tag className="mr-1 h-4 w-4" /> {FOCO_LABEL_ID}
              </Button>
            </CardContent>
          </Card>
          {/* Fim da nova seção para Gerenciar Etiquetas */}

          {isProcessed && (
            <p className="mt-4 text-center text-green-600 font-semibold">
              ✅ Esta tarefa já foi processada pelo SEISO.
            </p>
          )}
          <Button onClick={() => navigate(-1)} variant="outline" className="w-full flex items-center gap-2">
            <ArrowLeft className="h-4 w-4" /> Voltar
          </Button>
        </div>

        <div className="flex flex-col gap-6">
          <Card className="p-6">
            <CardTitle className="text-xl font-bold mb-4 flex items-center gap-2">
              <Users className="h-5 w-5 text-blue-600" /> Delegar Tarefa
            </CardTitle>
            <CardContent className="grid gap-4">
              <div>
                <Label htmlFor="delegate-name">Nome do Responsável</Label>
                <Input
                  id="delegate-name"
                  value={delegateName}
                  onChange={(e) => setDelegateName(e.target.value)}
                  placeholder="Ex: João, Equipe Marketing"
                  className="mt-1"
                  disabled={isLoadingTodoist}
                />
              </div>
              <Button onClick={handleDelegateTask} className="w-full flex items-center gap-2" disabled={isLoadingTodoist}>
                <Save className="h-4 w-4" /> Delegar e Marcar como Processada
              </Button>
            </CardContent>
          </Card>

          <Card className="p-6">
            <CardTitle className="text-xl font-bold mb-4 flex items-center gap-2">
              <CalendarIcon className="h-5 w-5 text-green-600" /> Agendar Tarefa
            </CardTitle>
            <CardContent className="grid gap-4">
              <div>
                <Label htmlFor="schedule-date">Data de Vencimento</Label>
                <Popover open={isSchedulingPopoverOpen} onOpenChange={setIsSchedulingPopoverOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      variant={"outline"}
                      className={cn(
                        "w-full justify-start text-left font-normal mt-1",
                        !selectedDueDate && "text-muted-foreground"
                      )}
                      disabled={isLoadingTodoist}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {selectedRecurrenceString ? (
                        <span>Recorrência: {selectedRecurrenceString}</span>
                      ) : selectedDueDate && isValid(selectedDueDate) ? (
                        <span>
                          {format(selectedDueDate, "PPP", { locale: ptBR })}
                          {selectedDueTime && ` às ${selectedDueTime}`}
                        </span>
                      ) : (
                        <span>Escolha uma data</span>
                      )}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-4">
                    <h4 className="font-semibold text-lg mb-3">Agendar Tarefa</h4>
                    <div className="grid gap-4">
                      <div>
                        <Label htmlFor="schedule-date-popover">Data de Vencimento</Label>
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
                        <Label htmlFor="schedule-time-popover">Hora de Vencimento (Opcional)</Label>
                        <Input
                          id="schedule-time-popover"
                          type="time"
                          value={selectedDueTime}
                          onChange={(e) => setSelectedDueTime(e.target.value)}
                          className="mt-1"
                        />
                      </div>
                      <div className="mt-2">
                        <Label htmlFor="deadline-date-popover">Deadline (Opcional)</Label>
                        <Calendar
                          mode="single"
                          selected={selectedDeadlineDate}
                          onSelect={setSelectedDeadlineDate}
                          initialFocus
                          locale={ptBR}
                          className="rounded-md border shadow"
                        />
                      </div>
                      <div>
                        <Label htmlFor="schedule-recurrence-string">Recorrência (Todoist string)</Label>
                        <Input
                          id="schedule-recurrence-string"
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
                        <Label htmlFor="schedule-priority">Prioridade</Label>
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
                        <Label htmlFor="schedule-duration">Duração Estimada (minutos)</Label>
                        <Input
                          id="schedule-duration"
                          type="number"
                          value={selectedDuration}
                          onChange={(e) => setSelectedDuration(e.target.value)}
                          min="1"
                          placeholder="Ex: 30"
                          className="mt-1"
                        />
                      </div>
                      <Button onClick={handleScheduleTask} className="w-full" disabled={isLoadingTodoist}>
                        Salvar Agendamento
                      </Button>
                      {(selectedDueDate || selectedDueTime || selectedDeadlineDate || selectedRecurrenceString) && (
                        <Button onClick={() => { setSelectedDueDate(undefined); setSelectedDueTime(""); setSelectedDeadlineDate(undefined); setSelectedRecurrenceString(""); }} variant="outline" className="w-full" disabled={isLoadingTodoist}>
                          <XCircle className="mr-2 h-4 w-4" /> Limpar Datas
                        </Button>
                      )}
                    </div>
                  </PopoverContent>
                </Popover>
              </div>
              <Button onClick={handleScheduleTask} className="w-full flex items-center gap-2" disabled={isLoadingTodoist}>
                <Save className="h-4 w-4" /> Agendar e Marcar como Processada
              </Button>
            </CardContent>
          </Card>

          <Card className="p-6">
            <CardTitle className="text-xl font-bold mb-4 flex items-center gap-2">
              <ListTodo className="h-5 w-5 text-purple-600" /> Quebrar em Subtarefas
            </CardTitle>
            <CardContent className="grid gap-4">
              <div>
                <Label htmlFor="subtask-content">Conteúdo das Subtarefas (uma por linha)</Label>
                <Textarea
                  id="subtask-content"
                  value={subtaskContent}
                  onChange={(e) => setSubtaskContent(e.target.value)}
                  placeholder="Ex:&#10;- Pesquisar fornecedores&#10;- Contatar 3 fornecedores&#10;- Analisar propostas"
                  rows={5}
                  className="mt-1"
                  disabled={isLoadingTodoist}
                />
              </div>
              <Button onClick={handleCreateSubtasks} className="w-full flex items-center gap-2" disabled={isLoadingTodoist}>
                <PlusCircle className="h-4 w-4" /> Criar Subtarefas e Marcar como Processada
              </Button>
            </CardContent>
          </Card>

          {!isProcessed && (
            <Button onClick={handleMarkAsProcessed} variant="outline" className="w-full flex items-center gap-2" disabled={isLoadingTodoist}>
              <Tag className="h-4 w-4" /> Marcar como Processada (Sem Ação Específica)
            </Button>
          )}
        </div>
      </div>
    </div>
  );
};

export default Seiso;