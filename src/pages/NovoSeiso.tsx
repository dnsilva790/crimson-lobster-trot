"use client";

import React, { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { useTodoist } from "@/context/TodoistContext";
import LoadingSpinner from "@/components/ui/loading-spinner";
import FocusTaskCard from "@/components/FocusTaskCard";
import { Progress } from "@/components/ui/progress";
import AIAgentAssistant from "@/components/AIAgentAssistant";
import AIAgentPromptEditor from "@/components/AIAgentPromptEditor";

import ExecucaoInitialState from "@/components/execucao/ExecucaoInitialState";
import ExecucaoFinishedState from "@/components/execucao/ExecucaoFinishedState";
import TaskActionButtons from "@/components/execucao/TaskActionButtons";
import { useExecucaoTasks } from "@/hooks/useExecucaoTasks";
import { useKeyboardShortcuts } from "@/hooks/useKeyboardShortcuts";
import { calculateNext15MinInterval, calculateNextFullHour } from '@/utils/dateUtils'; // Importar calculateNextFullHour
import { format, parseISO, isValid } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { toast } from "sonner";
import { TodoistTask } from "@/lib/types";
import {
  FOCO_LABEL_ID,
  RAPIDA_LABEL_ID,
  CRONOGRAMA_HOJE_LABEL,
} from "@/lib/constants"; // Importar as constantes das etiquetas
import SubtaskTimelineView from "@/components/SubtaskTimelineView"; // Importar o novo componente SubtaskTimelineView

const AI_AGENT_PROMPT_STORAGE_KEY = "ai_agent_tutor_seiso_prompt";
const NOVO_SEISO_FILTER_INPUT_STORAGE_KEY = "novoseiso_filter_input";
const NOVO_SEISO_CATEGORY_FILTER_STORAGE_KEY = "novoseiso_category_filter";
const NOVO_SEISO_TASK_SOURCE_STORAGE_KEY = "novoseiso_task_source";

const defaultAiPrompt = `**TUTOR IA SEISO - COACH DE EXECUÇÃO ESTRATÉGICA E PRODUTIVIDADE (FOCO TDAH)**

**MISSÃO:** Você é um Coach de Execução Estratégica, focado em ajudar o usuário a lidar com tarefas de forma assertiva, especialmente considerando os desafios do TDAH (procrastinação, sobrecarga cognitiva, dificuldade em iniciar).

**REGRAS DE INTERAÇÃO:**
1.  **Clareza e Concisão:** Suas respostas devem ser curtas, diretas e focadas na ação. Evite parágrafos longos.
2.  **Próxima Micro-Ação:** Para qualquer tarefa em foco, sua prioridade é identificar e sugerir a **próxima micro-ação concreta e sob o controle imediato do usuário**.
3.  **Quebra de Inércia:** Se o usuário estiver travado, sugira a menor ação possível para iniciar o movimento.
4.  **Suporte Emocional:** Use uma linguagem positiva, encorajadora e de suporte, reconhecendo o esforço.
5.  **Comandos de Etiqueta:** O usuário pode pedir para adicionar/remover etiquetas (Foco, Rápida, Cronograma).
6.  **Relatórios:** Se o usuário solicitar um relatório de status ou próximo passo, forneça o template de atualização do Todoist.

**CONTEXTO DA TAREFA:**
Use as informações da 'Tarefa em Foco' para guiar a conversa.

**TEMPLATE DE ATUALIZAÇÃO TODOIST (Para comandos de relatório):**
\`\`\`
[PROGRESSO]: [Resumo conciso do que foi feito na última sessão].
[PRÓXIMO PASSO]: _[Ação imediata sugerida pelo Tutor IA]._
\`\`\`
`;

const NovoSeiso = () => {
  const { fetchTasks, closeTask, updateTask, isLoading: isLoadingTodoist } = useTodoist();
  const [filterInput, setFilterInput] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem(NOVO_SEISO_FILTER_INPUT_STORAGE_KEY) || "";
    }
    return "";
  });
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState<"all" | "pessoal" | "profissional">(() => {
    if (typeof window !== 'undefined') {
      return (localStorage.getItem(NOVO_SEISO_CATEGORY_FILTER_STORAGE_KEY) as "all" | "pessoal" | "profissional") || "all";
    }
    return "all";
  });
  const [selectedTaskSource, setSelectedTaskSource] = useState<"filter" | "planner" | "ranking" | "all">(() => {
    if (typeof window !== 'undefined') {
      return (localStorage.getItem(NOVO_SEISO_TASK_SOURCE_STORAGE_KEY) as "filter" | "planner" | "ranking" | "all") || "all";
    }
    return "all";
  });

  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem(NOVO_SEISO_FILTER_INPUT_STORAGE_KEY, filterInput);
    }
  }, [filterInput]);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem(NOVO_SEISO_CATEGORY_FILTER_STORAGE_KEY, selectedCategoryFilter);
    }
  }, [selectedCategoryFilter]);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem(NOVO_SEISO_TASK_SOURCE_STORAGE_KEY, selectedTaskSource);
    }
    // When task source changes, we should reload tasks for focus
    if (selectedTaskSource !== "all") { // Only reload if not 'all' to avoid double fetching on initial load
      loadTasksForFocus(selectedTaskSource);
    }
  }, [selectedTaskSource]);

  const [aiAgentPrompt, setAiAgentPrompt] = useState<string>(defaultAiPrompt);
  const [allTasksForAI, setAllTasksForAI] = useState<TodoistTask[]>([]); // Todas as tarefas para o Radar de Produtividade
  const [subtasks, setSubtasks] = useState<TodoistTask[]>([]); // Novo estado para subtarefas
  const [isLoadingSubtasks, setIsLoadingSubtasks] = useState(false); // Novo estado de loading para subtarefas

  const {
    focusTasks,
    initialTotalTasks,
    currentTaskIndex,
    execucaoState,
    isLoadingTasks,
    loadTasksForFocus,
    advanceToNextTask,
    updateTaskInFocusList,
    setFocusTaskById,
  } = useExecucaoTasks(filterInput, selectedCategoryFilter, selectedCategoryFilter, selectedTaskSource);

  const currentTask = focusTasks[currentTaskIndex] || null;

  const handleSaveAiAgentPrompt = useCallback((newPrompt: string) => {
    setAiAgentPrompt(newPrompt);
    localStorage.setItem(AI_AGENT_PROMPT_STORAGE_KEY, newPrompt);
  }, []);

  useEffect(() => {
    const savedPrompt = localStorage.getItem(AI_AGENT_PROMPT_STORAGE_KEY);
    if (savedPrompt) {
      setAiAgentPrompt(savedPrompt);
    }
  }, []);

  // Fetch all tasks for the AI Assistant's "Radar de Produtividade"
  useEffect(() => {
    const fetchAllTasks = async () => {
      console.log("NovoSeiso: Fetching all tasks for AI Assistant Radar.");
      const tasks = await fetchTasks(undefined, { includeSubtasks: false, includeRecurring: false });
      setAllTasksForAI(tasks);
      console.log(`NovoSeiso: Fetched ${tasks.length} tasks for AI Assistant Radar.`);
    };
    if (execucaoState === "focusing" || execucaoState === "initial") {
      fetchAllTasks();
    }
  }, [execucaoState, fetchTasks]);

  // Fetch subtasks for the current task
  useEffect(() => {
    const fetchSubtasksForCurrentTask = async () => {
      if (currentTask && currentTask.id) {
        console.log(`NovoSeiso: Attempting to fetch subtasks for parent ID: ${currentTask.id}`);
        setIsLoadingSubtasks(true);
        try {
          // CORREÇÃO: Passar parentId como opção, não como filtro
          const fetchedSubtasks = await fetchTasks(undefined, { parentId: currentTask.id, includeSubtasks: true, includeRecurring: false });
          console.log(`NovoSeiso: Fetched ${fetchedSubtasks.length} subtasks for task ${currentTask.id}:`, fetchedSubtasks);
          setSubtasks(fetchedSubtasks || []);
        } catch (error) {
          console.error("NovoSeiso: Failed to fetch subtasks:", error);
          setSubtasks([]);
        } finally {
          setIsLoadingSubtasks(false);
        }
      } else {
        console.log("NovoSeiso: No currentTask or currentTask.id, clearing subtasks.");
        setSubtasks([]);
      }
    };
    fetchSubtasksForCurrentTask();
  }, [currentTask, fetchTasks]);


  const handleComplete = useCallback(async (taskId: string) => {
    const success = await closeTask(taskId);
    if (success !== undefined) {
      toast.success("Tarefa concluída com sucesso!");
      advanceToNextTask();
    }
  }, [closeTask, advanceToNextTask]);

  const handleSkip = useCallback(() => {
    toast.info("Tarefa pulada.");
    advanceToNextTask();
  }, [advanceToNextTask]);

  const handleUpdateTask = useCallback(async (taskId: string, data: {
    content?: string;
    description?: string;
    priority?: 1 | 2 | 3 | 4;
    due_date?: string | null;
    due_datetime?: string | null;
    labels?: string[];
    duration?: number;
    duration_unit?: "minute" | "day";
    deadline?: string | null;
  }) => {
    const updated = await updateTask(taskId, data);
    if (updated) {
      updateTaskInFocusList(updated);
      toast.success("Tarefa atualizada no Todoist!");
      return updated;
    } else {
      toast.error("Falha ao atualizar a tarefa.");
      return undefined;
    }
  }, [updateTask, updateTaskInFocusList]);

  const handlePostpone = useCallback(async (taskId: string) => {
    const taskToUpdate = focusTasks.find(task => task.id === taskId);
    if (!taskToUpdate) {
      toast.error("Tarefa não encontrada para postergar.");
      return;
    }

    // Revertido para usar calculateNext15MinInterval
    const nextInterval = calculateNext15MinInterval(new Date());
    
    // Remove FOCO_LABEL_ID e CRONOGRAMA_HOJE_LABEL, e adiciona RAPIDA_LABEL_ID
    const updatedLabels = [...new Set([
      ...taskToUpdate.labels.filter(label => label !== FOCO_LABEL_ID && label !== CRONOGRAMA_HOJE_LABEL),
      RAPIDA_LABEL_ID
    ])];

    const updated = await updateTask(taskId, {
      due_date: nextInterval.date,
      due_datetime: nextInterval.datetime,
      labels: updatedLabels, // Atualiza as etiquetas
    });
    if (updated) {
      toast.success(`Tarefa postergada para ${format(parseISO(nextInterval.datetime), "dd/MM/yyyy HH:mm", { locale: ptBR })} e marcada como rápida!`);
      updateTaskInFocusList(updated);
    } else {
      toast.error("Falha ao postergar a tarefa.");
    }
  }, [updateTask, updateTaskInFocusList, focusTasks]);

  const handleEmergencyFocus = useCallback(async (taskId: string) => {
    const taskToUpdate = focusTasks.find(task => task.id === taskId);
    if (!taskToUpdate) {
      toast.error("Tarefa não encontrada para foco de emergência.");
      return;
    }

    const updatedLabels = [...new Set([...taskToUpdate.labels, FOCO_LABEL_ID])]; // Adiciona a etiqueta de foco
    
    const updated = await updateTask(taskId, { 
      priority: 4, // Define como P1
      labels: updatedLabels, // Atualiza as etiquetas
    }); 

    if (updated) {
      updateTaskInFocusList(updated);
      setFocusTaskById(taskId); // Muda o foco para esta tarefa
      toast.success("Foco de emergência ativado! Tarefa definida como P1 e com etiqueta de foco.");
    } else {
      toast.error("Falha ao ativar foco de emergência.");
    }
  }, [updateTask, updateTaskInFocusList, setFocusTaskById, focusTasks]);

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
      updateTaskInFocusList(updated);
      toast.success(`Etiqueta "${labelToToggle}" ${isLabelActive ? 'removida' : 'adicionada'}!`);
    } else {
      toast.error(`Falha ao atualizar etiqueta "${labelToToggle}".`);
    }
  }, [updateTask, updateTaskInFocusList]);

  const handleToggleFoco = useCallback(async (taskId: string, currentLabels: string[]) => {
    await handleToggleLabel(taskId, currentLabels, FOCO_LABEL_ID);
  }, [handleToggleLabel]);

  const handleToggleRapida = useCallback(async (taskId: string, currentLabels: string[]) => {
    await handleToggleLabel(taskId, currentLabels, RAPIDA_LABEL_ID);
  }, [handleToggleLabel]);

  const handleToggleCronograma = useCallback(async (taskId: string, currentLabels: string[]) => {
    await handleToggleLabel(taskId, currentLabels, CRONOGRAMA_HOJE_LABEL);
  }, [handleToggleLabel]);


  useKeyboardShortcuts({
    execucaoState,
    isLoading: isLoadingTodoist || isLoadingTasks,
    currentTask,
    onComplete: handleComplete,
    onSkip: handleSkip,
    onOpenReschedulePopover: () => { /* Popover handled by TaskActionButtons */ },
  });

  const progressValue = initialTotalTasks > 0 ? ((initialTotalTasks - focusTasks.length) / initialTotalTasks) * 100 : 0;

  const isLoadingCombined = isLoadingTodoist || isLoadingTasks || isLoadingSubtasks;

  return (
    <div className="p-4 grid grid-cols-1 lg:grid-cols-3 gap-6">
      <div className="lg:col-span-2">
        <h2 className="text-3xl font-bold mb-2 text-gray-800">✨ NOVO SEISO - Modo Foco Total</h2>
        <p className="text-lg text-gray-600 mb-6">
          Concentre-se em uma tarefa por vez, com o apoio do seu Tutor IA.
        </p>

        {isLoadingCombined && (
          <div className="flex justify-center items-center h-48">
            <LoadingSpinner size={40} />
          </div>
        )}

        {!isLoadingCombined && execucaoState === "initial" && (
          <ExecucaoInitialState
            filterInput={filterInput}
            setFilterInput={setFilterInput}
            selectedCategoryFilter={selectedCategoryFilter}
            setSelectedCategoryFilter={setSelectedCategoryFilter}
            selectedTaskSource={selectedTaskSource}
            setSelectedTaskSource={setSelectedTaskSource}
            onStartFocus={() => loadTasksForFocus(selectedTaskSource)}
            isLoading={isLoadingCombined}
          />
        )}

        {!isLoadingCombined && execucaoState === "focusing" && currentTask && (
          <div className="mt-8">
            <div className="flex justify-between items-center mb-4">
              <p className="text-xl font-medium text-gray-700">
                Tarefa {currentTaskIndex + 1} de {focusTasks.length}
              </p>
              <Progress value={progressValue} className="w-1/2 h-3" />
            </div>
            <FocusTaskCard task={currentTask} />
            
            {/* Render SubtaskTimelineView here */}
            {isLoadingSubtasks ? (
              <div className="flex justify-center items-center h-24 mt-4">
                <LoadingSpinner size={20} />
              </div>
            ) : subtasks.length > 0 && (
              <div className="mt-6">
                <SubtaskTimelineView subtasks={subtasks} mainTaskDueDate={currentTask.due?.datetime ? parseISO(currentTask.due.datetime) : (currentTask.due?.date ? parseISO(currentTask.due.date) : null)} />
              </div>
            )}

            <TaskActionButtons
              currentTask={currentTask}
              isLoading={isLoadingCombined}
              onComplete={handleComplete}
              onSkip={handleSkip}
              onUpdateTask={handleUpdateTask}
              onPostpone={handlePostpone}
              onEmergencyFocus={handleEmergencyFocus}
              onToggleFoco={handleToggleFoco}
              onToggleRapida={handleToggleRapida}
              onToggleCronograma={handleToggleCronograma}
            />
          </div>
        )}

        {!isLoadingCombined && execucaoState === "finished" && (
          <ExecucaoFinishedState
            originalTasksCount={initialTotalTasks}
            onStartNewFocus={() => setExecucaoState("initial")}
          />
        )}
      </div>
      <div className="lg:col-span-1">
        <div className="flex justify-end mb-4">
          <AIAgentPromptEditor
            initialPrompt={aiAgentPrompt}
            onSave={handleSaveAiAgentPrompt}
            storageKey={AI_AGENT_PROMPT_STORAGE_KEY}
          />
        </div>
        <AIAgentAssistant
          aiPrompt={aiAgentPrompt}
          currentTask={currentTask}
          allTasks={allTasksForAI}
          updateTask={handleUpdateTask}
          closeTask={handleComplete}
          onTaskSuggested={setFocusTaskById}
        />
      </div>
    </div>
  );
};

export default NovoSeiso;