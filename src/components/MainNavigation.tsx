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
  Users, // Ícone para Follow-Up
  CalendarClock, // Ícone para Deadlines
  Bot, // Ícone para o Tutor IA SEISO
  CheckSquare, // Ícone para o novo Shitsuke (Revisão Diária)
  FolderOpen, // Ícone para Gestão de Projetos 5W2H
  LayoutDashboard, // Alterado de Matrix para LayoutDashboard
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
    path: "/planejador",
    icon: CalendarDays,
    title: "PLANEJADOR",
    description: "Sequenciar Backlog",
    colorClass: "bg-indigo-100 hover:bg-indigo-200",
    activeColor: "border-indigo-600",
  },
  {
    path: "/shitsuke", // Nova rota para SHITSUKE (Revisão Diária)
    icon: CheckSquare, // Ícone para Revisão Diária
    title: "SHITSUKE",
    description: "Revisão Diária",
    colorClass: "bg-green-50 hover:bg-green-100", // Cor para Revisão Diária
    activeColor: "border-green-500",
  },
  {
    path: "/project-management", // Rota atualizada
    icon: FolderOpen, // Novo ícone para Gestão de Projetos
    title: "PROJETOS 5W2H", // Novo título
    description: "Gestão de Projetos", // Nova descrição
    colorClass: "bg-teal-100 hover:bg-teal-200",
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
    path: "/internal-tasks",
    icon: ListTodo,
    title: "INTERNAS",
    description: "Tarefas Pessoais/Profissionais",
    colorClass: "bg-gray-100 hover:bg-gray-200",
    activeColor: "border-gray-600",
  },
  {
    path: "/eisenhower", // Nova rota para Matriz de Eisenhower
    icon: LayoutDashboard, // Alterado de Matrix para LayoutDashboard
    title: "EISENHOWER",
    description: "Matriz de Priorização",
    colorClass: "bg-orange-50 hover:bg-orange-100",
    activeColor: "border-orange-500",
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