"use client";

import React, { useMemo, useState, useCallback, useRef, useEffect } from "react";
import { TodoistTask } from "@/lib/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { format, parseISO, isValid, setHours, setMinutes, addMinutes, isToday, isPast, startOfDay, addDays, isSameDay, subDays, differenceInDays, parse } from "date-fns";
import { ptBR } from "date-fns/locale";
import { CalendarIcon, Clock, ExternalLink, ListTodo, ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";

interface SubtaskTimelineViewProps {
  subtasks: TodoistTask[];
  mainTaskDueDate?: Date | null; // Optional: to center the timeline around the main task's due date
}

const PRIORITY_COLORS: Record<1 | 2 | 3 | 4, string> = {
  4: "bg-red-500", // P1 - Urgente
  3: "bg-orange-500", // P2 - Alto
  2: "bg-yellow-500", // P3 - Médio
  1: "bg-gray-400", // P4 - Baixo
};

const PRIORITY_LABELS: Record<1 | 2 | 3 | 4, string> = {
  4: "P1",
  3: "P2",
  2: "P3",
  1: "P4",
};

const MINUTES_IN_DAY = 24 * 60;
const PIXELS_PER_MINUTE = 1.5; // 1.5px per minute = 90px per hour
const NUM_DAYS_TO_DISPLAY = 7; // Display 7 days at a time
const DAY_COLUMN_WIDTH = 150; // Width of each day column in pixels

const SubtaskTimelineView: React.FC<SubtaskTimelineViewProps> = ({ subtasks, mainTaskDueDate }) => {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [viewStartDate, setViewStartDate] = useState<Date>(() => {
    const today = startOfDay(new Date());
    if (mainTaskDueDate && isValid(mainTaskDueDate)) {
      // Start the view 3 days before the main task due date
      return subDays(startOfDay(mainTaskDueDate), 3);
    }
    return today;
  });

  const displayedDates = useMemo(() => {
    const dates: Date[] = [];
    for (let i = 0; i < NUM_DAYS_TO_DISPLAY; i++) {
      dates.push(addDays(viewStartDate, i));
    }
    return dates;
  }, [viewStartDate]);

  const tasksByDay = useMemo(() => {
    const map = new Map<string, (TodoistTask & { startMinutes: number; top: number; height: number; endMinutes: number; })[]>();
    
    displayedDates.forEach(day => {
      const dayKey = format(day, 'yyyy-MM-dd');
      map.set(dayKey, []);
    });

    subtasks
      .filter(task => task.due?.datetime || task.due?.date) // Only tasks with a due date/time
      .forEach(task => {
        let startDateTime: Date | null = null;
        let durationMinutes = task.estimatedDurationMinutes || 30; // Default to 30 min if not specified

        if (task.due?.datetime && isValid(parseISO(task.due.datetime))) {
          startDateTime = parseISO(task.due.datetime);
        } else if (task.due?.date && isValid(parseISO(task.due.date))) {
          // If only date is available, set a default time (e.g., 9 AM)
          startDateTime = setHours(setMinutes(parseISO(task.due.date), 0), 9);
        }

        if (!startDateTime || !isValid(startDateTime)) {
          return; // Skip invalid dates
        }

        const taskDayKey = format(startOfDay(startDateTime), 'yyyy-MM-dd');
        if (map.has(taskDayKey)) {
          const startMinutes = startDateTime.getHours() * 60 + startDateTime.getMinutes();
          const top = startMinutes * PIXELS_PER_MINUTE;
          const height = durationMinutes * PIXELS_PER_MINUTE;

          map.get(taskDayKey)?.push({
            ...task,
            startMinutes,
            top,
            height,
            endMinutes: startMinutes + durationMinutes,
          });
        }
      });
    
    // Sort tasks within each day by start time
    map.forEach(tasks => tasks.sort((a, b) => a.startMinutes - b.startMinutes));

    return map;
  }, [subtasks, displayedDates]);

  const tasksWithoutDueDate = useMemo(() => {
    return subtasks.filter(task => !task.due?.datetime && !task.due?.date);
  }, [subtasks]);

  const handlePreviousPeriod = useCallback(() => {
    setViewStartDate(prev => subDays(prev, NUM_DAYS_TO_DISPLAY));
  }, []);

  const handleNextPeriod = useCallback(() => {
    setViewStartDate(prev => addDays(prev, NUM_DAYS_TO_DISPLAY));
  }, []);

  const renderCurrentTimeLine = (day: Date) => {
    if (!isToday(day)) return null;

    const now = new Date();
    const currentMinutes = now.getHours() * 60 + now.getMinutes();
    const topPosition = currentMinutes * PIXELS_PER_MINUTE;

    return (
      <div
        className="absolute left-0 right-0 h-0.5 bg-red-500 z-10"
        style={{ top: `${topPosition}px` }}
      >
        <div className="absolute -left-1 -top-2 w-3 h-3 rounded-full bg-red-500"></div>
        <span className="absolute -right-10 -top-2 text-xs text-red-600 font-semibold">
          {format(now, "HH:mm")}
        </span>
      </div>
    );
  };

  if (subtasks.length === 0) {
    return (
      <p className="text-gray-500 italic">Nenhuma subtarefa encontrada.</p>
    );
  }

  return (
    <Card className="p-4">
      <CardHeader>
        <CardTitle className="text-xl font-bold mb-2 flex items-center gap-2">
          <ListTodo className="h-5 w-5 text-indigo-600" /> Cronograma Detalhado (Horas)
        </CardTitle>
        <div className="flex items-center justify-between mt-2">
          <Button variant="outline" size="sm" onClick={handlePreviousPeriod}>
            <ChevronLeft className="h-4 w-4" /> Anterior
          </Button>
          <p className="text-sm text-gray-600 font-semibold">
            {format(displayedDates[0], "dd/MM", { locale: ptBR })} - {format(displayedDates[NUM_DAYS_TO_DISPLAY - 1], "dd/MM", { locale: ptBR })}
          </p>
          <Button variant="outline" size="sm" onClick={handleNextPeriod}>
            Próximo <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <div ref={scrollRef} className="flex overflow-x-auto border border-gray-200 rounded-md h-[400px]">
          {/* Time markers column (Fixed Left) */}
          <div className="relative w-12 flex-shrink-0 border-r border-gray-200 bg-white sticky left-0 z-30">
            <div className="h-10 border-b border-gray-200 bg-white"></div>
            <div style={{ height: `${MINUTES_IN_DAY * PIXELS_PER_MINUTE}px` }}>
              {Array.from({ length: 24 }).map((_, hour) => (
                <div key={`marker-${hour}`} className="absolute right-1 text-xs text-gray-500" style={{ top: `${hour * 60 * PIXELS_PER_MINUTE}px` }}>
                  {format(setHours(new Date(), hour), "HH:mm")}
                </div>
              ))}
            </div>
          </div>

          {/* Daily timeline columns (Scrollable) */}
          {displayedDates.map(day => {
            const dayKey = format(day, 'yyyy-MM-dd');
            const tasksOnThisDay = tasksByDay.get(dayKey) || [];
            const isCurrentDay = isSameDay(day, new Date());

            return (
              <div key={dayKey} className={cn("relative flex-shrink-0 border-r border-gray-200", isCurrentDay && "bg-blue-50")} style={{ minWidth: `${DAY_COLUMN_WIDTH}px`, width: `${DAY_COLUMN_WIDTH}px` }}>
                <div className={cn("sticky top-0 z-20 p-1 text-center text-sm font-semibold border-b", isCurrentDay ? "bg-blue-100 text-blue-800" : "bg-gray-100 text-gray-700")}>
                  {format(day, "EEE, dd/MM", { locale: ptBR })}
                </div>
                <div className="relative" style={{ height: `${MINUTES_IN_DAY * PIXELS_PER_MINUTE}px` }}>
                  {/* Background grid lines for hours */}
                  {Array.from({ length: 24 }).map((_, hour) => (
                    <div key={`grid-${dayKey}-${hour}`} className="absolute left-0 right-0 border-t border-gray-100" style={{ top: `${hour * 60 * PIXELS_PER_MINUTE}px` }}></div>
                  ))}
                  {tasksOnThisDay.map((task, index) => (
                    <div
                      key={task.id}
                      className={cn(
                        "absolute left-1 right-1 bg-blue-100 border border-blue-300 rounded-sm p-1 text-xs overflow-hidden",
                        "hover:bg-blue-200 transition-colors duration-100",
                        isPast(addMinutes(parseISO(task.due?.datetime || task.due?.date!), task.estimatedDurationMinutes || 0)) && "opacity-60 bg-gray-100 border-gray-300"
                      )}
                      style={{
                        top: `${task.top}px`,
                        height: `${task.height}px`,
                        zIndex: 5 + index, // Simple stacking
                      }}
                      title={`${task.content} (${task.estimatedDurationMinutes} min)`}
                    >
                      <div className="font-semibold text-gray-800 truncate">{task.content}</div>
                      <div className="flex items-center justify-between text-gray-600 mt-0.5">
                        <span className="flex items-center gap-1">
                          <Clock className="h-3 w-3" /> {task.estimatedDurationMinutes} min
                        </span>
                        <span
                          className={cn(
                            "px-1 py-0.5 rounded-full text-white text-xs font-medium",
                            PRIORITY_COLORS[task.priority],
                          )}
                        >
                          {PRIORITY_LABELS[task.priority]}
                        </span>
                      </div>
                      <a 
                        href={task.url} 
                        target="_blank" 
                        rel="noopener noreferrer" 
                        className="absolute top-1 right-1 text-blue-500 hover:text-blue-700 opacity-0 hover:opacity-100 transition-opacity"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    </div>
                  ))}
                  {renderCurrentTimeLine(day)}
                </div>
              </div>
            );
          })}
        </div>

        {tasksWithoutDueDate.length > 0 && (
          <div className="mt-4 p-3 border border-gray-200 rounded-md bg-gray-50">
            <h4 className="font-semibold text-gray-700 mb-2">Subtarefas sem Prazo Definido:</h4>
            <ul className="list-disc list-inside text-sm text-gray-600 space-y-1">
              {tasksWithoutDueDate.map(task => (
                <li key={task.id} className="flex items-center justify-between">
                  <span>{task.content}</span>
                  <a 
                    href={task.url} 
                    target="_blank" 
                    rel="noopener noreferrer" 
                    className="ml-2 text-blue-500 hover:text-blue-700"
                  >
                    <ExternalLink className="h-3 w-3 inline-block" />
                  </a>
                </li>
              ))}
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default SubtaskTimelineView;