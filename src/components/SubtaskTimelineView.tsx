"use client";

import React, { useMemo, useState, useCallback, useRef, useEffect } from "react";
import { TodoistTask } from "@/lib/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { format, parseISO, isValid, setHours, setMinutes, addMinutes, isToday, isPast, startOfDay, isSameDay, differenceInDays } from "date-fns";
import { ptBR } from "date-fns/locale";
import { ExternalLink, ListTodo, Clock, CalendarIcon } from "lucide-react";
import { Button } from "@/components/ui/button";

interface SubtaskTimelineViewProps {
  subtasks: TodoistTask[];
  mainTaskDueDate?: Date | null;
}

const PRIORITY_COLORS: Record<1 | 2 | 3 | 4, string> = {
  4: "bg-red-500",
  3: "bg-orange-500",
  2: "bg-yellow-500",
  1: "bg-gray-400",
};

const PRIORITY_LABELS: Record<1 | 2 | 3 | 4, string> = {
  4: "P1",
  3: "P2",
  2: "P3",
  1: "P4",
};

const MINUTES_IN_DAY = 24 * 60;
const PIXELS_PER_MINUTE = 2; // 2px per minute = 120px per hour (Total width: 2880px)
const TASK_ROW_HEIGHT = 40; // Height of each task row

const SubtaskTimelineView: React.FC<SubtaskTimelineViewProps> = ({ subtasks }) => {
  const today = startOfDay(new Date());

  const tasksWithLayout = useMemo(() => {
    // Filter tasks that are due today or have a specific time today
    const tasksDueToday = subtasks
      .filter(task => {
        const dueDateString = task.due?.datetime || task.due?.date;
        if (!dueDateString) return false;
        const dueDate = startOfDay(parseISO(dueDateString));
        return isValid(dueDate) && isSameDay(dueDate, today);
      })
      .map(task => {
        let startDateTime: Date | null = null;
        let durationMinutes = task.estimatedDurationMinutes || 30;

        if (task.due?.datetime && isValid(parseISO(task.due.datetime))) {
          startDateTime = parseISO(task.due.datetime);
        } else if (task.due?.date && isValid(parseISO(task.due.date))) {
          // If only date is available, use 9 AM as default start time
          startDateTime = setHours(setMinutes(parseISO(task.due.date), 0), 9);
        }

        if (!startDateTime || !isValid(startDateTime)) return null;

        const startMinutes = startDateTime.getHours() * 60 + startDateTime.getMinutes();
        
        // Calculate horizontal position and width
        const left = startMinutes * PIXELS_PER_MINUTE;
        const width = durationMinutes * PIXELS_PER_MINUTE;

        return {
          ...task,
          startMinutes,
          left,
          width,
          durationMinutes,
        };
      })
      .filter(Boolean) as (TodoistTask & { startMinutes: number; left: number; width: number; durationMinutes: number; })[];

    // Sort tasks by start time
    tasksDueToday.sort((a, b) => a.startMinutes - b.startMinutes);

    return tasksDueToday;
  }, [subtasks, today]);

  const tasksWithoutDueDate = useMemo(() => {
    return subtasks.filter(task => !task.due?.datetime && !task.due?.date);
  }, [subtasks]);

  const totalTimelineWidth = MINUTES_IN_DAY * PIXELS_PER_MINUTE;
  const totalHeight = tasksWithLayout.length * TASK_ROW_HEIGHT;

  const renderHourMarkers = () => {
    const markers: JSX.Element[] = [];
    for (let hour = 0; hour < 24; hour++) {
      const leftPosition = hour * 60 * PIXELS_PER_MINUTE;
      markers.push(
        <div 
          key={`hour-marker-${hour}`} 
          className="absolute top-0 bottom-0 border-l border-gray-200 text-xs text-gray-500 pt-1 px-1"
          style={{ left: `${leftPosition}px`, width: `${60 * PIXELS_PER_MINUTE}px` }}
        >
          {format(setHours(today, hour), "HH:mm")}
        </div>
      );
    }
    return markers;
  };

  const renderTodayLine = () => {
    const now = new Date();
    if (!isToday(now)) return null;

    const currentMinutes = now.getHours() * 60 + now.getMinutes();
    const leftPosition = currentMinutes * PIXELS_PER_MINUTE;

    return (
      <div
        className="absolute top-0 bottom-0 w-0.5 bg-red-600 z-20"
        style={{ left: `${leftPosition}px` }}
      ></div>
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
          <ListTodo className="h-5 w-5 text-indigo-600" /> Cronograma de Execução (Gantt - Hoje)
        </CardTitle>
        <p className="text-sm text-gray-600">
          Visualização detalhada das subtarefas com prazo para hoje.
        </p>
      </CardHeader>
      <CardContent className="p-0">
        <div className="flex border border-gray-200 rounded-md overflow-hidden">
          
          {/* Task List Column (Y-Axis Labels) */}
          <div className="sticky left-0 z-10 w-48 flex-shrink-0 bg-white border-r border-gray-200 divide-y divide-gray-100">
            <div className="h-10 flex items-center p-2 text-sm font-semibold border-b border-gray-200">Subtarefas (Hoje)</div>
            <div style={{ height: `${totalHeight}px` }}>
                {tasksWithLayout.map((task, index) => (
                    <div 
                        key={task.id} 
                        className={cn(
                            "w-full h-10 flex items-center p-2 text-sm truncate",
                            index % 2 === 1 ? "bg-gray-50" : "bg-white"
                        )}
                        title={task.content}
                    >
                        {task.content}
                    </div>
                ))}
            </div>
          </div>

          {/* Gantt Chart Area (X-Axis Timeline) */}
          <div className="flex-grow overflow-x-auto">
            {/* Timeline Header (Hours) */}
            <div className="relative h-10 flex-shrink-0 border-b border-gray-200" style={{ width: `${totalTimelineWidth}px` }}>
              {renderHourMarkers()}
            </div>

            {/* Task Bars Container */}
            <div className="relative" style={{ height: `${totalHeight}px`, minWidth: `${totalTimelineWidth}px` }}>
              {/* Horizontal Row Separators */}
              {tasksWithLayout.map((_, index) => (
                <div 
                  key={`row-sep-${index}`} 
                  className="absolute left-0 right-0 border-t border-gray-100"
                  style={{ top: `${index * TASK_ROW_HEIGHT}px` }}
                ></div>
              ))}

              {/* Task Bars */}
              {tasksWithLayout.map((task, index) => (
                <div
                  key={`bar-${task.id}`}
                  className={cn(
                    "absolute h-8 rounded-md p-1 text-xs font-semibold flex items-center justify-start overflow-hidden shadow-md transition-all duration-300 z-10",
                    PRIORITY_COLORS[task.priority],
                    "text-white"
                  )}
                  style={{
                    left: `${task.left}px`,
                    width: `${task.width}px`,
                    top: `${index * TASK_ROW_HEIGHT + 2}px`, // Position vertically based on index
                  }}
                  title={`${task.content} (${task.durationMinutes} min)`}
                >
                  <span className="truncate px-1">{task.content}</span>
                  <a 
                    href={task.url} 
                    target="_blank" 
                    rel="noopener noreferrer" 
                    className="absolute top-0 right-0 text-white hover:text-gray-200 p-1"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <ExternalLink className="h-3 w-3" />
                  </a>
                </div>
              ))}
              {renderTodayLine()}
            </div>
          </div>
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