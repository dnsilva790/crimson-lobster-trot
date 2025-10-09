import React from "react";
import { NavLink } from "react-router-dom";
import ModuleCard from "@/components/ui/module-card";
import {
  ClipboardList,
  Trophy,
  Sparkles,
  BarChart,
  TrendingUp,
  Zap,
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
    path: "/seiketsu", // Seiketsu antes de Seiton
    icon: BarChart,
    title: "SEIKETSU",
    description: "Organização Padrão",
    colorClass: "bg-purple-100 hover:bg-purple-200",
    activeColor: "border-purple-600",
  },
  {
    path: "/seiton",
    icon: Trophy,
    title: "SEITON",
    description: "Torneio de Priorização",
    colorClass: "bg-yellow-100 hover:bg-yellow-200",
    activeColor: "border-yellow-600",
  },
  // { // REMOVIDO
  //   path: "/seiso",
  //   icon: Sparkles,
  //   title: "SEISO",
  //   description: "Limpeza e Revisão",
  //   colorClass: "bg-blue-100 hover:bg-blue-200",
  //   activeColor: "border-blue-600",
  // },
  // { // REMOVIDO
  //   path: "/shitsuke",
  //   icon: TrendingUp,
  //   title: "SHITSUKE",
  //   description: "Métricas e Progresso",
  //   colorClass: "bg-emerald-100 hover:bg-emerald-200",
  //   activeColor: "border-emerald-600",
  // },
  {
    path: "/execucao",
    icon: Zap,
    title: "EXECUÇÃO",
    description: "Modo Foco Total",
    colorClass: "bg-red-100 hover:bg-red-200",
    activeColor: "border-red-600",
  },
];

const MainNavigation = () => {
  return (
    <nav className="p-4 bg-white shadow-md rounded-xl mb-6">
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
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