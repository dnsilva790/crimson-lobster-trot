"use client";

import React from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import LoadingSpinner from "@/components/ui/loading-spinner";

interface ExecucaoInitialStateProps {
  filterInput: string;
  setFilterInput: (value: string) => void;
  onStartFocus: () => void;
  isLoading: boolean;
}

const ExecucaoInitialState: React.FC<ExecucaoInitialStateProps> = ({
  filterInput,
  setFilterInput,
  onStartFocus,
  isLoading,
}) => {
  return (
    <div className="text-center mt-10">
      <div className="grid w-full items-center gap-1.5 mb-6 max-w-md mx-auto">
        <Label htmlFor="task-filter" className="text-left text-gray-600 font-medium">
          Filtro de Tarefas (ex: "hoje", "p1", "#projeto")
        </Label>
        <Input
          type="text"
          id="task-filter"
          placeholder="Opcional: insira um filtro do Todoist..."
          value={filterInput}
          onChange={(e) => setFilterInput(e.target.value)}
          className="mt-1"
          disabled={isLoading}
        />
      </div>
      <Button
        onClick={onStartFocus}
        className="px-8 py-4 text-xl bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors duration-200"
        disabled={isLoading}
      >
        {isLoading ? (
          <LoadingSpinner size={20} className="text-white" />
        ) : (
          "Iniciar Modo Foco"
        )}
      </Button>
    </div>
  );
};

export default ExecucaoInitialState;