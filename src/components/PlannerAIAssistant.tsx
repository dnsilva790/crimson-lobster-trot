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

// Removido PLANNER_AI_CHAT_HISTORY_KEY pois o chat não será mais exibido.

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
  // Removido estados de mensagens e inputMessage, e isLoadingAI para o chat
  const [isLoadingAI, setIsLoadingAI] = useState(false); // Mantido para o spinner de sugestão
  // Removido scrollAreaRef

  // Removido useEffect para carregar/salvar histórico de chat
  // Removido useEffect para scroll

  // Removido addMessage, pois não haverá chat

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
    let explanation = ""; // A explicação será usada para um toast, não para o chat

    console.log("PlannerAIAssistant: generateAISuggestion started."); // Log de depuração
    console.log("PlannerAIAssistant: Task:", task.content, "Duration:", durationMinutes, "Category:", taskCategory, "Priority:", taskPriority); // Log de depuração

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
            // Gerar uma explicação concisa para o toast
            explanation = `Sugestão: ${slotStartStr} - ${slotEndStr} em ${format(currentDayDate, "dd/MM/yyyy", { locale: ptBR })} para "${task.content}" (P${taskPriority}, ${taskCategory}).`;
          }
        }
      }
    }

    if (bestSlot) {
      toast.info(explanation); // Exibir a sugestão como um toast
      onSuggestSlot(bestSlot);
      console.log("PlannerAIAssistant: Best slot found and suggested:", bestSlot); // Log de depuração
    } else {
      toast.error("Não foi possível encontrar um slot adequado para esta tarefa nos próximos 7 dias.");
      onSuggestSlot(null);
      console.log("PlannerAIAssistant: No suitable slot found."); // Log de depuração
    }
    setIsLoadingAI(false);
  }, [selectedTaskToSchedule, selectedDate, schedules, recurringBlocks, tempEstimatedDuration, tempSelectedCategory, tempSelectedPriority, getCombinedTimeBlocksForDate, scoreSlot, onSuggestSlot, setIsLoadingAI]);


  const handleTriggerSuggestion = useCallback(async () => {
    console.log("PlannerAIAssistant: handleTriggerSuggestion called."); // Log de depuração
    if (!selectedTaskToSchedule) {
      toast.error("Por favor, selecione uma tarefa do backlog para eu poder sugerir um slot.");
      console.log("PlannerAIAssistant: No task selected."); // Log de depuração
      return;
    }
    if (tempSelectedCategory === "none") {
      toast.error("Por favor, classifique a tarefa como 'Pessoal' ou 'Profissional' antes de sugerir um slot.");
      console.log("PlannerAIAssistant: Category is 'none'."); // Log de depuração
      return;
    }
    console.log("PlannerAIAssistant: Preconditions met, calling generateAISuggestion."); // Log de depuração
    const durationMinutes = parseInt(tempEstimatedDuration, 10) || 15;
    const taskCategory = tempSelectedCategory === "none" ? (selectedTaskToSchedule ? getTaskCategory(selectedTaskToSchedule) : undefined) : tempSelectedCategory;
    const taskPriority = tempSelectedPriority;
    await generateAISuggestion(selectedTaskToSchedule, selectedDate, durationMinutes, taskCategory, taskPriority);
  }, [selectedTaskToSchedule, selectedDate, tempEstimatedDuration, tempSelectedCategory, tempSelectedPriority, generateAISuggestion]);

  // Expose a method to trigger suggestion from parent
  useImperativeHandle(ref, () => ({
    triggerSuggestion: () => handleTriggerSuggestion(),
  }));

  // O componente não renderiza nada visualmente, apenas expõe a funcionalidade via ref
  return null;
});

PlannerAIAssistant.displayName = "PlannerAIAssistant";

export default PlannerAIAssistant;