"use client";

import React from "react";
import { DaySchedule, TimeBlock, ScheduledTask, TimeBlockType } from "@/lib/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { format, parseISO, setHours, setMinutes, addMinutes, isWithinInterval, parse, isBefore, isAfter, isEqual, addDays } from "date-fns";
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
        <div className="overflow-y-auto h-[calc(100vh-300px)] custom-scroll"> {/* Adjust height as needed */}
          {renderTimeSlots()}
        </div>
      </CardContent>
    </Card>
  );
};

export default TimeSlotPlanner;