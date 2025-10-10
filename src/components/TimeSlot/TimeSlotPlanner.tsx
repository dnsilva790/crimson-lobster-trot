"use client";

import React, { useState, useEffect, useRef } from "react"; // Importar useRef
import { DaySchedule, TimeBlock, ScheduledTask, TimeBlockType } from "@/lib/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { format, parseISO, setHours, setMinutes, addMinutes, isWithinInterval, parse, isBefore, isAfter, isEqual, addDays, isToday } from "date-fns"; // Adicionar isToday
import { ptBR } from "date-fns/locale";

interface TimeSlotPlannerProps {
  daySchedule: DaySchedule;
  onSelectSlot?: (time: string, type: TimeBlockType) => void;
  onSelectTask?: (task: ScheduledTask) => void; // Adicionada prop para selecionar tarefa agendada
  suggestedSlotStart?: string | null; // Novo: Início do slot sugerido
  suggestedSlotEnd?: string | null;   // Novo: Fim do slot sugerido
}

const TimeSlotPlanner: React.FC<TimeSlotPlannerProps> = ({
  daySchedule,
  onSelectSlot,
  onSelectTask,
  suggestedSlotStart,
  suggestedSlotEnd,
}) => {
  const [currentTime, setCurrentTime] = useState(new Date());
  const scrollAreaRef = useRef<HTMLDivElement>(null); // Ref para a área de scroll

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTime(new Date());
    }, 60 * 1000); // Atualiza a cada minuto

    return () => clearInterval(interval);
  }, []);

  // Calcula a posição da linha do horário atual
  const renderCurrentTimeLine = () => {
    if (!isToday(parseISO(daySchedule.date))) {
      return null; // Apenas mostra para o dia atual
    }

    const now = currentTime;
    const totalMinutesToday = now.getHours() * 60 + now.getMinutes();
    // Cada slot de 15 minutos tem 40px (h-10). Então 1 minuto = 40/15 pixels.
    const pixelsPerMinute = 40 / 15;
    const topPosition = totalMinutesToday * pixelsPerMinute;

    return (
      <div
        className="absolute left-0 right-0 h-0.5 bg-red-500 z-20"
        style={{ top: `${topPosition}px` }}
      >
        <div className="absolute -left-1 -top-2 w-3 h-3 rounded-full bg-red-500"></div>
        <span className="absolute -right-10 -top-2 text-xs text-red-600 font-semibold">
          {format(now, "HH:mm")}
        </span>
      </div>
    );
  };

  // Efeito para rolar para a linha do tempo atual ao carregar
  useEffect(() => {
    if (scrollAreaRef.current && isToday(parseISO(daySchedule.date))) {
      const now = new Date();
      const totalMinutesToday = now.getHours() * 60 + now.getMinutes();
      const pixelsPerMinute = 40 / 15;
      const topPosition = totalMinutesToday * pixelsPerMinute;
      
      // Rola para a posição, centralizando a linha do tempo na tela
      scrollAreaRef.current.scrollTo({
        top: Math.max(0, topPosition - scrollAreaRef.current.clientHeight / 2),
        behavior: 'smooth'
      });
    }
  }, [daySchedule.date]); // Rola quando o dia muda

  const renderTimeSlots = () => {
    const slots: JSX.Element[] = [];
    const today = parseISO(daySchedule.date); // Use the date from daySchedule

    const parsedSuggestedStart = suggestedSlotStart ? parse(suggestedSlotStart, "HH:mm", today) : null;
    const parsedSuggestedEnd = suggestedSlotEnd ? parse(suggestedSlotEnd, "HH:mm", today) : null;

    for (let hour = 0; hour < 24; hour++) {
      for (let minute = 0; minute < 60; minute += 15) {
        const slotTime = setMinutes(setHours(today, hour), minute);
        const formattedTime = format(slotTime, "HH:mm");
        const nextSlotTime = addMinutes(slotTime, 15); // Represents the end of the current 15-min slot

        // Determine the type of time block for this slot
        let blockType: TimeBlockType = "work"; // Default to work
        let blockLabel: string | undefined;
        let blockColorClass = "bg-gray-50 hover:bg-gray-100";

        // Check if this slot falls within any defined time blocks
        for (const block of daySchedule.timeBlocks) {
          const blockStart = parse(block.start, "HH:mm", today);
          let blockEnd = parse(block.end, "HH:mm", today);
          // Adjust blockEnd if it crosses midnight (e.g., 23:00 to 00:00)
          if (isBefore(blockEnd, blockStart)) {
            blockEnd = addDays(blockEnd, 1);
          }

          // A block covers this 15-min slot if the slot's start is >= block's start
          // AND the slot's end is <= block's end.
          // Or, more simply, if the slot's start is within the block interval (inclusive start, exclusive end)
          if (isWithinInterval(slotTime, { start: blockStart, end: blockEnd }) &&
              (isBefore(nextSlotTime, blockEnd) || isEqual(nextSlotTime, blockEnd))) {
            blockType = block.type;
            blockLabel = block.label;
            if (block.type === "personal") {
              blockColorClass = "bg-blue-50 hover:bg-blue-100";
            } else if (block.type === "break") {
              blockColorClass = "bg-yellow-50 hover:bg-yellow-100";
            } else { // work
              blockColorClass = "bg-green-50 hover:bg-green-100";
            }
            break; // Found a matching block, no need to check further
          }
        }

        // Check for scheduled tasks that occupy this 15-minute slot
        // A task occupies this slot if its start time is less than or equal to slotTime
        // AND its end time is strictly greater than slotTime.
        const taskInSlot = daySchedule.scheduledTasks.find(task => {
          const taskStart = parse(task.start, "HH:mm", today);
          const taskEnd = parse(task.end, "HH:mm", today);
          return (isBefore(taskStart, nextSlotTime) || isEqual(taskStart, slotTime)) && isAfter(taskEnd, slotTime);
        });

        // Determine if this slot is part of the suggested slot
        const isSuggestedSlot = parsedSuggestedStart && parsedSuggestedEnd &&
                                isWithinInterval(slotTime, { start: parsedSuggestedStart, end: parsedSuggestedEnd }) &&
                                (isBefore(nextSlotTime, parsedSuggestedEnd) || isEqual(nextSlotTime, parsedSuggestedEnd));

        slots.push(
          <div
            key={formattedTime}
            className={cn(
              "relative p-1 border-b border-gray-200 text-xs h-10 flex items-center justify-between",
              blockColorClass,
              onSelectSlot && "cursor-pointer",
              isSuggestedSlot && "bg-yellow-200 border-yellow-500 ring-2 ring-yellow-500 z-10" // Highlight suggested slot
            )}
            onClick={() => onSelectSlot?.(formattedTime, blockType)}
          >
            <span className="font-medium text-gray-600">{formattedTime}</span>
            {blockLabel && <span className="text-gray-500 italic">{blockLabel}</span>}
            
            {taskInSlot && (
              <div className="absolute inset-0 flex flex-col justify-center items-center bg-opacity-80 bg-indigo-200 text-indigo-800 text-center text-[10px] font-semibold overflow-hidden cursor-pointer"
                   onClick={(e) => { e.stopPropagation(); onSelectTask?.(taskInSlot); }}>
                <span className="truncate w-full px-1" title={taskInSlot.content}>
                  {taskInSlot.content}
                </span>
              </div>
            )}
          </div>
        );
      }
    }
    return slots;
  };

  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle className="text-xl font-bold text-gray-800">
          Agenda para {format(parseISO(daySchedule.date), "EEEE, dd 'de' MMMM", { locale: ptBR })}
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <div ref={scrollAreaRef} className="overflow-y-auto h-[calc(100vh-300px)] custom-scroll relative"> {/* Adicionar relative aqui */}
          {renderTimeSlots()}
          {renderCurrentTimeLine()} {/* Renderizar a linha do tempo */}
        </div>
      </CardContent>
    </Card>
  );
};

export default TimeSlotPlanner;