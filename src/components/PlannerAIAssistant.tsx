"use client";

import React, { useState, useEffect, useRef, useCallback, useImperativeHandle, ForwardedRef } from "react";
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

export interface PlannerAIAssistantRef {
  triggerSuggestion: () => void;
}

const PLANNER_AI_CHAT_HISTORY_KEY = "planner_ai_chat_history";

const PlannerAIAssistant = React.forwardRef<PlannerAIAssistantRef, PlannerAIAssistantProps>(({
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
}, ref) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputMessage, setInputMessage] = useState("");
  const [isLoadingAI, setIsLoadingAI] = useState(false);
  const scrollAreaRef = useRef<HTMLDivElement>(null);

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
  }, [selectedTaskToSchedule, selectedDate, schedules, recurringBlocks, tempEstimatedDuration, tempSelectedCategory, tempSelectedPriority, getCombinedTimeBlocksForDate, scoreSlot, onSuggestSlot, addMessage, setIsLoadingAI]);


  const handleSendMessage = useCallback(async (initialSuggestion: boolean = false) => {
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
  }, [inputMessage, selectedTaskToSchedule, selectedDate, tempEstimatedDuration, tempSelectedCategory, tempSelectedPriority, generateAISuggestion, plannerAiPrompt, addMessage, setIsLoadingAI]);

  // Expose a method to trigger suggestion from parent
  useImperativeHandle(ref, () => ({
    triggerSuggestion: () => handleSendMessage(true),
  }));

  return (
    <Card className="h-full flex flex-col">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <Bot className="h-5 w-5 text-indigo-600" /> Agente de Slots IA
        </CardTitle>
      </CardHeader>
      <CardContent className="flex-grow flex flex-col p-0">
        <ScrollArea className="h-[calc(100vh-400px)] p-4" viewportRef={scrollAreaRef}>
          <div className="space-y-4">
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex ${
                  msg.sender === "user" ? "justify-end" : "justify-start"
                }`}
              >
                <div
                  className={cn(
                    "max-w-[80%] p-3 rounded-lg shadow-sm",
                    msg.sender === "user"
                      ? "bg-blue-500 text-white"
                      : "bg-gray-100 text-gray-800 border border-gray-200",
                  )}
                >
                  {msg.sender === "ai" && <span className="font-semibold text-indigo-600 block mb-1">Agente IA:</span>}
                  <p className="whitespace-pre-wrap">{msg.text}</p>
                </div>
              </div>
            ))}
          </div>
        </ScrollArea>
        <div className="p-4 border-t flex flex-col gap-2">
          <div className="flex items-center gap-2">
            <Input
              placeholder="Pergunte ao Agente IA..."
              value={inputMessage}
              onChange={(e) => setInputMessage(e.target.value)}
              onKeyPress={(e) => {
                if (e.key === "Enter") {
                  handleSendMessage();
                }
              }}
              disabled={isLoadingAI}
              className="flex-grow"
            />
            <Button onClick={() => handleSendMessage()} disabled={isLoadingAI}>
              <Send className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
});

PlannerAIAssistant.displayName = "PlannerAIAssistant";

export default PlannerAIAssistant;