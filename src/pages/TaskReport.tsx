"use client";

import React, { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ListTodo, FileText, Search, RotateCcw, Download, Filter } from "lucide-react";
import { useTodoist } from "@/context/TodoistContext";
import { TodoistTask, EisenhowerTask } from "@/lib/types";
import LoadingSpinner from "@/components/ui/loading-spinner";
import { toast } from "sonner";
import TaskTableComponent from "@/components/TaskTableComponent";
import { exportTasksToExcel } from "@/utils/excelExport";
import { getEisenhowerRating } from "@/utils/eisenhowerUtils"; // Importar a nova função

const TASK_REPORT_FILTER_INPUT_STORAGE_KEY = "task_report_filter_input";

const TaskReport = () => {
  const { fetchTasks, isLoading: isLoadingTodoist } = useTodoist();
  const [tasks, setTasks] = useState<TodoistTask[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [filterInput, setFilterInput] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem(TASK_REPORT_FILTER_INPUT_STORAGE_KEY) || "all";
    }
    return "all";
  });

  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem(TASK_REPORT_FILTER_INPUT_STORAGE_KEY, filterInput);
    }
  }, [filterInput]);

  const loadTasks = useCallback(async () => {
    setIsLoading(true);
    setTasks([]);
    try {
      const filter = filterInput.trim() || undefined;
      const includeCompleted = filter?.toLowerCase() === 'all' || filter?.toLowerCase().includes('completed');
      const fetchedTasks = await fetchTasks(filter, { includeSubtasks: true, includeRecurring: true, includeCompleted: includeCompleted });
      
      // 1. Mesclar tarefas do Todoist com as pontuações do Eisenhower da descrição
      const mergedTasks = fetchedTasks.map(task => {
        const { urgency, importance } = getEisenhowerRating(task);
        return { ...task, urgency, importance } as TodoistTask;
      });
      
      if (mergedTasks && mergedTasks.length > 0) {
        setTasks(mergedTasks);
        toast.success(`Carregadas ${mergedTasks.length} tarefas para o relatório.`);
      } else {
        toast.info("Nenhuma tarefa encontrada com o filtro atual.");
      }
    } catch (error) {
      console.error("Failed to load tasks for report:", error);
      toast.error("Falha ao carregar tarefas.");
    } finally {
      setIsLoading(false);
    }
  }, [fetchTasks, filterInput]);

  useEffect(() => {
    loadTasks();
  }, [loadTasks]);

  const handleExport = () => {
    if (tasks.length === 0) {
      toast.error("Nenhuma tarefa para exportar.");
      return;
    }
    exportTasksToExcel(tasks, 'relatorio_tarefas');
    toast.success("Exportação para Excel iniciada!");
  };

  const isLoadingCombined = isLoading || isLoadingTodoist;

  return (
    <div className="p-4">
      <h2 className="text-3xl font-bold mb-2 text-gray-800">
        <FileText className="inline-block h-8 w-8 mr-2 text-indigo-600" /> RELATÓRIO DE TAREFAS
      </h2>
      <p className="text-lg text-gray-600 mb-6">
        Visualize e exporte todas as suas tarefas do Todoist.
      </p>

      <Card className="mb-6 p-6">
        <CardTitle className="text-xl font-bold mb-4 flex items-center gap-2">
          <Filter className="h-5 w-5 text-indigo-600" /> Configuração do Relatório
        </CardTitle>
        <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
          <div className="md:col-span-2">
            <Label htmlFor="task-filter" className="text-gray-700">
              Filtro de Tarefas (Todoist)
            </Label>
            <Input
              id="task-filter"
              type="text"
              placeholder="Ex: 'hoje', 'p1', 'all', 'completed'"
              value={filterInput}
              onChange={(e) => setFilterInput(e.target.value)}
              className="mt-1"
              disabled={isLoadingCombined}
            />
            <p className="text-sm text-gray-500 mt-1">
              Use a sintaxe de filtro do Todoist. Use 'all' para todas as tarefas (incluindo concluídas).
            </p>
          </div>
          <div className="flex gap-2">
            <Button
              onClick={loadTasks}
              disabled={isLoadingCombined}
              className="flex-1 flex items-center justify-center bg-indigo-600 hover:bg-indigo-700 text-white"
            >
              {isLoadingCombined ? (
                <LoadingSpinner size={20} className="text-white" />
              ) : (
                <Search className="h-4 w-4 mr-2" />
              )}
              Buscar
            </Button>
            <Button
              onClick={handleExport}
              disabled={isLoadingCombined || tasks.length === 0}
              className="flex-1 flex items-center justify-center bg-green-600 hover:bg-green-700 text-white"
            >
              <Download className="h-4 w-4 mr-2" /> Exportar ({tasks.length})
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-xl font-bold text-gray-800">
            Visualização em Tabela ({tasks.length} tarefas)
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {tasks.length > 0 ? (
            <TaskTableComponent tasks={tasks} />
          ) : (
            <div className="p-6 text-center text-gray-600">
              {isLoadingCombined ? "Carregando tarefas..." : "Nenhuma tarefa para exibir. Ajuste o filtro e clique em Buscar."}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default TaskReport;