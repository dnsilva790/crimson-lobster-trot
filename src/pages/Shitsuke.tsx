import React from "react";
import { Card } from "@/components/ui/card";
import { TrendingUp, BarChart, CheckCircle } from "lucide-react";

const Shitsuke = () => {
  return (
    <div className="p-4">
      <h2 className="text-3xl font-bold mb-2 text-gray-800">📈 SHITSUKE - Métricas e Progresso</h2>
      <p className="text-lg text-gray-600 mb-6">Acompanhe seu desempenho e mantenha a disciplina.</p>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <Card className="p-6 bg-blue-50 border-blue-200 flex flex-col items-center text-center">
          <TrendingUp className="h-12 w-12 text-blue-600 mb-4" />
          <h3 className="text-xl font-semibold text-blue-800 mb-2">Progresso Semanal</h3>
          <p className="text-gray-700">Visualize suas tarefas concluídas e o ritmo de trabalho ao longo da semana.</p>
          <div className="mt-4 text-2xl font-bold text-blue-700">Em breve!</div>
        </Card>

        <Card className="p-6 bg-green-50 border-green-200 flex flex-col items-center text-center">
          <BarChart className="h-12 w-12 text-green-600 mb-4" />
          <h3 className="text-xl font-semibold text-green-800 mb-2">Análise de Prioridades</h3>
          <p className="text-gray-700">Entenda como você está distribuindo seu tempo entre diferentes níveis de prioridade.</p>
          <div className="mt-4 text-2xl font-bold text-green-700">Em breve!</div>
        </Card>

        <Card className="p-6 bg-purple-50 border-purple-200 flex flex-col items-center text-center">
          <CheckCircle className="h-12 w-12 text-purple-600 mb-4" />
          <h3 className="text-xl font-semibold text-purple-800 mb-2">Consistência 5S</h3>
          <p className="text-gray-700">Monitore a frequência com que você aplica os princípios 5S na sua organização.</p>
          <div className="mt-4 text-2xl font-bold text-purple-700">Em breve!</div>
        </Card>
      </div>

      <div className="bg-indigo-50 p-6 rounded-lg text-indigo-800 mt-8 text-center">
        <p className="text-lg font-medium">
          Este módulo será o seu centro de feedback, ajudando você a entender seus hábitos e aprimorar sua disciplina.
        </p>
        <p className="text-md mt-2">
          As métricas e gráficos detalhados serão implementados aqui para oferecer insights valiosos.
        </p>
      </div>
    </div>
  );
};

export default Shitsuke;