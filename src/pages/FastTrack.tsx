"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useTodoist } from "@/context/TodoistContext";
import { TodoistTask, DurationRange } from "@/lib/types";
import LoadingSpinner from "@/components/ui/loading-spinner";
import { toast } from "sonner";
import { getDurationRanges, saveDurationRanges } from "@/utils/durationRangeStorage";
import DurationRangeConfig from "@/components/DurationRangeConfig";
import FastTrackTaskCard from "@/components/FastTrackTaskCard";
import { calculateNext15MinInterval } from "@/utils/dateUtils";
import { format, parseISO, isValid } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Rocket, Filter, RotateCcw, XCircle } from "lucide-react";

const FAST_TRACK_FILTER_INPUT_STORAGE_KEY = "fast_track_filter_input";
const FAST_TRACK_CATEGORY_FILTER_STORAGE_KEY = "fast_track_category_filter";

const FastTrack = () => {
  const { fetchTasks, closeTask, updateTask, isLoading: isLoadingTodoist } = useTodoist();
  const [allTasks, setAllTasks] = useState<TodoistTask[]>([]);
  const [filteredTasks, setFilteredTasks] = useState<TodoistTask[]>([]);
  const [durationRanges, setDurationRanges] = useState<DurationRange[]>([]);
  const [isLoadingTasks, setIsLoadingTasks] = useState(false);

  const [filterInput, setFilterInput] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem(FAST_TRACK_FILTER_INPUT_STORAGE_KEY) || "";
    }
    return "";
  });
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState<"all" | "pessoal" | "profissional">(() => {
    if (typeof window !== 'undefined') {
      return (localStorage.getItem(FAST_TRACK_CATEGORY_FILTER_STORAGE_KEY) as "all" | "pessoal" | "profissional") || "all";
    }
    return "all";
  });

  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem(FAST_TRACK_FILTER_INPUT_STORAGE_KEY, filterInput);
    }
  }, [filterInput]);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem(FAST_TRACK_CATEGORY_FILTER_STORAGE_KEY, selectedCategoryFilter);
    }
  }, [selectedCategoryFilter]);

  const loadDurationRanges = useCallback(() => {
    const loadedRanges = getDurationRanges();
    setDurationRanges(loadedRanges);
    console.log("FastTrack: Loaded duration ranges from storage:", loadedRanges);
  }, []);

  useEffect(() => {
    loadDurationRanges();
  }, [loadDurationRanges]);

  const fetchAndFilterTasks = useCallback(async () => {
    setIsLoadingTasks(true);
    try {
      const todoistFilter = filterInput.trim() || undefined;
      const fetched = await fetchTasks(todoistFilter, { includeSubtasks: false, includeRecurring: false });
      
      let processedTasks = fetched || [];

      // Apply category filter
      if (selectedCategoryFilter !== "all") {
        processedTasks = processedTasks.filter(task => {
          const isPersonal = task.labels.includes("pessoal");
          const isProfessional = task.labels.includes("profissional");
          if (selectedCategoryFilter === "pessoal") return isPersonal && !isProfessional;
          if (selectedCategoryFilter === "profissional") return isProfessional && !isPersonal;
          return false; // Should not happen with "all"
        });
      }

      // Sort tasks: P1 > P2 > P3 > P4, then by deadline, then by due date, then by estimated duration (shortest first)
      processedTasks.sort((a, b) => {
        if (b.priority !== a.priority) return b.priority - a.priority;

        const getDeadlineValue = (task: TodoistTask) => {
          if (typeof task.deadline === 'string' && task.deadline) return parseISO(task.deadline).getTime();
          return Infinity;
        };
        const deadlineA = getDeadlineValue(a);
        const deadlineB = getDeadlineValue(b);
        if (deadlineA !== deadlineB) return deadlineA - deadlineB;

        const getDueDateValue = (task: TodoistTask) => {
          if (typeof task.due?.datetime === 'string' && task.due.datetime) return parseISO(task.due.datetime).getTime();
          if (typeof task.due?.date === 'string' && task.due.date) return parseISO(task.due.date).getTime();
          return Infinity;
        };
        const dateA = getDueDateValue(a);
        const dateB = getDueDateValue(b);
        if (dateA !== dateB) return dateA - dateB;

        const durationA = a.estimatedDurationMinutes || Infinity;
        const durationB = b.estimatedDurationMinutes || Infinity;
        return durationA - durationB;
      });

      setAllTasks(processedTasks);
      setFilteredTasks(processedTasks);
      toast.success(`Carregadas ${processedTasks.length} tarefas para Fast Track.`);
    } catch (error) {
      console.error("Failed to fetch tasks for Fast Track:", error);
      toast.error("Falha ao carregar tarefas para Fast Track.");
    } finally {
      setIsLoadingTasks(false);
    }
  }, [fetchTasks, filterInput, selectedCategoryFilter]);

  useEffect(() => {
    fetchAndFilterTasks();
  }, [fetchAndFilterTasks]);

  const handleDurationRangesSave = useCallback((newRanges: DurationRange[]) => {
    console.log("FastTrack: handleDurationRangesSave called with new ranges:", newRanges);
    setDurationRanges(newRanges);
    fetchAndFilterTasks(); // Re-fetch and re-group tasks with new ranges
  }, [fetchAndFilterTasks]);

  const handleCompleteTask = useCallback(async (taskId: string) => {
    const success = await closeTask(taskId);
    if (success !== undefined) {
      toast.success("Tarefa concluída!");
      fetchAndFilterTasks();
    }
  }, [closeTask, fetchAndFilterTasks]);

  const handleUpdateTaskAndRefresh = useCallback(async (taskId: string, data: {
    priority?: 1 | 2 | 3 | 4;
    due_date?: string | null;
    due_datetime?: string | null;
    duration?: number;
    duration_unit?: "minute" | "day";
    deadline?: string | null;
  }) => {
    const updated = await updateTask(taskId, data);
    if (updated) {
      toast.success("Tarefa atualizada com sucesso!");
      fetchAndFilterTasks();
    }
    return updated;
  }, [updateTask, fetchAndFilterTasks]);

  const handlePostponeTask = useCallback(async (taskId: string) => {
    const nextInterval = calculateNext15MinInterval(new Date());
    const updated = await updateTask(taskId, {
      due_date: nextInterval.date,
      due_datetime: nextInterval.datetime,
    });
    if (updated) {
      toast.success(`Tarefa postergada para ${format(parseISO(nextInterval.datetime), "dd/MM/yyyy HH:mm", { locale: ptBR })}!`);
      fetchAndFilterTasks();
    } else {
      toast.error("Falha ao postergar a tarefa.");
    }
  }, [updateTask, fetchAndFilterTasks]);

  const groupedTasks = useMemo(() => {
    console.log("FastTrack: Recalculating groupedTasks. Current durationRanges:", durationRanges);
    const groups: { [key: string]: TodoistTask[] } = {};
    const noDurationKey = "no-duration";

    // Initialize groups with defined ranges
    durationRanges.forEach(range => {
      groups[range.id] = [];
    });
    groups[noDurationKey] = []; // For tasks without estimated duration

    filteredTasks.forEach(task => {
      const duration = task.estimatedDurationMinutes;
      let assigned = false;

      console.log(`  Task: "${task.content}" (ID: ${task.id}), estimatedDurationMinutes: ${duration}`);

      if (duration === undefined || duration === null) {
        groups[noDurationKey].push(task);
        assigned = true;
        console.log(`    -> Assigned to "Sem Duração Definida" (no duration).`);
      } else {
        for (const range of durationRanges) {
          const min = range.minMinutes === null ? -Infinity : range.minMinutes;
          const max = range.maxMinutes === null ? Infinity : range.maxMinutes;

          console.log(`    Comparing with range "${range.label}" (min: ${min}, max: ${max})`);

          if (duration >= min && duration <= max) {
            groups[range.id].push(task);
            assigned = true;
            console.log(`    -> Assigned to range "${range.label}".`);
            break;
          }
        }
      }

      if (!assigned && (duration !== undefined && duration !== null)) {
        // Fallback for tasks that don't fit any defined range (e.g., if ranges are not exhaustive)
        groups[noDurationKey].push(task);
        console.log(`    -> Assigned to "Sem Duração Definida" (did not fit any custom range).`);
      }
    });

    // Sort groups by their defined order
    const sortedGroupedTasks: { range: DurationRange | { id: string; label: string }, tasks: TodoistTask[] }[] = [];
    durationRanges.forEach(range => {
      if (groups[range.id] && groups[range.id].length > 0) {
        sortedGroupedTasks.push({ range, tasks: groups[range.id] });
      }
    });
    // Add 'no duration' group at the end if it has tasks
    if (groups[noDurationKey].length > 0) {
      sortedGroupedTasks.push({ range: { id: noDurationKey, label: "Sem Duração Definida" }, tasks: groups[noDurationKey] });
    }

    console.log("FastTrack: Grouped tasks result:", sortedGroupedTasks);
    return sortedGroupedTasks;
  }, [filteredTasks, durationRanges]);

  const handleClearFilter = useCallback(() => {
    setFilterInput("");
    setSelectedCategoryFilter("all");
  }, []);

  const isLoading = isLoadingTodoist || isLoadingTasks;

  return (
    <div className="p-4">
      <h2 className="text-3xl font-bold mb-2 text-gray-800">
        <Rocket className="inline-block h-8 w-8 mr-2 text-blue-600" /> FAST TRACK - Backlog por Duração
      </h2>
      <p className="text-lg text-gray-600 mb-6">
        Organize e ataque seu backlog agrupando tarefas por duração estimada.
      </p>

      <Card className="mb-6 p-6">
        <CardTitle className="text-xl font-bold mb-4 flex items-center gap-2">
          <Filter className="h-5 w-5 text-indigo-600" /> Filtros e Configurações
        </CardTitle>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
          <div className="md:col-span-1">
            <Label htmlFor="task-filter" className="text-left text-gray-600 font-medium">
              Filtro de Tarefas (Todoist)
            </Label>
            <div className="relative flex items-center mt-1">
              <Input
                type="text"
                id="task-filter"
                placeholder="Ex: 'hoje', 'p1', '#projeto'"
                value={filterInput}
                onChange={(e) => setFilterInput(e.target.value)}
                className="pr-10"
                disabled={isLoading}
              />
              {filterInput && (
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={handleClearFilter}
                  className="absolute right-0 top-0 h-full px-3"
                  disabled={isLoading}
                >
                  <XCircle className="h-4 w-4" />
                </Button>
              )}
            </div>
          </div>
          <div className="md:col-span-1">
            <Label htmlFor="category-filter" className="text-left text-gray-600 font-medium">
              Filtrar por Categoria
            </Label>
            <Select
              value={selectedCategoryFilter}
              onValueChange={(value: "all" | "pessoal" | "profissional") => setSelectedCategoryFilter(value)}
              disabled={isLoading}
            >
              <SelectTrigger className="w-full mt-1">
                <SelectValue placeholder="Todas as Categorias" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas as Categorias</SelectItem>
                <SelectItem value="pessoal">Pessoal</SelectItem>
                <SelectItem value="profissional">Profissional</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="md:col-span-1 flex gap-2">
            <Button onClick={fetchAndFilterTasks} disabled={isLoading} className="flex-grow flex items-center gap-2">
              <RotateCcw className="h-4 w-4" /> Recarregar Tarefas
            </Button>
            <DurationRangeConfig onSave={handleDurationRangesSave} />
          </div>
        </div>
      </Card>

      {isLoading ? (
        <div className="flex justify-center items-center h-64">
          <LoadingSpinner size={40} />
        </div>
      ) : filteredTasks.length === 0 ? (
        <div className="text-center p-8 border rounded-lg bg-gray-50">
          <p className="text-gray-600 text-lg mb-4">Nenhuma tarefa encontrada com os filtros atuais.</p>
          <Button onClick={fetchAndFilterTasks} className="bg-indigo-600 hover:bg-indigo-700 text-white">
            Recarregar Todas as Tarefas
          </Button>
        </div>
      ) : (
        <div className="space-y-8">
          {groupedTasks.map((group) => (
            <div key={group.range.id}>
              <h3 className="text-2xl font-bold mb-4 text-gray-800 border-b pb-2">
                {group.range.label} ({group.tasks.length})
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {group.tasks.map(task => (
                  <FastTrackTaskCard
                    key={task.id}
                    task={task}
                    isLoading={isLoadingTodoist}
                    onComplete={handleCompleteTask}
                    onUpdateTask={handleUpdateTaskAndRefresh}
                    onPostpone={handlePostponeTask}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default FastTrack;