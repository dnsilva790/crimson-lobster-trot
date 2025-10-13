import React from "react";
import { NavLink } from "react-router-dom";
import ModuleCard from "@/components/ui/module-card";
import {
  ClipboardList,
  Trophy,
  Sparkles, // Ícone para Novo Seiso
  BarChart,
  ListTodo,
  CalendarDays,
  Star, // Ícone para Shitsuke e Seiton Review
  Users, // Ícone para Follow-Up
  CalendarClock, // Ícone para Deadlines
} from "lucide-react";

const modules = [
  {
    path: "/seiri",
    icon: ClipboardList,
    title: "SEIRI",
    description: "Separar o Essencial",
    colorClass: "bg-green-100 hover:bg-green-200",
    activeColor: "border-green-600",
  },
  {
    path: "/seiketsu",
    icon: BarChart,
    title: "SEIKETSU",
    description: "Padronização",
    colorClass: "bg-purple-100 hover:bg-purple-200",
    activeColor: "border-purple-600",
  },
  {
    path: "/seiton-review", // Nova rota para o Seiton de Revisão
    icon: Star, // Usando Star para o novo Seiton
    title: "SEITON",
    description: "Revisão de Prioridades",
    colorClass: "bg-yellow-100 hover:bg-yellow-200",
    activeColor: "border-yellow-600",
  },
  {
    path: "/seiton", // O Seiton original (Torneio)
    icon: Trophy,
    title: "SEITON",
    description: "Torneio de Priorização",
    colorClass: "bg-orange-100 hover:bg-orange-200", // Mudando a cor para diferenciar
    activeColor: "border-orange-600",
  },
  {
    path: "/novoseiso", // Rota atualizada para Novo Seiso
    icon: Sparkles, // Ícone para Novo Seiso
    title: "NOVO SEISO", // Título atualizado
    description: "Modo Foco Total", // Descrição mantida
    colorClass: "bg-blue-100 hover:bg-blue-200", // Cor atualizada
    activeColor: "border-blue-600",
  },
  {
    path: "/internal-tasks",
    icon: ListTodo,
    title: "INTERNAS",
    description: "Tarefas Pessoais/Profissionais",
    colorClass: "bg-gray-100 hover:bg-gray-200",
    activeColor: "border-gray-600",
  },
  {
    path: "/planejador",
    icon: CalendarDays,
    title: "PLANEJADOR",
    description: "Sequenciar Backlog",
    colorClass: "bg-indigo-100 hover:bg-indigo-200",
    activeColor: "border-indigo-600",
  },
  {
    path: "/shitsuke", // Nova rota
    icon: Star, // Ícone para Shitsuke
    title: "SHITSUKE",
    description: "Projetos 5W2H",
    colorClass: "bg-teal-100 hover:bg-teal-200", // Mudando a cor para Shitsuke
    activeColor: "border-teal-600",
  },
  {
    path: "/follow-up", // Nova rota para Acompanhamento de Delegados
    icon: Users, // Ícone para Follow-Up
    title: "FOLLOW-UP",
    description: "Acompanhar Delegados",
    colorClass: "bg-pink-100 hover:bg-pink-200",
    activeColor: "border-pink-600",
  },
  {
    path: "/deadlines", // Nova rota para Deadlines
    icon: CalendarClock, // Ícone para Deadlines
    title: "DEADLINES",
    description: "Tarefas com Prazo Final",
    colorClass: "bg-red-100 hover:bg-red-200", // Cor para Deadlines
    activeColor: "border-red-600",
  },
];

const MainNavigation = () => {
  return (
    <nav className="p-4 bg-white shadow-md rounded-xl mb-6">
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-7 gap-4">
        {modules.map((module) => (
          <NavLink
            key={module.path}
            to={module.path}
            className={({ isActive }) =>
              isActive ? "ring-2 ring-indigo-500 rounded-xl" : ""
            }
          >
            {({ isActive }) => (
              <ModuleCard
                icon={module.icon}
                title={module.title}
                description={module.description}
                colorClass={module.colorClass}
                isActive={isActive}
                className={isActive ? module.activeColor : ""}
              />
            )}
          </NavLink>
        ))}
      </div>
    </nav>
  );
};

export default MainNavigation;