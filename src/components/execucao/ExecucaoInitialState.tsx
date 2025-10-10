"use client";

import React from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import LoadingSpinner from "@/components/ui/loading-spinner";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface ExecucaoInitialStateProps {
  filterInput: string;
  setFilterInput: (value: string) => void;
  selectedCategoryFilter: "all" | "pessoal" | "profissional";
  setSelectedCategoryFilter: (value: "all" | "pessoal" | "profissional") => void;
  onStartFocus: () => void;
  isLoading: boolean;
}

const ExecucaoInitialState: React.FC<ExecucaoInitialStateProps> = ({
  filterInput,
  setFilterInput,
  selectedCategoryFilter,
  setSelectedCategoryFilter,
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
      <div className="grid w-full items-center gap-1.5 mb-6 max-w-md mx-auto">
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