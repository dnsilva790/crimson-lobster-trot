"use client";

import React, { useState, useEffect, useRef, useCallback, useImperativeHandle, ForwardedRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Send, Bot, User, Lightbulb, CalendarCheck, MessageSquare } from "lucide-react";
import { TodoistTask, InternalTask, DaySchedule, RecurringTimeBlock, TimeBlockType, ScheduledTask } from "@/lib/types";
import { toast } from "sonner";
import { cn, getTaskCategory } from "@/lib/utils";
import { format, parseISO, startOfDay, addMinutes, isWithinInterval, parse, setHours, setMinutes, addDays, isEqual, isBefore, startOfMinute, isValid, getDay } from "date-fns";
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
  onSuggestSlot: (slot: { start: string; end: string; date: string; displacedTask?: ScheduledTask } | null) => void;
  onScheduleSuggestedTask: (task: TodoistTask | InternalTask, start: string, end: string, targetDate: Date) => Promise<void>;
}

export interface PlannerAIAssistantRef {
  triggerSuggestion: () => void;
}

interface Message {
  id: string;
  sender: "user" | "ai";
  text: string;
}

const PLANNER_AI_CHAT_HISTORY_KEY_PREFIX = "planner_ai_chat_history_";

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
  const [isLoadingAI, setIsLoadingAI] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputMessage, setInputMessage] = useState("");
  const scrollAreaRef = useRef<HTMLDivElement>(null);

  const getChatHistoryKey = (date: Date) => `${PLANNER_AI_CHAT_HISTORY_KEY_PREFIX}${format(date, "yyyy-MM-dd")}`;

  // Load messages for the selected date
  useEffect(() => {
    const savedHistory = localStorage.getItem(getChatHistoryKey(selectedDate));
    if (savedHistory) {
      setMessages(JSON.parse(savedHistory));
    } else {
      setMessages([]);
      addMessage("ai", `Olá! Sou o Tutor IA do Planejador. Como posso te ajudar a organizar seu dia ${format(selectedDate, "dd/MM", { locale: ptBR })}?`);
    }
  }, [selectedDate]); // Reload chat history when selectedDate changes

  // Save messages whenever they change
  useEffect(() => {
    if (messages.length > 0) {
      localStorage.setItem(getChatHistoryKey(selectedDate), JSON.stringify(messages));
    }
  }, [messages, selectedDate]);

  useEffect(() => {
    if (scrollAreaRef.current) {
      scrollAreaRef.current.scrollTop = scrollAreaRef.current.scrollHeight;
    }
  }, [messages]);

  const addMessage = useCallback((sender: "user" | "ai", text: string) => {
    setMessages((prev) => [...prev, { id: Date.now().toString(), sender, text }]);
  }, []);

  const getCombinedTimeBlocksForDate = useCallback((date: Date): TimeBlock[] => {
    const dateKey = format(date, "yyyy-MM-dd");
    const dayOfWeek = getDay(date).toString() as DayOfWeek;

    const dateSpecificBlocks = schedules[dateKey]?.timeBlocks || [];
    const recurringBlocksForDay = recurringBlocks.filter(block => block.dayOfWeek === dayOfWeek);

    const combined = [...dateSpecificBlocks, ...recurringBlocksForDay];
    return combined.sort((a, b) => a.start.localeCompare(b.start));
  }, [schedules, recurringBlocks]);

  const getTaskImportanceScore = useCallback((task: TodoistTask | InternalTask): number => {
    let score = 0;

    // Reuniões são imutáveis e têm a maior importância para não serem remanejadas
    if (task.content.startsWith('*')) {
      return Infinity; 
    }

    // 1. Deadline (highest priority for displacement)
    if ('deadline' in task && typeof task.deadline === 'string' && task.deadline) {
      const parsedDeadline = parseISO(task.deadline);
      if (isValid(parsedDeadline)) {
        const daysUntilDeadline = (parsedDeadline.getTime() - startOfDay(new Date()).getTime()) / (1000 * 60 * 60 * 24);
        score += Math.max(0, 1000 - (daysUntilDeadline * 50)); // Closer deadline, higher score
      }
    }

    // 2. Priority
    const priority = 'priority' in task ? task.priority : 1;
    switch (priority) {
      case 4: score += 80; break; // P1
      case 3: score += 60; break; // P2
      case 2: score += 40; break; // P3
      case 1: score += 20; break; // P4
    }

    // 3. Due Date/Time
    if ('due' in task && task.due) {
      let dueDate: Date | null = null;
      if (typeof task.due.datetime === 'string' && task.due.datetime) {
        dueDate = parseISO(task.due.datetime);
      } else if (typeof task.due.date === 'string' && task.due.date) {
        dueDate = parseISO(task.due.date);
      }

      if (dueDate && isValid(dueDate)) {
        const daysUntilDue = (dueDate.getTime() - startOfDay(new Date()).getTime()) / (1000 * 60 * 60 * 24);
        score += Math.max(0, 50 - (daysUntilDue * 10)); // Closer due date, higher score
      }
    }

    return score;
  }, []);

  const scoreSlot = useCallback((
    slotStart: Date,
    slotEnd: Date,
    currentDayDate: Date,
    durationMinutes: number,
    taskCategory: "pessoal" | "profissional" | undefined,
    taskPriority: 1 | 2 | 3 | 4,
    combinedBlocksForSuggestion: TimeBlock[],
    scheduledTasksForSuggestion: ScheduledTask[],
    now: Date,
    startOfToday: Date,
    dayOffset: number,
    taskToScheduleImportance: number,
  ): { score: number, displacedTask: ScheduledTask | undefined } => {
    let currentSlotScore = 0;
    let displacedTask: ScheduledTask | undefined = undefined;

    // Penalidade: Slots no passado
    if (isBefore(slotStart, now)) {
      return { score: -Infinity, displacedTask: undefined };
    }

    // Check for conflicts with scheduled tasks
    for (const st of scheduledTasksForSuggestion) {
      const stStart = (typeof st.start === 'string' && st.start) ? parse(st.start, "HH:mm", currentDayDate) : null;
      const stEnd = (typeof st.end === 'string' && st.end) ? parse(st.end, "HH:mm", currentDayDate) : null;
      if (!stStart || !stEnd || !isValid(stStart) || !isValid(stEnd)) continue;

      // Standard overlap check: (start1 < end2 && end1 > start2)
      if (slotStart < stEnd && slotEnd > stStart) {
        
        if (st.isMeeting) { // Meetings cannot be displaced
          return { score: -Infinity, displacedTask: undefined };
        } else {
          // Compare importance: if new task is more important, this slot is a candidate for displacement
          const existingTaskImportance = getTaskImportanceScore(st.originalTask as TodoistTask | InternalTask);
          if (taskToScheduleImportance > existingTaskImportance) {
            displacedTask = st;
            currentSlotScore += 50; // Bonus for displacing a less important task
          } else {
            return { score: -Infinity, displacedTask: undefined }; // Cannot displace a more important or equally important task
          }
        }
      }
    }

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
        // Standard overlap check: (start1 < end2 && end1 > start2)
        if (slotStart < blockEnd && slotEnd > blockStart) {
          isOverlappingBreak = true;
          break;
        }
      }
    }
    // Penalidade: Sobreposição com blocos de pausa
    if (isOverlappingBreak) {
      return { score: -Infinity, displacedTask: undefined };
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

    return { score: currentSlotScore, displacedTask };
  }, [getTaskImportanceScore]);


  const generateAISuggestion = useCallback(async (
    task: (TodoistTask | InternalTask),
    currentSelectedDate: Date,
    durationMinutes: number,
    taskCategory: "pessoal" | "profissional" | undefined,
    taskPriority: 1 | 2 | 3 | 4,
  ) => {
    setIsLoadingAI(true);
    let bestSlot: { start: string; end: string; date: string; displacedTask?: ScheduledTask } | null = null;
    let bestScore = -Infinity;
    let explanation = "";

    addMessage("ai", "Analisando sua agenda e a tarefa...");

    const NUM_DAYS_TO_LOOK_AHEAD = 7;
    const now = new Date();
    const startOfToday = startOfDay(now);
    const taskToScheduleImportance = getTaskImportanceScore(task);

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

          const { score: currentScore, displacedTask: currentDisplacedTask } = scoreSlot(
            slotStart, slotEnd, currentDayDate, durationMinutes,
            taskCategory, taskPriority, combinedBlocksForSuggestion,
            scheduledTasksForSuggestion, now, startOfToday, dayOffset,
            taskToScheduleImportance
          );

          if (currentScore > bestScore) {
            bestScore = currentScore;
            bestSlot = { start: slotStartStr, end: slotEndStr, date: currentDayDateKey, displacedTask: currentDisplacedTask };
            
            explanation = `Sugestão: ${slotStartStr} - ${slotEndStr} em ${format(currentDayDate, "dd/MM/yyyy", { locale: ptBR })} para "${task.content}" (P${taskPriority}, ${taskCategory}).`;
            if (currentDisplacedTask) {
              explanation += ` Remanejando "${currentDisplacedTask.content}".`;
            }
          }
        }
      }
    }

    if (bestSlot) {
      addMessage("ai", explanation); // Add to chat
      onSuggestSlot(bestSlot);
    } else {
      addMessage("ai", "Não foi possível encontrar um slot adequado para esta tarefa nos próximos 7 dias."); // Add to chat
      onSuggestSlot(null);
    }
    setIsLoadingAI(false);
  }, [selectedTaskToSchedule, selectedDate, schedules, recurringBlocks, tempEstimatedDuration, tempSelectedCategory, tempSelectedPriority, getCombinedTimeBlocksForDate, scoreSlot, onSuggestSlot, setIsLoadingAI, getTaskImportanceScore, addMessage]);

  const handleTriggerSuggestion = useCallback(async () => {
    if (!selectedTaskToSchedule) {
      addMessage("ai", "Por favor, selecione uma tarefa do backlog para eu poder sugerir um slot.");
      return;
    }
    if (tempSelectedCategory === "none") {
      addMessage("ai", "Por favor, classifique a tarefa como 'Pessoal' ou 'Profissional' antes de sugerir um slot.");
      return;
    }
    const durationMinutes = parseInt(tempEstimatedDuration, 10) || 15;
    const taskCategory = tempSelectedCategory === "none" ? (selectedTaskToSchedule ? getTaskCategory(selectedTaskToSchedule) : undefined) : tempSelectedCategory;
    const taskPriority = tempSelectedPriority;
    await generateAISuggestion(selectedTaskToSchedule, selectedDate, durationMinutes, taskCategory, taskPriority);
  }, [selectedTaskToSchedule, selectedDate, tempEstimatedDuration, tempSelectedCategory, tempSelectedPriority, generateAISuggestion, addMessage]);

  useImperativeHandle(ref, () => ({
    triggerSuggestion: () => handleTriggerSuggestion(),
  }));

  const handleSendMessage = async () => {
    if (inputMessage.trim() === "" || isLoadingAI) return;

    addMessage("user", inputMessage);
    const userMsg = inputMessage;
    setInputMessage("");

    // Simulate AI processing user's chat message
    setIsLoadingAI(true);
    setTimeout(() => {
      let aiResponse = "Entendi. Como posso refinar a sugestão ou te ajudar de outra forma?";
      if (userMsg.toLowerCase().includes("mais cedo")) {
        aiResponse = "Ok, vou tentar encontrar um slot mais cedo. (Funcionalidade de refinar sugestão em desenvolvimento)";
      } else if (userMsg.toLowerCase().includes("outro dia")) {
        aiResponse = "Certo, vou procurar em outro dia. (Funcionalidade de refinar sugestão em desenvolvimento)";
      } else if (userMsg.toLowerCase().includes("mais longo")) {
        aiResponse = "Entendido, vou considerar um slot mais longo. (Funcionalidade de refinar sugestão em desenvolvimento)";
      }
      addMessage("ai", aiResponse);
      setIsLoadingAI(false);
    }, 1000);
  };

  return (
    <Card className="h-[calc(100vh-100px)] flex flex-col">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <Bot className="h-5 w-5 text-indigo-600" /> Tutor IA do Planejador
        </CardTitle>
      </CardHeader>
      <CardContent className="flex-grow flex flex-col p-0">
        <ScrollArea className="h-[calc(100vh-300px)] p-4" viewportRef={scrollAreaRef}>
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
                  {msg.sender === "ai" && <span className="font-semibold text-indigo-600 block mb-1">Tutor IA:</span>}
                  <p className="whitespace-pre-wrap">{msg.text}</p>
                </div>
              </div>
            ))}
            {isLoadingAI && (
              <div className="flex justify-start">
                <div className="max-w-[80%] p-3 rounded-lg shadow-sm bg-gray-100 text-gray-800 border border-gray-200">
                  <span className="font-semibold text-indigo-600 block mb-1">Tutor IA:</span>
                  <span className="animate-pulse">Pensando...</span>
                </div>
              </div>
            )}
          </div>
        </ScrollArea>
        <div className="p-4 border-t flex items-center gap-2">
          <Input
            placeholder="Converse com o Tutor IA..."
            value={inputMessage}
            onChange={(e) => setInputMessage(e.target.value)}
            onKeyPress={(e) => {
              if (e.key === "Enter") {
                handleSendMessage();
              }
            }}
            disabled={isLoadingAI || !selectedTaskToSchedule}
            className="flex-grow"
          />
          <Button onClick={handleSendMessage} disabled={isLoadingAI || !selectedTaskToSchedule}>
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
});

PlannerAIAssistant.displayName = "PlannerAIAssistant";

export default PlannerAIAssistant;