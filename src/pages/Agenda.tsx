"use client";

import React, { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CalendarIcon, ListTodo } from "lucide-react";
import { format, parseISO, isValid, startOfDay, addMinutes, parse } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn, getTaskCategory } from "@/lib/utils";
import { useTodoist } from "@/context/TodoistContext";
import { TodoistTask, ScheduledTask, DaySchedule } from "@/lib/types";
import TimeSlotPlanner from "@/components/TimeSlot/TimeSlotPlanner";
import LoadingSpinner from "@/components/ui/loading-spinner";
import { toast } from "sonner";

const AGENDA_FILTER = `(#📅 Reuniões|@📆 Cronograma de hoje) & (p1|p2|p3|p4) & due before: in 168 hour & !@⚡ Rápida`;
const DEFAULT_TASK_DURATION_MINUTES = 30; // Duração padrão para tarefas sem duração definida

const Agenda = () => {
  const { fetchTasks, isLoading: isLoadingTodoist } = useTodoist();
  const [selectedDate, setSelectedDate] = useState<Date>(startOfDay(new Date()));
  const [agendaSchedule, setAgendaSchedule] = useState<DaySchedule>({
    date: format(selectedDate, "yyyy-MM-dd"),
    timeBlocks: [],
    scheduledTasks: [],
  });
  const [isLoadingAgenda, setIsLoadingAgenda] = useState(false);

  const loadAgendaTasks = useCallback(async () => {
    setIsLoadingAgenda(true);
    try {
      const fetchedTodoistTasks = await fetchTasks(AGENDA_FILTER, { includeSubtasks: false, includeRecurring: false });
      
      const tasksForSelectedDay: ScheduledTask[] = [];
      const selectedDateKey = format(selectedDate, "yyyy-MM-dd");

      fetchedTodoistTasks.forEach(task => {
        if (task.due?.datetime && isValid(parseISO(task.due.datetime))) {
          const taskDueDateTime = parseISO(task.due.datetime);
          const taskDueDate = startOfDay(taskDueDateTime);

          if (format(taskDueDate, "yyyy-MM-dd") === selectedDateKey) {
            const startTime = format(taskDueDateTime, "HH:mm");
            const durationMinutes = task.duration?.amount && task.duration.unit === "minute"
              ? task.duration.amount
              : DEFAULT_TASK_DURATION_MINUTES;
            const endTime = format(addMinutes(taskDueDateTime, durationMinutes), "HH:mm");

            tasksForSelectedDay.push({
              id: task.id,
              taskId: task.id,
              content: task.content,
              description: task.description,
              start: startTime,
              end: endTime,
              priority: task.priority,
              category: getTaskCategory(task) || "profissional", // Default to professional if no category label
              estimatedDurationMinutes: durationMinutes,
              originalTask: task,
              isMeeting: task.content.startsWith('📅') || task.labels.includes('reunião'), // Simple meeting detection
            });
          }
        }
      });

      setAgendaSchedule({
        date: selectedDateKey,
        timeBlocks: [], // No custom time blocks for this view
        scheduledTasks: tasksForSelectedDay.sort((a, b) => a.start.localeCompare(b.start)),
      });

      if (tasksForSelectedDay.length === 0) {
        toast.info(`Nenhuma tarefa encontrada para ${format(selectedDate, "dd/MM/yyyy", { locale: ptBR })} com o filtro da agenda.`);
      } else {
        toast.success(`Carregadas ${tasksForSelectedDay.length} tarefas para ${format(selectedDate, "dd/MM/yyyy", { locale: ptBR })}.`);
      }

    } catch (error) {
      console.error("Failed to load agenda tasks:", error);
      toast.error("Falha ao carregar tarefas da agenda.");
    } finally {
      setIsLoadingAgenda(false);
    }
  }, [fetchTasks, selectedDate]);

  useEffect(() => {
    loadAgendaTasks();
  }, [selectedDate, loadAgendaTasks]);

  const handleDateChange = (date: Date | undefined) => {
    if (date) {
      setSelectedDate(startOfDay(date));
    }
  };

  const isLoadingCombined = isLoadingTodoist || isLoadingAgenda;

  return (
    <div className="p-4">
      <h2 className="text-3xl font-bold mb-2 text-gray-800">
        <ListTodo className="inline-block h-8 w-8 mr-2 text-indigo-600" /> AGENDA - Visão Diária
      </h2>
      <p className="text-lg text-gray-600 mb-6">
        Visualize suas reuniões e tarefas prioritárias em um calendário diário.
      </p>

      <div className="mb-6 flex items-center gap-4">
        <Popover>
          <PopoverTrigger asChild>
            <Button
              variant={"outline"}
              className={cn(
                "w-[240px] justify-start text-left font-normal",
                !selectedDate && "text-muted-foreground"
              )}
            >
              <CalendarIcon className="mr-2 h-4 w-4" />
              {selectedDate && isValid(selectedDate) ? format(selectedDate, "PPP", { locale: ptBR }) : <span>Selecione uma data</span>}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0">
            <Calendar
              mode="single"
              selected={selectedDate}
              onSelect={handleDateChange}
              initialFocus
              locale={ptBR}
            />
          </PopoverContent>
        </Popover>
        <Button onClick={loadAgendaTasks} disabled={isLoadingCombined} className="flex items-center gap-2">
          <ListTodo className="h-4 w-4" /> Recarregar Agenda
        </Button>
      </div>

      {isLoadingCombined ? (
        <div className="flex justify-center items-center h-[calc(100vh-300px)]">
          <LoadingSpinner size={40} />
        </div>
      ) : (
        <TimeSlotPlanner
          daySchedule={agendaSchedule}
          // onSelectSlot e onSelectTask são omitidos ou definidos como no-op para uma visão somente leitura
        />
      )}
    </div>
  );
};

export default Agenda;