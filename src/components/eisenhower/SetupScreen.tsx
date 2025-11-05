"use client";

import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Settings, Play } from "lucide-react";
import { toast } from "sonner";

interface SetupScreenProps {
  onStart: (filter: string) => void;
  initialFilterInput: string;
  initialStatusFilter: "all" | "overdue";
  initialCategoryFilter: "all" | "pessoal" | "profissional";
  initialPriorityFilter: "all" | "p1" | "p2" | "p3" | "p4"; // Novo
  initialDeadlineFilter: "all" | "has_deadline" | "no_deadline"; // Novo
  onFilterInputChange: (value: string) => void;
  onStatusFilterChange: (value: "all" | "overdue") => void;
  onCategoryFilterChange: (value: "all" | "pessoal" | "profissional") => void;
  onPriorityFilterChange: (value: "all" | "p1" | "p2" | "p3" | "p4") => void; // Novo
  onDeadlineFilterChange: (value: "all" | "has_deadline" | "no_deadline") => void; // Novo
}

const SetupScreen: React.FC<SetupScreenProps> = ({ 
  onStart, 
  initialFilterInput,
  initialStatusFilter,
  initialCategoryFilter,
  initialPriorityFilter, // Novo
  initialDeadlineFilter, // Novo
  onFilterInputChange,
  onStatusFilterChange,
  onCategoryFilterChange,
  onPriorityFilterChange, // Novo
  onDeadlineFilterChange, // Novo
}) => {
  const handleStart = () => {
    const filterParts: string[] = [];

    if (initialFilterInput.trim()) {
      filterParts.push(`(${initialFilterInput.trim()})`);
    }
    
    if (initialStatusFilter === "overdue") {
      filterParts.push("due before: in 0 min");
    }

    if (initialCategoryFilter === "pessoal") {
      filterParts.push("@pessoal");
    } else if (initialCategoryFilter === "profissional") {
      filterParts.push("@profissional");
    }

    if (initialPriorityFilter !== "all") {
      filterParts.push(initialPriorityFilter);
    }

    if (initialDeadlineFilter === "has_deadline") {
      filterParts.push("deadline: *");
    } else if (initialDeadlineFilter === "no_deadline") {
      filterParts.push("no deadline");
    }

    const finalFilter = filterParts.join(" & ");
    
    if (!finalFilter) {
      // If no specific filters are applied, pass undefined to fetch all active tasks
      onStart(undefined as unknown as string); 
      return;
    }
    
    onStart(finalFilter);
  };

  return (
    <div className="p-4 text-center">
      <h3 className="text-2xl font-bold text-gray-800 flex items-center justify-center gap-2 mb-4">
        <Settings className="h-6 w-6 text-indigo-600" /> Configuração Inicial
      </h3>
      <p className="text-lg text-gray-700 mb-6">
        Comece carregando as tarefas do Todoist que você deseja analisar.
      </p>

      <Card className="p-6 max-w-md mx-auto">
        <CardHeader>
          <CardTitle className="text-xl font-bold text-gray-800">Carregar Tarefas</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4">
          <div>
            <Label htmlFor="todoist-filter" className="text-left text-gray-600 font-medium">
              Filtro do Todoist (Opcional)
            </Label>
            <Input
              id="todoist-filter"
              type="text"
              value={initialFilterInput}
              onChange={(e) => onFilterInputChange(e.target.value)}
              placeholder="Ex: 'hoje', 'p1', '#projeto'"
              className="mt-1"
            />
            <p className="text-sm text-gray-500 text-left mt-1">
              Use a sintaxe de filtro do Todoist para refinar a seleção.
            </p>
          </div>
          <div>
            <Label htmlFor="status-filter" className="text-left text-gray-600 font-medium">
              Status da Tarefa
            </Label>
            <Select value={initialStatusFilter} onValueChange={(value: "all" | "overdue") => onStatusFilterChange(value)}>
              <SelectTrigger className="w-full mt-1">
                <SelectValue placeholder="Todas as Tarefas (Backlog)" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas as Tarefas (Backlog)</SelectItem>
                <SelectItem value="overdue">Apenas Atrasadas (Backlog)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label htmlFor="category-filter" className="text-left text-gray-600 font-medium">
              Filtrar por Categoria
            </Label>
            <Select value={initialCategoryFilter} onValueChange={(value: "all" | "pessoal" | "profissional") => onCategoryFilterChange(value)}>
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
          <div>
            <Label htmlFor="priority-filter" className="text-left text-gray-600 font-medium">
              Filtrar por Prioridade
            </Label>
            <Select value={initialPriorityFilter} onValueChange={(value: "all" | "p1" | "p2" | "p3" | "p4") => onPriorityFilterChange(value)}>
              <SelectTrigger className="w-full mt-1">
                <SelectValue placeholder="Todas as Prioridades" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas as Prioridades</SelectItem>
                <SelectItem value="p4">P4 (Baixa)</SelectItem>
                <SelectItem value="p3">P3 (Média)</SelectItem>
                <SelectItem value="p2">P2 (Alta)</SelectItem>
                <SelectItem value="p1">P1 (Urgente)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label htmlFor="deadline-filter" className="text-left text-gray-600 font-medium">
              Filtrar por Deadline
            </Label>
            <Select value={initialDeadlineFilter} onValueChange={(value: "all" | "has_deadline" | "no_deadline") => onDeadlineFilterChange(value)}>
              <SelectTrigger className="w-full mt-1">
                <SelectValue placeholder="Todos os Deadlines" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os Deadlines</SelectItem>
                <SelectItem value="has_deadline">Com Deadline Definido</SelectItem>
                <SelectItem value="no_deadline">Sem Deadline Definido</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Button onClick={handleStart} className="w-full py-3 text-lg bg-indigo-600 hover:bg-indigo-700 text-white flex items-center justify-center gap-2">
            <Play className="h-5 w-5" /> Iniciar Análise
          </Button>
        </CardContent>
      </Card>
    </div>
  );
};

export default SetupScreen;