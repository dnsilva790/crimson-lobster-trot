"use client";

import React from "react";
import { DaySchedule, TimeBlock, ScheduledTask, TimeBlockType } from "@/lib/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { format, parseISO, setHours, setMinutes, addMinutes, isWithinInterval, parse } from "date-fns";
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
        const nextSlotTime = addMinutes(slotTime, 15);
        // const formattedNextTime = format(nextSlotTime, "HH:mm"); // Não usado diretamente aqui

        // Determine the type of time block for this slot
        let blockType: TimeBlockType = "work"; // Default to work
        let blockLabel: string | undefined;
        let blockColorClass = "bg-gray-50 hover:bg-gray-100";

        // Check if this slot falls within any defined time blocks
        for (const block of daySchedule.timeBlocks) {
          const blockStart = parse(block.start, "HH:mm", today);
          const blockEnd = parse(block.end, "HH:mm", today);

          // Check if the slot overlaps with the block
          if (isWithinInterval(slotTime, { start: blockStart, end: blockEnd }) ||
              isWithinInterval(nextSlotTime, { start: blockStart, end: blockEnd }) ||
              (slotTime <= blockStart && nextSlotTime >= blockEnd)) {
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

        // Check for scheduled tasks that start in this slot
        const tasksStartingInSlot = daySchedule.scheduledTasks.filter(task => {
          const taskStart = parse(task.start, "HH:mm", today);
          return taskStart.getTime() === slotTime.getTime();
        });

        // Check for scheduled tasks that span this slot
        const tasksSpanningSlot = daySchedule.scheduledTasks.filter(task => {
          const taskStart = parse(task.start, "HH:mm", today);
          const taskEnd = parse(task.end, "HH:mm", today);
          return isWithinInterval(slotTime, { start: taskStart, end: taskEnd }) &&
                 !tasksStartingInSlot.some(t => t.id === task.id); // Exclude tasks already handled by tasksStartingInSlot
        });

        // Determine if this slot is part of the suggested slot
        const isSuggestedSlot = parsedSuggestedStart && parsedSuggestedEnd &&
                                isWithinInterval(slotTime, { start: parsedSuggestedStart, end: parsedSuggestedEnd });

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
            
            {tasksStartingInSlot.length > 0 && (
              <div className="absolute inset-0 flex flex-col justify-center items-center bg-opacity-80 bg-indigo-200 text-indigo-800 text-center text-[10px] font-semibold overflow-hidden cursor-pointer"
                   onClick={(e) => { e.stopPropagation(); onSelectTask?.(tasksStartingInSlot[0]); }}>
                <span className="truncate w-full px-1" title={tasksStartingInSlot[0].content}>
                  {tasksStartingInSlot[0].content}
                </span>
              </div>
            )}
            {tasksSpanningSlot.length > 0 && (
              <div className="absolute inset-0 flex flex-col justify-center items-center bg-opacity-80 bg-indigo-100 text-indigo-700 text-center text-[10px] font-semibold overflow-hidden cursor-pointer"
                   onClick={(e) => { e.stopPropagation(); onSelectTask?.(tasksSpanningSlot[0]); }}>
                <span className="truncate w-full px-1" title={tasksSpanningSlot[0].content}>
                  {tasksSpanningSlot[0].content}
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