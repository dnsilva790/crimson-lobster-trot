"use client";

import React from "react";
import { Button } from "@/components/ui/button";

interface ExecucaoFinishedStateProps {
  originalTasksCount: number;
  onStartNewFocus: () => void;
}

const ExecucaoFinishedState: React.FC<ExecucaoFinishedStateProps> = ({
  originalTasksCount,
  onStartNewFocus,
}) => {
  return (
    <div className="text-center mt-10">
      <p className="text-2xl font-semibold text-gray-700 mb-4">
        🎉 Modo Foco Concluído!
      </p>
      <p className="text-lg text-gray-600 mb-6">
        Você revisou todas as {originalTasksCount} tarefas.
      </p>
      <Button
        onClick={onStartNewFocus}
        className="px-8 py-4 text-xl bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-colors duration-200"
      >
        Iniciar Novo Foco
      </Button>
    </div>
  );
};

export default ExecucaoFinishedState;