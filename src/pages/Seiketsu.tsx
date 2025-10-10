"use client";

import React, { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { useTodoist } from "@/context/TodoistContext";
import { TodoistTask } from "@/lib/types";
import LoadingSpinner from "@/components/ui/loading-spinner";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import GTDTaskCard from "@/components/GTDTaskCard"; // Novo componente
import { Progress } from "@/components/ui/progress";
import { ArrowLeft } from "lucide-react";

type SeiketsuState = "initial" | "collecting" | "processing" | "finished";
type SeiketsuStep = "initial" | "actionable_decision" | "not_actionable_options" | "actionable_options";

interface SeiketsuProcessorStateSnapshot {
  inboxTasks: TodoistTask[];
  processedTasksCount: number;
  currentTask: TodoistTask | null;
  seiketsuState: SeiketsuState;
  seiketsuStep: SeiketsuStep;
  filterInput: string;
}

const LOCAL_STORAGE_KEY = "seiketsuProcessorState";
const SEIKETSU_FILTER_INPUT_STORAGE_KEY = "seiketsu_filter_input";

const Seiketsu = () => {
  const { fetchTasks, closeTask, deleteTask, updateTask, isLoading: isLoadingTodoist } = useTodoist();
  const [inboxTasks, setInboxTasks] = useState<TodoistTask[]>([]);
  const [processedTasksCount, setProcessedTasksCount] = useState<number>(0);
  const [currentTask, setCurrentTask] = useState<TodoistTask | null>(null);
  const [seiketsuState, setSeiketsuState] = useState<SeiketsuState>("initial");
  const [seiketsuStep, setSeiketsuStep] = useState<SeiketsuStep>("initial"); // Controla o sub-passo dentro do Seiketsu
  const [filterInput, setFilterInput] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem(SEIKETSU_FILTER_INPUT_STORAGE_KEY) || "";
    }
    return "";
  });
  const [history, setHistory] = useState<SeiketsuProcessorStateSnapshot[]>([]);
  const [hasSavedState, setHasSavedState] = useState<boolean>(false);

  // Save filter to localStorage whenever it changes
  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem(SEIKETSU_FILTER_INPUT_STORAGE_KEY, filterInput);
    }
  }, [filterInput]);

  // Load state from localStorage on mount
  useEffect(() => {
    const savedState = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (savedState) {
      try {
        const parsedState: SeiketsuProcessorStateSnapshot = JSON.parse(savedState);
        setInboxTasks(parsedState.inboxTasks);
        setProcessedTasksCount(parsedState.processedTasksCount);
        setCurrentTask(parsedState.currentTask);
        setSeiketsuState(parsedState.seiketsuState);
        setSeiketsuStep(parsedState.seiketsuStep);
        setFilterInput(parsedState.filterInput);
        setHasSavedState(true);
        if (parsedState.seiketsuState === "processing" && parsedState.currentTask) {
          toast.info("Estado do processador Seiketsu carregado. Clique em 'Continuar Processamento' para prosseguir.");
        } else if (parsedState.seiketsuState === "finished") {
          toast.info("Processamento Seiketsu concluído na última sessão. Inicie um novo para revisar mais tarefas.");
        }
      } catch (e) {
        console.error("Failed to parse saved Seiketsu state from localStorage", e);
        localStorage.removeItem(LOCAL_STORAGE_KEY);
      }
    }
  }, []);

  // Save state to localStorage whenever relevant state changes
  useEffect(() => {
    if (seiketsuState !== "initial") {
      const stateToSave: SeiketsuProcessorStateSnapshot = {
        inboxTasks,
        processedTasksCount,
        currentTask,
        seiketsuState,
        seiketsuStep,
        filterInput,
      };
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(stateToSave));
      setHasSavedState(true);
    }
  }, [inboxTasks, processedTasksCount, currentTask, seiketsuState, seiketsuStep, filterInput]);

  const saveStateToHistory = useCallback(() => {
    setHistory((prev) => [
      ...prev,
      {
        inboxTasks,
        processedTasksCount,
        currentTask,
        seiketsuState,
        seiketsuStep,
        filterInput,
      },
    ]);
  }, [inboxTasks, processedTasksCount, currentTask, seiketsuState, seiketsuStep, filterInput]);

  const undoLastAction = useCallback(() => {
    if (history.length > 0) {
      const lastState = history[history.length - 1];
      setInboxTasks(lastState.inboxTasks);
      setProcessedTasksCount(lastState.processedTasksCount);
      setCurrentTask(lastState.currentTask);
      setSeiketsuState(lastState.seiketsuState);
      setSeiketsuStep(lastState.seiketsuStep);
      setFilterInput(lastState.filterInput);
      setHistory((prev) => prev.slice(0, prev.length - 1));
      toast.info("Última ação desfeita.");
    } else {
      toast.info("Não há ações para desfazer.");
    }
  }, [history]);

  const resetProcessor = useCallback(() => {
    setInboxTasks([]);
    setProcessedTasksCount(0);
    setCurrentTask(null);
    setSeiketsuState("initial");
    setSeiketsuStep("initial");
    setHistory([]);
    localStorage.removeItem(LOCAL_STORAGE_KEY);
    setHasSavedState(false);
    toast.success("Processador Seiketsu resetado!");
  }, []);

  const loadTasksForProcessing = useCallback(async (continueSaved: boolean = false) => {
    setSeiketsuState("collecting");
    setSeiketsuStep("initial");
    setProcessedTasksCount(0);

    let tasks: TodoistTask[] = [];
    if (continueSaved && inboxTasks.length > 0) {
      tasks = inboxTasks; // Continue with existing tasks
      setCurrentTask(inboxTasks[0]);
      setSeiketsuStep("actionable_decision");
      setSeiketsuState("processing");
      toast.info(`Continuando processamento com ${inboxTasks.length} tarefas.`);
      return;
    }

    const fetchedTasks = await fetchTasks(filterInput.trim() || undefined);
    if (fetchedTasks && fetchedTasks.length > 0) {
      setInboxTasks(fetchedTasks);
      setCurrentTask(fetchedTasks[0]);
      setSeiketsuStep("actionable_decision");
      setSeiketsuState("processing");
      toast.info(`Encontradas ${fetchedTasks.length} tarefas para processar.`);
    } else {
      setInboxTasks([]);
      setCurrentTask(null);
      setSeiketsuState("finished");
      toast.info("Nenhuma tarefa encontrada para processar. Sua caixa de entrada está limpa!");
    }
  }, [fetchTasks, filterInput, inboxTasks]);

  const advanceToNextTask = useCallback(() => {
    saveStateToHistory();
    setProcessedTasksCount((prev) => prev + 1);
    const remainingTasks = inboxTasks.slice(1);
    setInboxTasks(remainingTasks);

    if (remainingTasks.length > 0) {
      setCurrentTask(remainingTasks[0]);
      setSeiketsuStep("actionable_decision"); // Reset to actionable decision for next task
    } else {
      setCurrentTask(null);
      setSeiketsuState("finished");
      toast.success("Todas as tarefas da caixa de entrada foram processadas!");
    }
  }, [inboxTasks, saveStateToHistory]);

  // Seiketsu Actions
  const handleNotActionable = useCallback(() => {
    saveStateToHistory();
    setSeiketsuStep("not_actionable_options");
  }, [saveStateToHistory]);

  const handleActionable = useCallback(() => {
    saveStateToHistory();
    setSeiketsuStep("actionable_options");
  }, [saveStateToHistory]);

  const handleDelete = useCallback(async (taskId: string) => {
    const success = await deleteTask(taskId);
    if (success !== undefined) {
      toast.success("Tarefa eliminada!");
      advanceToNextTask();
    }
  }, [deleteTask, advanceToNextTask]);

  const handleIncubate = useCallback(async (taskId: string) => {
    const updated = await updateTask(taskId, { labels: ["um_dia_talvez"] });
    if (updated) {
      toast.success("Tarefa incubada (Um dia/Talvez)!");
      advanceToNextTask();
    }
  }, [updateTask, advanceToNextTask]);

  const handleArchive = useCallback(async (taskId: string) => {
    const success = await closeTask(taskId);
    if (success !== undefined) {
      toast.success("Tarefa arquivada!");
      advanceToNextTask();
    }
  }, [closeTask, advanceToNextTask]);

  const handleDoNow = useCallback(async (taskId: string) => {
    const success = await closeTask(taskId);
    if (success !== undefined) {
      toast.success("Tarefa concluída (menos de 2 minutos)!");
      advanceToNextTask();
    }
  }, [closeTask, advanceToNextTask]);

  const handleDelegate = useCallback(async (taskId: string, delegateTo: string) => {
    const currentTaskLabels = currentTask?.labels || [];
    const updatedLabels = [...currentTaskLabels, `delegado_${delegateTo.replace(/\s/g, '_').toLowerCase()}`];
    const updated = await updateTask(taskId, { description: `${currentTask?.description || ''}\n[DELEGADO PARA]: ${delegateTo}`, labels: updatedLabels });
    if (updated) {
      toast.success(`Tarefa delegada para ${delegateTo}!`);
      advanceToNextTask();
    }
  }, [updateTask, advanceToNextTask, currentTask]);

  const handleSchedule = useCallback(async (taskId: string, dueDate: string | null, dueDateTime: string | null) => {
    const updated = await updateTask(taskId, { due_date: dueDate, due_datetime: dueDateTime });
    if (updated) {
      toast.success("Tarefa agendada!");
      advanceToNextTask();
    }
  }, [updateTask, advanceToNextTask]);

  const handleNextAction = useCallback(async (taskId: string) => {
    // For "Next Action", we might just want to ensure it has a reasonable priority or label.
    // For simplicity, we'll just advance it.
    toast.success("Tarefa definida como Próxima Ação!");
    advanceToNextTask();
  }, [advanceToNextTask]);

  const handleEditTask = useCallback(async (taskId: string, content: string, description: string) => {
    const updated = await updateTask(taskId, { content, description });
    if (updated) {
      toast.success("Tarefa atualizada (Projeto)!");
      // No advanceToNextTask here, as the user might want to continue working on the project definition
      // or decide the next action for it. We'll just refresh the current task.
      setCurrentTask(updated);
      setInboxTasks(prev => prev.map(t => t.id === taskId ? updated : t));
    }
  }, [updateTask]);

  const handleGoToProject = useCallback((taskId: string) => {
    const taskUrl = currentTask?.url;
    if (taskUrl) {
      window.open(taskUrl, "_blank");
      toast.info("Abrindo tarefa no Todoist para edição de projeto.");
    }
    // Keep the current task in view, don't advance
  }, [currentTask]);

  const progressValue = inboxTasks.length > 0 ? (processedTasksCount / (processedTasksCount + inboxTasks.length)) * 100 : 0;

  const isLoading = isLoadingTodoist || seiketsuState === "collecting";

  return (
    <div className="p-4">
      <h2 className="text-3xl font-bold mb-2 text-gray-800">📥 SEIKETSU - Processar Caixa de Entrada</h2>
      <p className="text-lg text-gray-600 mb-6">
        Siga o fluxo GTD para esvaziar sua caixa de entrada e definir as próximas ações.
      </p>

      {isLoading && (
        <div className="flex justify-center items-center h-48">
          <LoadingSpinner size={40} />
        </div>
      )}

      {!isLoading && seiketsuState === "initial" && (
        <div className="text-center mt-10">
          <div className="grid w-full items-center gap-1.5 mb-6 max-w-md mx-auto">
            <Label htmlFor="task-filter" className="text-left text-gray-600 font-medium">
              Filtro de Tarefas (ex: "hoje", "p1", "#projeto")
            </Label>
            <Input
              type="text"
              id="task-filter"
              placeholder="Opcional: insira um filtro do Todoist..."
              value={filterInput}
              onChange={(e) => setFilterInput(e.target.value)}
              className="mt-1"
              disabled={isLoading}
            />
          </div>
          <div className="flex flex-col md:flex-row justify-center gap-4 mt-6">
            {hasSavedState && (
              <Button
                onClick={() => loadTasksForProcessing(true)}
                className="px-8 py-4 text-xl bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors duration-200"
              >
                Continuar Processamento
              </Button>
            )}
            <Button
              onClick={() => loadTasksForProcessing(false)}
              className="px-8 py-4 text-xl bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-colors duration-200"
            >
              Iniciar Novo Processamento
            </Button>
            {hasSavedState && (
              <Button
                onClick={resetProcessor}
                className="px-8 py-4 text-xl bg-red-500 hover:bg-red-600 text-white rounded-lg transition-colors duration-200"
              >
                Resetar Estado Salvo
              </Button>
            )}
          </div>
        </div>
      )}

      {!isLoading && seiketsuState === "processing" && currentTask && (
        <div className="mt-8">
          <p className="text-center text-xl font-medium mb-6 text-gray-700">
            Processando tarefa {processedTasksCount + 1} de {processedTasksCount + inboxTasks.length}
          </p>
          <GTDTaskCard
            task={currentTask}
            isLoading={isLoading}
            onNotActionable={handleNotActionable}
            onActionable={handleActionable}
            onDelete={handleDelete}
            onIncubate={handleIncubate}
            onArchive={handleArchive}
            onDoNow={handleDoNow}
            onDelegate={handleDelegate}
            onSchedule={handleSchedule}
            onNextAction={handleNextAction}
            onEditTask={handleEditTask}
            onGoToProject={handleGoToProject}
            gtdStep={seiketsuStep}
          />
          <div className="flex justify-center gap-4 mt-6">
            <Button
              onClick={undoLastAction}
              disabled={history.length === 0}
              className="bg-gray-400 hover:bg-gray-500 text-white px-6 py-3 text-lg flex items-center justify-center"
            >
              <ArrowLeft className="mr-2 h-5 w-5" /> Desfazer
            </Button>
          </div>
          <div className="mt-8 text-center">
            <Progress value={progressValue} className="w-full max-w-md mx-auto h-3" />
          </div>
        </div>
      )}

      {!isLoading && seiketsuState === "finished" && (
        <div className="text-center mt-10">
          <p className="text-2xl font-semibold text-gray-700 mb-4">
            🎉 Processamento Seiketsu Concluído!
          </p>
          <p className="text-lg text-gray-600 mb-6">
            Você processou todas as {processedTasksCount} tarefas da sua caixa de entrada.
          </p>
          <Button
            onClick={() => loadTasksForProcessing(false)}
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