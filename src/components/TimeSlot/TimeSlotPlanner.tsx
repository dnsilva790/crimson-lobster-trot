"use client";

import React, { useState, useEffect, useRef, useMemo } from "react";
import { DaySchedule, TimeBlock, ScheduledTask, TimeBlockType } from "@/lib/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { format, parseISO, setHours, setMinutes, addMinutes, isWithinInterval, parse, isBefore, isAfter, isEqual, addDays, isToday, isValid } from "date-fns";
import { ptBR } from "date-fns/locale";
import { ExternalLink } from "lucide-react"; // Importar o ícone ExternalLink
import { Button } from "@/components/ui/button"; // Importar Button para o ícone

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

  const pixelsPerMinute = 40 / 15; // Each 15-min slot is h-10 (40px)

  // Helper function to calculate layout for scheduled tasks
  const calculateTaskLayout = (tasks: ScheduledTask[], date: Date): ScheduledTask[] => {
    const augmentedTasks: ScheduledTask[] = tasks.map(task => {
      const startDateTime = parse(task.start, "HH:mm", date);
      const endDateTime = parse(task.end, "HH:mm", date);

      if (!isValid(startDateTime) || !isValid(endDateTime)) {
        console.warn(`Invalid date/time for task: ${task.content}`);
        return { ...task, startDateTime, endDateTime, top: 0, height: 0, left: 0, width: 100, column: 0, maxColumns: 1 };
      }

      const top = (startDateTime.getHours() * 60 + startDateTime.getMinutes()) * pixelsPerMinute;
      const height = (task.estimatedDurationMinutes || 15) * pixelsPerMinute;

      return { ...task, startDateTime, endDateTime, top, height, left: 0, width: 100, column: 0, maxColumns: 1 };
    });

    // Sort tasks by start time
    augmentedTasks.sort((a, b) => (a.startDateTime?.getTime() || 0) - (b.startDateTime?.getTime() || 0));

    const columns: { end: Date; task: ScheduledTask }[][] = []; // Each column is an array of tasks
    
    for (const task of augmentedTasks) {
      let placed = false;
      for (let i = 0; i < columns.length; i++) {
        const column = columns[i];
        // Check if this task can fit in this column without overlapping the last task in it
        if (column.length === 0 || (task.startDateTime && task.startDateTime >= column[column.length - 1].end)) {
          task.column = i;
          column.push({ end: task.endDateTime!, task });
          placed = true;
          break;
        }
      }
      if (!placed) {
        // Create a new column
        task.column = columns.length;
        columns.push([{ end: task.endDateTime!, task }]);
      }
    }

    // Now, calculate maxColumns for each task based on actual overlaps
    for (const task of augmentedTasks) {
      let maxOverlapsAtAnyPoint = 1;
      for (const otherTask of augmentedTasks) {
        if (task.id === otherTask.id) continue;

        // Check if they overlap
        if (task.startDateTime! < otherTask.endDateTime! && task.endDateTime! > otherTask.startDateTime!) {
          // If they overlap, find the maximum number of tasks that are active during their overlap interval
          let currentOverlapCount = 0;
          const overlapStart = new Date(Math.max(task.startDateTime!.getTime(), otherTask.startDateTime!.getTime()));
          const overlapEnd = new Date(Math.min(task.endDateTime!.getTime(), otherTask.endDateTime!.getTime()));

          for (const checkTask of augmentedTasks) {
            if (checkTask.startDateTime! < overlapEnd && checkTask.endDateTime! > overlapStart) {
              currentOverlapCount++;
            }
          }
          maxOverlapsAtAnyPoint = Math.max(maxOverlapsAtAnyPoint, currentOverlapCount);
        }
      }
      task.maxColumns = maxOverlapsAtAnyPoint;
    }

    // Final pass to set left and width based on calculated columns and maxColumns
    for (const task of augmentedTasks) {
      task.width = 100 / (task.maxColumns || 1);
      task.left = (task.column || 0) * (task.width);
    }

    return augmentedTasks;
  };

  const parsedDayScheduleDate = (typeof daySchedule.date === 'string' && daySchedule.date) ? parseISO(daySchedule.date) : new Date();

  const tasksWithLayout = useMemo(() => {
    return calculateTaskLayout(daySchedule.scheduledTasks, parsedDayScheduleDate);
  }, [daySchedule.scheduledTasks, parsedDayScheduleDate]);


  const renderTimeSlots = () => {
    const slots: JSX.Element[] = [];
    const today = parsedDayScheduleDate;

    const parsedSuggestedStart = (typeof suggestedSlotStart === 'string' && suggestedSlotStart) ? parse(suggestedSlotStart, "HH:mm", today) : null;
    const parsedSuggestedEnd = (typeof suggestedSlotEnd === 'string' && suggestedSlotEnd) ? parse(suggestedSlotEnd, "HH:mm", today) : null;

    // Render the 15-minute time slots (backgrounds)
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
        const isSlotCoveredByTask = tasksWithLayout.some(task => {
            if (!task.startDateTime || !task.endDateTime) return false;
            return (slotTime < task.endDateTime && nextSlotTime > task.startDateTime);
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
            <span className="font-medium text-gray-600 bg-white z-40 relative pr-2">
              {formattedTime}
            </span>
            {blockLabel && <span className="text-gray-500 italic">{blockLabel}</span>}
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
          Agenda para {isValid(parsedDayScheduleDate) ? format(parsedDayScheduleDate, "EEEE, dd 'de' MMMM", { locale: ptBR }) : "Data Inválida"}
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <div ref={scrollAreaRef} className="overflow-y-auto h-[calc(100vh-300px)] custom-scroll relative">
          {renderTimeSlots()}
          {tasksWithLayout.map(task => (
            <div
              key={`scheduled-task-${task.id}`}
              className="absolute flex flex-col justify-center items-center bg-indigo-100 bg-opacity-70 text-indigo-800 text-center text-sm font-semibold overflow-hidden cursor-pointer z-30 rounded-md border border-indigo-300 p-1 group" // Adicionado 'group'
              style={{
                top: `${task.top}px`,
                height: `${task.height}px`,
                left: `${task.left}%`,
                width: `${task.width}%`,
              }}
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
                {task.originalTask && 'url' in task.originalTask && task.originalTask.url && (
                  <a 
                    href={task.originalTask.url} 
                    target="_blank" 
                    rel="noopener noreferrer" 
                    onClick={(e) => e.stopPropagation()} // Previne que o clique no link acione o onSelectTask do pai
                    className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity" // Visível no hover
                  >
                    <Button variant="ghost" size="icon" className="h-6 w-6 text-indigo-600 hover:bg-indigo-200">
                      <ExternalLink className="h-4 w-4" />
                    </Button>
                  </a>
                )}
            </div>
          ))}
          {renderCurrentTimeLine()}
        </div>
      </CardContent>
    </Card>
  );
};

export default TimeSlotPlanner;