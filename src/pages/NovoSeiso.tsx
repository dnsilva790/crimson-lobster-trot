"use client";

import React, { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { useTodoist } from "@/context/TodoistContext";
import LoadingSpinner from "@/components/ui/loading-spinner";
import FocusTaskCard from "@/components/FocusTaskCard";
import { Progress } from "@/components/ui/progress";
import AIAssistant from "@/components/AIAssistant";
import PromptEditor from "@/components/PromptEditor";

import ExecucaoInitialState from "@/components/execucao/ExecucaoInitialState";
import ExecucaoFinishedState from "@/components/execucao/ExecucaoFinishedState";
import TaskActionButtons from "@/components/execucao/TaskActionButtons";
import { useExecucaoTasks } from "@/hooks/useExecucaoTasks";
import { useKeyboardShortcuts } from "@/hooks/useKeyboardShortcuts";
import { calculateNext15MinInterval } from '@/utils/dateUtils';
import { format, parseISO, isValid } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { toast } from "sonner";


const AI_PROMPT_STORAGE_KEY = "ai_tutor_novoseiso_prompt";
const NOVO_SEISO_FILTER_INPUT_STORAGE_KEY = "novoseiso_filter_input";
const NOVO_SEISO_CATEGORY_FILTER_STORAGE_KEY = "novoseiso_category_filter";
const NOVO_SEISO_TASK_SOURCE_STORAGE_KEY = "novoseiso_task_source";

const defaultAiPrompt = `**TUTOR IA SEISO - COACH DE EXECUÇÃO ESTRATÉGICA E PRODUTIVIDADE**
**MISSÃO PRINCIPAL**
Você é o Tutor IA SEISO, um Coach de Execução Estratégica especializado em TDAH. Sua missão é transformar o usuário em um benchmark de produtividade, liderança e comunicação. Você otimiza o fluxo de trabalho através de discussões estratégicas, priorização inteligente, delegação eficaz e condução passo a passo na execução de tarefas complexas, com o mínimo de esforço cognitivo. Sua prioridade máxima é a clareza e a ação imediata, focando na próxima micro-ação concreta e sob o controle direto do usuário.

**PERFIL DO USUÁRIO**
Cargo: Coordenador de Compras
TDAH: Toma Concerta 54mg às 06:00 (pico de produtividade: 06h-10h)
Desafios: Ansiedade, medo de rejeição, procrastinação de tarefas P1/P2 complexas
Stakeholders Críticos: Carlos Botelho, Paulo Pontes, Dallmann, Anaterra, Felipe Starling

**EQUIPE (PARA DELEGAÇÃO)**
* **Ingrid:** Negociações >R$500k, stakeholders de alto escalão, análises complexas
* **João:** Médio/grande porte, follow-ups críticos, requer seriedade
* **Samara:** Médio porte, análises equilibradas, está em desenvolvimento
* **Francisco:** Tarefas relacionais, follow-ups diversos, suporte geral
* **David:** Questões jurídicas, contratos, assinaturas, interlocução jurídico
* **Cazé/Ana Julia:** Requisições administrativas, tarefas supervisionadas

**SISTEMA DE PRIORIZAÇÃO E FOCO**
**PRIORIDADE ZERO (NÃO NEGOCIÁVEL)**
Tarefas com deadline preenchido com data de hoje ou amanhã. Objetivo: zerar essas pendências para garantir saída no horário.

**LÓGICA DE SUGESTÃO INTEGRADA (RADAR DE PRODUTIVIDADE)**
Após limpar os deadlines, a lógica para sugerir a próxima tarefa:
1. **Identifique a Próxima Ação Urgente (A)** com base na matriz: Stakeholder Crítico > campo deadline próximo > P1 > P2 > P3 > P4
    * **Definição de Prioridades:**
        * **P1:** Impacto nas próximas 4 horas úteis
        * **P2:** Impacto nas próximas 24 horas úteis
        * **P3:** Impacto nos próximos 7 dias
        * **P4:** Inbox - Tarefas não processadas que podem ser resolvidas em até 2 minutos
2. **Escaneie o Horizonte (Radar):** Verifique o calendário em busca de reuniões críticas ou deadlines nas próximas 48-72 horas
3. **Crie uma "Tarefa de Preparação Candidata" (B)** se um evento futuro exigir preparação
4. **Compare A e B:** Use o "Fator de Impacto e Ansiedade". A preparação para um evento crítico (Tarefa B) tem peso altíssimo para evitar estresse futuro
5. **Sugira a Ação Mais Estratégica:** Se B for mais crítica, sugira-a ANTES de A, explicando o porquê

**CONSIDERAÇÃO DE ENERGIA**
Para considerar o nível de energia disponível para execução de tarefas, considere o ciclo de ação do Concerta 54mg tomado às 06:00, com pico de produtividade entre 06h-10h.

**CRITÉRIOS DE DELEGAÇÃO**
**DELEGAR PARA:**
* **Ingrid:** Negociações >R$500k, stakeholders de alto escalão, análises complexas
* **João:** Médio/grande porte, follow-ups críticos, requer seriedade
* **Samara:** Médio porte, análises equilibradas, está em desenvolvimento
* **Francisco:** Tarefas relacionais, follow-ups diversos, suporte geral
* **David:** Questões jurídicas, contratos, assinaturas, interlocução jurídico
* **Cazé/Ana Julia:** Requisições administrativas, tarefas supervisionadas
**NÃO DELEGAR:**
* Stakeholders críticos exigindo sua presença
* Decisões estratégicas exigindo sua autoridade
* Tarefas marcadas como "não delegável" na descrição

**MODOS DE OPERAÇÃO**
1. **MODO DIÁLOGO (PADRÃO)**
Responda a perguntas estratégicas ou dúvidas de alto nível. Seu objetivo é ajudar o usuário a desbloquear o pensamento e definir a próxima ação de maior impacto e sob seu controle imediato. Método de Condução: Execução passo a passo, sem atalhos.
**Instruções Simples e Diretas:** Para cada micro-ação, forneça:
* Nome da Tarefa: [Nome exato da tarefa]
* Link da Tarefa: [Link do Todoist]
* Próximo Passo: [Uma única ação, clara e concisa]
* **Sugestão para Atualização da Descrição do Todoist (copiar/colar):**
\`\`\`
[PROGRESSO]: [Breve resumo dos últimos passos concluídos e relevantes nesta sessão].
[PRÓXIMO PASSO]: _[Ação que acabou de ser sugerida pelo SEISO]._
\`\`\`
*Atenção:* O "PROGRESSO" deve ser um resumo acumulativo e conciso do que já foi feito na sessão atual da tarefa, focando nos *últimos* feitos. O "PRÓXIMO PASSO" é sempre a instrução mais recente.
**Condução Passo a Passo (Revisado):** Após confirmação de execução de um passo, **primeiro forneça feedback positivo e, em seguida, apresente o próximo micro-passo. Imediatamente após, forneça o bloco conciso de texto "Sugestão para Atualização da Descrição do Todoist" para o usuário copiar e colar na descrição da tarefa no Todoist, refletindo o progresso e o próximo passo.** Continue até a tarefa ser 100% concluída.
**Finalização (Ajustado):** Ao final de uma tarefa **ou quando houver um bloqueio (como atendimento indisponível)**:
* Forneça um template de atualização *final e consolidado* para o Todoist (seguindo a estrutura de [STATUS] e [PRÓXIMO PASSO - AÇÃO IMEDIATA]), que resuma *todo* o progresso da tarefa até aquele momento.
* Avalie se um feedback ao stakeholder é necessário e forneça um template.
Adaptabilidade: A linguagem de coaching deve ser adaptável, sendo profunda e instigante quando apropriado, mas priorizando a concisão e a direcionalidade quando o usuário expressar a necessidade (ex: TDAH). Neste modo, evite listas ou formatações rígidas, a menos que seja para destacar uma única e clara instrução de ação.

2. **MODO RELATÓRIO (SOB COMANDO)**
Se o usuário solicitar explicitamente 'GERAR STATUS' ou 'PRÓXIMO PASSO PARA TODOIST', você deve encerrar o diálogo e fornecer APENAS UM BLOCO DE TEXTO ideal para o campo de descrição do Todoist. Este bloco deve ser estruturado em duas seções claras:
* **[STATUS]:** Um parágrafo conciso (máximo 40 palavras) sobre o que foi alcançado na última sessão de foco.
* **[PRÓXIMO PASSO - AÇÃO IMEDIATA]:** Uma única frase curta e acionável (a próxima ação de maior impacto), formatada em negrito ou itálico para fácil visualização.

**PERSONA DO MENTOR**
Clara, Objetiva e Focada na Ação: Sua comunicação é direta e prática.
Positiva e Encorajadora: Apesar da firmeza, sua linguagem é positiva e construtiva, para construir disciplina sem gerar sobrecarga emocional. Você reconhece o esforço e celebra as vitórias.
Anti-Procrastinação: Você é especialista em quebrar a inércia, transformando tarefas vagas em ações concretas e imediatas.`;

const NovoSeiso = () => {
  const { closeTask, updateTask, isLoading: isLoadingTodoist } = useTodoist();
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
      return (localStorage.getItem(NOVO_SEISO_TASK_SOURCE_STORAGE_KEY) as "filter" | "planner" | "ranking" | "all") || "filter";
    }
    return "filter";
  });
  const [aiPrompt, setAiPrompt] = useState<string>(defaultAiPrompt);

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

  const {
    focusTasks,
    initialTotalTasks,
    currentTaskIndex,
    execucaoState,
    isLoadingTasks,
    loadTasksForFocus,
    advanceToNextTask,
    updateTaskInFocusList,
  } = useExecucaoTasks(filterInput, selectedCategoryFilter, selectedTaskSource);

  const currentTask = focusTasks[currentTaskIndex];

  useEffect(() => {
    const savedPrompt = localStorage.getItem(AI_PROMPT_STORAGE_KEY);
    if (savedPrompt) {
      setAiPrompt(savedPrompt);
    }
  }, []);

  const handleSaveAiPrompt = useCallback((newPrompt: string) => {
    setAiPrompt(newPrompt);
    localStorage.setItem(AI_PROMPT_STORAGE_KEY, newPrompt);
  }, []);

  const handleComplete = useCallback(async (taskId: string) => {
    const success = await closeTask(taskId);
    if (success !== undefined) {
      advanceToNextTask();
      toast.success("Tarefa concluída com sucesso!");
    }
  }, [closeTask, advanceToNextTask]);

  const handleSkip = useCallback(async () => {
    advanceToNextTask();
    toast.info("Tarefa pulada.");
  }, [advanceToNextTask]);

  const handleUpdateTaskAndRefresh = useCallback(async (taskId: string, data: {
    priority?: 1 | 2 | 3 | 4;
    due_date?: string | null;
    due_datetime?: string | null;
    duration?: number;
    duration_unit?: "minute" | "day";
    deadline?: string | null;
  }) => {
    const updated = await updateTask(taskId, data);
    if (updated) {
      updateTaskInFocusList(updated);
      toast.success("Tarefa atualizada com sucesso!");
    }
    return updated;
  }, [updateTask, updateTaskInFocusList]);

  const handlePostpone = useCallback(async (taskId: string) => {
    if (!currentTask) return; // Ensure currentTask is available

    const nextInterval = calculateNext15MinInterval(new Date());
    
    // Remove '🎯 Foco' and add '⚡ Rápida' labels
    const updatedLabels = new Set(currentTask.labels);
    updatedLabels.delete('🎯 Foco');
    updatedLabels.add('⚡ Rápida');

    const updated = await updateTask(taskId, {
      due_date: nextInterval.date,
      due_datetime: nextInterval.datetime,
      labels: Array.from(updatedLabels), // Convert Set back to Array
    });
    if (updated) {
      toast.success(`Tarefa postergada para ${format(parseISO(nextInterval.datetime), "dd/MM/yyyy HH:mm", { locale: ptBR })} e atualizada!`);
      advanceToNextTask();
    } else {
      toast.error("Falha ao postergar a tarefa.");
    }
  }, [updateTask, advanceToNextTask, currentTask]); // Add currentTask to dependencies

  const [isReschedulePopoverOpen, setIsReschedulePopoverOpen] = useState(false);

  useKeyboardShortcuts({
    execucaoState,
    isLoading: isLoadingTodoist || isLoadingTasks,
    currentTask,
    onComplete: handleComplete,
    onSkip: handleSkip,
    onOpenReschedulePopover: () => setIsReschedulePopoverOpen(true),
  });

  const tasksProcessed = initialTotalTasks - focusTasks.length;
  const progressValue = initialTotalTasks > 0 ? (tasksProcessed / initialTotalTasks) * 100 : 0;
  
  const isLoading = isLoadingTodoist || isLoadingTasks;

  return (
    <div className="p-4 grid grid-cols-1 lg:grid-cols-3 gap-6">
      <div className="lg:col-span-2">
        <h2 className="text-3xl font-bold mb-2 text-gray-800">✨ NOVO SEISO - Modo Foco Total</h2>
        <p className="text-lg text-gray-600 mb-6">Concentre-se em uma tarefa por vez.</p>

        {isLoading && (
          <div className="flex justify-center items-center h-48">
            <LoadingSpinner size={40} />
          </div>
        )}

        {!isLoading && execucaoState === "initial" && (
          <ExecucaoInitialState
            filterInput={filterInput}
            setFilterInput={setFilterInput}
            selectedCategoryFilter={selectedCategoryFilter}
            setSelectedCategoryFilter={setSelectedCategoryFilter}
            selectedTaskSource={selectedTaskSource}
            setSelectedTaskSource={setSelectedTaskSource}
            onStartFocus={() => loadTasksForFocus(selectedTaskSource)}
            isLoading={isLoading}
          />
        )}

        {!isLoading && execucaoState === "focusing" && currentTask && (
          <div className="mt-8">
            <FocusTaskCard task={currentTask} />

            <TaskActionButtons
              currentTask={currentTask}
              isLoading={isLoading}
              onComplete={handleComplete}
              onSkip={handleSkip}
              onUpdateTask={handleUpdateTaskAndRefresh}
              onPostpone={handlePostpone}
            />

            <div className="mt-8 text-center">
              <p className="text-lg font-medium text-gray-700 mb-2">
                Tarefas restantes: {focusTasks.length} de {initialTotalTasks}
              </p>
              <Progress value={progressValue} className="w-full max-w-md mx-auto h-3" />
            </div>
          </div>
        )}

        {!isLoading && execucaoState === "finished" && (
          <ExecucaoFinishedState
            originalTasksCount={initialTotalTasks}
            onStartNewFocus={() => loadTasksForFocus(selectedTaskSource)}
          />
        )}
      </div>

      <div className="lg:col-span-1 flex flex-col gap-4">
        <div className="flex justify-end">
          <PromptEditor
            initialPrompt={aiPrompt}
            onSave={handleSaveAiPrompt}
            storageKey={AI_PROMPT_STORAGE_KEY}
          />
        </div>
        <AIAssistant
          aiPrompt={aiPrompt}
          currentTask={currentTask}
          focusTasks={focusTasks}
          updateTask={updateTask}
          closeTask={closeTask}
        />
      </div>
    </div>
  );
};

export default NovoSeiso;