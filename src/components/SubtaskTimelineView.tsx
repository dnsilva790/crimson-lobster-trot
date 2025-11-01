"use client";

import React, { useMemo } from "react";
import { TodoistTask } from "@/lib/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { format, parseISO, isValid, setHours, setMinutes, addMinutes, isToday, isPast, startOfDay } from "date-fns";
import { ptBR } from "date-fns/locale";
import { CalendarIcon, Clock, ExternalLink, ListTodo } from "lucide-react";
import { Badge } from "@/components/ui/badge";

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
const PIXELS_PER_MINUTE = 1.5; // Adjust this value to control the height of the timeline

const SubtaskTimelineView: React.FC<SubtaskTimelineViewProps> = ({ subtasks, mainTaskDueDate }) => {
  const timelineDate = useMemo(() => {
    if (mainTaskDueDate && isValid(mainTaskDueDate)) {
      return startOfDay(mainTaskDueDate);
    }
    return startOfDay(new Date());
  }, [mainTaskDueDate]);

  const tasksForTimeline = useMemo(() => {
    return subtasks
      .filter(task => task.due?.datetime || task.due?.date) // Only tasks with a due date/time
      .map(task => {
        let startDateTime: Date | null = null;
        let durationMinutes = task.estimatedDurationMinutes || 30; // Default to 30 min if not specified

        if (task.due?.datetime && isValid(parseISO(task.due.datetime))) {
          startDateTime = parseISO(task.due.datetime);
        } else if (task.due?.date && isValid(parseISO(task.due.date))) {
          // If only date is available, set a default time (e.g., 9 AM)
          startDateTime = setHours(setMinutes(parseISO(task.due.date), 0), 9);
        }

        if (!startDateTime || !isValid(startDateTime)) {
          return null; // Skip invalid dates
        }

        // Ensure the task is placed on the correct timelineDate
        startDateTime = setHours(setMinutes(timelineDate, startDateTime.getMinutes()), startDateTime.getHours());

        const startMinutes = startDateTime.getHours() * 60 + startDateTime.getMinutes();
        const top = startMinutes * PIXELS_PER_MINUTE;
        const height = durationMinutes * PIXELS_PER_MINUTE;

        return {
          ...task,
          startMinutes,
          top,
          height,
          endMinutes: startMinutes + durationMinutes,
        };
      })
      .filter(Boolean) // Remove nulls
      .sort((a, b) => (a?.startMinutes || 0) - (b?.startMinutes || 0)); // Sort by start time
  }, [subtasks, timelineDate]);

  const tasksWithoutDueDate = useMemo(() => {
    return subtasks.filter(task => !task.due?.datetime && !task.due?.date);
  }, [subtasks]);

  const renderTimeMarkers = () => {
    const markers: JSX.Element[] = [];
    for (let hour = 0; hour < 24; hour++) {
      const time = setHours(timelineDate, hour);
      markers.push(
        <div
          key={hour}
          className="absolute left-0 w-full border-t border-gray-200 text-xs text-gray-500 pl-1"
          style={{ top: `${hour * 60 * PIXELS_PER_MINUTE}px`, height: `${60 * PIXELS_PER_MINUTE}px` }}
        >
          {format(time, "HH:mm")}
        </div>
      );
    }
    return markers;
  };

  const renderCurrentTimeLine = () => {
    if (!isToday(timelineDate)) return null; // Only show current time line for today

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
          <ListTodo className="h-5 w-5 text-indigo-600" /> Linha do Tempo de Subtarefas
        </CardTitle>
        <p className="text-sm text-gray-600">
          Visualização para {format(timelineDate, "dd/MM/yyyy", { locale: ptBR })}
        </p>
      </CardHeader>
      <CardContent className="p-0">
        <div className="relative border border-gray-200 rounded-md overflow-hidden" style={{ height: `${MINUTES_IN_DAY * PIXELS_PER_MINUTE}px` }}>
          {renderTimeMarkers()}
          {tasksForTimeline.map((task, index) => (
            <div
              key={task.id}
              className={cn(
                "absolute left-12 right-1 bg-blue-100 border border-blue-300 rounded-sm p-1 text-xs overflow-hidden",
                "hover:bg-blue-200 transition-colors duration-100",
                isPast(addMinutes(task.startDateTime!, task.estimatedDurationMinutes || 0)) && "opacity-60 bg-gray-100 border-gray-300"
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
          {renderCurrentTimeLine()}
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