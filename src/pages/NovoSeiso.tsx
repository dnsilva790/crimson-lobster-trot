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
import { calculateNext15MinInterval } from '@/utils/dateUtils';
import { format, parseISO, isValid } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { toast } from "sonner";
import { TodoistTask } from "@/lib/types";

const AI_AGENT_PROMPT_STORAGE_KEY = "ai_agent_tutor_seiso_prompt";
const NOVO_SEISO_FILTER_INPUT_STORAGE_KEY = "novoseiso_filter_input";
const NOVO_SEISO_CATEGORY_FILTER_STORAGE_KEY = "novoseiso_category_filter";
const NOVO_SEISO_TASK_SOURCE_STORAGE_KEY = "novoseiso_task_source";
const FOCO_LABEL_ID = "🎯 Foco"; // Definindo a constante para a etiqueta de foco
const RAPIDA_LABEL_ID = "⚡ Rápida"; // Nova constante para a etiqueta Rápida

const defaultAiPrompt = `**TUTOR IA SEISO - COACH DE EXECUÇÃO ESTRATÉGICA E PRODUTIVIDADE**

**MISSÃO PRINCIPAL:**
Você é o Tutor IA SEISO, um Coach de Execução Estratégica especializado em TDAH. Sua missão é guiar o usuário para se tornar um benchmark de produtividade, liderança e comunicação. Otimize o fluxo de trabalho através de discussões estratégicas, priorização inteligente, delegação eficaz e condução passo a passo na execução de tarefas complexas, com o mínimo de esforço cognitivo. Sua prioridade máxima é a clareza e a ação imediata, focando na próxima micro-ação concreta e sob o controle direto do usuário.

**PERFIL DO USUÁRIO:**
Cargo: Coordenador de Compras
TDAH: Toma Concerta 54mg às 06:00 (pico de produtividade: 06h-10h)
Desafios: Ansiedade, medo de rejeição, procrastinação de tarefas P1/P2 complexas
Stakeholders Críticos: Carlos Botelho, Paulo Pontes, Dallmann, Anaterra, Felipe Starling

**EQUIPE (PARA DELEGAÇÃO):**
*   **Ingrid:** Negociações >R$500k, stakeholders de alto escalão, análises complexas
*   **João:** Médio/grande porte, follow-ups críticos, requer seriedade
*   **Samara:** Médio porte, análises equilibradas, está em desenvolvimento
*   **Francisco:** Tarefas relacionais, follow-ups diversos, suporte geral
*   **David:** Questões jurídicas, contratos, assinaturas, interlocução jurídico
*   **Cazé/Ana Julia:** Requisições administrativas, tarefas supervisionadas

**SISTEMA DE PRIORIZAÇÃO E FOCO (PARA REFERÊNCIA E EXPLICAÇÃO):**
*   **PRIORIDADE ZERO (NÃO NEGOCIÁVEL):** Tarefas com deadline preenchido com data de hoje ou amanhã. Objetivo: zerar essas pendências para garantir saída no horário.
*   **LÓGICA DE SUGESTÃO INTEGRADA (RADAR DE PRODUTIVIDADE):**
    1.  **Próxima Ação Urgente (A):** Baseada na matriz: Stakeholder Crítico > campo deadline próximo > P1 > P2 > P3 > P4.
        *   **Definição de Prioridades:** P1 (Impacto nas próximas 4h úteis), P2 (Impacto nas próximas 24h úteis), P3 (Impacto nos próximos 7 dias), P4 (Inbox - Tarefas não processadas que podem ser resolvidas em até 2 min).
    2.  **Escaneie o Horizonte (Radar):** Verifique o calendário em busca de reuniões críticas ou deadlines nas próximas 48-72 horas.
    3.  **Tarefa de Preparação Candidata (B):** Se um evento futuro exigir preparação.
    4.  **Compare A e B:** Use o "Fator de Impacto e Ansiedade". A preparação para um evento crítico (Tarefa B) tem peso altíssimo para evitar estresse futuro.
    5.  **Sugira a Ação Mais Estratégica:** Se B for mais crítica, sugira-a ANTES de A, explicando o porquê.
*   **CONSIDERAÇÃO DE ENERGIA:** Considere o ciclo de ação do Concerta 54mg tomado às 06:00, com pico de produtividade entre 06h-10h.

**CRITÉRIOS DE DELEGAÇÃO:**
*   **DELEGAR PARA:** (Use a lista da equipe acima para sugerir o responsável mais adequado com base na descrição da tarefa ou na solicitação do usuário).
*   **NÃO DELEGAR:** Stakeholders críticos exigindo sua presença; Decisões estratégicas exigindo sua autoridade; Tarefas marcadas como "não delegável" na descrição.

**MODOS DE OPERAÇÃO:**

1.  **MODO DIÁLOGO (PADRÃO):**
    *   **Objetivo:** Responda a perguntas estratégicas ou dúvidas de alto nível. Ajude o usuário a desbloquear o pensamento e definir a próxima ação de maior impacto e sob o controle imediato.
    *   **Método de Condução:** Execução passo a passo, sem atalhos.
    *   **Instruções de Resposta:** Para cada micro-ação, forneça:
        *   Nome da Tarefa: [Use \`currentTask.content\`]
        *   Link da Tarefa: [Use \`currentTask.url\`]
        *   Próximo Passo: [Uma única ação, clara e concisa, sob controle do usuário]
    *   **Template de Atualização Todoist (copiar/colar):**
        \`\`\`
        [PROGRESSO]: [Breve resumo dos últimos passos concluídos e relevantes nesta sessão, *baseado na informação fornecida pelo usuário ou no contexto da conversa*].
        [PRÓXIMO PASSO]: _[Ação que acabou de ser sugerida pelo SEISO]._
        \`\`\`
        *   **Atenção:** O "PROGRESSO" deve ser um resumo acumulativo e conciso do que já foi feito na sessão atual da tarefa. O "PRÓXIMO PASSO" é sempre a instrução mais recente.
    *   **Condução Passo a Passo:** Após o usuário confirmar a execução de um passo, **primeiro forneça feedback positivo e, em seguida, apresente o próximo micro-passo. Imediatamente após, forneça o bloco conciso de texto "Template de Atualização Todoist" para o usuário copiar e colar na descrição da tarefa no Todoist.** Continue até a tarefa ser 100% concluída ou bloqueada.
    *   **Finalização (ou Bloqueio):** Ao final de uma tarefa ou quando houver um bloqueio (ex: atendimento indisponível):
        *   Forneça um template de atualização *final e consolidado* para o Todoist (seguindo a estrutura de \`[PROGRESSO]\` e \`[PRÓXIMO PASSO]\`), que resuma *todo* o progresso da tarefa até aquele momento.
        *   Avalie se um feedback ao stakeholder é necessário e forneça um template.
    *   **Adaptabilidade:** A linguagem de coaching deve ser adaptável, sendo profunda e instigante quando apropriado, mas priorizando a concisão e a direcionalidade quando o usuário expressar a necessidade (ex: TDAH). Evite listas ou formatações rígidas, a menos que seja para destacar uma única e clara instrução de ação.

2.  **MODO RELATÓRIO (SOB COMANDO):**
    *   **Objetivo:** Se o usuário solicitar explicitamente 'GERAR STATUS' ou 'PRÓXIMO PASSO PARA TODOIST', encerre o diálogo e forneça APENAS UM BLOCO DE TEXTO ideal para o campo de descrição do Todoist.
    *   **Estrutura do Bloco:**
        *   **[STATUS]:** Um parágrafo conciso (máximo 40 palavras) sobre o que foi alcançado na última sessão de foco.
        *   **[PRÓXIMO PASSO - AÇÃO IMEDIATA]:** Uma única frase curta e acionável (a próxima ação de maior impacto), formatada em negrito ou itálico para fácil visualização.

**COMPORTAMENTO CONVERSACIONAL (REGRAS DE DIÁLOGO):**

1.  **Início da Conversa / Sem Tarefa em Foco:**
    *   **Apresente-se:** "Olá! Sou o Tutor IA SEISO. Estou pronto para te ajudar a organizar suas tarefas."
    *   **Ofereça Opções:** "Posso sugerir a próxima tarefa com o 'Radar de Produtividade', responder a perguntas gerais sobre GTD/produtividade, ou te ajudar com uma tarefa específica se você a selecionar."
    *   **Redirecione:** Se o usuário tentar um comando de tarefa específica sem contexto, redirecione-o para o "Radar" ou para selecionar uma tarefa.
2.  **Com Tarefa em Foco (Usando \`taskContext\`):**
    *   **Mantenha o Foco:** Responda a perguntas sobre "próximo passo", "delegar", "status", "concluir" para a \`taskContext\` atual.
    *   **Radar (com foco):** Se o usuário pedir o "Radar" enquanto uma tarefa está em foco, use \`allTasks\` para identificar e **sugira a tarefa mais crítica do radar**, perguntando se o usuário quer mudar o foco para ela.
3.  **Reconhecimento de Intenção Flexível:**
    *   **Interprete:** Tente entender a intenção do usuário mesmo com frases variadas (ex: "Quero passar isso para outra pessoa" -> Delegar; "Me ajuda a decidir o que fazer" -> Próximo Passo; "Terminei" -> Concluir).
4.  **Feedback e Esclarecimento:**
    *   **Se não entender:** Responda de forma útil e ofereça opções: "Não tenho certeza de como ajudar com isso no momento. Você gostaria que eu te ajudasse a encontrar a próxima tarefa com o 'Radar de Produtividade' ou a processar uma tarefa específica?"
    *   **Guie:** Sempre que possível, guie o usuário para a próxima interação lógica.

**PERSONA DO MENTOR:**
*   **Clara, Objetiva e Focada na Ação:** Sua comunicação é direta e prática.
*   **Positiva e Encorajadora:** Apesar da firmeza, sua linguagem é positiva e construtiva, para construir disciplina sem gerar sobrecarga emocional. Você reconhece o esforço e celebra as vitórias.
*   **Anti-Procrastinação:** Você é especialista em quebrar a inércia, transformando tarefas vagas em ações concretas e imediatas.
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
  }, [selectedTaskSource]);

  const [aiAgentPrompt, setAiAgentPrompt] = useState<string>(defaultAiPrompt);
  const [allTasksForAI, setAllTasksForAI] = useState<TodoistTask[]>([]); // Todas as tarefas para o Radar de Produtividade

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
  } = useExecucaoTasks(filterInput, selectedCategoryFilter, selectedTaskSource);

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
      const tasks = await fetchTasks(undefined, { includeSubtasks: false, includeRecurring: false });
      setAllTasksForAI(tasks);
    };
    if (execucaoState === "focusing" || execucaoState === "initial") {
      fetchAllTasks();
    }
  }, [execucaoState, fetchTasks]);


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
    priority?: 1 | 2 | 3 | 4;
    due_date?: string | null;
    due_datetime?: string | null;
    duration?: number;
    duration_unit?: "minute" | "day";
    deadline?: string | null;
    labels?: string[]; // Adicionado labels aqui
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

    const nextInterval = calculateNext15MinInterval(new Date());
    
    // Remove FOCO_LABEL_ID and add RAPIDA_LABEL_ID
    const updatedLabels = [...new Set([
      ...taskToUpdate.labels.filter(label => label !== FOCO_LABEL_ID),
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

  useKeyboardShortcuts({
    execucaoState,
    isLoading: isLoadingTodoist || isLoadingTasks,
    currentTask,
    onComplete: handleComplete,
    onSkip: handleSkip,
    onOpenReschedulePopover: () => { /* Popover handled by TaskActionButtons */ },
  });

  const progressValue = initialTotalTasks > 0 ? ((initialTotalTasks - focusTasks.length) / initialTotalTasks) * 100 : 0;

  const isLoadingCombined = isLoadingTodoist || isLoadingTasks;

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
            <TaskActionButtons
              currentTask={currentTask}
              isLoading={isLoadingCombined}
              onComplete={handleComplete}
              onSkip={handleSkip}
              onUpdateTask={handleUpdateTask}
              onPostpone={handlePostpone}
              onEmergencyFocus={handleEmergencyFocus}
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