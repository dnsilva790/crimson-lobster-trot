"use client";

import React, { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useTodoist } from "@/context/TodoistContext";
import { TodoistTask } from "@/lib/types";
import LoadingSpinner from "@/components/ui/loading-spinner";
import { toast } from "sonner";
import { ListTodo, Save, Search, RotateCcw, FolderOpen } from "lucide-react";
import { get5W2H, updateDescriptionWithSection } from "@/lib/utils";

const SEIKETSU_5W2H_FILTER_STORAGE_KEY = "seiketsu_5w2h_filter_input";
const SEIKETSU_5W2H_PROCESSED_LABEL = "gtd_5w2h_processada";

const Seiketsu5W2H = () => {
  const { fetchTasks, updateTask, isLoading: isLoadingTodoist } = useTodoist();
  const [availableTasks, setAvailableTasks] = useState<TodoistTask[]>([]);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [currentTask, setCurrentTask] = useState<TodoistTask | null>(null);
  const [isLoadingTasks, setIsLoadingTasks] = useState(false);
  const [filterInput, setFilterInput] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem(SEIKETSU_5W2H_FILTER_STORAGE_KEY) || `no date & !@${SEIKETSU_5W2H_PROCESSED_LABEL}`;
    }
    return `no date & !@${SEIKETSU_5W2H_PROCESSED_LABEL}`;
  });

  // 5W2H States
  const [what, setWhat] = useState("");
  const [why, setWhy] = useState("");
  const [who, setWho] = useState("");
  const [where, setWhere] = useState("");
  const [when, setWhen] = useState("");
  const [how, setHow] = useState("");
  const [howMuch, setHowMuch] = useState("");

  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem(SEIKETSU_5W2H_FILTER_STORAGE_KEY, filterInput);
    }
  }, [filterInput]);

  const fetchAvailableTasks = useCallback(async () => {
    setIsLoadingTasks(true);
    try {
      const filter = filterInput.trim() || undefined;
      const fetchedTasks = await fetchTasks(filter, { includeSubtasks: false, includeRecurring: false });
      setAvailableTasks(fetchedTasks || []);
      if (fetchedTasks.length > 0) {
        toast.info(`Encontradas ${fetchedTasks.length} tarefas para processar.`);
      } else {
        toast.info("Nenhuma tarefa encontrada com o filtro atual.");
      }
    } catch (error) {
      console.error("Failed to fetch tasks:", error);
      toast.error("Falha ao carregar tarefas.");
    } finally {
      setIsLoadingTasks(false);
    }
  }, [fetchTasks, filterInput]);

  useEffect(() => {
    fetchAvailableTasks();
  }, [fetchAvailableTasks]);

  const handleTaskSelection = useCallback((taskId: string) => {
    const task = availableTasks.find(t => t.id === taskId) || null;
    setSelectedTaskId(taskId);
    setCurrentTask(task);
    
    if (task) {
      const w2h = get5W2H(task);
      setWhat(w2h.what || task.content);
      setWhy(w2h.why);
      setWho(w2h.who);
      setWhere(w2h.where);
      setWhen(w2h.when);
      setHow(w2h.how);
      setHowMuch(w2h.howMuch);
      toast.info(`Tarefa "${task.content}" selecionada.`);
    } else {
      setWhat("");
      setWhy("");
      setWho("");
      setWhere("");
      setWhen("");
      setHow("");
      setHowMuch("");
    }
  }, [availableTasks]);

  const handleSave5W2H = useCallback(async () => {
    if (!currentTask) {
      toast.error("Por favor, selecione uma tarefa primeiro.");
      return;
    }
    if (!what.trim() || !why.trim() || !who.trim() || !how.trim()) {
      toast.error("Os campos O Quê, Por Quê, Quem e Como são obrigatórios.");
      return;
    }

    let newDescription = currentTask.description || "";
    newDescription = updateDescriptionWithSection(newDescription, '[WHAT]:', what);
    newDescription = updateDescriptionWithSection(newDescription, '[WHY]:', why);
    newDescription = updateDescriptionWithSection(newDescription, '[WHO]:', who);
    newDescription = updateDescriptionWithSection(newDescription, '[WHERE]:', where);
    newDescription = updateDescriptionWithSection(newDescription, '[WHEN]:', when);
    newDescription = updateDescriptionWithSection(newDescription, '[HOW]:', how);
    newDescription = updateDescriptionWithSection(newDescription, '[HOW_MUCH]:', howMuch);

    const updatedLabels = [...new Set([...currentTask.labels, SEIKETSU_5W2H_PROCESSED_LABEL])];

    const updated = await updateTask(currentTask.id, {
      description: newDescription,
      labels: updatedLabels,
    });

    if (updated) {
      toast.success(`Template 5W2H salvo para "${currentTask.content}" e tarefa marcada como processada.`);
      // Remove a tarefa da lista de disponíveis e limpa a seleção
      setAvailableTasks(prev => prev.filter(t => t.id !== currentTask.id));
      setSelectedTaskId(null);
      setCurrentTask(null);
    } else {
      toast.error("Falha ao salvar o template 5W2H.");
    }
  }, [currentTask, what, why, who, where, when, how, howMuch, updateTask]);

  const isLoadingCombined = isLoadingTodoist || isLoadingTasks;

  return (
    <div className="p-4">
      <h2 className="text-3xl font-bold mb-2 text-gray-800">
        <FolderOpen className="inline-block h-8 w-8 mr-2 text-indigo-600" /> SEIKETSU - 5W2H de Entendimento
      </h2>
      <p className="text-lg text-gray-600 mb-6">
        Analise uma tarefa do backlog e preencha o template 5W2H para garantir clareza e acionabilidade.
      </p>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-1 p-6">
          <CardTitle className="text-xl font-bold mb-4 flex items-center gap-2">
            <ListTodo className="h-5 w-5 text-indigo-600" /> Selecionar Tarefa
          </CardTitle>
          <div className="grid gap-4">
            <div>
              <Label htmlFor="task-filter" className="text-gray-700">
                Filtro de Tarefas
              </Label>
              <Input
                id="task-filter"
                type="text"
                placeholder="Filtro Todoist (ex: no date & !@5w2h_processada)"
                value={filterInput}
                onChange={(e) => setFilterInput(e.target.value)}
                className="mt-1"
                disabled={isLoadingCombined}
              />
            </div>
            <Button onClick={fetchAvailableTasks} disabled={isLoadingCombined} className="flex items-center justify-center">
              {isLoadingTasks ? (
                <LoadingSpinner size={20} className="text-white" />
              ) : (
                <Search className="h-4 w-4 mr-2" />
              )}
              Buscar Tarefas
            </Button>
            
            <Label htmlFor="task-select" className="text-gray-700 mt-2">
              Tarefas Disponíveis ({availableTasks.length})
            </Label>
            <Select value={selectedTaskId || ""} onValueChange={handleTaskSelection} disabled={isLoadingCombined || availableTasks.length === 0}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Selecione uma tarefa" />
              </SelectTrigger>
              <SelectContent>
                {availableTasks.map(task => (
                  <SelectItem key={task.id} value={task.id}>
                    {task.content} (P{task.priority})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </Card>

        <Card className="lg:col-span-2 p-6">
          <CardHeader>
            <CardTitle className="text-xl font-bold flex items-center gap-2">
              <FolderOpen className="h-5 w-5 text-indigo-600" /> Template 5W2H
            </CardTitle>
            {currentTask && (
              <p className="text-sm text-gray-600">
                Tarefa: <span className="font-semibold">{currentTask.content}</span>
              </p>
            )}
          </CardHeader>
          <CardContent className="grid gap-6">
            {/* O Quê (What) */}
            <div>
              <Label htmlFor="what">O Quê? (What)</Label>
              <Input
                id="what"
                value={what}
                onChange={(e) => setWhat(e.target.value)}
                placeholder="O que precisa ser feito?"
                className="mt-1"
                required
                disabled={!currentTask || isLoadingCombined}
              />
            </div>

            {/* Por Quê (Why) */}
            <div>
              <Label htmlFor="why">Por Quê? (Why)</Label>
              <Textarea
                id="why"
                value={why}
                onChange={(e) => setWhy(e.target.value)}
                placeholder="Qual o propósito ou benefício?"
                rows={2}
                className="mt-1"
                required
                disabled={!currentTask || isLoadingCombined}
              />
            </div>

            {/* Quem (Who) */}
            <div>
              <Label htmlFor="who">Quem? (Who)</Label>
              <Input
                id="who"
                value={who}
                onChange={(e) => setWho(e.target.value)}
                placeholder="Quem é o responsável pela execução?"
                className="mt-1"
                required
                disabled={!currentTask || isLoadingCombined}
              />
            </div>

            {/* Onde (Where) */}
            <div>
              <Label htmlFor="where">Onde? (Where)</Label>
              <Input
                id="where"
                value={where}
                onChange={(e) => setWhere(e.target.value)}
                placeholder="Onde será realizado?"
                className="mt-1"
                disabled={!currentTask || isLoadingCombined}
              />
            </div>

            {/* Quando (When) */}
            <div>
              <Label htmlFor="when">Quando? (When)</Label>
              <Input
                id="when"
                value={when}
                onChange={(e) => setWhen(e.target.value)}
                placeholder="Quando deve ser feito/entregue? (Data ou Prazo)"
                className="mt-1"
                disabled={!currentTask || isLoadingCombined}
              />
            </div>

            {/* Como (How) */}
            <div>
              <Label htmlFor="how">Como? (How)</Label>
              <Textarea
                id="how"
                value={how}
                onChange={(e) => setHow(e.target.value)}
                placeholder="Como será feito? (Passos, metodologia)"
                rows={3}
                className="mt-1"
                required
                disabled={!currentTask || isLoadingCombined}
              />
            </div>

            {/* Quanto (How Much) */}
            <div>
              <Label htmlFor="howMuch">Quanto? (How Much)</Label>
              <Input
                id="howMuch"
                value={howMuch}
                onChange={(e) => setHowMuch(e.target.value)}
                placeholder="Quanto custará? (Custo, recursos)"
                className="mt-1"
                disabled={!currentTask || isLoadingCombined}
              />
            </div>

            <Button 
              onClick={handleSave5W2H} 
              className="w-full mt-4 flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white"
              disabled={!currentTask || isLoadingCombined}
            >
              <Save className="h-4 w-4" /> Salvar 5W2H e Marcar como Processada
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Seiketsu5W2H;