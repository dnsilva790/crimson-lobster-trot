"use client";

import React, { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import LoadingSpinner from "@/components/ui/loading-spinner";
import { useTodoist } from "@/context/TodoistContext";
import { TodoistTask } from "@/lib/types";
import { toast } from "sonner";
import {
  Inbox,
  Check,
  Trash2,
  Archive,
  Clock,
  CalendarIcon,
  Users,
  ListTodo,
  ExternalLink,
  XCircle,
  ChevronRight,
  FolderOpen,
  Hourglass,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { format, parseISO, setHours, setMinutes } from "date-fns";
import { ptBR } from "date-fns/locale";

type GtdState =
  | "initial" // User sets filter
  | "loading" // Fetching tasks
  | "reviewing" // Processing tasks one by one
  | "finished"; // All tasks processed

type ActionableStep =
  | "isActionable" // Deciding if task is actionable
  | "nextAction" // Deciding next action if actionable
  | "scheduling" // Setting due date/time
  | "delegating"; // Setting delegate info

interface GtdProcessorState {
  gtdState: GtdState;
  actionableStep: ActionableStep;
  tasksToProcess: TodoistTask[];
  currentTaskIndex: number;
  inboxFilter: string;
  selectedDueDate?: Date;
  selectedDueTime: string;
  delegateName: string;
}

const GTD_STORAGE_KEY = "gtdProcessorState";
const INBOX_FILTER_STORAGE_KEY = "gtdInboxFilter";

const Seiketsu = () => {
  const { fetchTasks, closeTask, deleteTask, updateTask, isLoading: isLoadingTodoist } = useTodoist();
  const [gtdState, setGtdState] = useState<GtdState>("initial");
  const [actionableStep, setActionableStep] = useState<ActionableStep>("isActionable");
  const [tasksToProcess, setTasksToProcess] = useState<TodoistTask[]>([]);
  const [currentTaskIndex, setCurrentTaskIndex] = useState<number>(0);
  const [inboxFilter, setInboxFilter] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem(INBOX_FILTER_STORAGE_KEY) || "no date & no project & no label";
    }
    return "no date & no project & no label";
  });

  // States for popovers
  const [isSchedulingPopoverOpen, setIsSchedulingPopoverOpen] = useState(false);
  const [isDelegatingPopoverOpen, setIsDelegatingPopoverOpen] = useState(false);

  // Temporary states for current task actions
  const [selectedDueDate, setSelectedDueDate] = useState<Date | undefined>(undefined);
  const [selectedDueTime, setSelectedDueTime] = useState<string>("");
  const [delegateName, setDelegateName] = useState<string>("");

  const currentTask = tasksToProcess[currentTaskIndex];
  const isLoading = isLoadingTodoist || gtdState === "loading";

  // Load state from localStorage on mount
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const savedState = localStorage.getItem(GTD_STORAGE_KEY);
      if (savedState) {
        try {
          const parsedState: GtdProcessorState = JSON.parse(savedState);
          
          let newGtdState = parsedState.gtdState;
          // Se estivermos no estado de revisão mas não houver tarefas, resetar para inicial
          if (newGtdState === "reviewing" && (!parsedState.tasksToProcess || parsedState.tasksToProcess.length === 0)) {
            newGtdState = "initial"; 
            toast.warning("Estado de revisão inválido detectado (sem tarefas). Reiniciando o processamento.");
          }

          setGtdState(newGtdState);
          setActionableStep(parsedState.actionableStep);
          setTasksToProcess(parsedState.tasksToProcess || []); // Garante que seja um array
          setCurrentTaskIndex(parsedState.currentTaskIndex);
          setInboxFilter(parsedState.inboxFilter);
          setSelectedDueDate(parsedState.selectedDueDate ? parseISO(parsedState.selectedDueDate.toISOString()) : undefined);
          setSelectedDueTime(parsedState.selectedDueTime);
          setDelegateName(parsedState.delegateName);
          
          if (newGtdState === "reviewing" && parsedState.tasksToProcess.length > 0) {
            toast.info("Processamento GTD retomado.");
          }
        } catch (e) {
          console.error("Failed to parse GTD state from localStorage", e);
          localStorage.removeItem(GTD_STORAGE_KEY);
          toast.error("Erro ao carregar estado GTD. Reiniciando.");
        }
      }
    }
  }, []);

  // Save state to localStorage whenever relevant state changes
  useEffect(() => {
    if (typeof window !== 'undefined' && gtdState !== "initial" && gtdState !== "loading") {
      const stateToSave: GtdProcessorState = {
        gtdState,
        actionableStep,
        tasksToProcess,
        currentTaskIndex,
        inboxFilter,
        selectedDueDate,
        selectedDueTime,
        delegateName,
      };
      localStorage.setItem(GTD_STORAGE_KEY, JSON.stringify(stateToSave));
      localStorage.setItem(INBOX_FILTER_STORAGE_KEY, inboxFilter);
    }
  }, [gtdState, actionableStep, tasksToProcess, currentTaskIndex, inboxFilter, selectedDueDate, selectedDueTime, delegateName]);

  const loadTasksForProcessing = useCallback(async () => {
    setGtdState("loading");
    setCurrentTaskIndex(0);
    setActionableStep("isActionable");
    setTasksToProcess([]);

    // Passar 'false' para includeSubtasksAndRecurring para excluí-los por padrão
    const fetchedTasks = await fetchTasks(inboxFilter, false); 
    if (fetchedTasks && fetchedTasks.length > 0) {
      setTasksToProcess(fetchedTasks);
      setGtdState("reviewing");
      toast.success(`Encontradas ${fetchedTasks.length} tarefas para processar.`);
    } else {
      setGtdState("finished");
      toast.info("Nenhuma tarefa encontrada para processar com o filtro atual.");
    }
  }, [fetchTasks, inboxFilter]);

  const advanceToNextTask = useCallback(() => {
    if (currentTaskIndex < tasksToProcess.length - 1) {
      setCurrentTaskIndex((prev) => prev + 1);
      setActionableStep("isActionable"); // Reset step for next task
      // Reset temporary states for next task
      setSelectedDueDate(undefined);
      setSelectedDueTime("");
      setDelegateName("");
    } else {
      setGtdState("finished");
      toast.success("Todas as tarefas da caixa de entrada foram processadas!");
    }
  }, [currentTaskIndex, tasksToProcess.length]);

  // --- Ações GTD ---

  const handleEliminate = useCallback(async () => {
    if (!currentTask) return;
    const success = await deleteTask(currentTask.id);
    if (success !== undefined) {
      toast.success(`Tarefa "${currentTask.content}" eliminada.`);
      advanceToNextTask();
    }
  }, [currentTask, deleteTask, advanceToNextTask]);

  const handleIncubate = useCallback(async () => {
    if (!currentTask) return;
    const updatedLabels = [...currentTask.labels.filter(l => l !== "pessoal" && l !== "profissional"), "um_dia_talvez"];
    const updated = await updateTask(currentTask.id, {
      labels: updatedLabels,
      due_date: null,
      due_datetime: null,
      priority: 1, // Set to lowest priority
    });
    if (updated) {
      toast.info(`Tarefa "${currentTask.content}" incubada (Um Dia/Talvez).`);
      advanceToNextTask();
    }
  }, [currentTask, updateTask, advanceToNextTask]);

  const handleArchive = useCallback(async () => {
    if (!currentTask) return;
    // For archiving, we can add a label and potentially move to a specific project
    // For simplicity, let's just add an #arquivo label and mark as complete if it's a reference item
    const updatedLabels = [...currentTask.labels.filter(l => l !== "pessoal" && l !== "profissional"), "arquivo"];
    const updated = await updateTask(currentTask.id, { labels: updatedLabels });
    if (updated) {
      // Optionally, if it's purely reference, you might close it.
      // await closeTask(currentTask.id); // Uncomment if archiving means closing
      toast.info(`Tarefa "${currentTask.content}" arquivada.`);
      advanceToNextTask();
    }
  }, [currentTask, updateTask, advanceToNextTask]);

  const handleDoNow = useCallback(async () => {
    if (!currentTask) return;
    const success = await closeTask(currentTask.id);
    if (success !== undefined) {
      toast.success(`Tarefa "${currentTask.content}" concluída (Regra dos 2 Minutos).`);
      advanceToNextTask();
    }
  }, [currentTask, closeTask, advanceToNextTask]);

  const handleSetSchedule = useCallback(async () => {
    if (!currentTask || !selectedDueDate) {
      toast.error("Por favor, selecione uma data para agendar.");
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

    const updated = await updateTask(currentTask.id, {
      due_date: finalDueDate,
      due_datetime: finalDueDateTime,
    });
    if (updated) {
      toast.success(`Tarefa "${currentTask.content}" agendada.`);
      setIsSchedulingPopoverOpen(false);
      advanceToNextTask();
    }
  }, [currentTask, selectedDueDate, selectedDueTime, updateTask, advanceToNextTask]);

  const handleSetDelegate = useCallback(async () => {
    if (!currentTask || !delegateName.trim()) {
      toast.error("Por favor, insira o nome do responsável.");
      return;
    }
    const updatedDescription = currentTask.description ? `${currentTask.description}\n\n[DELEGADO PARA]: ${delegateName.trim()}` : `[DELEGADO PARA]: ${delegateName.trim()}`;
    const updatedLabels = [...currentTask.labels.filter(l => !l.startsWith("espera_de_")), `espera_de_${delegateName.trim().toLowerCase().replace(/\s/g, '_')}`];

    const updated = await updateTask(currentTask.id, {
      description: updatedDescription,
      labels: updatedLabels,
    });
    if (updated) {
      toast.success(`Tarefa "${currentTask.content}" delegada para ${delegateName.trim()}.`);
      setIsDelegatingPopoverOpen(false);
      advanceToNextTask();
    }
  }, [currentTask, delegateName, updateTask, advanceToNextTask]);

  const handleMarkAsProject = useCallback(async () => {
    if (!currentTask) return;
    const updatedLabels = [...currentTask.labels.filter(l => l !== "projeto"), "projeto"];
    const updated = await updateTask(currentTask.id, { labels: updatedLabels });
    if (updated) {
      toast.info(`Tarefa "${currentTask.content}" marcada como projeto.`);
      // Optionally open Todoist URL for the user to break it down
      window.open(currentTask.url, "_blank");
      advanceToNextTask();
    }
  }, [currentTask, updateTask, advanceToNextTask]);

  const handleNextAction = useCallback(async () => {
    if (!currentTask) return;
    // Ensure it has a project (if not inbox), a priority, and maybe a context label
    // For simplicity, let's just ensure it's not in the inbox filter anymore and advance.
    // The user is expected to assign project/priority/labels in Todoist after this step.
    toast.success(`Tarefa "${currentTask.content}" movida para Próximas Ações.`);
    advanceToNextTask();
  }, [currentTask, advanceToNextTask]);

  const renderTaskCard = (task: TodoistTask) => (
    <Card className="p-6 rounded-xl shadow-lg bg-white flex flex-col h-full max-w-2xl mx-auto">
      <div className="flex-grow">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-2xl font-bold text-gray-800">{task.content}</h3>
          <a href={task.url} target="_blank" rel="noopener noreferrer" className="ml-2 text-indigo-600 hover:text-indigo-800">
            <ExternalLink className="h-5 w-5" />
          </a>
        </div>
        {task.description && (
          <p className="text-md text-gray-700 mb-4 whitespace-pre-wrap">{task.description}</p>
        )}
      </div>
      <div className="flex items-center justify-between text-sm text-gray-500 mt-auto pt-4 border-t border-gray-200">
        <span>Criado em: {format(parseISO(task.created_at), "dd/MM/yyyy", { locale: ptBR })}</span>
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

  return (
    <div className="p-4">
      <h2 className="text-3xl font-bold mb-2 text-gray-800">
        <Inbox className="inline-block h-8 w-8 mr-2 text-indigo-600" /> SEIKETSU - Processador GTD
      </h2>
      <p className="text-lg text-gray-600 mb-6">
        Processe sua caixa de entrada seguindo o fluxo GTD para organizar suas tarefas.
      </p>

      {isLoading && (
        <div className="flex justify-center items-center h-48">
          <LoadingSpinner size={40} />
        </div>
      )}

      {!isLoading && gtdState === "initial" && (
        <div className="text-center mt-10">
          <div className="grid w-full items-center gap-1.5 mb-6 max-w-md mx-auto">
            <Label htmlFor="inbox-filter" className="text-left text-gray-600 font-medium">
              Filtro da Caixa de Entrada (Todoist)
            </Label>
            <Input
              type="text"
              id="inbox-filter"
              placeholder="Ex: 'no date & no project & no label' (subtarefas e recorrentes excluídas por padrão)"
              value={inboxFilter}
              onChange={(e) => setInboxFilter(e.target.value)}
              className="mt-1"
              disabled={isLoading}
            />
            <p className="text-xs text-gray-500 text-left mt-1">
              Use filtros do Todoist para definir sua caixa de entrada. Subtarefas e tarefas recorrentes são excluídas automaticamente.
            </p>
          </div>
          <Button
            onClick={loadTasksForProcessing}
            className="px-8 py-4 text-xl bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-colors duration-200"
            disabled={isLoading}
          >
            Iniciar Processamento GTD
          </Button>
        </div>
      )}

      {!isLoading && gtdState === "reviewing" && currentTask && (
        <div className="mt-8">
          <p className="text-center text-xl font-medium mb-6 text-gray-700">
            Processando tarefa {currentTaskIndex + 1} de {tasksToProcess.length}
          </p>
          {renderTaskCard(currentTask)}

          {actionableStep === "isActionable" && (
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mt-6">
              <Button
                onClick={handleEliminate}
                disabled={isLoading}
                className="bg-red-500 hover:bg-red-600 text-white py-3 text-md flex items-center justify-center"
              >
                <Trash2 className="mr-2 h-5 w-5" /> Eliminar
              </Button>
              <Button
                onClick={handleIncubate}
                disabled={isLoading}
                className="bg-yellow-500 hover:bg-yellow-600 text-white py-3 text-md flex items-center justify-center"
              >
                <Hourglass className="mr-2 h-5 w-5" /> Incubar
              </Button>
              <Button
                onClick={handleArchive}
                disabled={isLoading}
                className="bg-gray-500 hover:bg-gray-600 text-white py-3 text-md flex items-center justify-center"
              >
                <Archive className="mr-2 h-5 w-5" /> Arquivar
              </Button>
              <Button
                onClick={() => setActionableStep("nextAction")}
                disabled={isLoading}
                className="bg-green-500 hover:bg-green-600 text-white py-3 text-md flex items-center justify-center"
              >
                <ChevronRight className="mr-2 h-5 w-5" /> Sim, é Acionável
              </Button>
            </div>
          )}

          {actionableStep === "nextAction" && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6">
              <Button
                onClick={handleMarkAsProject}
                disabled={isLoading}
                className="bg-blue-500 hover:bg-blue-600 text-white py-3 text-md flex items-center justify-center"
              >
                <FolderOpen className="mr-2 h-5 w-5" /> É um Projeto?
              </Button>
              <Popover open={isDelegatingPopoverOpen} onOpenChange={setIsDelegatingPopoverOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    disabled={isLoading}
                    className="py-3 text-md flex items-center justify-center"
                  >
                    <Users className="mr-2 h-5 w-5" /> Delegar
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-80 p-4">
                  <h4 className="font-semibold text-lg mb-3">Delegar Tarefa</h4>
                  <div className="grid gap-4">
                    <div>
                      <Label htmlFor="delegate-name">Nome do Responsável</Label>
                      <Input
                        id="delegate-name"
                        value={delegateName}
                        onChange={(e) => setDelegateName(e.target.value)}
                        placeholder="Ex: João, Equipe Marketing"
                        className="mt-1"
                      />
                    </div>
                    <Button onClick={handleSetDelegate} className="w-full">
                      Salvar Delegação
                    </Button>
                  </div>
                </PopoverContent>
              </Popover>
              <Button
                onClick={handleDoNow}
                disabled={isLoading}
                className="bg-purple-500 hover:bg-purple-600 text-white py-3 text-md flex items-center justify-center"
              >
                <Check className="mr-2 h-5 w-5" /> Fazer Agora (&lt; 2 min)
              </Button>
              <Popover open={isSchedulingPopoverOpen} onOpenChange={setIsSchedulingPopoverOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    disabled={isLoading}
                    className="py-3 text-md flex items-center justify-center"
                  >
                    <CalendarIcon className="mr-2 h-5 w-5" /> Agendar
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
                      <Label htmlFor="schedule-time">Hora de Vencimento (Opcional)</Label>
                      <Input
                        id="schedule-time"
                        type="time"
                        value={selectedDueTime}
                        onChange={(e) => setSelectedDueTime(e.target.value)}
                        className="mt-1"
                      />
                    </div>
                    <Button onClick={handleSetSchedule} className="w-full">
                      Salvar Agendamento
                    </Button>
                  </div>
                </PopoverContent>
              </Popover>
              <Button
                onClick={handleNextAction}
                disabled={isLoading}
                className="bg-orange-500 hover:bg-orange-600 text-white py-3 text-md flex items-center justify-center"
              >
                <ListTodo className="mr-2 h-5 w-5" /> Próxima Ação
              </Button>
              <Button
                onClick={() => setActionableStep("isActionable")}
                disabled={isLoading}
                variant="outline"
                className="py-3 text-md flex items-center justify-center"
              >
                <XCircle className="mr-2 h-5 w-5" /> Voltar
              </Button>
            </div>
          )}
        </div>
      )}

      {!isLoading && gtdState === "finished" && (
        <div className="text-center mt-10">
          <p className="text-2xl font-semibold text-gray-700 mb-4">
            🎉 Caixa de Entrada Limpa!
          </p>
          <p className="text-lg text-gray-600 mb-6">
            Você processou todas as tarefas da sua caixa de entrada.
          </p>
          <Button
            onClick={() => setGtdState("initial")}
            className="px-8 py-4 text-xl bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-colors duration-200"
          >
            Iniciar Novo Processamento
          </Button>
        </div>
      )}
    </div>
  );
};

export default Seiketsu;