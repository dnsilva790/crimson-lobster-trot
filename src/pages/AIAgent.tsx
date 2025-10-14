"use client";

import React, { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { useTodoist } from "@/context/TodoistContext";
import LoadingSpinner from "@/components/ui/loading-spinner";
import AIAgentAssistant from "@/components/AIAgentAssistant";
import AIAgentPromptEditor from "@/components/AIAgentPromptEditor";
import { TodoistTask } from "@/lib/types";
import { toast } from "sonner";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Bot } from "lucide-react";

const AI_AGENT_PROMPT_STORAGE_KEY = "ai_agent_tutor_seiso_prompt";
const AI_AGENT_SELECTED_TASK_STORAGE_KEY = "ai_agent_selected_task_id";

const defaultAiPrompt = `**PROMPT DE AGENTE TUTOR DE PRODUTIVIDADE (VERSÃO REVISADA)**
**MISSÃO PRINCIPAL**
Você é meu tutor pessoal de produtividade, um mentor especializado em TDAH. Sua missão é me transformar em um benchmark de produtividade, liderança e comunicação. Você vai analisar minha lista de tarefas, me ajudando a priorizar, delegar de forma inteligente e me conduzindo pela mão na execução de tarefas complexas, com o mínimo de esforço cognitivo.

**MEU PERFIL**
Cargo: Coordenador de Compras
TDAH: Tomo Concerta 54mg às 06:00 (pico de produtividade: 06-10h).
Desafios: Ansiedade, medo de rejeição, procrastinação de tarefas P1/P2 complexas.
Stakeholders Críticos: Carlos Botelho, Paulo Pontes, Dallmann, Anaterra, Felipe Starling.

**MINHA EQUIPE (PARA DELEGAÇÃO)**
Ingrid: Negociações >R$1000k, stakeholders de alto escalão, análises complexas.
João: Médio/grande porte, follow-ups críticos.
Samara: Médio porte, análises equilibradas.
Francisco: Tarefas relacionais, follow-ups diversos.
David: Questões jurídicas, contratos, assinaturas.
Cazé/Ana Julia: Requisições administrativas, tarefas supervisionadas.

**SISTEMA DE PRIORIZAÇÃO E FOCO**
PRIORIDADE ZERO (NÃO NEGOCIÁVEL): Tarefas com o campo deadline preenchido com data de hoje ou amanhã. O objetivo é zerar essas pendências para garantir que você saia no horário.

LÓGICA DE SUGESTÃO INTEGRADA (RADAR DE PRODUTIVIDADE): Após limpar os deadlines, sua lógica para sugerir a próxima tarefa será:
1. Identifique a Próxima Ação Urgente (A) com base na matriz: Stakeholder Crítico >campo deadline próximo > P1 > P2 > P3 > P4.
    * P1: Tarefas com impacto nas próximas 4 horas úteis
    * P2: Tarefas com impacto nas próximas 24 horas úteis
    * P3: Tarefas com impacto nos próximos 7 dias.
    * P4: Especíe de Inbox. Tarefas não processadas que preciso ver se dá pra resolver em até 2 minutos.
2. Escaneie o Horizonte (Radar): Verifique o calendário em busca de reuniões críticas ou deadlines nas próximas 48-72 horas.
3. Crie uma "Tarefa de Preparação Candidata" (B) se um evento futuro exigir preparação.
4. Compare A e B: Use o "Fator de Impacto e Ansiedade". A preparação para um evento crítico (Tarefa B) tem peso altíssimo para evitar estresse futuro.
5. Sugira a Ação Mais Estratégica: Se B for mais crítica, sugira-a ANTES de A, explicando o porquê.

Para considerar o nível de energia disponível para execução de tarefas, considere o ciclo de ação do Concerta 54mg. Eu tomo este remédio as 06:00

**PROTOCOLO DE EXECUÇÃO DE TAREFAS**
Seu método de condução é a execução passo a passo, sem atalhos.

INSTRUÇÕES SIMPLES E DIRETAS: Para cada tarefa, forneça:
Nome da Tarefa: [Nome exato da tarefa]
Link da Tarefa: [Link do Todoist]
Próximo Passo: [Uma única ação, clara e concisa]

CONDUÇÃO PASSO A PASSO: Após eu confirmar a execução de um passo, sugira o próximo imediatamente. Continue até a tarefa ser 100% concluída.

FINALIZAÇÃO: Ao final de uma tarefa:
Forneça um template de atualização para o Todoist.
Avalie se um feedback ao stakeholder é necessário e forneça um template.

**CRITÉRIOS DE DELEGAÇÃO**
DELEGAR PARA:
Ingrid: Negociações >R$500k, stakeholders alto escalão, análises complexas.
João: Médio/grande porte, follow-ups críticos, requer seriedade.
Samara: Médio porte, análises equilibradas, está em desenvolvimento.
Francisco: Tarefas relacionais, follow-ups diversos, suporte geral.
David: Questões jurídicas, contratos, assinaturas, interlocução jurídico.
Cazé/Ana Julia: Requisições administrativas, tarefas supervisionadas.

NÃO DELEGAR:
Stakeholders críticos exigindo minha presença.
Decisões estratégicas exigindo minha autoridade.
Tarefas marcadas como "não delegável" na descrição.

**PERSONA DO MENTOR**
Sua comunicação é clara, objetiva, e focada na ação.
Positivo e Encorajador: Apesar da firmeza, sua linguagem é positiva e construtiva, para construir disciplina sem gerar sobrecarga emocional. Você reconhece o esforço e celebra as vitórias.
Anti-Procrastinação: Você é especialista em quebrar a inércia, transformando tarefas vagas em ações concretas e imediatas.`;

const AIAgent = () => {
  const { fetchTasks, updateTask, closeTask, isLoading: isLoadingTodoist } = useTodoist();
  const [aiPrompt, setAiPrompt] = useState<string>(defaultAiPrompt);
  const [allTasks, setAllTasks] = useState<TodoistTask[]>([]);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem(AI_AGENT_SELECTED_TASK_STORAGE_KEY);
    }
    return null;
  });
  const [currentTask, setCurrentTask] = useState<TodoistTask | null>(null);
  const [isLoadingTasks, setIsLoadingTasks] = useState(false);

  // Load AI Prompt from localStorage
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const savedPrompt = localStorage.getItem(AI_AGENT_PROMPT_STORAGE_KEY);
      if (savedPrompt) {
        setAiPrompt(savedPrompt);
      }
    }
  }, []);

  // Save AI Prompt to localStorage
  const handleSaveAiPrompt = useCallback((newPrompt: string) => {
    setAiPrompt(newPrompt);
    if (typeof window !== 'undefined') {
      localStorage.setItem(AI_AGENT_PROMPT_STORAGE_KEY, newPrompt);
    }
  }, []);

  // Fetch all tasks for selection and AI radar
  const loadAllTasks = useCallback(async () => {
    setIsLoadingTasks(true);
    try {
      const tasks = await fetchTasks(undefined, { includeSubtasks: false, includeRecurring: false });
      setAllTasks(tasks);
      if (selectedTaskId) {
        const foundTask = tasks.find(t => t.id === selectedTaskId);
        setCurrentTask(foundTask || null);
        if (!foundTask) {
          setSelectedTaskId(null);
          if (typeof window !== 'undefined') {
            localStorage.removeItem(AI_AGENT_SELECTED_TASK_STORAGE_KEY);
          }
          toast.info("A tarefa selecionada não foi encontrada ou está concluída.");
        }
      }
    } catch (error) {
      console.error("Failed to load all tasks:", error);
      toast.error("Falha ao carregar todas as tarefas.");
    } finally {
      setIsLoadingTasks(false);
    }
  }, [fetchTasks, selectedTaskId]);

  useEffect(() => {
    loadAllTasks();
  }, [loadAllTasks]);

  // Update currentTask when selectedTaskId changes
  useEffect(() => {
    if (selectedTaskId) {
      const foundTask = allTasks.find(task => task.id === selectedTaskId);
      setCurrentTask(foundTask || null);
      if (typeof window !== 'undefined') {
        localStorage.setItem(AI_AGENT_SELECTED_TASK_STORAGE_KEY, selectedTaskId);
      }
    } else {
      setCurrentTask(null);
      if (typeof window !== 'undefined') {
        localStorage.removeItem(AI_AGENT_SELECTED_TASK_STORAGE_KEY);
      }
    }
  }, [selectedTaskId, allTasks]);

  const handleTaskSelect = useCallback((taskId: string) => {
    setSelectedTaskId(taskId);
    toast.info("Tarefa selecionada para o Tutor IA.");
  }, []);

  const isLoading = isLoadingTodoist || isLoadingTasks;

  return (
    <div className="p-4 grid grid-cols-1 lg:grid-cols-3 gap-6">
      <div className="lg:col-span-2">
        <h2 className="text-3xl font-bold mb-2 text-gray-800">
          <Bot className="inline-block h-8 w-8 mr-2 text-indigo-600" /> Tutor IA SEISO
        </h2>
        <p className="text-lg text-gray-600 mb-6">
          Seu assistente pessoal de produtividade, especializado em TDAH.
        </p>

        <div className="flex flex-col md:flex-row justify-between items-center gap-4 mb-6">
          <div className="flex-grow w-full md:w-auto">
            <Label htmlFor="task-selector" className="sr-only">Selecionar Tarefa</Label>
            <Select
              value={selectedTaskId || ""}
              onValueChange={handleTaskSelect}
              disabled={isLoading}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Selecione uma tarefa para focar..." />
              </SelectTrigger>
              <SelectContent>
                {isLoading ? (
                  <SelectItem value="loading" disabled>Carregando tarefas...</SelectItem>
                ) : allTasks.length === 0 ? (
                  <SelectItem value="no-tasks" disabled>Nenhuma tarefa encontrada.</SelectItem>
                ) : (
                  allTasks.map(task => (
                    <SelectItem key={task.id} value={task.id}>
                      {task.content} (P{task.priority})
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
          </div>
          <AIAgentPromptEditor
            initialPrompt={aiPrompt}
            onSave={handleSaveAiPrompt}
            storageKey={AI_AGENT_PROMPT_STORAGE_KEY}
          />
        </div>

        {isLoading && (
          <div className="flex justify-center items-center h-48">
            <LoadingSpinner size={40} />
          </div>
        )}

        {!isLoading && (
          <AIAgentAssistant
            aiPrompt={aiPrompt}
            currentTask={currentTask}
            allTasks={allTasks}
            updateTask={updateTask}
            closeTask={closeTask}
          />
        )}
      </div>

      <div className="lg:col-span-1">
        <div className="p-4 bg-gray-50 rounded-xl shadow-lg">
          <h3 className="text-xl font-bold text-gray-800 mb-4">
            Como usar o Tutor IA SEISO:
          </h3>
          <ul className="list-disc list-inside space-y-2 text-gray-700 text-sm">
            <li>**Selecione uma Tarefa:** Escolha uma tarefa da sua lista do Todoist no seletor acima para que o Tutor IA possa focar nela.</li>
            <li>**Peça o Próximo Passo:** Digite "próximo passo" ou "o que fazer" para quebrar a tarefa em micro-ações.</li>
            <li>**Delegue:** Pergunte "delegar" para obter sugestões de quem pode assumir a tarefa, com base na sua equipe definida.</li>
            <li>**Verifique o Status:** Digite "status" para um resumo rápido da tarefa.</li>
            <li>**Gere Relatórios:** Use os botões "Gerar Status" ou "Gerar Próximo Passo" para criar templates de atualização para o Todoist.</li>
            <li>**Radar de Produtividade:** Pergunte "radar" ou "sugerir próxima tarefa" para que o IA escaneie seus deadlines e prioridades.</li>
            <li>**Edite o Prompt:** Clique em "Editar Prompt do Tutor IA" para ajustar as regras e a persona do seu assistente.</li>
            <li>**Lembre-se:** A IA é uma simulação. Para interações mais avançadas, você precisaria de uma integração com um LLM externo.</li>
          </ul>
        </div>
      </div>
    </div>
  );
};

export default AIAgent;