"use client";

import React, { useState, useEffect, useRef, useMemo } from "react";
import { DaySchedule, TimeBlock, ScheduledTask, TimeBlockType, TodoistTask } from "@/lib/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn, getSolicitante, getDelegateNameFromLabels } from "@/lib/utils"; // Importar utilitários
import { format, parseISO, setHours, setMinutes, addMinutes, isWithinInterval, parse, isBefore, isAfter, isEqual, addDays, isToday, isValid } from "date-fns";
import { ptBR } from "date-fns/locale";
import { ExternalLink, CheckCircle, Repeat2, User, Users } from "lucide-react"; // Importar User e Users
import { Button } from "@/components/ui/button";
import { useDrag, useDrop } from 'react-dnd';

interface TimeSlotPlannerProps {
  daySchedule: DaySchedule;
  onSelectSlot?: (time: string, type: TimeBlockType) => void;
  onSelectTask?: (task: ScheduledTask) => void;
  onCompleteTask?: (taskId: string) => Promise<void>;
  onDropTask: (draggedTask: ScheduledTask, newStartTime: string) => void; // Nova prop para lidar com o drop
  currentDate: Date; // Adicionado para o contexto de data
  suggestedSlotStart?: string | null;
  suggestedSlotEnd?: string | null;
}

const DRAG_ITEM_TYPE = 'SCHEDULED_TASK'; // Definir o tipo de item arrastável

const TimeSlotPlanner: React.FC<TimeSlotPlannerProps> = ({
  daySchedule,
  onSelectSlot,
  onSelectTask,
  onCompleteTask,
  onDropTask, // Usar a nova prop
  currentDate, // Usar a nova prop
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

  const renderCurrentTimeLine = () => {
    const parsedDayScheduleDate = (typeof daySchedule.date === 'string' && daySchedule.date) ? parseISO(daySchedule.date) : null;
    if (!parsedDayScheduleDate || !isValid(parsedDayScheduleDate) || !isToday(parsedDayScheduleDate)) {
      return null;
    }

    const now = currentTime;
    const totalMinutesToday = now.getHours() * 60 + now.getMinutes();
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

  useEffect(() => {
    const parsedDayScheduleDate = (typeof daySchedule.date === 'string' && daySchedule.date) ? parseISO(daySchedule.date) : null;
    if (scrollAreaRef.current && parsedDayScheduleDate && isValid(parsedDayScheduleDate) && isToday(parsedDayScheduleDate)) {
      const now = new Date();
      const totalMinutesToday = now.getHours() * 60 + now.getMinutes();
      const pixelsPerMinute = 40 / 15;
      const topPosition = totalMinutesToday * pixelsPerMinute;
      
      scrollAreaRef.current.scrollTo({
        top: Math.max(0, topPosition - scrollAreaRef.current.clientHeight / 2),
        behavior: 'smooth'
      });
    }
  }, [daySchedule.date]);

  const pixelsPerMinute = 40 / 15;

  const calculateTaskLayout = (tasks: ScheduledTask[], date: Date): ScheduledTask[] => {
    const augmentedTasks: ScheduledTask[] = tasks.map(task => {
      const startDateTime = parse(task.start, "HH:mm", date);
      const endDateTime = addMinutes(startDateTime, task.estimatedDurationMinutes || 15); // Use estimatedDurationMinutes for end time calculation

      if (!isValid(startDateTime) || !isValid(endDateTime)) {
        console.warn(`Invalid date/time for task: ${task.content}`);
        return { ...task, startDateTime, endDateTime, top: 0, height: 0, left: 0, width: 100, column: 0, maxColumns: 1 };
      }

      const top = (startDateTime.getHours() * 60 + startDateTime.getMinutes()) * pixelsPerMinute;
      const height = (task.estimatedDurationMinutes || 15) * pixelsPerMinute;

      return { ...task, startDateTime, endDateTime, top, height, left: 0, width: 100, column: 0, maxColumns: 1 };
    });

    augmentedTasks.sort((a, b) => (a.startDateTime?.getTime() || 0) - (b.startDateTime?.getTime() || 0));

    const columns: { end: Date; task: ScheduledTask }[][] = [];
    
    for (const task of augmentedTasks) {
      let placed = false;
      for (let i = 0; i < columns.length; i++) {
        const column = columns[i];
        if (column.length === 0 || (task.startDateTime && task.startDateTime >= column[column.length - 1].end)) {
          task.column = i;
          column.push({ end: task.endDateTime!, task });
          placed = true;
          break;
        }
      }
      if (!placed) {
        task.column = columns.length;
        columns.push([{ end: task.endDateTime!, task }]);
      }
    }

    for (const task of augmentedTasks) {
      let maxOverlapsAtAnyPoint = 1;
      for (const otherTask of augmentedTasks) {
        if (task.id === otherTask.id) continue;

        if (task.startDateTime! < otherTask.endDateTime! && task.endDateTime! > otherTask.startDateTime!) {
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

        const isSlotCoveredByTask = tasksWithLayout.some(task => {
            if (!task.startDateTime || !task.endDateTime) return false;
            return (slotTime < task.endDateTime && nextSlotTime > task.startDateTime);
        });

        const isSuggestedSlot = parsedSuggestedStart && parsedSuggestedEnd && isValid(parsedSuggestedStart) && isValid(parsedSuggestedEnd) &&
                                isWithinInterval(slotTime, { start: parsedSuggestedStart, end: parsedSuggestedEnd }) &&
                                (isBefore(nextSlotTime, parsedSuggestedEnd) || isEqual(nextSlotTime, parsedSuggestedEnd));

        // Make time slots droppable
        const [{ isOver }, drop] = useDrop(() => ({
          accept: DRAG_ITEM_TYPE,
          drop: (item: ScheduledTask) => {
            console.log("DROP DETECTED on slot:", formattedTime, "item:", item);
            onDropTask(item, formattedTime);
          },
          collect: (monitor) => ({
            isOver: monitor.isOver(),
          }),
        }), [formattedTime, onDropTask, daySchedule.scheduledTasks]); // Adicionado daySchedule.scheduledTasks para re-renderizar o drop target se as tarefas mudarem

        slots.push(
          <div
            key={formattedTime}
            ref={drop} // Atribuir ref do drop
            className={cn(
              "relative p-1 border-b border-gray-200 text-xs h-10 flex items-center justify-between",
              blockColorClass,
              onSelectSlot && !isSlotCoveredByTask && "cursor-pointer",
              isSuggestedSlot && "bg-yellow-200 border-yellow-500 ring-2 ring-yellow-500 z-10",
              isOver && "bg-indigo-200 border-indigo-500 ring-2 ring-indigo-500" // Estilo quando arrastado sobre
            )}
            onClick={() => onSelectSlot?.(formattedTime, blockType)}
          >
            {isOver && <span className="absolute inset-0 bg-indigo-300 opacity-50 z-50"></span>} {/* Visual feedback */}
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
          {tasksWithLayout.map(task => {
            // Make scheduled tasks draggable
            const [{ isDragging }, drag] = useDrag(() => ({
              type: DRAG_ITEM_TYPE,
              item: task, // Pass the entire task object
              collect: (monitor) => {
                const dragging = monitor.isDragging();
                if (dragging) {
                  console.log("DRAGGING task:", task.content);
                }
                return { isDragging: dragging };
              },
            }), [task]);

            const isRecurring = task.originalTask && 'due' in task.originalTask && task.originalTask.due?.is_recurring === true;
            
            const originalTask = task.originalTask as TodoistTask | undefined;
            const solicitante = originalTask ? getSolicitante(originalTask) : undefined;
            const delegateName = originalTask ? getDelegateNameFromLabels(originalTask.labels) : undefined;

            return (
              <div
                key={`scheduled-task-${task.id}`}
                ref={drag} // Atribuir ref do drag
                className={cn(
                  "absolute flex flex-col justify-between bg-indigo-100 bg-opacity-70 text-indigo-800 text-sm font-semibold overflow-hidden cursor-pointer z-30 rounded-md border border-indigo-300 p-1 group",
                  isDragging ? "opacity-50 border-dashed" : "opacity-100" // Estilo quando arrastando
                )}
                style={{
                  top: `${task.top}px`,
                  height: `${task.height}px`,
                  left: `${task.left}%`,
                  width: `${task.width}%`,
                  minHeight: '20px', 
                }}
                onClick={(e) => { e.stopPropagation(); onSelectTask?.(task); }}
              >
                  {/* Top Row: Priority, Content, Recurrence */}
                  <div className="flex items-center w-full">
                      <span className={cn(
                          "flex-shrink-0 px-1 py-0.5 rounded-full text-white text-xs font-bold mr-1",
                          task.priority === 4 && "bg-red-500",
                          task.priority === 3 && "bg-orange-500",
                          task.priority === 2 && "bg-yellow-500",
                          task.priority === 1 && "bg-gray-400",
                          task.height < 25 && "hidden" // Esconde a prioridade se a barra for muito pequena
                      )}>
                          P{task.priority}
                      </span>
                      <span 
                        className={cn(
                          "truncate flex-grow px-1 leading-tight",
                          task.height < 25 ? "text-xs" : "text-sm" // Reduz o tamanho da fonte para tarefas muito curtas
                        )} 
                        title={task.content}
                      >
                          {task.content}
                      </span>
                      {isRecurring && (
                        <Repeat2 
                          className={cn(
                            "h-3 w-3 text-purple-600 flex-shrink-0 mr-1",
                            task.height < 25 && "hidden"
                          )} 
                          title="Tarefa Recorrente"
                        />
                      )}
                  </div>
                  
                  {/* Bottom Row: Solicitante/Delegate (if space allows) */}
                  {(solicitante || delegateName) && task.height > 40 && (
                      <div className="flex flex-wrap gap-x-2 text-xs text-indigo-900/80 mt-auto">
                          {solicitante && (
                              <span className="flex items-center gap-0.5">
                                  <User className="h-3 w-3 text-blue-600" /> {solicitante.split(' ')[0]}
                              </span>
                          )}
                          {delegateName && (
                              <span className="flex items-center gap-0.5">
                                  <Users className="h-3 w-3 text-orange-600" /> {delegateName.split(' ')[0]}
                              </span>
                          )}
                      </div>
                  )}

                  {/* Action Buttons (Hover) */}
                  {task.originalTask && 'url' in task.originalTask && task.originalTask.url && (
                    <div className="absolute top-1 right-1 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      {onCompleteTask && (
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          onClick={(e) => { e.stopPropagation(); onCompleteTask(task.taskId); }} 
                          className="h-6 w-6 text-green-600 hover:bg-green-200"
                        >
                          <CheckCircle className="h-4 w-4" />
                        </Button>
                      )}
                      <a 
                        href={task.originalTask.url} 
                        target="_blank" 
                        rel="noopener noreferrer" 
                        onClick={(e) => e.stopPropagation()}
                      >
                        <Button variant="ghost" size="icon" className="h-6 w-6 text-indigo-600 hover:bg-indigo-200">
                          <ExternalLink className="h-4 w-4" />
                        </Button>
                      </a>
                    </div>
                  )}
              </div>
            );
          })}
          {renderCurrentTimeLine()}
        </div>
      </CardContent>
    </Card>
  );
};

export default TimeSlotPlanner;