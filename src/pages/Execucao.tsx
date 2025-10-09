"use client";

import React, { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { useTodoist } from "@/context/TodoistContext";
import { TodoistTask } from "@/lib/types";
import LoadingSpinner from "@/components/ui/loading-spinner";
import { toast } from "sonner";
import FocusTaskCard from "@/components/FocusTaskCard";
import TaskTimer from "@/components/TaskTimer";
import { CalendarIcon, Clock, Star, Zap, Check, ArrowRight, CalendarDays, ListTodo } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { format, setHours, setMinutes, parseISO, addDays } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Progress } from "@/components/ui/progress";

type ExecucaoState = "initial" | "focusing" | "finished";

const Execucao = () => {
  const { fetchTasks, closeTask, updateTask, isLoading } = useTodoist();
  const [focusTasks, setFocusTasks] = useState<TodoistTask[]>([]);
  const [originalTasksCount, setOriginalTasksCount] = useState<number>(0);
  const [currentTaskIndex, setCurrentTaskIndex] = useState<number>(0);
  const [execucaoState, setExecucaoState] = useState<ExecucaoState>("initial");

  // State for rescheduling/setting deadline popover
  const [isReschedulePopoverOpen, setIsReschedulePopoverOpen] = useState(false);
  const [isDeadlinePopoverOpen, setIsDeadlinePopoverOpen] = useState(false);
  const [selectedDueDate, setSelectedDueDate] = useState<Date | undefined>(undefined);
  const [selectedDueTime, setSelectedDueTime] = useState<string>("");
  const [selectedPriority, setSelectedPriority] = useState<1 | 2 | 3 | 4>(1); // Default to P4

  const currentTask = focusTasks[currentTaskIndex];

  const loadTasksForFocus = useCallback(async () => {
    setExecucaoState("initial");
    setCurrentTaskIndex(0);
    const fetchedTasks = await fetchTasks(); // Fetch all uncompleted tasks
    if (fetchedTasks && fetchedTasks.length > 0) {
      // Sort tasks by priority (P1 first) and then by due date (earliest first)
      const sortedTasks = [...fetchedTasks].sort((a, b) => {
        // Priority: P1 (4) > P2 (3) > P3 (2) > P4 (1)
        if (b.priority !== a.priority) {
          return b.priority - a.priority;
        }

        // Due date: earliest first
        const getDateValue = (task: TodoistTask) => {
          if (task.due?.datetime) return new Date(task.due.datetime).getTime();
          if (task.due?.date) return new Date(task.due.date).getTime();
          return Infinity; // Tasks without a due date go last
        };

        const dateA = getDateValue(a);
        const dateB = getDateValue(b);

        return dateA - dateB;
      });

      setFocusTasks(sortedTasks);
      setOriginalTasksCount(sortedTasks.length);
      setExecucaoState("focusing");
      toast.info(`Encontradas ${sortedTasks.length} tarefas para focar.`);
    } else {
      setFocusTasks([]);
      setOriginalTasksCount(0);
      setExecucaoState("finished");
      toast.info("Nenhuma tarefa encontrada para focar. Bom trabalho!");
    }
  }, [fetchTasks]);

  useEffect(() => {
    // No initial load, wait for user to click "Iniciar Modo Foco"
  }, []);

  const handleNextTask = useCallback(() => {
    if (currentTaskIndex < focusTasks.length - 1) {
      setCurrentTaskIndex((prev) => prev + 1);
    } else {
      setExecucaoState("finished");
      toast.success("Modo Foco Total concluído!");
    }
  }, [currentTaskIndex, focusTasks.length]);

  const handleComplete = useCallback(async (taskId: string) => {
    const success = await closeTask(taskId);
    if (success !== undefined) {
      toast.success("Tarefa concluída com sucesso!");
      // Remove the completed task from the list and move to the next
      setFocusTasks((prev) => prev.filter((task) => task.id !== taskId));
      if (focusTasks.length - 1 === 0) { // If it was the last task
        setExecucaoState("finished");
        toast.success("Modo Foco Total concluído!");
      } else if (currentTaskIndex < focusTasks.length - 1) {
        // If there are more tasks, the index remains the same, but the next task shifts into its place
        // No need to increment currentTaskIndex here, as the list shrinks
      } else { // If the last task was completed and there are still tasks left (due to filtering)
        setCurrentTaskIndex(0); // Reset to first task if current one was last and list is not empty
      }
    }
  }, [closeTask, focusTasks.length, currentTaskIndex]);

  const handleSkip = useCallback(() => {
    toast.info("Tarefa pulada. Passando para a próxima.");
    handleNextTask();
  }, [handleNextTask]);

  const handleReschedule = useCallback(async (taskId: string, daysToAdd: number) => {
    if (!currentTask) return;
    const newDueDate = addDays(new Date(), daysToAdd);
    const updateData = {
      due_date: format(newDueDate, "yyyy-MM-dd"),
      due_datetime: null,
    };
    const updated = await updateTask(taskId, updateData);
    if (updated) {
      toast.success(`Tarefa reagendada para ${format(newDueDate, "dd/MM/yyyy", { locale: ptBR })}!`);
      handleNextTask();
    }
  }, [currentTask, updateTask, handleNextTask]);

  const handleSetDueDateAndTime = useCallback(async () => {
    if (!currentTask || !selectedDueDate) {
      toast.error("Por favor, selecione uma data.");
      return;
    }

    const updateData: {
      priority?: 1 | 2 | 3 | 4;
      due_date?: string | null;
      due_datetime?: string | null;
    } = {};
    let finalDate = selectedDueDate;

    if (selectedDueTime) {
      const [hours, minutes] = selectedDueTime.split(":").map(Number);
      finalDate = setMinutes(setHours(selectedDueDate, hours), minutes);
      updateData.due_datetime = format(finalDate, "yyyy-MM-dd'T'HH:mm:ss");
      updateData.due_date = null;
    } else {
      updateData.due_date = format(finalDate, "yyyy-MM-dd");
      updateData.due_datetime = null;
    }

    if (selectedPriority !== currentTask.priority) {
      updateData.priority = selectedPriority;
    }

    const updated = await updateTask(currentTask.id, updateData);
    if (updated) {
      toast.success("Tarefa atualizada com sucesso!");
      setIsReschedulePopoverOpen(false);
      setIsDeadlinePopoverOpen(false);
      handleNextTask();
    }
  }, [currentTask, selectedDueDate, selectedDueTime, selectedPriority, updateTask, handleNextTask]);

  const handleGuideMe = useCallback(() => {
    toast.info("Funcionalidade 'Guiar-me (TDAH)' em desenvolvimento. Em breve, sugestões e quebras de tarefa!");
  }, []);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (execucaoState !== "focusing" || isLoading) return;

      switch (event.key.toLowerCase()) {
        case "f":
          if (currentTask) handleComplete(currentTask.id);
          break;
        case "p":
          handleSkip();
          break;
        case "r":
          // Open reschedule popover or trigger a default reschedule (e.g., +1 day)
          // For now, let's just open the popover
          setIsReschedulePopoverOpen(true);
          break;
        case "d":
          // Open deadline popover
          setIsDeadlinePopoverOpen(true);
          break;
        case "g":
          handleGuideMe();
          break;
        default:
          break;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [execucaoState, isLoading, currentTask, handleComplete, handleSkip, handleGuideMe]);

  // Initialize popover states when a new task is loaded
  useEffect(() => {
    if (currentTask) {
      const initialDueDate = currentTask.due?.date ? parseISO(currentTask.due.date) : undefined;
      const initialDueTime = currentTask.due?.datetime ? format(parseISO(currentTask.due.datetime), "HH:mm") : "";
      setSelectedDueDate(initialDueDate);
      setSelectedDueTime(initialDueTime);
      setSelectedPriority(currentTask.priority);
    }
  }, [currentTask]);

  const progressValue = originalTasksCount > 0 ? ((originalTasksCount - focusTasks.length) / originalTasksCount) * 100 : 0;

  return (
    <div className="p-4">
      <h2 className="text-3xl font-bold mb-2 text-gray-800">⚡ EXECUÇÃO - Modo Foco Total</h2>
      <p className="text-lg text-gray-600 mb-6">Concentre-se em uma tarefa por vez.</p>

      {isLoading && (
        <div className="flex justify-center items-center h-48">
          <LoadingSpinner size={40} />
        </div>
      )}

      {!isLoading && execucaoState === "initial" && (
        <div className="text-center mt-10">
          <Button
            onClick={loadTasksForFocus}
            className="px-8 py-4 text-xl bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors duration-200"
          >
            Iniciar Modo Foco
          </Button>
        </div>
      )}

      {!isLoading && execucaoState === "focusing" && currentTask && (
        <div className="mt-8">
          <FocusTaskCard task={currentTask} />

          <div className="mt-8">
            <TaskTimer />
          </div>

          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4 mt-8">
            <Button
              onClick={() => handleComplete(currentTask.id)}
              disabled={isLoading}
              className="bg-green-500 hover:bg-green-600 text-white py-3 text-md flex items-center justify-center"
            >
              <Check className="mr-2 h-5 w-5" /> Concluída (F)
            </Button>
            <Button
              onClick={handleSkip}
              disabled={isLoading}
              className="bg-blue-500 hover:bg-blue-600 text-white py-3 text-md flex items-center justify-center"
            >
              <ArrowRight className="mr-2 h-5 w-5" /> Próxima (P)
            </Button>

            <Popover open={isReschedulePopoverOpen} onOpenChange={setIsReschedulePopoverOpen}>
              <PopoverTrigger asChild>
                <Button
                  disabled={isLoading}
                  className="bg-purple-500 hover:bg-purple-600 text-white py-3 text-md flex items-center justify-center"
                >
                  <CalendarDays className="mr-2 h-5 w-5" /> Reagendar (R)
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-4">
                <h4 className="font-semibold mb-2">Reagendar Tarefa</h4>
                <div className="grid gap-4">
                  <div>
                    <Label htmlFor="reschedule-date">Data de Vencimento</Label>
                    <Calendar
                      mode="single"
                      selected={selectedDueDate}
                      onSelect={setSelectedDueDate}
                      initialFocus
                      locale={ptBR}
                    />
                  </div>
                  <div>
                    <Label htmlFor="reschedule-time">Hora (Opcional)</Label>
                    <Input
                      id="reschedule-time"
                      type="time"
                      value={selectedDueTime}
                      onChange={(e) => setSelectedDueTime(e.target.value)}
                    />
                  </div>
                  <div>
                    <Label htmlFor="reschedule-priority">Prioridade</Label>
                    <Select
                      value={String(selectedPriority)}
                      onValueChange={(value) => setSelectedPriority(Number(value) as 1 | 2 | 3 | 4)}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione a prioridade" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="4">P1 - Urgente</SelectItem>
                        <SelectItem value="3">P2 - Alto</SelectItem>
                        <SelectItem value="2">P3 - Médio</SelectItem>
                        <SelectItem value="1">P4 - Baixo</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <Button onClick={handleSetDueDateAndTime}>Salvar Reagendamento</Button>
                </div>
              </PopoverContent>
            </Popover>

            <Popover open={isDeadlinePopoverOpen} onOpenChange={setIsDeadlinePopoverOpen}>
              <PopoverTrigger asChild>
                <Button
                  disabled={isLoading}
                  className="bg-orange-500 hover:bg-orange-600 text-white py-3 text-md flex items-center justify-center"
                >
                  <Clock className="mr-2 h-5 w-5" /> Data Limite (D)
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-4">
                <h4 className="font-semibold mb-2">Definir Data Limite (Vencimento)</h4>
                <p className="text-sm text-gray-600 mb-2">
                  *Atenção: A API do Todoist não permite definir 'deadline' diretamente. Esta ação irá atualizar a 'data de vencimento' da tarefa.
                </p>
                <div className="grid gap-4">
                  <div>
                    <Label htmlFor="deadline-date">Data de Vencimento</Label>
                    <Calendar
                      mode="single"
                      selected={selectedDueDate}
                      onSelect={setSelectedDueDate}
                      initialFocus
                      locale={ptBR}
                    />
                  </div>
                  <div>
                    <Label htmlFor="deadline-time">Hora (Opcional)</Label>
                    <Input
                      id="deadline-time"
                      type="time"
                      value={selectedDueTime}
                      onChange={(e) => setSelectedDueTime(e.target.value)}
                    />
                  </div>
                  <Button onClick={handleSetDueDateAndTime}>Salvar Data Limite</Button>
                </div>
              </PopoverContent>
            </Popover>

            <Button
              onClick={handleGuideMe}
              disabled={isLoading}
              className="bg-indigo-500 hover:bg-indigo-600 text-white py-3 text-md flex items-center justify-center"
            >
              <ListTodo className="mr-2 h-5 w-5" /> Guiar-me (TDAH) (G)
            </Button>
          </div>

          <div className="mt-8 text-center">
            <p className="text-lg font-medium text-gray-700 mb-2">
              Tarefa {originalTasksCount - focusTasks.length + 1} de {originalTasksCount}
            </p>
            <Progress value={progressValue} className="w-full max-w-md mx-auto h-3" />
          </div>
        </div>
      )}

      {!isLoading && execucaoState === "finished" && originalTasksCount === 0 && (
        <div className="text-center mt-10">
          <p className="text-2xl font-semibold text-gray-700 mb-4">
            🎉 Todas as tarefas foram focadas e/ou concluídas!
          </p>
          <p className="text-lg text-gray-600 mb-6">
            Nenhuma tarefa restante para focar.
          </p>
          <Button
            onClick={loadTasksForFocus}
            className="px-8 py-4 text-xl bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-colors duration-200"
          >
            Iniciar Novo Foco
          </Button>
        </div>
      )}

      {!isLoading && execucaoState === "finished" && originalTasksCount > 0 && (
        <div className="text-center mt-10">
          <p className="text-2xl font-semibold text-gray-700 mb-4">
            ✅ Modo Foco Total concluído!
          </p>
          <p className="text-lg text-gray-600 mb-6">
            Você revisou todas as {originalTasksCount} tarefas.
          </p>
          <Button
            onClick={loadTasksForFocus}
            className="px-8 py-4 text-xl bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-colors duration-200"
          >
            Iniciar Novo Foco
          </Button>
        </div>
      )}
    </div>
  );
};

export default Execucao;