"use client";

import React, { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { getInternalTasks, addInternalTask, updateInternalTask, deleteInternalTask } from "@/utils/internalTaskStorage";
import { InternalTask } from "@/lib/types";
import { toast } from "sonner";
import { PlusCircle, Trash2, Edit, Save, XCircle } from "lucide-react";
import { cn } from "@/lib/utils";

const InternalTasks = () => {
  const [tasks, setTasks] = useState<InternalTask[]>([]);
  const [newTaskContent, setNewTaskContent] = useState("");
  const [newTaskDescription, setNewTaskDescription] = useState("");
  const [newTaskCategory, setNewTaskCategory] = useState<"pessoal" | "profissional">("pessoal");
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [editedContent, setEditedContent] = useState("");
  const [editedDescription, setEditedDescription] = useState("");
  const [editedCategory, setEditedCategory] = useState<"pessoal" | "profissional">("pessoal");

  useEffect(() => {
    setTasks(getInternalTasks());
  }, []);

  const handleAddTask = useCallback(() => {
    if (!newTaskContent.trim()) {
      toast.error("O conteúdo da tarefa não pode ser vazio.");
      return;
    }

    const newTask: InternalTask = {
      id: Date.now().toString(), // Simple unique ID
      content: newTaskContent.trim(),
      description: newTaskDescription.trim(),
      category: newTaskCategory,
      isCompleted: false,
      createdAt: new Date().toISOString(),
    };

    const updatedTasks = addInternalTask(newTask);
    setTasks(updatedTasks);
    setNewTaskContent("");
    setNewTaskDescription("");
    setNewTaskCategory("pessoal");
    toast.success("Tarefa interna adicionada!");
  }, [newTaskContent, newTaskDescription, newTaskCategory]);

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
  }, []);

  const handleCancelEditing = useCallback(() => {
    setEditingTaskId(null);
    setEditedContent("");
    setEditedDescription("");
    setEditedCategory("pessoal");
  }, []);

  const handleSaveEdit = useCallback(() => {
    if (!editingTaskId || !editedContent.trim()) {
      toast.error("O conteúdo da tarefa não pode ser vazio.");
      return;
    }

    const updatedTask: InternalTask = {
      id: editingTaskId,
      content: editedContent.trim(),
      description: editedDescription.trim(),
      category: editedCategory,
      isCompleted: tasks.find(t => t.id === editingTaskId)?.isCompleted || false,
      createdAt: tasks.find(t => t.id === editingTaskId)?.createdAt || new Date().toISOString(),
    };

    const updatedTasks = updateInternalTask(updatedTask);
    setTasks(updatedTasks);
    setEditingTaskId(null);
    setEditedContent("");
    setEditedDescription("");
    setEditedCategory("pessoal");
    toast.success("Tarefa interna atualizada!");
  }, [editingTaskId, editedContent, editedDescription, editedCategory, tasks]);

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
          <span className="text-xs text-gray-400 ml-6">
            Criado em: {new Date(task.createdAt).toLocaleDateString()} - Categoria: {task.category === "pessoal" ? "Pessoal" : "Profissional"}
          </span>
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
          <Button onClick={handleAddTask} className="w-full mt-2">
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