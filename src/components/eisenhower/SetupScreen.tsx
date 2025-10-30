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
}

const SetupScreen: React.FC<SetupScreenProps> = ({ onStart }) => {
  const [filterInput, setFilterInput] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "overdue">("all");

  const handleStart = () => {
    let finalFilter = filterInput.trim();
    
    if (statusFilter === "overdue") {
      // Adiciona o filtro de atrasadas ao filtro do usuário, se houver
      finalFilter = finalFilter ? `(${finalFilter}) & overdue` : 'overdue';
    } else if (statusFilter === "all" && !finalFilter) {
      // Se for 'all' e não houver filtro de usuário, usamos um filtro amplo para evitar carregar TUDO
      // No Todoist, 'all' sem filtro é implícito, mas para garantir que não carreguemos tarefas concluídas,
      // o fetchTasks já cuida disso. Se o usuário não colocar filtro, ele carrega o que o Todoist considera ativo.
      // Vamos manter o filtro vazio se for 'all' e o input estiver vazio.
    }

    if (!finalFilter && statusFilter === "all") {
      // Se não houver filtro, passamos undefined para fetchTasks carregar o padrão (todas ativas)
      onStart(undefined as unknown as string); // Passa undefined, mas o tipo é string, então forçamos.
      return;
    }
    
    if (!finalFilter && statusFilter === "overdue") {
      finalFilter = 'overdue';
    }

    if (!finalFilter) {
      toast.error("Por favor, insira um filtro ou selecione 'Todas as Tarefas' para carregar.");
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
              value={filterInput}
              onChange={(e) => setFilterInput(e.target.value)}
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
            <Select value={statusFilter} onValueChange={(value: "all" | "overdue") => setStatusFilter(value)}>
              <SelectTrigger className="w-full mt-1">
                <SelectValue placeholder="Todas as Tarefas (Backlog)" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas as Tarefas (Backlog)</SelectItem>
                <SelectItem value="overdue">Apenas Atrasadas (Backlog)</SelectItem>
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