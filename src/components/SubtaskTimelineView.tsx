"use client";

import React, { useMemo, useState, useCallback } from "react";
import { TodoistTask } from "@/lib/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { format, parseISO, isValid, startOfDay, addDays, isSameDay, subDays, differenceInDays } from "date-fns";
import { ptBR } from "date-fns/locale";
import { CalendarIcon, Clock, ExternalLink, ListTodo, ChevronLeft, ChevronRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
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

const NUM_DAYS_TO_DISPLAY = 14; // Display 14 days (2 weeks)
const PIXELS_PER_DAY = 100; // Width of each day column in pixels

const SubtaskTimelineView: React.FC<SubtaskTimelineViewProps> = ({ subtasks, mainTaskDueDate }) => {
  const [viewStartDate, setViewStartDate] = useState<Date>(() => {
    const today = startOfDay(new Date());
    if (mainTaskDueDate && isValid(mainTaskDueDate)) {
      // Start the view 7 days before the main task due date
      return subDays(startOfDay(mainTaskDueDate), 7);
    }
    return subDays(today, 7); // Default to starting 7 days ago
  });

  const displayedDates = useMemo(() => {
    const dates: Date[] = [];
    for (let i = 0; i < NUM_DAYS_TO_DISPLAY; i++) {
      dates.push(addDays(viewStartDate, i));
    }
    return dates;
  }, [viewStartDate]);

  const tasksWithLayout = useMemo(() => {
    const tasks = subtasks
      .filter(task => task.due?.date || task.due?.datetime)
      .map(task => {
        const dueDateString = task.due?.datetime || task.due?.date;
        if (!dueDateString) return null;

        const dueDate = startOfDay(parseISO(dueDateString));
        if (!isValid(dueDate)) return null;

        // Use created_at as the start date if no explicit start date is available
        const startDate = startOfDay(parseISO(task.created_at));
        
        // Calculate duration in days (minimum 1 day)
        const durationDays = Math.max(1, differenceInDays(dueDate, startDate) + 1);
        
        // Calculate offset from the viewStartDate
        const offsetDays = differenceInDays(startDate, viewStartDate);
        
        // Calculate horizontal position and width
        const left = offsetDays * PIXELS_PER_DAY;
        const width = durationDays * PIXELS_PER_DAY;

        return {
          ...task,
          startDate,
          dueDate,
          durationDays,
          left,
          width,
        };
      })
      .filter(Boolean) as (TodoistTask & { startDate: Date; dueDate: Date; durationDays: number; left: number; width: number; })[];

    // Simple vertical stacking logic (Gantt rows)
    const rows: { end: number; tasks: typeof tasks }[] = [];
    tasks.sort((a, b) => a.startDate.getTime() - b.startDate.getTime());

    tasks.forEach(task => {
      let placed = false;
      for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        // Check if this task can fit in this row without overlapping horizontally
        const rowEndDay = row.end;
        if (task.left >= rowEndDay) {
          task.top = i * 40; // 40px per row
          row.end = task.left + task.width;
          row.tasks.push(task);
          placed = true;
          break;
        }
      }
      if (!placed) {
        task.top = rows.length * 40;
        rows.push({ end: task.left + task.width, tasks: [task] });
      }
    });

    return { tasks, totalHeight: rows.length * 40 + 20 };
  }, [subtasks, viewStartDate]);

  const tasksWithoutDueDate = useMemo(() => {
    return subtasks.filter(task => !task.due?.datetime && !task.due?.date);
  }, [subtasks]);

  const handlePreviousPeriod = useCallback(() => {
    setViewStartDate(prev => subDays(prev, NUM_DAYS_TO_DISPLAY));
  }, []);

  const handleNextPeriod = useCallback(() => {
    setViewStartDate(prev => addDays(prev, NUM_DAYS_TO_DISPLAY));
  }, []);

  if (subtasks.length === 0) {
    return (
      <p className="text-gray-500 italic">Nenhuma subtarefa encontrada.</p>
    );
  }

  return (
    <Card className="p-4">
      <CardHeader>
        <CardTitle className="text-xl font-bold mb-2 flex items-center gap-2">
          <ListTodo className="h-5 w-5 text-indigo-600" /> Cronograma do Projeto (Gantt)
        </CardTitle>
        <div className="flex items-center justify-between mt-2">
          <Button variant="outline" size="sm" onClick={handlePreviousPeriod}>
            <ChevronLeft className="h-4 w-4" /> Período Anterior
          </Button>
          <p className="text-sm text-gray-600 font-semibold">
            {format(displayedDates[0], "dd/MM/yyyy", { locale: ptBR })} - {format(displayedDates[NUM_DAYS_TO_DISPLAY - 1], "dd/MM/yyyy", { locale: ptBR })}
          </p>
          <Button variant="outline" size="sm" onClick={handleNextPeriod}>
            Próximo Período <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <div className="flex overflow-x-auto border border-gray-200 rounded-md">
          {/* Timeline Header (Dates) */}
          <div className="flex sticky left-0 z-20 bg-white border-r border-gray-200">
            <div className="w-48 flex-shrink-0 p-2 font-semibold text-gray-700 border-b">Subtarefas</div>
          </div>
          <div className="flex flex-grow">
            {displayedDates.map(day => {
              const isCurrentDay = isSameDay(day, new Date());
              return (
                <div 
                  key={format(day, 'yyyy-MM-dd')} 
                  className={cn(
                    "w-[100px] flex-shrink-0 p-2 text-center text-xs font-semibold border-b border-gray-200",
                    isCurrentDay ? "bg-blue-100 text-blue-800" : "bg-gray-100 text-gray-700"
                  )}
                >
                  {format(day, "EEE")}
                  <div className="text-lg font-bold">{format(day, "dd")}</div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="flex overflow-x-auto relative" style={{ height: `${tasksWithLayout.totalHeight}px` }}>
          {/* Task List Column (Fixed Left) */}
          <div className="sticky left-0 z-10 w-48 flex-shrink-0 bg-white border-r border-gray-200 divide-y divide-gray-100">
            {tasksWithLayout.tasks.map((task) => (
              <div 
                key={task.id} 
                className="h-10 flex items-center p-2 text-sm truncate"
                style={{ top: `${task.top}px` }}
                title={task.content}
              >
                {task.content}
              </div>
            ))}
          </div>

          {/* Gantt Chart Area (Scrollable) */}
          <div className="relative flex-grow" style={{ width: `${NUM_DAYS_TO_DISPLAY * PIXELS_PER_DAY}px` }}>
            {/* Vertical Day Separators */}
            {displayedDates.map((day, index) => {
              const isCurrentDay = isSameDay(day, new Date());
              return (
                <div 
                  key={`sep-${format(day, 'yyyy-MM-dd')}`} 
                  className={cn(
                    "absolute top-0 bottom-0 border-r border-gray-200",
                    isCurrentDay && "bg-blue-50 opacity-50"
                  )}
                  style={{ left: `${index * PIXELS_PER_DAY}px`, width: `${PIXELS_PER_DAY}px` }}
                ></div>
              );
            })}

            {/* Task Bars */}
            {tasksWithLayout.tasks.map((task) => (
              <div
                key={`bar-${task.id}`}
                className={cn(
                  "absolute h-8 rounded-md p-1 text-xs font-semibold flex items-center justify-center overflow-hidden shadow-md transition-all duration-300",
                  PRIORITY_COLORS[task.priority],
                  "text-white"
                )}
                style={{
                  left: `${task.left}px`,
                  width: `${task.width}px`,
                  top: `${task.top + 2}px`, // Add a small offset for padding
                }}
                title={`${task.content} (${task.durationDays} dias)`}
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