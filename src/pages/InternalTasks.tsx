"use client";

import React, { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { getInternalTasks, addInternalTask, updateInternalTask, deleteInternalTask, saveInternalTasks } from "@/utils/internalTaskStorage";
import { InternalTask, TodoistProject } from "@/lib/types";
import { toast } from "sonner";
import { PlusCircle, Trash2, Edit, Save, XCircle, Clock, CalendarIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { useTodoist } from "@/context/TodoistContext";
import { format, parseISO, isValid } from "date-fns";
import { ptBR } from "date-fns/locale";

const InternalTasks = () => {
  const { createTodoistTask, fetchProjects, isLoading: isLoadingTodoist } = useTodoist();
  const [tasks, setTasks] = useState<InternalTask[]>([]);
  const [newTaskContent, setNewTaskContent] = useState("");
  const [newTaskDescription, setNewTaskDescription] = useState("");
  const [newTaskCategory, setNewTaskCategory] = useState<"pessoal" | "profissional">("pessoal");
  const [newTaskEstimatedDuration, setNewTaskEstimatedDuration] = useState<string>("15");
  const [newDueDate, setNewDueDate] = useState<Date | undefined>(undefined);
  const [newDueTime, setNewDueTime] = useState<string>("");
  const [newDeadline, setNewDeadline] = useState<Date | undefined>(undefined); // Adicionado

  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [editedContent, setEditedContent] = useState("");
  const [editedDescription, setEditedDescription] = useState("");
  const [editedCategory, setEditedCategory] = useState<"pessoal" | "profissional">("pessoal");
  const [editedEstimatedDuration, setEditedEstimatedDuration] = useState<string>("15");
  const [editedDueDate, setEditedDueDate] = useState<Date | undefined>(undefined);
  const [editedDueTime, setEditedDueTime] = useState<string>("");
  const [editedDeadline, setEditedDeadline] = useState<Date | undefined>(undefined); // Adicionado

  // New states for Todoist task creation
  const [taskCreationType, setTaskCreationType] = useState<"internal" | "todoist">("internal");
  const [todoistProjects, setTodoistProjects] = useState<TodoistProject[]>([]);
  const [selectedTodoistProjectId, setSelectedTodoistProjectId] = useState<string | undefined>(undefined);

  useEffect(() => {
    setTasks(getInternalTasks());
  }, []);

  // Fetch Todoist projects
  useEffect(() => {
    const loadProjects = async () => {
      const projects = await fetchProjects();
      if (projects && projects.length > 0) {
        setTodoistProjects(projects);
        setSelectedTodoistProjectId(projects[0].id); // Select the first project by default
      }
    };
    loadProjects();
  }, [fetchProjects]);

  const handleAddTask = useCallback(async () => {
    if (!newTaskContent.trim()) {
      toast.error("O conteúdo da tarefa não pode ser vazio.");
      return;
    }
    const duration = parseInt(newTaskEstimatedDuration, 10);
    if (isNaN(duration) || duration <= 0) {
      toast.error("A duração estimada deve ser um número positivo.");
      return;
    }

    if (taskCreationType === "todoist") {
      if (!selectedTodoistProjectId) {
        toast.error("Por favor, selecione um projeto do Todoist.");
        return;
      }

      const labels = newTaskCategory === "none" ? [] : [newTaskCategory];

      const todoistTaskData = {
        content: newTaskContent.trim(),
        description: newTaskDescription.trim(),
        project_id: selectedTodoistProjectId,
        priority: 1 as 1 | 2 | 3 | 4, // Default to P4 (lowest) for new tasks
        labels: labels,
        duration: duration,
        duration_unit: "minute" as "minute",
        due_date: newDueDate ? format(newDueDate, "yyyy-MM-dd") : undefined,
        due_datetime: newDueDate && newDueTime ? format(newDueDate, "yyyy-MM-dd") + "T" + newDueTime + ":00" : undefined,
        deadline: newDeadline ? format(newDeadline, "yyyy-MM-dd") : undefined, // Adicionado
      };

      const createdTask = await createTodoistTask(todoistTaskData);
      if (createdTask) {
        toast.success(`Tarefa "${createdTask.content}" criada no Todoist!`);
        setNewTaskContent("");
        setNewTaskDescription("");
        setNewTaskCategory("pessoal");
        setNewTaskEstimatedDuration("15");
        setNewDueDate(undefined);
        setNewDueTime("");
        setNewDeadline(undefined); // Adicionado
      } else {
        toast.error("Falha ao criar tarefa no Todoist.");
      }
    } else {
      const newTask: InternalTask = {
        id: Date.now().toString(),
        content: newTaskContent.trim(),
        description: newTaskDescription.trim(),
        category: newTaskCategory,
        isCompleted: false,
        createdAt: new Date().toISOString(),
        estimatedDurationMinutes: duration,
        dueDate: newDueDate ? format(newDueDate, "yyyy-MM-dd") : null,
        dueTime: newDueTime || null,
      };

      const updatedTasks = addInternalTask(newTask);
      setTasks(updatedTasks);
      setNewTaskContent("");
      setNewTaskDescription("");
      setNewTaskCategory("pessoal");
      setNewTaskEstimatedDuration("15");
      setNewDueDate(undefined);
      setNewDueTime("");
      toast.success("Tarefa interna adicionada!");
    }
  }, [newTaskContent, newTaskDescription, newTaskCategory, newTaskEstimatedDuration, newDueDate, newDueTime, newDeadline, taskCreationType, selectedTodoistProjectId, createTodoistTask]); // Adicionado newDeadline

  const handleToggleComplete = useCallback((taskId: string) => {
    setTasks((prevTasks) => {
      const updatedTasks = prevTasks.map((task) =>
        task.id === taskId ? { ...task, isCompleted: !task.isCompleted } : task
      );
      saveInternalTasks(updatedTasks);
      toast.info(`Tarefa ${updatedTasks.find(t => t.id === taskId)?.isCompleted ? 'concluída' : 'reaberta'}!`);
      return updatedTasks;
    });
  }, []);

  const handleDeleteTask = useCallback((taskId: string) => {
    const updatedTasks = deleteInternalTask(taskId);
    setTasks(updatedTasks);
    toast.success("Tarefa interna excluída!");
  }, []);

  const handleStartEditing = useCallback((task: InternalTask) => {
    setEditingTaskId(task.id);
    setEditedContent(task.content);
    setEditedDescription(task.description || "");
    setEditedCategory(task.category);
    setEditedEstimatedDuration(String(task.estimatedDurationMinutes || 15));
    setEditedDueDate(task.dueDate ? parseISO(task.dueDate) : undefined);
    setEditedDueTime(task.dueTime || "");
    setEditedDeadline(task.dueDate ? parseISO(task.dueDate) : undefined); // Placeholder for internal tasks, as they don't have a separate deadline field // Adicionado
  }, []);

  const handleCancelEditing = useCallback(() => {
    setEditingTaskId(null);
    setEditedContent("");
    setEditedDescription("");
    setEditedCategory("pessoal");
    setEditedEstimatedDuration("15");
    setEditedDueDate(undefined);
    setEditedDueTime("");
    setEditedDeadline(undefined); // Adicionado
  }, []);

  const handleSaveEdit = useCallback(() => {
    if (!editingTaskId || !editedContent.trim()) {
      toast.error("O conteúdo da tarefa não pode ser vazio.");
      return;
    }
    const duration = parseInt(editedEstimatedDuration, 10);
    if (isNaN(duration) || duration <= 0) {
      toast.error("A duração estimada deve ser um número positivo.");
      return;
    }

    const updatedTask: InternalTask = {
      id: editingTaskId,
      content: editedContent.trim(),
      description: editedDescription.trim(),
      category: editedCategory,
      isCompleted: tasks.find(t => t.id === editingTaskId)?.isCompleted || false,
      createdAt: tasks.find(t => t.id === editingTaskId)?.createdAt || new Date().toISOString(),
      estimatedDurationMinutes: duration,
      dueDate: editedDueDate ? format(editedDueDate, "yyyy-MM-dd") : null,
      dueTime: editedDueTime || null,
    };

    const updatedTasks = updateInternalTask(updatedTask);
    setTasks(updatedTasks);
    setEditingTaskId(null);
    setEditedContent("");
    setEditedDescription("");
    setEditedCategory("pessoal");
    setEditedEstimatedDuration("15");
    setEditedDueDate(undefined);
    setEditedDueTime("");
    setEditedDeadline(undefined); // Adicionado
    toast.success("Tarefa interna atualizada!");
  }, [editingTaskId, editedContent, editedDescription, editedCategory, editedEstimatedDuration, editedDueDate, editedDueTime, tasks]); // Adicionado editedDeadline

  const personalTasks = tasks.filter(task => task.category === "pessoal");
  const professionalTasks = tasks.filter(task => task.category === "profissional");

  const renderTaskCard = (task: InternalTask) => (
    <Card key={task.id} className={cn(
      "p-4 flex flex-col gap-2",
      task.isCompleted ? "bg-gray-50 border-gray-200 line-through text-gray-500" : "bg-white border-gray-300",
      task.category === "pessoal" ? "border-l-4 border-blue-500" : "border-l-4 border-green-500"
    )}>
      {editingTaskId === task.id ? (
        <div className="grid gap-2">
          <Input
            value={editedContent}
            onChange={(e) => setEditedContent(e.target.value)}
            className="font-semibold text-lg"
          />
          <Textarea
            value={editedDescription}
            onChange={(e) => setEditedDescription(e.target.value)}
            placeholder="Descrição (opcional)"
            rows={2}
            className="text-sm"
          />
          <Select value={editedCategory} onValueChange={(value: "pessoal" | "profissional") => setEditedCategory(value)}>
            <SelectTrigger>
              <SelectValue placeholder="Categoria" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="pessoal">Pessoal</SelectItem>
              <SelectItem value="profissional">Profissional</SelectItem>
            </SelectContent>
          </Select>
          <div>
            <Label htmlFor="edited-duration">Duração Estimada (minutos)</Label>
            <Input
              id="edited-duration"
              type="number"
              value={editedEstimatedDuration}
              onChange={(e) => setEditedEstimatedDuration(e.target.value)}
              min="1"
              className="mt-1"
            />
          </div>
          <div>
            <Label htmlFor="edited-due-date">Data de Vencimento</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant={"outline"}
                  className={cn(
                    "w-full justify-start text-left font-normal mt-1",
                    !editedDueDate && "text-muted-foreground"
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {editedDueDate && isValid(editedDueDate) ? format(editedDueDate, "PPP", { locale: ptBR }) : <span>Escolha uma data</span>}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0">
                <Calendar
                  mode="single"
                  selected={editedDueDate}
                  onSelect={setEditedDueDate}
                  initialFocus
                  locale={ptBR}
                />
              </PopoverContent>
            </Popover>
          </div>
          <div>
            <Label htmlFor="edited-due-time">Hora de Vencimento (Opcional)</Label>
            <Input
              id="edited-due-time"
              type="time"
              value={editedDueTime}
              onChange={(e) => setEditedDueTime(e.target.value)}
              className="mt-1"
            />
          </div>
          <div className="flex gap-2 mt-2">
            <Button onClick={handleSaveEdit} size="sm" className="flex-1">
              <Save className="h-4 w-4 mr-2" /> Salvar
            </Button>
            <Button onClick={handleCancelEditing} variant="outline" size="sm" className="flex-1">
              <XCircle className="h-4 w-4 mr-2" /> Cancelar
            </Button>
          </div>
        </div>
      ) : (
        <>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Checkbox
                checked={task.isCompleted}
                onCheckedChange={() => handleToggleComplete(task.id)}
                id={`task-${task.id}`}
              />
              <Label htmlFor={`task-${task.id}`} className="text-lg font-semibold cursor-pointer">
                {task.content}
              </Label>
            </div>
            <div className="flex gap-2">
              <Button variant="ghost" size="icon" onClick={() => handleStartEditing(task)}>
                <Edit className="h-4 w-4" />
              </Button>
              <Button variant="ghost" size="icon" onClick={() => handleDeleteTask(task.id)}>
                <Trash2 className="h-4 w-4 text-red-500" />
              </Button>
            </div>
          </div>
          {task.description && <p className="text-sm text-gray-600 ml-6">{task.description}</p>}
          <div className="flex items-center text-xs text-gray-400 ml-6 flex-wrap gap-x-4 gap-y-1">
            <span>Criado em: {new Date(task.createdAt).toLocaleDateString()}</span>
            <span className="mx-2">|</span>
            <span>Categoria: {task.category === "pessoal" ? "Pessoal" : "Profissional"}</span>
            {task.estimatedDurationMinutes && (
              <>
                <span className="mx-2">|</span>
                <span className="flex items-center">
                  <Clock className="h-3 w-3 mr-1" /> {task.estimatedDurationMinutes} min
                </span>
              </>
            )}
            {task.dueDate && isValid(parseISO(task.dueDate)) && (
              <>
                <span className="mx-2">|</span>
                <span className="flex items-center">
                  <CalendarIcon className="h-3 w-3 mr-1" /> Vencimento: {format(parseISO(task.dueDate), "dd/MM/yyyy", { locale: ptBR })}
                  {task.dueTime && ` às ${task.dueTime}`}
                </span>
              </>
            )}
          </div>
        </>
      )}
    </Card>
  );

  return (
    <div className="p-4">
      <h2 className="text-3xl font-bold mb-2 text-gray-800">📝 Minhas Tarefas Internas</h2>
      <p className="text-lg text-gray-600 mb-6">
        Gerencie suas tarefas pessoais e profissionais diretamente aqui, sem sincronizar com o Todoist.
      </p>

      <Card className="mb-8 p-6">
        <CardTitle className="text-xl font-bold mb-4 flex items-center gap-2">
          <PlusCircle className="h-5 w-5 text-indigo-600" /> Adicionar Nova Tarefa
        </CardTitle>
        <div className="grid gap-4">
          <div>
            <Label htmlFor="task-creation-type">Tipo de Tarefa</Label>
            <Select value={taskCreationType} onValueChange={(value: "internal" | "todoist") => setTaskCreationType(value)}>
              <SelectTrigger className="w-full mt-1">
                <SelectValue placeholder="Selecione o tipo de tarefa" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="internal">Tarefa Interna</SelectItem>
                <SelectItem value="todoist">Tarefa Todoist</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {taskCreationType === "todoist" && (
            <div>
              <Label htmlFor="todoist-project">Projeto do Todoist</Label>
              <Select
                value={selectedTodoistProjectId}
                onValueChange={(value) => setSelectedTodoistProjectId(value)}
                disabled={isLoadingTodoist || todoistProjects.length === 0}
              >
                <SelectTrigger className="w-full mt-1">
                  <SelectValue placeholder="Selecione um projeto" />
                </SelectTrigger>
                <SelectContent>
                  {todoistProjects.length === 0 ? (
                    <SelectItem value="loading" disabled>Carregando projetos...</SelectItem>
                  ) : (
                    todoistProjects.map((project) => (
                      <SelectItem key={project.id} value={project.id}>
                        {project.name}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>
          )}

          <div>
            <Label htmlFor="new-task-content">Conteúdo da Tarefa</Label>
            <Input
              id="new-task-content"
              value={newTaskContent}
              onChange={(e) => setNewTaskContent(e.target.value)}
              placeholder="Ex: Comprar pão"
              className="mt-1"
            />
          </div>
          <div>
            <Label htmlFor="new-task-description">Descrição (Opcional)</Label>
            <Textarea
              id="new-task-description"
              value={newTaskDescription}
              onChange={(e) => setNewTaskDescription(e.target.value)}
              placeholder="Detalhes da tarefa..."
              rows={2}
              className="mt-1"
            />
          </div>
          <div>
            <Label htmlFor="new-task-category">Categoria</Label>
            <Select value={newTaskCategory} onValueChange={(value: "pessoal" | "profissional") => setNewTaskCategory(value)}>
              <SelectTrigger className="w-full mt-1">
                <SelectValue placeholder="Selecione a categoria" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="pessoal">Pessoal</SelectItem>
                <SelectItem value="profissional">Profissional</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label htmlFor="new-task-duration">Duração Estimada (minutos)</Label>
            <Input
              id="new-task-duration"
              type="number"
              value={newTaskEstimatedDuration}
              onChange={(e) => setNewTaskEstimatedDuration(e.target.value)}
              min="1"
              placeholder="Ex: 30"
              className="mt-1"
            />
          </div>
          <div>
            <Label htmlFor="new-due-date">Data de Vencimento (Opcional)</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant={"outline"}
                  className={cn(
                    "w-full justify-start text-left font-normal mt-1",
                    !newDueDate && "text-muted-foreground"
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {newDueDate && isValid(newDueDate) ? format(newDueDate, "PPP", { locale: ptBR }) : <span>Escolha uma data</span>}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0">
                <Calendar
                  mode="single"
                  selected={newDueDate}
                  onSelect={setNewDueDate}
                  initialFocus
                  locale={ptBR}
                />
              </PopoverContent>
            </Popover>
          </div>
          <div>
            <Label htmlFor="new-due-time">Hora de Vencimento (Opcional)</Label>
            <Input
              id="new-due-time"
              type="time"
              value={newDueTime}
              onChange={(e) => setNewDueTime(e.target.value)}
              className="mt-1"
            />
          </div>
          <div> {/* Adicionado */}
            <Label htmlFor="new-deadline">Deadline (Opcional)</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant={"outline"}
                  className={cn(
                    "w-full justify-start text-left font-normal mt-1",
                    !newDeadline && "text-muted-foreground"
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {newDeadline && isValid(newDeadline) ? format(newDeadline, "PPP", { locale: ptBR }) : <span>Escolha uma data</span>}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0">
                <Calendar
                  mode="single"
                  selected={newDeadline}
                  onSelect={setNewDeadline}
                  initialFocus
                  locale={ptBR}
                />
              </PopoverContent>
            </Popover>
          </div>
          <Button onClick={handleAddTask} className="w-full mt-2" disabled={isLoadingTodoist}>
            Adicionar Tarefa
          </Button>
        </div>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div>
          <h3 className="text-2xl font-bold mb-4 text-blue-700">Tarefas Pessoais ({personalTasks.length})</h3>
          <div className="space-y-4">
            {personalTasks.length > 0 ? (
              personalTasks.map(renderTaskCard)
            ) : (
              <p className="text-gray-500">Nenhuma tarefa pessoal adicionada ainda.</p>
            )}
          </div>
        </div>
        <div>
          <h3 className="text-2xl font-bold mb-4 text-green-700">Tarefas Profissionais ({professionalTasks.length})</h3>
          <div className="space-y-4">
            {professionalTasks.length > 0 ? (
              professionalTasks.map(renderTaskCard)
            ) : (
              <p className="text-gray-500">Nenhuma tarefa profissional adicionada ainda.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default InternalTasks;