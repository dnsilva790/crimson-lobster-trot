"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Send, Bot, User, Lightbulb, CalendarCheck } from "lucide-react";
import { TodoistTask, InternalTask, DaySchedule, RecurringTimeBlock, TimeBlockType, ScheduledTask } from "@/lib/types";
import { toast } from "sonner";
import { cn, getTaskCategory } from "@/lib/utils";
import { format, parseISO, startOfDay, addMinutes, isWithinInterval, parse, setHours, setMinutes, addDays, isEqual, isBefore, startOfMinute, isValid } from "date-fns";
import { ptBR } from "date-fns/locale";

interface PlannerAIAssistantProps {
  plannerAiPrompt: string;
  selectedTaskToSchedule: (TodoistTask | InternalTask) | null;
  selectedDate: Date;
  schedules: Record<string, DaySchedule>;
  recurringBlocks: RecurringTimeBlock[];
  tempEstimatedDuration: string;
  tempSelectedCategory: "pessoal" | "profissional" | "none";
  tempSelectedPriority: 1 | 2 | 3 | 4;
  onSuggestSlot: (slot: { start: string; end: string; date: string } | null) => void;
  onScheduleSuggestedTask: (task: TodoistTask | InternalTask, start: string, end: string, targetDate: Date) => Promise<void>;
}

interface Message {
  id: string;
  sender: "user" | "ai";
  text: string;
}

const PLANNER_AI_CHAT_HISTORY_KEY = "planner_ai_chat_history";

const PlannerAIAssistant: React.FC<PlannerAIAssistantProps> = ({
  plannerAiPrompt,
  selectedTaskToSchedule,
  selectedDate,
  schedules,
  recurringBlocks,
  tempEstimatedDuration,
  tempSelectedCategory,
  tempSelectedPriority,
  onSuggestSlot,
  onScheduleSuggestedTask,
}) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputMessage, setInputMessage] = useState("");
  const [isLoadingAI, setIsLoadingAI] = useState(false);
  const scrollAreaRef = useRef<HTMLDivElement>(null); // Corrigido: useRef importado e tipo correto

  // Load/Save chat history
  useEffect(() => {
    const savedHistory = localStorage.getItem(PLANNER_AI_CHAT_HISTORY_KEY);
    if (savedHistory) {
      setMessages(JSON.parse(savedHistory));
    } else {
      addMessage("ai", "Olá! Sou o Agente de Sugestão de Slots. Selecione uma tarefa e clique em 'Sugerir Slot' para eu te ajudar a planejar, ou me faça uma pergunta!");
    }
  }, []);

  useEffect(() => {
    localStorage.setItem(PLANNER_AI_CHAT_HISTORY_KEY, JSON.stringify(messages));
  }, [messages]);

  useEffect(() => {
    if (scrollAreaRef.current) {
      scrollAreaRef.current.scrollTop = scrollAreaRef.current.scrollHeight;
    }
  }, [messages]);

  const addMessage = useCallback((sender: "user" | "ai", text: string) => {
    setMessages((prev) => [...prev, { id: Date.now().toString(), sender, text }]);
  }, []);

  const getCombinedTimeBlocksForDate = useCallback((date: Date): TimeBlockType[] => {
    const dateKey = format(date, "yyyy-MM-dd");
    const dayOfWeek = getDay(date).toString() as DayOfWeek;

    const dateSpecificBlocks = schedules[dateKey]?.timeBlocks || [];
    const recurringBlocksForDay = recurringBlocks.filter(block => block.dayOfWeek === dayOfWeek);

    const combined = [...dateSpecificBlocks, ...recurringBlocksForDay];
    return combined.sort((a, b) => a.start.localeCompare(b.start));
  }, [schedules, recurringBlocks]);

  const scoreSlot = useCallback((
    slotStart: Date,
    slotEnd: Date,
    currentDayDate: Date,
    durationMinutes: number,
    taskCategory: "pessoal" | "profissional" | undefined,
    taskPriority: 1 | 2 | 3 | 4,
    combinedBlocksForSuggestion: TimeBlockType[],
    scheduledTasksForSuggestion: ScheduledTask[],
    now: Date,
    startOfToday: Date,
    dayOffset: number
  ): number => {
    let currentSlotScore = 0;

    // Penalidade: Slots no passado (já filtrado antes, mas reforça)
    if (isBefore(slotStart, now)) {
      return -Infinity;
    }

    // Penalidade: Conflito com tarefas agendadas
    const hasConflict = scheduledTasksForSuggestion.some(st => {
      const stStart = (typeof st.start === 'string' && st.start) ? parse(st.start, "HH:mm", currentDayDate) : null;
      const stEnd = (typeof st.end === 'string' && st.end) ? parse(st.end, "HH:mm", currentDayDate) : null;
      if (!stStart || !stEnd || !isValid(stStart) || !isValid(stEnd)) return false;

      return (isWithinInterval(slotStart, { start: stStart, end: stEnd }) ||
              isWithinInterval(slotEnd, { start: stStart, end: stEnd }) ||
              (slotStart <= stStart && slotEnd >= stEnd));
    });
    if (hasConflict) return -Infinity;

    let isOverlappingBreak = false;
    let fitsInAppropriateBlock = false;

    for (const block of combinedBlocksForSuggestion) {
      if (block.type === "break") {
        const blockStart = (typeof block.start === 'string' && block.start) ? parse(block.start, "HH:mm", currentDayDate) : null;
        let blockEnd = (typeof block.end === 'string' && block.end) ? parse(block.end, "HH:mm", currentDayDate) : null;
        if (!blockStart || !blockEnd || !isValid(blockStart) || !isValid(blockEnd)) continue;

        if (isBefore(blockEnd, blockStart)) {
          blockEnd = addDays(blockEnd, 1);
        }
        if (isWithinInterval(slotStart, { start: blockStart, end: blockEnd }) ||
            isWithinInterval(slotEnd, { start: blockStart, end: blockEnd }) ||
            (slotStart <= blockStart && slotEnd >= blockEnd)) {
          isOverlappingBreak = true;
          break;
        }
      }
    }
    // Penalidade: Sobreposição com blocos de pausa
    if (isOverlappingBreak) {
      return -Infinity;
    }

    // Pontuação: Correspondência de Categoria/Tipo de Bloco
    for (const block of combinedBlocksForSuggestion) {
      if (block.type === "break") continue;

      const blockStart = (typeof block.start === 'string' && block.start) ? parse(block.start, "HH:mm", currentDayDate) : null;
      let blockEnd = (typeof block.end === 'string' && block.end) ? parse(block.end, "HH:mm", currentDayDate) : null;
      if (!blockStart || !blockEnd || !isValid(blockStart) || !isValid(blockEnd)) continue;

      if (isBefore(blockEnd, blockStart)) {
        blockEnd = addDays(blockEnd, 1);
      }

      if (slotStart >= blockStart && slotEnd <= blockEnd) {
        let isCategoryMatch = false;
        if (taskCategory === "profissional" && block.type === "work") {
          isCategoryMatch = true;
          currentSlotScore += 10;
        } else if (taskCategory === "pessoal" && block.type === "personal") {
          isCategoryMatch = true;
          currentSlotScore += 10;
        } else if (taskCategory === undefined && (block.type === "work" || block.type === "personal")) {
          isCategoryMatch = true;
          currentSlotScore += 5;
        }

        if (isCategoryMatch) {
          fitsInAppropriateBlock = true;
          // Pontuação: Horário de Pico de Produtividade (06h-10h)
          if (block.type === "work" && taskCategory === "profissional" &&
              slotStart.getHours() >= 6 && slotStart.getHours() < 10) {
            currentSlotScore += 5;
          }
          break;
        }
      }
    }

    // Penalidade: Slot que não se encaixa em nenhum bloco de tempo adequado
    if (!fitsInAppropriateBlock && combinedBlocksForSuggestion.length > 0) {
      currentSlotScore -= 5;
    } else if (combinedBlocksForSuggestion.length === 0) {
      // Se não há blocos definidos, qualquer slot é "adequado" com uma pontuação base
      fitsInAppropriateBlock = true;
      currentSlotScore += 5;
    }

    // Pontuação: Prioridade da Tarefa
    switch (taskPriority) {
      case 4: currentSlotScore += 8; break; // P1
      case 3: currentSlotScore += 6; break; // P2
      case 2: currentSlotScore += 4; break; // P3
      case 1: currentSlotScore += 2; break; // P4
    }

    // Pontuação: Proximidade da Data
    if (isEqual(currentDayDate, startOfToday)) {
      currentSlotScore += 200;
    } else if (isEqual(currentDayDate, addDays(startOfToday, 1))) {
      currentSlotScore += 100;
    } else {
      currentSlotScore -= dayOffset * 10; // Cada dia adicional no futuro: -10 pontos
    }

    // Pontuação: Horário do Dia (slots mais cedo são ligeiramente preferidos)
    currentSlotScore -= (slotStart.getHours() * 60 + slotStart.getMinutes()) / 100;

    return currentSlotScore;
  }, [schedules, recurringBlocks]);


  const generateAISuggestion = useCallback(async (
    task: (TodoistTask | InternalTask),
    currentSelectedDate: Date,
    durationMinutes: number,
    taskCategory: "pessoal" | "profissional" | undefined,
    taskPriority: 1 | 2 | 3 | 4,
  ) => {
    setIsLoadingAI(true);
    let bestSlot: { start: string; end: string; date: string } | null = null;
    let bestScore = -Infinity;
    let explanation = "";

    const NUM_DAYS_TO_LOOK_AHEAD = 7;
    const now = new Date();
    const startOfToday = startOfDay(now);

    for (let dayOffset = 0; dayOffset < NUM_DAYS_TO_LOOK_AHEAD; dayOffset++) {
      const currentDayDate = addDays(currentSelectedDate, dayOffset);
      const startOfCurrentDay = startOfDay(currentDayDate);

      if (isBefore(startOfCurrentDay, startOfToday)) {
        continue;
      }

      const currentDayDateKey = format(currentDayDate, "yyyy-MM-dd");
      const combinedBlocksForSuggestion = getCombinedTimeBlocksForDate(currentDayDate);
      const scheduledTasksForSuggestion = schedules[currentDayDateKey]?.scheduledTasks || [];

      let startHour = 0;
      let startMinute = 0;

      if (isEqual(startOfCurrentDay, startOfToday)) {
        const currentTotalMinutes = now.getHours() * 60 + now.getMinutes();
        startHour = Math.floor(currentTotalMinutes / 60);
        startMinute = Math.ceil((currentTotalMinutes % 60) / 15) * 15;
        if (startMinute === 60) {
          startHour++;
          startMinute = 0;
        }
      }

      for (let hour = startHour; hour < 24; hour++) {
        for (let minute = (hour === startHour ? startMinute : 0); minute < 60; minute += 15) {
          const slotStart = setMinutes(setHours(currentDayDate, hour), minute);
          const slotEnd = addMinutes(slotStart, durationMinutes);
          const slotStartStr = format(slotStart, "HH:mm");
          const slotEndStr = format(slotEnd, "HH:mm");

          const currentScore = scoreSlot(
            slotStart, slotEnd, currentDayDate, durationMinutes,
            taskCategory, taskPriority, combinedBlocksForSuggestion,
            scheduledTasksForSuggestion, now, startOfToday, dayOffset
          );

          if (currentScore > bestScore) {
            bestScore = currentScore;
            bestSlot = { start: slotStartStr, end: slotEndStr, date: currentDayDateKey };
            // Generate a detailed explanation for the best slot
            explanation = `Eu sugeri o slot de **${slotStartStr} - ${slotEndStr} em ${format(currentDayDate, "dd/MM/yyyy", { locale: ptBR })}** para a tarefa "${task.content}" (Prioridade P${taskPriority}, Categoria: ${taskCategory}).\n\n`;
            explanation += `Minha decisão foi baseada nos seguintes pontos:\n`;

            // 1. Proximidade da Data
            if (isEqual(currentDayDate, startOfToday)) {
              explanation += `- **Proximidade:** Este slot é para **hoje**, o que lhe confere uma alta pontuação.\n`;
            } else if (isEqual(currentDayDate, addDays(startOfToday, 1))) {
              explanation += `- **Proximidade:** Este slot é para **amanhã**, o que lhe confere uma boa pontuação.\n`;
            } else {
              explanation += `- **Proximidade:** Este slot está a ${dayOffset} dias no futuro.\n`;
            }

            // 2. Correspondência de Categoria/Tipo de Bloco
            let blockMatchFound = false;
            for (const block of combinedBlocksForSuggestion) {
              const blockStart = (typeof block.start === 'string' && block.start) ? parse(block.start, "HH:mm", currentDayDate) : null;
              let blockEnd = (typeof block.end === 'string' && block.end) ? parse(block.end, "HH:mm", currentDayDate) : null;
              if (!blockStart || !blockEnd || !isValid(blockStart) || !isValid(blockEnd)) continue;
              if (isBefore(blockEnd, blockStart)) blockEnd = addDays(blockEnd, 1);

              if (slotStart >= blockStart && slotEnd <= blockEnd) {
                if (taskCategory === "profissional" && block.type === "work") {
                  explanation += `- **Correspondência de Categoria:** O slot está dentro de um **bloco de trabalho**, ideal para sua tarefa **profissional**.\n`;
                  blockMatchFound = true;
                  // Horário de Pico de Produtividade
                  if (slotStart.getHours() >= 6 && slotStart.getHours() < 10) {
                    explanation += `  - **Pico de Produtividade:** O slot cai no seu horário de pico (06h-10h), otimizando a execução.\n`;
                  }
                  break;
                } else if (taskCategory === "pessoal" && block.type === "personal") {
                  explanation += `- **Correspondência de Categoria:** O slot está dentro de um **bloco pessoal**, ideal para sua tarefa **pessoal**.\n`;
                  blockMatchFound = true;
                  break;
                } else if (taskCategory === undefined && (block.type === "work" || block.type === "personal")) {
                  explanation += `- **Correspondência de Categoria:** O slot está dentro de um **bloco de ${block.type === "work" ? "trabalho" : "pessoal"}**, adequado para sua tarefa sem categoria definida.\n`;
                  blockMatchFound = true;
                  break;
                }
              }
            }
            if (!blockMatchFound && combinedBlocksForSuggestion.length > 0) {
              explanation += `- **Atenção:** O slot não se encaixa perfeitamente em um bloco de tempo adequado para a categoria da tarefa, mas foi a melhor opção disponível considerando outros fatores.\n`;
            } else if (combinedBlocksForSuggestion.length === 0) {
              explanation += `- **Disponibilidade:** Não há blocos de tempo definidos para este dia, então qualquer slot disponível é considerado.\n`;
            }

            // 3. Prioridade da Tarefa
            explanation += `- **Prioridade:** A tarefa tem **prioridade P${taskPriority}**, o que a torna mais relevante para agendamento.\n`;

            // 4. Horário do Dia
            explanation += `- **Horário:** Este slot é um de um dos mais cedo disponíveis que atende aos critérios, o que é geralmente preferível.\n`;
          }
        }
      }
    }

    if (bestSlot) {
      addMessage("ai", explanation);
      onSuggestSlot(bestSlot);
    } else {
      addMessage("ai", "Não foi possível encontrar um slot adequado para esta tarefa nos próximos 7 dias, considerando suas regras e agendamentos existentes. Tente ajustar a duração, a categoria ou os blocos de tempo.");
      onSuggestSlot(null);
    }
    setIsLoadingAI(false);
  }, [selectedTaskToSchedule, selectedDate, schedules, recurringBlocks, tempEstimatedDuration, tempSelectedCategory, tempSelectedPriority, getCombinedTimeBlocksForDate, scoreSlot, onSuggestSlot]);


  const handleSendMessage = async (initialSuggestion: boolean = false) => {
    if (!initialSuggestion && inputMessage.trim() === "") return;

    const userMsg = initialSuggestion ? "Sugerir Slot" : inputMessage;
    addMessage("user", userMsg);
    setInputMessage("");
    setIsLoadingAI(true);

    // Simulate AI thinking time
    await new Promise(resolve => setTimeout(resolve, 1000));

    if (initialSuggestion) {
      if (!selectedTaskToSchedule) {
        addMessage("ai", "Por favor, selecione uma tarefa do backlog para eu poder sugerir um slot.");
        setIsLoadingAI(false);
        return;
      }
      if (tempSelectedCategory === "none") {
        addMessage("ai", "Por favor, classifique a tarefa como 'Pessoal' ou 'Profissional' antes de sugerir um slot.");
        setIsLoadingAI(false);
        return;
      }
      const durationMinutes = parseInt(tempEstimatedDuration, 10) || 15;
      const taskCategory = tempSelectedCategory === "none" ? (selectedTaskToSchedule ? getTaskCategory(selectedTaskToSchedule) : undefined) : tempSelectedCategory;
      const taskPriority = tempSelectedPriority;
      await generateAISuggestion(selectedTaskToSchedule, selectedDate, durationMinutes, taskCategory, taskPriority);
    } else {
      // Handle follow-up questions
      let aiResponse = "Entendido. Como posso te ajudar a entender melhor a sugestão ou o planejamento?";
      if (userMsg.toLowerCase().includes("por que")) {
        aiResponse = "Minha lógica de sugestão é baseada nas regras definidas no prompt do planejador. Posso revisar os critérios de pontuação para você, ou você tem uma pergunta específica sobre um slot?";
      } else if (userMsg.toLowerCase().includes("regras")) {
        aiResponse = `As regras principais que sigo são:\n\n${plannerAiPrompt}\n\nQual parte você gostaria de explorar?`;
      } else if (userMsg.toLowerCase().includes("slot pessoal") && tempSelectedCategory === "profissional") {
        aiResponse = "Se uma tarefa profissional foi sugerida para um slot pessoal, isso geralmente acontece porque não havia slots de trabalho disponíveis que atendessem aos critérios de prioridade e proximidade. A penalidade por não corresponder à categoria pode ter sido compensada pela alta prioridade da tarefa e pela urgência da data.";
      }
      addMessage("ai", aiResponse);
      setIsLoadingAI(false);
    }
  }, [inputMessage, selectedTaskToSchedule, selectedDate, tempEstimatedDuration, tempSelectedCategory, tempSelectedPriority, generateAISuggestion, plannerAiPrompt]);

  // Expose a method to trigger suggestion from parent
  React.useImperativeHandle(plannerAIAssistantRef, () => ({ // Corrigido: Usando plannerAIAssistantRef
    triggerSuggestion: () => handleSendMessage(true),
  }));

  const preallocateMeetingTasks = useCallback(async () => {
    if (!meetingProjectId) {
      toast.error("Projeto de reuniões não configurado. Verifique as configurações do Todoist.");
      return;
    }

    setIsPreallocatingMeetings(true);
    try {
      const meetingTasks = await fetchTasks(`##${MEETING_PROJECT_NAME} & no date`, { includeSubtasks: false, includeRecurring: false });
      let preallocatedCount = 0;

      for (const task of meetingTasks) {
        if (ignoredMeetingTaskIds.includes(task.id)) {
          continue;
        }

        if (task.content.toLowerCase().includes("reunião") && task.estimatedDurationMinutes) {
          const durationMinutes = task.estimatedDurationMinutes;
          const taskCategory = getTaskCategory(task) || "profissional"; // Reuniões geralmente são profissionais
          const taskPriority = task.priority;

          let bestSlot: { start: string; end: string; date: string } | null = null;
          let bestScore = -Infinity;

          const NUM_DAYS_TO_LOOK_AHEAD = 7;
          const now = new Date();
          const startOfToday = startOfDay(now);

          for (let dayOffset = 0; dayOffset < NUM_DAYS_TO_LOOK_AHEAD; dayOffset++) {
            const currentDayDate = addDays(startOfToday, dayOffset);
            const currentDayDateKey = format(currentDayDate, "yyyy-MM-dd");
            const combinedBlocksForSuggestion = getCombinedTimeBlocksForDate(currentDayDate);
            const scheduledTasksForSuggestion = schedules[currentDayDateKey]?.scheduledTasks || [];

            let startHour = 0;
            let startMinute = 0;

            if (isEqual(currentDayDate, startOfToday)) {
              const currentTotalMinutes = now.getHours() * 60 + now.getMinutes();
              startHour = Math.floor(currentTotalMinutes / 60);
              startMinute = Math.ceil((currentTotalMinutes % 60) / 15) * 15;
              if (startMinute === 60) {
                startHour++;
                startMinute = 0;
              }
            }

            for (let hour = startHour; hour < 24; hour++) {
              for (let minute = (hour === startHour ? startMinute : 0); minute < 60; minute += 15) {
                const slotStart = setMinutes(setHours(currentDayDate, hour), minute);
                const slotEnd = addMinutes(slotStart, durationMinutes);
                const slotStartStr = format(slotStart, "HH:mm");
                const slotEndStr = format(slotEnd, "HH:mm");

                const currentScore = scoreSlot(
                  slotStart, slotEnd, currentDayDate, durationMinutes,
                  taskCategory, taskPriority, combinedBlocksForSuggestion,
                  scheduledTasksForSuggestion, now, startOfToday, dayOffset
                );

                if (currentScore > bestScore) {
                  bestScore = currentScore;
                  bestSlot = { start: slotStartStr, end: slotEndStr, date: currentDayDateKey };
                }
              }
            }
          }

          if (bestSlot) {
            // Temporariamente definir as props para a tarefa de reunião
            const originalTempCategory = tempSelectedCategory;
            const originalTempPriority = tempSelectedPriority;
            const originalTempDuration = tempEstimatedDuration;

            setTempSelectedCategory(taskCategory);
            setTempSelectedPriority(taskPriority);
            setTempEstimatedDuration(String(durationMinutes));

            await scheduleTask(task, bestSlot.start, bestSlot.end, parseISO(bestSlot.date), true);
            preallocatedCount++;

            // Restaurar as props temporárias
            setTempSelectedCategory(originalTempCategory);
            setTempSelectedPriority(originalTempPriority);
            setTempEstimatedDuration(originalTempDuration);
          }
        }
      }
      if (preallocatedCount > 0) {
        toast.success(`${preallocatedCount} reuniões pré-alocadas com sucesso!`);
      } else {
        toast.info("Nenhuma reunião encontrada para pré-alocar ou todos os slots estão ocupados.");
      }
    } catch (error) {
      console.error("Erro ao pré-alocar reuniões:", error);
      toast.error("Falha ao pré-alocar reuniões.");
    } finally {
      setIsPreallocatingMeetings(false);
      fetchBacklogTasks(); // Recarregar backlog para remover tarefas agendadas
    }
  }, [meetingProjectId, fetchTasks, ignoredMeetingTaskIds, getCombinedTimeBlocksForDate, schedules, scoreSlot, scheduleTask, tempSelectedCategory, tempSelectedPriority, tempEstimatedDuration, fetchBacklogTasks]);


  const isLoading = isLoadingTodoist || isLoadingBacklog || isPreallocatingMeetings;

  const DayOfWeekNames: Record<DayOfWeek, string> = {
    "0": "Domingo",
    "1": "Segunda-feira",
    "2": "Terça-feira",
    "3": "Quarta-feira",
    "4": "Quinta-feira",
    "5": "Sexta-feira",
    "6": "Sábado",
  };

  const setDay = (date: Date, day: number) => {
    const currentDay = date.getDay();
    const diff = day - currentDay;
    return addDays(date, diff);
  };

  const groupedRecurringBlocks = recurringBlocks.reduce((acc, block) => {
    const key = `${block.start}-${block.end}-${block.type}-${block.label || ''}`;
    if (!acc[key]) {
      acc[key] = { ...block, days: [] };
    }
    acc[key].days.push(block.dayOfWeek);
    return acc;
  }, {} as Record<string, RecurringTimeBlock & { days: DayOfWeek[] }>);

  const renderRecurringBlockDisplay = (block: RecurringTimeBlock & { days: DayOfWeek[] }) => {
    const sortedDays = block.days.sort((a, b) => parseInt(a) - parseInt(b));
    let dayDisplay = "";

    const isWeekdays = sortedDays.length === 5 && sortedDays.every((day, i) => day === String(i + 1));
    const isWeekend = sortedDays.length === 2 && sortedDays.includes("0") && sortedDays.includes("6");

    if (isWeekdays) {
      dayDisplay = "Todo(a) dia de semana";
    } else if (isWeekend) {
      dayDisplay = "Todo(a) fim de semana";
    } else if (sortedDays.length === 1) {
      dayDisplay = `Todo(a) ${DayOfWeekNames[sortedDays[0]]}`;
    } else {
      dayDisplay = sortedDays.map(day => DayOfWeekNames[day]).join(", ");
    }

    return (
      <div key={block.id} className="flex items-center justify-between p-2 bg-gray-50 rounded-md border">
        <span className="text-sm">
          {block.start} - {block.end} |{" "}
          {block.type === "work" && <Briefcase className="inline-block h-4 w-4 mr-1 text-green-600" />}
          {block.type === "personal" && <Home className="inline-block h-4 w-4 mr-1 text-blue-600" />}
          {block.type === "break" && <Clock className="inline-block h-4 w-4 mr-1 text-yellow-600" />}
          {block.label || (block.type === "work" ? "Trabalho" : block.type === "personal" ? "Pessoal" : "Pausa")}
          <span className="ml-2 text-gray-400">({dayDisplay})</span>
        </span>
        <Button variant="ghost" size="icon" onClick={() => handleDeleteBlock(block.id, true)}>
          <Trash2 className="h-4 w-4 text-red-500" />
        </Button>
      </div>
    );
  };


  return (
    <div className="p-4 grid grid-cols-1 lg:grid-cols-3 gap-6">
      <div className="lg:col-span-2">
        <h2 className="text-3xl font-bold mb-2 text-gray-800">🗓️ PLANEJADOR - Sequenciamento de Tarefas</h2>
        <p className="text-lg text-gray-600 mb-6">
          Defina seus blocos de tempo e organize suas tarefas em intervalos de 15 minutos.
        </p>

        <div className="mb-6 flex items-center gap-4">
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant={"outline"}
                className={cn(
                  "w-[240px] justify-start text-left font-normal",
                  !selectedDate && "text-muted-foreground"
                )}
              >
                <CalendarIcon className="mr-2 h-4 w-4" />
                {selectedDate && isValid(selectedDate) ? format(selectedDate, "PPP", { locale: ptBR }) : <span>Selecione uma data</span>}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0">
              <Calendar
                mode="single"
                selected={selectedDate}
                onSelect={handleDateChange}
                initialFocus
                locale={ptBR}
              />
            </PopoverContent>
          </Popover>
          <Button
            onClick={preallocateMeetingTasks}
            disabled={!meetingProjectId || isLoading}
            className="bg-blue-600 hover:bg-blue-700 text-white flex items-center gap-2"
          >
            {isPreallocatingMeetings ? (
              <LoadingSpinner size={20} className="text-white" />
            ) : (
              <CalendarCheck className="h-4 w-4" />
            )}
            Pré-alocar Reuniões
          </Button>
          {ignoredMeetingTaskIds.length > 0 && (
            <Button
              onClick={handleClearIgnoredMeetings}
              variant="outline"
              className="flex items-center gap-2 text-red-600 border-red-600 hover:bg-red-50"
            >
              <Ban className="h-4 w-4" /> Limpar Ignorados ({ignoredMeetingTaskIds.length})
            </Button>
          )}
        </div>

        <Card className="mb-6 p-6">
          <CardTitle className="text-xl font-bold mb-4 flex items-center gap-2">
            <Clock className="h-5 w-5 text-indigo-600" /> Definir Blocos de Tempo
          </CardTitle>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
            <div>
              <Label htmlFor="block-start">Início</Label>
              <Input
                id="block-start"
                type="time"
                value={newBlockStart}
                onChange={(e) => setNewBlockStart(e.target.value)}
                className="mt-1"
              />
            </div>
            <div>
              <Label htmlFor="block-end">Fim</Label>
              <Input
                id="block-end"
                type="time"
                value={newBlockEnd}
                onChange={(e) => setNewBlockEnd(e.target.value)}
                className="mt-1"
              />
            </div>
            <div>
              <Label htmlFor="block-type">Tipo</Label>
              <Select value={newBlockType} onValueChange={(value: TimeBlockType) => setNewBlockType(value)}>
                <SelectTrigger className="w-full mt-1">
                  <SelectValue placeholder="Tipo de Bloco" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="work">Trabalho</SelectItem>
                  <SelectItem value="personal">Pessoal</SelectItem>
                  <SelectItem value="break">Pausa</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="block-label">Rótulo (Opcional)</Label>
              <Input
                id="block-label"
                type="text"
                value={newBlockLabel}
                onChange={(e) => setNewBlockLabel(e.target.value)}
                placeholder="Ex: Almoço, Foco"
                className="mt-1"
              />
            </div>
            <div className="md:col-span-2">
              <Label htmlFor="block-recurrence">Recorrência</Label>
              <Select value={newBlockRecurrence} onValueChange={(value: "daily" | "dayOfWeek" | "weekdays" | "weekend") => setNewBlockRecurrence(value)}>
                <SelectTrigger className="w-full mt-1">
                  <SelectValue placeholder="Recorrência" />
                </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="daily">Apenas nesta data</SelectItem>
                    <SelectItem value="dayOfWeek">Todo(a) ...</SelectItem>
                    <SelectItem value="weekdays">Todos os dias de semana</SelectItem>
                    <SelectItem value="weekend">Todos os fins de semana</SelectItem>
                  </SelectContent>
              </Select>
            </div>
            {newBlockRecurrence === "dayOfWeek" && (
              <div className="md:col-span-2">
                <Label htmlFor="block-day-of-week">Dia da Semana</Label>
                <Select value={newBlockDayOfWeek} onValueChange={(value: DayOfWeek) => setNewBlockDayOfWeek(value)}>
                  <SelectTrigger className="w-full mt-1">
                    <SelectValue placeholder="Dia da Semana" />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(DayOfWeekNames).map(([value, label]) => (
                      <SelectItem key={value} value={value}>{label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <Button onClick={handleAddBlock} className="md:col-span-4 mt-2">
              <PlusCircle className="h-4 w-4 mr-2" /> Adicionar Bloco
            </Button>
          </div>

          {(currentDaySchedule.timeBlocks.length > 0 || recurringBlocks.length > 0) && (
            <div className="mt-6 space-y-2">
              <h3 className="text-lg font-semibold">Blocos Definidos:</h3>
              {currentDaySchedule.timeBlocks.map((block) => (
                <div key={block.id} className="flex items-center justify-between p-2 bg-gray-50 rounded-md border">
                  <span className="text-sm">
                    {block.start} - {block.end} |{" "}
                    {block.type === "work" && <Briefcase className="inline-block h-4 w-4 mr-1 text-green-600" />}
                    {block.type === "personal" && <Home className="inline-block h-4 w-4 mr-1 text-blue-600" />}
                    {block.type === "break" && <Clock className="inline-block h-4 w-4 mr-1 text-yellow-600" />}
                    {block.label || (block.type === "work" ? "Trabalho" : block.type === "personal" ? "Pessoal" : "Pausa")}
                    <span className="ml-2 text-gray-400">(Nesta data)</span>
                  </span>
                  <Button variant="ghost" size="icon" onClick={() => handleDeleteBlock(block.id, false)}>
                    <Trash2 className="h-4 w-4 text-red-500" />
                  </Button>
                </div>
              ))}
              {Object.values(groupedRecurringBlocks).map(renderRecurringBlockDisplay)}
            </div>
          )}
        </Card>

        <TimeSlotPlanner
          daySchedule={currentDaySchedule}
          onSelectSlot={handleSelectSlot}
          onSelectTask={handleDeleteScheduledTask}
          suggestedSlotStart={suggestedSlot && suggestedSlot.date === format(selectedDate, "yyyy-MM-dd") ? suggestedSlot.start : null}
          suggestedSlotEnd={suggestedSlot && suggestedSlot.date === format(selectedDate, "yyyy-MM-dd") ? suggestedSlot.end : null}
        />
      </div>

      <div className="lg:col-span-1">
        <div className="flex justify-end mb-4">
          <PlannerPromptEditor
            initialPrompt={plannerAiPrompt}
            onSave={handleSavePlannerAiPrompt}
            storageKey={PLANNER_AI_PROMPT_STORAGE_KEY}
          />
        </div>
        <Card className="h-full">
          <CardHeader>
            <CardTitle className="text-xl font-bold text-gray-800 flex items-center gap-2">
              <ListTodo className="h-5 w-5 text-indigo-600" /> Backlog de Tarefas
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="mb-4">
              <Label htmlFor="shitsuke-project-filter" className="text-sm text-gray-600 font-medium">
                Filtrar por Projeto Shitsuke
              </Label>
              <Select
                value={selectedShitsukeProjectId}
                onValueChange={(value: string | 'all') => setSelectedShitsukeProjectId(value)}
                disabled={isLoading}
              >
                <SelectTrigger className="w-full mt-1">
                  <SelectValue placeholder="Todos os Projetos Shitsuke" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os Projetos Shitsuke</SelectItem>
                  {shitsukeProjects.map(project => (
                    <SelectItem key={project.id} value={project.id}>
                      {project.what}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="mb-4">
              <Label htmlFor="backlog-filter" className="sr-only">Filtrar Backlog</Label>
              <div className="relative">
                <Input
                  id="backlog-filter"
                  type="text"
                  placeholder="Filtrar tarefas (ex: 'hoje', 'p1', '#projeto')"
                  value={filterInput}
                  onChange={(e) => setFilterInput(e.target.value)}
                  onKeyPress={(e) => {
                    if (e.key === "Enter") {
                      fetchBacklogTasks();
                    }
                  }}
                  className="pr-10"
                  disabled={isLoading}
                />
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={fetchBacklogTasks}
                  className="absolute right-0 top-0 h-full px-3"
                  disabled={isLoading}
                >
                  <Filter className="h-4 w-4" />
                </Button>
              </div>
            </div>

            {selectedTaskToSchedule && (
              <div className="mb-4 p-3 border border-indigo-400 bg-indigo-50 rounded-md flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-indigo-800">
                    Selecionado: {selectedTaskToSchedule.content}
                  </span>
                  <Button variant="ghost" size="icon" onClick={handleCancelTaskSelection}>
                    <XCircle className="h-4 w-4 text-indigo-600" />
                  </Button>
                </div>
                <div className="grid grid-cols-2 gap-2 mt-2">
                  <div>
                    <Label htmlFor="temp-category" className="text-sm text-indigo-800">Categoria:</Label>
                    <Select value={tempSelectedCategory} onValueChange={(value: "pessoal" | "profissional" | "none") => setTempSelectedCategory(value)}>
                      <SelectTrigger className="w-full mt-1">
                        <SelectValue placeholder="Categoria" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="pessoal">Pessoal</SelectItem>
                        <SelectItem value="profissional">Profissional</SelectItem>
                        <SelectItem value="none">Manter Categoria</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="temp-priority" className="text-sm text-indigo-800">Prioridade:</Label>
                    <Select value={String(tempSelectedPriority)} onValueChange={(value) => setTempSelectedPriority(Number(value) as 1 | 2 | 3 | 4)}>
                      <SelectTrigger className="w-full mt-1">
                        <SelectValue placeholder="Prioridade" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="4">P1 - Urgente</SelectItem>
                        <SelectItem value="3">P2 - Alto</SelectItem>
                        <SelectItem value="2">P3 - Médio</SelectItem>
                        <SelectItem value="1">P4 - Baixo</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="flex items-center gap-2 mt-2">
                  <Label htmlFor="temp-duration" className="text-sm text-indigo-800">Duração (min):</Label>
                  <Input
                    id="temp-duration"
                    type="number"
                    value={tempEstimatedDuration}
                    onChange={(e) => setTempEstimatedDuration(e.target.value)}
                    min="1"
                    className="w-20 text-sm"
                  />
                  <Button onClick={handleSuggestSlot} className="flex-grow bg-yellow-500 hover:bg-yellow-600 text-white">
                    <Lightbulb className="h-4 w-4 mr-2" /> Sugerir Slot
                  </Button>
                </div>
                {suggestedSlot && (
                  <div className="mt-2 p-2 bg-green-100 border border-green-400 rounded-md flex items-center justify-between">
                    <span className="text-sm text-green-800">
                      Sugestão: {suggestedSlot.start} - {suggestedSlot.end} ({format(parseISO(suggestedSlot.date), "dd/MM", { locale: ptBR })})
                    </span>
                    <Button size="sm" onClick={() => scheduleTask(selectedTaskToSchedule, suggestedSlot.start, suggestedSlot.end, parseISO(suggestedSlot.date))}>
                      Agendar
                    </Button>
                  </div>
                )}
              </div>
            )}
            {isLoading ? (
              <div className="flex justify-center items-center h-[calc(100vh-400px)]">
                <LoadingSpinner size={30} />
              </div>
            ) : backlogTasks.length > 0 ? (
              <div className="mt-4 p-2 border rounded-md bg-gray-50 h-[calc(100vh-400px)] overflow-y-auto space-y-2">
                {backlogTasks.map((task) => (
                  <div
                    key={task.id}
                    className={cn(
                      "p-3 border rounded-md cursor-pointer hover:bg-gray-100 transition-colors",
                      selectedTaskToSchedule?.id === task.id ? "bg-indigo-100 border-indigo-500" : "bg-white border-gray-200"
                    )}
                    onClick={() => handleSelectBacklogTask(task)}
                  >
                    <h4 className="font-semibold text-gray-800">{task.content}</h4>
                    {task.description && <p className="text-xs text-gray-600 line-clamp-2">{task.description}</p>}
                    <div className="flex justify-between items-center text-xs text-gray-500 mt-1">
                      <div className="flex items-center gap-2">
                        <span
                          className={cn(
                            "px-2 py-0.5 rounded-full text-white text-xs font-medium",
                            PRIORITY_COLORS['priority' in task ? task.priority : 1],
                          )}
                        >
                          {PRIORITY_LABELS['priority' in task ? task.priority : 1]}
                        </span>
                        <span className="text-gray-600">
                          {'labels' in task ? (getTaskCategory(task) || 'N/A') : task.category}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        {'due' in task && typeof task.due?.datetime === 'string' && task.due.datetime && isValid(parseISO(task.due.datetime)) && (
                          <span>Venc: {format(parseISO(task.due.datetime), "dd/MM HH:mm", { locale: ptBR })}</span>
                        )}
                        {'due' in task && typeof task.due?.date === 'string' && task.due.date && !(typeof task.due?.datetime === 'string' && task.due.datetime) && isValid(parseISO(task.due.date)) && (
                          <span>Venc: {format(parseISO(task.due.date), "dd/MM", { locale: ptBR })}</span>
                        )}
                        <span className="flex items-center">
                          <Clock className="h-3 w-3 mr-1" /> {task.estimatedDurationMinutes || 15} min
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="mt-4 p-4 border rounded-md bg-gray-50 h-[calc(100vh-400px)] overflow-y-auto">
                <p className="text-gray-500 italic">Nenhuma tarefa no backlog para agendar ainda.</p>
                <Button onClick={fetchBacklogTasks} className="mt-4 w-full">Recarregar Backlog</Button>
              </div>
            )}
          </CardContent>
        </Card>
        {/* PlannerAIAssistant component */}
        <div className="mt-6">
          <PlannerAIAssistant
            ref={plannerAIAssistantRef}
            plannerAiPrompt={plannerAiPrompt}
            selectedTaskToSchedule={selectedTaskToSchedule}
            selectedDate={selectedDate}
            schedules={schedules}
            recurringBlocks={recurringBlocks}
            tempEstimatedDuration={tempEstimatedDuration}
            tempSelectedCategory={tempSelectedCategory}
            tempSelectedPriority={tempSelectedPriority}
            onSuggestSlot={setSuggestedSlot}
            onScheduleSuggestedTask={scheduleTask}
          />
        </div>
      </div>
    </div>
  );
};

export default Planejador;