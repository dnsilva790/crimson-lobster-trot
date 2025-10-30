"use client";

import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Settings, Play } from "lucide-react";
import { toast } from "sonner";

interface SetupScreenProps {
  onStart: (filter: string) => void;
}

const SetupScreen: React.FC<SetupScreenProps> = ({ onStart }) => {
  const [filterInput, setFilterInput] = useState("");

  const handleStart = () => {
    if (!filterInput.trim()) {
      toast.error("Por favor, insira um filtro para carregar as tarefas.");
      return;
    }
    onStart(filterInput.trim());
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
              Filtro do Todoist
            </Label>
            <Input
              id="todoist-filter"
              type="text"
              value={filterInput}
              onChange={(e) => setFilterInput(e.target.value)}
              placeholder="Ex: 'hoje', 'p1', '#projeto', 'no date'"
              className="mt-1"
            />
            <p className="text-sm text-gray-500 text-left mt-1">
              Use a sintaxe de filtro do Todoist para selecionar as tarefas.
            </p>
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