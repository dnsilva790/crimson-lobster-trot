"use client";

import React, { useState, useEffect, useRef } from "react";
import { DaySchedule, TimeBlock, ScheduledTask, TimeBlockType } from "@/lib/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { format, parseISO, setHours, setMinutes, addMinutes, isWithinInterval, parse, isBefore, isAfter, isEqual, addDays, isToday, isValid } from "date-fns";
import { ptBR } from "date-fns/locale";

interface TimeSlotPlannerProps {
  daySchedule: DaySchedule;
  onSelectSlot?: (time: string, type: TimeBlockType) => void;
  onSelectTask?: (task: ScheduledTask) => void;
  suggestedSlotStart?: string | null;
  suggestedSlotEnd?: string | null;
}

const TimeSlotPlanner: React.FC<TimeSlotPlannerProps> = ({
  daySchedule,
  onSelectSlot,
  onSelectTask,
  suggestedSlotStart,
  suggestedSlotEnd,
}) => {
  const [currentTime, setCurrentTime] = useState(new Date());
  const scrollAreaRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTime(new Date());
    }, 60 * 1000);

    return () => clearInterval(interval);
  }, []);

  // Calcula a posição da linha do horário atual
  const renderCurrentTimeLine = () => {
    const parsedDayScheduleDate = (typeof daySchedule.date === 'string' && daySchedule.date) ? parseISO(daySchedule.date) : null;
    if (!parsedDayScheduleDate || !isValid(parsedDayScheduleDate) || !isToday(parsedDayScheduleDate)) {
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
    const parsedDayScheduleDate = (typeof daySchedule.date === 'string' && daySchedule.date) ? parseISO(daySchedule.date) : null;
    if (scrollAreaRef.current && parsedDayScheduleDate && isValid(parsedDayScheduleDate) && isToday(parsedDayScheduleDate)) {
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
  }, [daySchedule.date]);

  const renderTimeSlots = () => {
    const slots: JSX.Element[] = [];
    const today = (typeof daySchedule.date === 'string' && daySchedule.date) ? parseISO(daySchedule.date) : new Date(); // Fallback to current date if invalid

    const parsedSuggestedStart = (typeof suggestedSlotStart === 'string' && suggestedSlotStart) ? parse(suggestedSlotStart, "HH:mm", today) : null;
    const parsedSuggestedEnd = (typeof suggestedSlotEnd === 'string' && suggestedSlotEnd) ? parse(suggestedSlotEnd, "HH:mm", today) : null;

    for (let hour = 0; hour < 24; hour++) {
      for (let minute = 0; minute < 60; minute += 15) {
        const slotTime = setMinutes(setHours(today, hour), minute);
        const formattedTime = format(slotTime, "HH:mm");
        const nextSlotTime = addMinutes(slotTime, 15);

        let blockType: TimeBlockType = "work";
        let blockLabel: string | undefined;
        let blockColorClass = "bg-gray-50 hover:bg-gray-100";

        for (const block of daySchedule.timeBlocks) {
          const blockStart = (typeof block.start === 'string' && block.start) ? parse(block.start, "HH:mm", today) : null;
          let blockEnd = (typeof block.end === 'string' && block.end) ? parse(block.end, "HH:mm", today) : null;

          if (!blockStart || !blockEnd || !isValid(blockStart) || !isValid(blockEnd)) continue;

          if (isBefore(blockEnd, blockStart)) {
            blockEnd = addDays(blockEnd, 1);
          }

          if (isWithinInterval(slotTime, { start: blockStart, end: blockEnd }) &&
              (isBefore(nextSlotTime, blockEnd) || isEqual(nextSlotTime, blockEnd))) {
            blockType = block.type;
            blockLabel = block.label;
            if (block.type === "personal") {
              blockColorClass = "bg-blue-50 hover:bg-blue-100";
            } else if (block.type === "break") {
              blockColorClass = "bg-yellow-50 hover:bg-yellow-100";
            } else {
              blockColorClass = "bg-green-50 hover:bg-green-100";
            }
            break;
          }
        }

        const taskInSlot = daySchedule.scheduledTasks.find(task => {
          const taskStart = (typeof task.start === 'string' && task.start) ? parse(task.start, "HH:mm", today) : null;
          const taskEnd = (typeof task.end === 'string' && task.end) ? parse(task.end, "HH:mm", today) : null;
          if (!taskStart || !taskEnd || !isValid(taskStart) || !isValid(taskEnd)) return false;
          return (isBefore(taskStart, nextSlotTime) || isEqual(taskStart, slotTime)) && isAfter(taskEnd, slotTime);
        });

        const isSuggestedSlot = parsedSuggestedStart && parsedSuggestedEnd && isValid(parsedSuggestedStart) && isValid(parsedSuggestedEnd) &&
                                isWithinInterval(slotTime, { start: parsedSuggestedStart, end: parsedSuggestedEnd }) &&
                                (isBefore(nextSlotTime, parsedSuggestedEnd) || isEqual(nextSlotTime, parsedSuggestedEnd));

        slots.push(
          <div
            key={formattedTime}
            className={cn(
              "relative p-1 border-b border-gray-200 text-xs h-10 flex items-center justify-between",
              blockColorClass,
              onSelectSlot && "cursor-pointer",
              isSuggestedSlot && "bg-yellow-200 border-yellow-500 ring-2 ring-yellow-500 z-10"
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
                {/* NEW: Display Priority */}
                <span className={cn(
                  "px-1 py-0.5 rounded-full text-white text-[8px] font-bold mt-0.5",
                  taskInSlot.priority === 4 && "bg-red-500",
                  taskInSlot.priority === 3 && "bg-orange-500",
                  taskInSlot.priority === 2 && "bg-yellow-500",
                  taskInSlot.priority === 1 && "bg-gray-400",
                )}>
                  P{taskInSlot.priority}
                </span>
              </div>
            )}
          </div>
        );
      }
    }
    return slots;
  };

  const parsedDayScheduleDate = (typeof daySchedule.date === 'string' && daySchedule.date) ? parseISO(daySchedule.date) : new Date();

  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle className="text-xl font-bold text-gray-800">
          Agenda para {isValid(parsedDayScheduleDate) ? format(parsedDayScheduleDate, "EEEE, dd 'de' MMMM", { locale: ptBR }) : "Data Inválida"}
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <div ref={scrollAreaRef} className="overflow-y-auto h-[calc(100vh-300px)] custom-scroll relative">
          {renderTimeSlots()}
          {renderCurrentTimeLine()}
        </div>
      </CardContent>
    </Card>
  );
};

export default TimeSlotPlanner;