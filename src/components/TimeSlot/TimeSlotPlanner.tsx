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
    const scheduledTaskElements: JSX.Element[] = [];
    const today = (typeof daySchedule.date === 'string' && daySchedule.date) ? parseISO(daySchedule.date) : new Date(); // Fallback to current date if invalid

    const parsedSuggestedStart = (typeof suggestedSlotStart === 'string' && suggestedSlotStart) ? parse(suggestedSlotStart, "HH:mm", today) : null;
    const parsedSuggestedEnd = (typeof suggestedSlotEnd === 'string' && suggestedSlotEnd) ? parse(suggestedSlotEnd, "HH:mm", today) : null;

    const pixelsPerMinute = 40 / 15; // Each 15-min slot is h-10 (40px)

    // Render all scheduled tasks as merged blocks first
    daySchedule.scheduledTasks.forEach(task => {
        const taskStart = parse(task.start, "HH:mm", today);
        const taskEnd = parse(task.end, "HH:mm", today);

        if (!isValid(taskStart) || !isValid(taskEnd)) {
            console.warn(`TimeSlotPlanner: Scheduled task ${task.content} has invalid start/end times.`);
            return;
        }

        const startMinutes = taskStart.getHours() * 60 + taskStart.getMinutes();
        const durationMinutes = task.estimatedDurationMinutes || 15; // Fallback to 15 min if not defined

        const topPosition = startMinutes * pixelsPerMinute;
        const height = durationMinutes * pixelsPerMinute;

        scheduledTaskElements.push(
            <div
                key={`scheduled-task-${task.id}`}
                className="absolute left-0 right-0 flex flex-col justify-center items-center bg-indigo-100 bg-opacity-70 text-indigo-800 text-center text-sm font-semibold overflow-hidden cursor-pointer z-30 rounded-md border border-indigo-300 p-1" // Adjusted styling
                style={{ top: `${topPosition}px`, height: `${height}px` }}
                onClick={(e) => { e.stopPropagation(); onSelectTask?.(task); }}
            >
                <span className="truncate w-full px-1" title={task.content}>
                    {task.content}
                </span>
                <span className={cn(
                    "px-1 py-0.5 rounded-full text-white text-xs font-bold mt-0.5",
                    task.priority === 4 && "bg-red-500",
                    task.priority === 3 && "bg-orange-500",
                    task.priority === 2 && "bg-yellow-500",
                    task.priority === 1 && "bg-gray-400",
                )}>
                    P{task.priority}
                </span>
            </div>
        );
    });

    // Then, render the 15-minute time slots (backgrounds)
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

        // Check if this slot is covered by an already rendered merged task block
        const isSlotCoveredByTask = daySchedule.scheduledTasks.some(task => {
            const taskStart = parse(task.start, "HH:mm", today);
            const taskEnd = parse(task.end, "HH:mm", today);
            if (!isValid(taskStart) || !isValid(taskEnd)) return false;
            return (slotTime < taskEnd && nextSlotTime > taskStart);
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
              onSelectSlot && !isSlotCoveredByTask && "cursor-pointer", // Only clickable if not covered by a task
              isSuggestedSlot && "bg-yellow-200 border-yellow-500 ring-2 ring-yellow-500 z-10"
            )}
            onClick={() => onSelectSlot?.(formattedTime, blockType)}
          >
            <span className="font-medium text-gray-600 bg-white z-40 relative pr-2"> {/* Added bg-white z-40 relative pr-2 */}
              {formattedTime}
            </span>
            {blockLabel && <span className="text-gray-500 italic">{blockLabel}</span>}
          </div>
        );
      }
    }
    return [...slots, ...scheduledTaskElements]; // Render tasks on top of slots
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