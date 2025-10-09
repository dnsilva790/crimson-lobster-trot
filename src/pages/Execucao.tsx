"use client";

import React, { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useTodoist } from "@/context/TodoistContext";
import { TodoistTask, SeitonStateSnapshot } from "@/lib/types";
import LoadingSpinner from "@/components/ui/loading-spinner";
import { toast } from "sonner";
import FocusTaskCard from "@/components/FocusTaskCard";
import { CalendarIcon, Clock, Star, Zap, Check, ArrowRight, CalendarDays, Settings } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { format, setHours, setMinutes, parseISO, addDays } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Progress } from "@/components/ui/progress";
import AIAssistant from "@/components/AIAssistant";
import PromptEditor from "@/components/PromptEditor";
import TaskOwnerSelector from "@/components/TaskOwnerSelector"; // Novo import

type ExecucaoState = "initial" | "focusing" | "finished";

const AI_PROMPT_STORAGE_KEY = "ai_tutor_seiso_prompt";
const SEITON_RANKING_STORAGE_KEY = "seitonTournamentState"; // Key used by Seiton.tsx

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

const Execucao = () => {
  const { fetchTasks, closeTask, updateTask, isLoading } = useTodoist();
  const [focusTasks, setFocusTasks] = useState<TodoistTask[]>([]);
  const [originalTasksCount, setOriginalTasksCount] = useState<number>(0);
  const [currentTaskIndex, setCurrentTaskIndex] = useState<number>(0);
  const [execucaoState, setExecucaoState] = useState<ExecucaoState>("initial");
  const [filterInput, setFilterInput] = useState<string>("");
  const [aiPrompt, setAiPrompt] = useState<string>(defaultAiPrompt);

  // State for rescheduling/setting deadline popover
  const [isReschedulePopoverOpen, setIsReschedulePopoverOpen] = useState(false);
  const [isDeadlinePopoverOpen, setIsDeadlinePopoverOpen] = useState(false);
  const [selectedDueDate, setSelectedDueDate] = useState<Date | undefined>(undefined);
  const [selectedDueTime, setSelectedDueTime] = useState<string>("");
  const [selectedPriority, setSelectedPriority] = useState<1 | 2 | 3 | 4>(1); // Default to P4

  const currentTask = focusTasks[currentTaskIndex];

  useEffect(() => {
    // Load AI prompt from localStorage on mount
    const savedPrompt = localStorage.getItem(AI_PROMPT_STORAGE_KEY);
    if (savedPrompt) {
      setAiPrompt(savedPrompt);
    }
  }, []);

  const handleSaveAiPrompt = useCallback((newPrompt: string) => {
    setAiPrompt(newPrompt);
    localStorage.setItem(AI_PROMPT_STORAGE_KEY, newPrompt);
  }, []);

  const sortTasksForFocus = useCallback((tasks: TodoistTask[]): TodoistTask[] => {
    return [...tasks].sort((a, b) => {
      // Priority: P1 (4) > P2 (3) > P3 (2) > P4 (1)
      if (b.priority !== a.priority) {
        return b.priority - a.priority;
      }

      // Due date: earliest first
      const getDateValue = (task: TodoistTask) => {
        if (task.due?.datetime) return new Date(task.due.datetime).getTime();
        if (task.due?.date) return new Date(task.due.date).getTime();
        return Infinity; // Tasks without a due date go last
      };

      const dateA = getDateValue(a);
      const dateB = getDateValue(b);

      return dateA - dateB;
    });
  }, []);

  const loadTasksForFocus = useCallback(async (useFilter: boolean = false) => {
    setExecucaoState("initial");
    setCurrentTaskIndex(0);
    let fetchedTasks: TodoistTask[] = [];

    if (useFilter && filterInput.trim()) {
      fetchedTasks = await fetchTasks(filterInput.trim());
      if (fetchedTasks.length === 0) {
        toast.info("Nenhuma tarefa encontrada com o filtro. Tentando carregar do ranking do Seiton...");
        // Fallback to Seiton ranking
        const savedSeitonState = localStorage.getItem(SEITON_RANKING_STORAGE_KEY);
        if (savedSeitonState) {
          try {
            const parsedState: SeitonStateSnapshot = JSON.parse(savedState);
            if (parsedState.rankedTasks && parsedState.rankedTasks.length > 0) {
              fetchedTasks = parsedState.rankedTasks;
              toast.info(`Carregadas ${fetchedTasks.length} tarefas do ranking do Seiton.`);
            }
          } catch (e) {
            console.error("Failed to parse Seiton state from localStorage", e);
            toast.error("Erro ao carregar ranking do Seiton.");
          }
        }
      }
    }

    if (fetchedTasks.length === 0) {
      // If no filter, or filter/seiton ranking yielded no results, load all tasks
      fetchedTasks = await fetchTasks();
    }

    if (fetchedTasks && fetchedTasks.length > 0) {
      const sortedTasks = sortTasksForFocus(fetchedTasks);
      setFocusTasks(sortedTasks);
      setOriginalTasksCount(sortedTasks.length);
      setExecucaoState("focusing");
      toast.info(`Encontradas ${sortedTasks.length} tarefas para focar.`);
    } else {
      setFocusTasks([]);
      setOriginalTasksCount(0);
      setExecucaoState("finished");
      toast.info("Nenhuma tarefa encontrada para focar. Bom trabalho!");
    }
  }, [fetchTasks, filterInput, sortTasksForFocus]);

  useEffect(() => {
    // No initial load, wait for user to click "Iniciar Modo Foco"
  }, []);

  const handleNextTask = useCallback(async () => {
    // Re-fetch tasks to ensure real-time update after an action
    const latestTasks = await fetchTasks(filterInput.trim() || undefined); // Use filter if present, else no filter
    if (latestTasks && latestTasks.length > 0) {
      const sortedTasks = sortTasksForFocus(latestTasks);
      setFocusTasks(sortedTasks);
      setOriginalTasksCount(sortedTasks.length); // Update original count based on latest fetch
      if (currentTaskIndex < sortedTasks.length) {
        // If current index is still valid for the new list, stay
        // Otherwise, reset to 0 or move to the next valid index
        setCurrentTaskIndex(currentTaskIndex);
      } else {
        setCurrentTaskIndex(0); // Reset to first task if current one is no longer valid
      }
      setExecucaoState("focusing");
    } else {
      setFocusTasks([]);
      setOriginalTasksCount(0);
      setExecucaoState("finished");
      toast.success("Modo Foco Total concluído!");
    }
  }, [fetchTasks, filterInput, sortTasksForFocus, currentTaskIndex]);


  const handleComplete = useCallback(async (taskId: string) => {
    const success = await closeTask(taskId);
    if (success !== undefined) {
      toast.success("Tarefa concluída com sucesso!");
      await handleNextTask(); // Re-fetch and update state
    }
  }, [closeTask, handleNextTask]);

  const handleSkip = useCallback(async () => {
    toast.info("Tarefa pulada. Passando para a próxima.");
    await handleNextTask(); // Re-fetch and update state
  }, [handleNextTask]);

  const handleReschedule = useCallback(async (taskId: string, daysToAdd: number) => {
    if (!currentTask) return;
    const newDueDate = addDays(new Date(), daysToAdd);
    const updateData = {
      due_date: format(newDueDate, "yyyy-MM-dd"),
      due_datetime: null,
    };
    const updated = await updateTask(taskId, updateData);
    if (updated) {
      toast.success(`Tarefa reagendada para ${format(newDueDate, "dd/MM/yyyy", { locale: ptBR })}!`);
      await handleNextTask(); // Re-fetch and update state
    }
  }, [currentTask, updateTask, handleNextTask]);

  const handleSetDueDateAndTime = useCallback(async () => {
    if (!currentTask || !selectedDueDate) {
      toast.error("Por favor, selecione uma data.");
      return;
    }

    const updateData: {
      priority?: 1 | 2 | 3 | 4;
      due_date?: string | null;
      due_datetime?: string | null;
    } = {};
    let finalDate = selectedDueDate;

    if (selectedDueTime) {
      const [hours, minutes] = selectedDueTime.split(":").map(Number);
      finalDate = setMinutes(setHours(selectedDueDate, hours), minutes);
      updateData.due_datetime = format(finalDate, "yyyy-MM-dd'T'HH:mm:ss");
      updateData.due_date = null;
    } else {
      updateData.due_date = format(finalDate, "yyyy-MM-dd");
      updateData.due_datetime = null;
    }

    if (selectedPriority !== currentTask.priority) {
      updateData.priority = selectedPriority;
    }

    const updated = await updateTask(currentTask.id, updateData);
    if (updated) {
      toast.success("Tarefa atualizada com sucesso!");
      setIsReschedulePopoverOpen(false);
      setIsDeadlinePopoverOpen(false);
      await handleNextTask(); // Re-fetch and update state
    }
  }, [currentTask, selectedDueDate, selectedDueTime, selectedPriority, updateTask, handleNextTask]);

  const handleUpdateTaskContent = useCallback(async (taskId: string, newContent: string) => {
    const updated = await updateTask(taskId, { content: newContent });
    if (updated) {
      // Atualiza o estado local de focusTasks para refletir a mudança imediatamente
      setFocusTasks(prevTasks =>
        prevTasks.map(task =>
          task.id === taskId ? { ...task, content: newContent } : task
        )
      );
      toast.success("Nome da tarefa atualizado com sucesso!");
    } else {
      toast.error("Falha ao atualizar o nome da tarefa.");
    }
  }, [updateTask]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (execucaoState !== "focusing" || isLoading) return;

      switch (event.key.toLowerCase()) {
        case "f":
          if (currentTask) handleComplete(currentTask.id);
          break;
        case "p":
          handleSkip();
          break;
        case "r":
          // Open reschedule popover or trigger a default reschedule (e.g., +1 day)
          // For now, let's just open the popover
          setIsReschedulePopoverOpen(true);
          break;
        case "d":
          // Open deadline popover
          setIsDeadlinePopoverOpen(true);
          break;
        default:
          break;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [execucaoState, isLoading, currentTask, handleComplete, handleSkip]);

  // Initialize popover states when a new task is loaded
  useEffect(() => {
    if (currentTask) {
      const initialDueDate = currentTask.due?.date ? parseISO(currentTask.due.date) : undefined;
      const initialDueTime = currentTask.due?.datetime ? format(parseISO(currentTask.due.datetime), "HH:mm") : "";
      setSelectedDueDate(initialDueDate);
      setSelectedDueTime(initialDueTime);
      setSelectedPriority(currentTask.priority);
    }
  }, [currentTask]);

  const progressValue = originalTasksCount > 0 ? ((originalTasksCount - focusTasks.length) / originalTasksCount) * 100 : 0;

  return (
    <div className="p-4 grid grid-cols-1 lg:grid-cols-3 gap-6">
      <div className="lg:col-span-2">
        <h2 className="text-3xl font-bold mb-2 text-gray-800">⚡ EXECUÇÃO - Modo Foco Total</h2>
        <p className="text-lg text-gray-600 mb-6">Concentre-se em uma tarefa por vez.</p>

        {isLoading && (
          <div className="flex justify-center items-center h-48">
            <LoadingSpinner size={40} />
          </div>
        )}

        {!isLoading && execucaoState === "initial" && (
          <div className="text-center mt-10">
            <div className="grid w-full items-center gap-1.5 mb-6 max-w-md mx-auto">
              <Label htmlFor="task-filter" className="text-left text-gray-600 font-medium">
                Filtro de Tarefas (ex: "hoje", "p1", "#trabalho")
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
            <Button
              onClick={() => loadTasksForFocus(true)}
              className="px-8 py-4 text-xl bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors duration-200"
            >
              Iniciar Modo Foco
            </Button>
          </div>
        )}

        {!isLoading && execucaoState === "focusing" && currentTask && (
          <div className="mt-8">
            <FocusTaskCard task={currentTask} />

            <div className="mt-6 p-4 border rounded-lg bg-gray-50"> {/* Novo container para o seletor de responsável */}
              <TaskOwnerSelector
                taskId={currentTask.id}
                currentContent={currentTask.content}
                onUpdateTaskContent={handleUpdateTaskContent}
                isLoading={isLoading}
              />
            </div>

            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 mt-8">
              <Button
                onClick={() => handleComplete(currentTask.id)}
                disabled={isLoading}
                className="bg-green-500 hover:bg-green-600 text-white py-3 text-md flex items-center justify-center"
              >
                <Check className="mr-2 h-5 w-5" /> Concluída (F)
              </Button>
              <Button
                onClick={handleSkip}
                disabled={isLoading}
                className="bg-blue-500 hover:bg-blue-600 text-white py-3 text-md flex items-center justify-center"
              >
                <ArrowRight className="mr-2 h-5 w-5" /> Próxima (P)
              </Button>

              <Popover open={isReschedulePopoverOpen} onOpenChange={setIsReschedulePopoverOpen}>
                <PopoverTrigger asChild>
                  <Button
                    disabled={isLoading}
                    className="bg-purple-500 hover:bg-purple-600 text-white py-3 text-md flex items-center justify-center"
                  >
                    <CalendarDays className="mr-2 h-5 w-5" /> Reagendar (R)
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-4">
                  <h4 className="font-semibold mb-2">Reagendar Tarefa</h4>
                  <div className="grid gap-4">
                    <div>
                      <Label htmlFor="reschedule-date">Data de Vencimento</Label>
                      <Calendar
                        mode="single"
                        selected={selectedDueDate}
                        onSelect={setSelectedDueDate}
                        initialFocus
                        locale={ptBR}
                      />
                    </div>
                    <div>
                      <Label htmlFor="reschedule-time">Hora (Opcional)</Label>
                      <Input
                        id="reschedule-time"
                        type="time"
                        value={selectedDueTime}
                        onChange={(e) => setSelectedDueTime(e.target.value)}
                      />
                    </div>
                    <div>
                      <Label htmlFor="reschedule-priority">Prioridade</Label>
                      <Select
                        value={String(selectedPriority)}
                        onValueChange={(value) => setSelectedPriority(Number(value) as 1 | 2 | 3 | 4)}
                      >
                        <SelectTrigger>
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
                    <Button onClick={handleSetDueDateAndTime}>Salvar Reagendamento</Button>
                  </div>
                </PopoverContent>
              </Popover>

              <Popover open={isDeadlinePopoverOpen} onOpenChange={setIsDeadlinePopoverOpen}>
                <PopoverTrigger asChild>
                  <Button
                    disabled={isLoading}
                    className="bg-orange-500 hover:bg-orange-600 text-white py-3 text-md flex items-center justify-center"
                  >
                    <Clock className="mr-2 h-5 w-5" /> Data Limite (D)
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-4">
                  <h4 className="font-semibold mb-2">Definir Data Limite (Vencimento)</h4>
                  <p className="text-sm text-gray-600 mb-2">
                    *Atenção: A API do Todoist não permite definir 'deadline' diretamente. Esta ação irá atualizar a 'data de vencimento' da tarefa.
                  </p>
                  <div className="grid gap-4">
                    <div>
                      <Label htmlFor="deadline-date">Data de Vencimento</Label>
                      <Calendar
                        mode="single"
                        selected={selectedDueDate}
                        onSelect={setSelectedDueDate}
                        initialFocus
                        locale={ptBR}
                      />
                    </div>
                    <div>
                      <Label htmlFor="deadline-time">Hora (Opcional)</Label>
                      <Input
                        id="deadline-time"
                        type="time"
                        value={selectedDueTime}
                        onChange={(e) => setSelectedDueTime(e.target.value)}
                      />
                    </div>
                    <Button onClick={handleSetDueDateAndTime}>Salvar Data Limite</Button>
                  </div>
                </PopoverContent>
              </Popover>
            </div>

            <div className="mt-8 text-center">
              <p className="text-lg font-medium text-gray-700 mb-2">
                Tarefa {originalTasksCount - focusTasks.length + 1} de {originalTasksCount}
              </p>
              <Progress value={progressValue} className="w-full max-w-md mx-auto h-3" />
            </div>
          </div>
        )}

        {!isLoading && execucaoState === "finished" && originalTasksCount === 0 && (
          <div className="text-center mt-10">
            <p className="text-2xl font-semibold text-gray-700 mb-4">
              🎉 Todas as tarefas foram focadas e/ou concluídas!
            </p>
            <p className="text-lg text-gray-600 mb-6">
              Nenhuma tarefa restante para focar.
            </p>
            <Button
              onClick={() => loadTasksForFocus(true)}
              className="px-8 py-4 text-xl bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-colors duration-200"
            >
              Iniciar Novo Foco
            </Button>
          </div>
        )}

        {!isLoading && execucaoState === "finished" && originalTasksCount > 0 && (
          <div className="text-center mt-10">
            <p className="text-2xl font-semibold text-gray-700 mb-4">
              ✅ Modo Foco Total concluído!
            </p>
            <p className="text-lg text-gray-600 mb-6">
              Você revisou todas as {originalTasksCount} tarefas.
            </p>
            <Button
              onClick={() => loadTasksForFocus(true)}
              className="px-8 py-4 text-xl bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-colors duration-200"
            >
              Iniciar Novo Foco
            </Button>
          </div>
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

export default Execucao;