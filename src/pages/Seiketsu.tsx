"use client";

import React from "react";
import { Button } from "@/components/ui/button";
import { BarChart } from "lucide-react"; // Mantendo o ícone original

const Seiketsu = () => {
  return (
    <div className="p-4 text-center">
      <h2 className="text-3xl font-bold mb-2 text-gray-800">📊 SEIKETSU - Padronização</h2>
      <p className="text-lg text-gray-600 mb-6">
        Este módulo é dedicado à padronização de processos e tarefas.
      </p>

      <div className="mt-10 p-8 bg-white rounded-xl shadow-lg max-w-2xl mx-auto">
        <BarChart className="h-20 w-20 text-indigo-600 mx-auto mb-6" />
        <h3 className="text-2xl font-semibold text-gray-700 mb-4">
          Funcionalidade de Padronização em Desenvolvimento
        </h3>
        <p className="text-md text-gray-600 mb-6">
          A ferramenta de processamento GTD foi removida. Em breve, este espaço será preenchido com funcionalidades para ajudar você a criar e aplicar padrões para suas tarefas e rotinas, garantindo consistência e eficiência.
        </p>
        <Button
          onClick={() => alert("Funcionalidade de padronização em breve!")}
          className="px-8 py-4 text-xl bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-colors duration-200"
        >
          Saiba Mais (Em Breve)
        </Button>
      </div>
    </div>
  );
};

export default Seiketsu;