"use client";

import React, { useMemo, useState, useCallback, useRef, useEffect } from "react";
import { TodoistTask } from "@/lib/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn, isURL } from "@/lib/utils";
import { format, parseISO, isValid, isSameDay, differenceInDays, startOfDay, addDays, isBefore, isPast, isAfter } from "date-fns";
import { ptBR } from "date-fns/locale";
import { ExternalLink, ListTodo, CalendarIcon, Clock } from "lucide-react";
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

const TASK_ROW_HEIGHT = 40; // Altura de cada linha de tarefa
const PIXELS_PER_DAY = 100; // 100px por dia

const SubtaskTimelineView: React.FC<SubtaskTimelineViewProps> = ({ subtasks }) => {
  const today = startOfDay(new Date());

  const tasksWithTimelineData = useMemo(() => {
    const validTasks = subtasks
      .map(task => {
        // Usar due.date como data de início (start)
        const startDateString = task.due?.date || task.due?.datetime;
        // Usar deadline como data de fim (end)
        const endDateString = task.deadline;

        if (!startDateString || !endDateString) return null;

        const startDate = startOfDay(parseISO(startDateString));
        const endDate = startOfDay(parseISO(endDateString));

        if (!isValid(startDate) || !isValid(endDate) || isBefore(endDate, startDate)) return null;

        // Definir o ponto de referência como o dia de início mais antigo ou hoje
        const referenceDate = startOfDay(today);
        
        // Calcular a diferença em dias a partir da data de referência
        const startOffsetDays = differenceInDays(startDate, referenceDate);
        const durationDays = differenceInDays(endDate, startDate) + 1; // Incluir o dia de início e fim

        // Calcular a posição e largura em pixels
        const left = startOffsetDays * PIXELS_PER_DAY;
        const width = durationDays * PIXELS_PER_DAY;

        return {
          ...task,
          startDate,
          endDate,
          startOffsetDays,
          durationDays,
          left,
          width,
        };
      })
      .filter(Boolean) as (TodoistTask & { 
        startDate: Date; 
        endDate: Date; 
        startOffsetDays: number; 
        durationDays: number; 
        left: number; 
        width: number; 
      })[];

    // Ordenar as tarefas por data de início
    validTasks.sort((a, b) => a.startDate.getTime() - b.startDate.getTime());

    return validTasks;
  }, [subtasks, today]);

  const tasksWithoutTimeline = useMemo(() => {
    return subtasks.filter(task => {
      const startDateString = task.due?.date || task.due?.datetime;
      const endDateString = task.deadline;
      return !startDateString || !endDateString || !isValid(parseISO(startDateString)) || !isValid(parseISO(endDateString));
    });
  }, [subtasks]);

  // Determinar o intervalo de datas para o eixo X
  const { minDate, maxDate, totalDays } = useMemo(() => {
    if (tasksWithTimelineData.length === 0) {
      return { minDate: today, maxDate: addDays(today, 7), totalDays: 8 };
    }

    const allDates = tasksWithTimelineData.flatMap(t => [t.startDate, t.endDate]);
    const min = startOfDay(allDates.reduce((a, b) => (isBefore(a, b) ? a : b), today));
    const max = startOfDay(allDates.reduce((a, b) => (isAfter(a, b) ? a : b), today));

    // Garantir que o cronograma comece no máximo 7 dias antes de hoje e termine 7 dias depois do último deadline
    const effectiveMin = isBefore(min, addDays(today, -7)) ? min : addDays(today, -7);
    const effectiveMax = isAfter(max, addDays(today, 7)) ? max : addDays(today, 7);

    const days = differenceInDays(effectiveMax, effectiveMin) + 1;

    return { minDate: effectiveMin, maxDate: effectiveMax, totalDays: days };
  }, [tasksWithTimelineData, today]);

  const totalTimelineWidth = totalDays * PIXELS_PER_DAY;
  const totalHeight = tasksWithTimelineData.length * TASK_ROW_HEIGHT;
  const startReferenceDate = minDate;

  const renderDayMarkers = () => {
    const markers: JSX.Element[] = [];
    for (let i = 0; i < totalDays; i++) {
      const date = addDays(startReferenceDate, i);
      const isTodayMarker = isSameDay(date, today);
      const isPastDay = isBefore(date, today);
      const leftPosition = i * PIXELS_PER_DAY;

      markers.push(
        <div 
          key={`day-marker-${i}`} 
          className={cn(
            "absolute top-0 bottom-0 border-l border-gray-200 text-xs pt-1 px-1 flex flex-col justify-start items-center",
            isTodayMarker && "bg-blue-50 border-blue-500 font-semibold",
            isPastDay && "bg-gray-100 text-gray-500"
          )}
          style={{ left: `${leftPosition}px`, width: `${PIXELS_PER_DAY}px` }}
        >
          <span className="text-xs">{format(date, "EEE", { locale: ptBR })}</span>
          <span className="text-sm">{format(date, "dd/MM")}</span>
        </div>
      );
    }
    return markers;
  };

  const renderTodayLine = () => {
    const todayOffsetDays = differenceInDays(today, startReferenceDate);
    const leftPosition = todayOffsetDays * PIXELS_PER_DAY;

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
          <CalendarIcon className="h-5 w-5 text-indigo-600" /> Cronograma de Projeto (Gantt - Dias)
        </CardTitle>
        <p className="text-sm text-gray-600">
          Visualização do cronograma das subtarefas. Início = Due Date, Fim = Deadline.
        </p>
      </CardHeader>
      <CardContent className="p-0">
        <div className="flex border border-gray-200 rounded-md overflow-hidden">
          
          {/* Task List Column (Y-Axis Labels) */}
          <div className="sticky left-0 z-10 w-48 flex-shrink-0 bg-white border-r border-gray-200 divide-y divide-gray-100">
            <div className="h-10 flex items-center p-2 text-sm font-semibold border-b border-gray-200">Subtarefas</div>
            <div style={{ height: `${totalHeight}px` }}>
                {tasksWithTimelineData.map((task, index) => {
                    const isContentURL = isURL(task.content);
                    return (
                        <div 
                            key={task.id} 
                            className={cn(
                                "w-full h-10 flex items-center p-2 text-sm truncate",
                                index % 2 === 1 ? "bg-gray-50" : "bg-white"
                            )}
                            title={task.content}
                        >
                            {isContentURL ? (
                                <a href={task.content} target="_blank" rel="noopener noreferrer" className="text-indigo-600 hover:underline">
                                    {task.content}
                                </a>
                            ) : (
                                task.content
                            )}
                        </div>
                    );
                })}
            </div>
          </div>

          {/* Gantt Chart Area (X-Axis Timeline) */}
          <div className="flex-grow overflow-x-auto">
            {/* Timeline Header (Days) */}
            <div className="relative h-10 flex-shrink-0 border-b border-gray-200" style={{ width: `${totalTimelineWidth}px` }}>
              {renderDayMarkers()}
            </div>

            {/* Task Bars Container */}
            <div className="relative" style={{ height: `${totalHeight}px`, minWidth: `${totalTimelineWidth}px` }}>
              {/* Linha de Hoje */}
              {renderTodayLine()}

              {/* Linhas de Grade Diárias */}
              {Array.from({ length: totalDays }).map((_, i) => (
                <div 
                  key={`grid-line-${i}`} 
                  className="absolute top-0 bottom-0 border-l border-gray-100"
                  style={{ left: `${i * PIXELS_PER_DAY}px` }}
                ></div>
              ))}

              {/* Task Bars */}
              {tasksWithTimelineData.map((task, index) => {
                const isContentURL = isURL(task.content);
                const isCompleted = task.is_completed;
                const isPastDue = isPast(task.endDate);

                return (
                  <div
                    key={`bar-${task.id}`}
                    className={cn(
                      "absolute h-8 rounded-md p-1 text-xs font-semibold flex items-center justify-start overflow-hidden shadow-md transition-all duration-300 z-10",
                      PRIORITY_COLORS[task.priority],
                      "text-white",
                      isCompleted && "opacity-50 bg-green-600",
                      isPastDue && !isCompleted && "bg-red-700"
                    )}
                    style={{
                      left: `${task.left}px`,
                      width: `${task.width}px`,
                      top: `${index * TASK_ROW_HEIGHT + 2}px`, // Position vertically based on index
                    }}
                    title={`${task.content} (${format(task.startDate, "dd/MM")} - ${format(task.endDate, "dd/MM")})`}
                  >
                    {isContentURL ? (
                        <a href={task.content} target="_blank" rel="noopener noreferrer" className="truncate px-1 text-white hover:underline">
                            {task.content}
                        </a>
                    ) : (
                        <span className="truncate px-1">{task.content}</span>
                    )}
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
                );
              })}
            </div>
          </div>
        </div>

        {tasksWithoutTimeline.length > 0 && (
          <div className="mt-4 p-3 border border-gray-200 rounded-md bg-gray-50">
            <h4 className="font-semibold text-gray-700 mb-2">Subtarefas sem Prazo/Deadline Definido (Não exibidas no Gantt):</h4>
            <ul className="list-disc list-inside text-sm text-gray-600 space-y-1">
              {tasksWithoutTimeline.map(task => {
                const isContentURL = isURL(task.content);
                return (
                  <li key={task.id} className="flex items-center justify-between">
                    {isContentURL ? (
                        <a href={task.content} target="_blank" rel="noopener noreferrer" className="text-indigo-600 hover:underline">
                            {task.content}
                        </a>
                    ) : (
                        <span>{task.content}</span>
                    )}
                    <a 
                      href={task.url} 
                      target="_blank" 
                      rel="noopener noreferrer" 
                      className="ml-2 text-blue-500 hover:text-blue-700"
                    >
                      <ExternalLink className="h-3 w-3 inline-block" />
                    </a>
                  </li>
                );
              })}
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default SubtaskTimelineView;