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
  onSelectTask?: (task: ScheduledTask) => void;
}

const TimeSlotPlanner: React.FC<TimeSlotPlannerProps> = ({
  daySchedule,
  onSelectSlot,
  onSelectTask,
}) => {
  const renderTimeSlots = () => {
    const slots: JSX.Element[] = [];
    const today = parseISO(daySchedule.date); // Use the date from daySchedule

    for (let hour = 0; hour < 24; hour++) {
      for (let minute = 0; minute < 60; minute += 15) {
        const slotTime = setMinutes(setHours(today, hour), minute);
        const formattedTime = format(slotTime, "HH:mm");
        const nextSlotTime = addMinutes(slotTime, 15);
        const formattedNextTime = format(nextSlotTime, "HH:mm");

        // Determine the type of time block for this slot
        let blockType: TimeBlockType = "work"; // Default to work
        let blockLabel: string | undefined;
        let blockColorClass = "bg-gray-50 hover:bg-gray-100";

        const currentInterval = { start: slotTime, end: nextSlotTime };

        // Check if this slot falls within any defined time blocks
        for (const block of daySchedule.timeBlocks) {
          const blockStart = parse(block.start, "HH:mm", today);
          const blockEnd = parse(block.end, "HH:mm", today);

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

        // Check for scheduled tasks in this slot
        const tasksInSlot = daySchedule.scheduledTasks.filter(task => {
          const taskStart = parse(task.start, "HH:mm", today);
          const taskEnd = parse(task.end, "HH:mm", today);
          return (
            isWithinInterval(slotTime, { start: taskStart, end: taskEnd }) ||
            isWithinInterval(nextSlotTime, { start: taskStart, end: taskEnd }) ||
            (slotTime <= taskStart && nextSlotTime >= taskEnd)
          );
        });

        slots.push(
          <div
            key={formattedTime}
            className={cn(
              "relative p-1 border-b border-gray-200 text-xs h-10 flex items-center justify-between",
              blockColorClass,
              onSelectSlot && "cursor-pointer"
            )}
            onClick={() => onSelectSlot?.(formattedTime, blockType)}
          >
            <span className="font-medium text-gray-600">{formattedTime}</span>
            {blockLabel && <span className="text-gray-500 italic">{blockLabel}</span>}
            {tasksInSlot.length > 0 && (
              <div className="absolute inset-0 flex flex-col justify-center items-center bg-opacity-70 bg-indigo-200 text-indigo-800 text-center text-[10px] font-semibold overflow-hidden">
                {tasksInSlot.map(task => (
                  <span key={task.id} className="truncate w-full px-1" title={task.content}>
                    {task.content}
                  </span>
                ))}
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