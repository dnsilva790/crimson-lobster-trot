import React, { useState, useEffect } from "react";
import { NavLink } from "react-router-dom";
import ModuleCard from "@/components/ui/module-card";
import {
  ClipboardList,
  Trophy,
  Sparkles,
  BarChart,
  ListTodo,
  CalendarDays,
  Users,
  CalendarClock,
  Bot,
  CheckSquare,
  FolderOpen,
  LayoutDashboard,
  ClipboardCheck,
  Settings,
  Mail,
  Lightbulb,
  FileText,
  BarChart3, // Importar BarChart3
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";

const modules = [
  {
    path: "/agent-manager", // Novo módulo
    icon: BarChart3,
    title: "AGE - IA",
    description: "Gerenciamento Estratégico",
    colorClass: "bg-green-100 hover:bg-green-200",
    activeColor: "border-green-600",
  },
  {
    path: "/seiri",
    icon: ClipboardList,
    title: "SEIRI",
    description: "Separar o Essencial",
    colorClass: "bg-green-100 hover:bg-green-200",
    activeColor: "border-green-600",
  },
  {
    path: "/eisenhower",
    icon: LayoutDashboard,
    title: "EISENHOWER",
    description: "Matriz de Priorização",
    colorClass: "bg-orange-50 hover:bg-orange-100",
    activeColor: "border-orange-500",
  },
  {
    path: "/seiso",
    icon: ClipboardCheck,
    title: "SEISO",
    description: "Planejamento de Ação",
    colorClass: "bg-cyan-100 hover:bg-cyan-200",
    activeColor: "border-cyan-600",
  },
  {
    path: "/agenda",
    icon: CalendarDays,
    title: "AGENDA",
    description: "Visão Diária",
    colorClass: "bg-teal-50 hover:bg-teal-100",
    activeColor: "border-teal-500",
  },
  {
    path: "/novoseiso",
    icon: Sparkles,
    title: "NOVO SEISO",
    description: "Modo Foco Total",
    colorClass: "bg-blue-100 hover:bg-blue-200",
    activeColor: "border-blue-600",
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
    path: "/seiton",
    icon: Trophy,
    title: "SEITON",
    description: "Torneio de Priorização",
    colorClass: "bg-orange-100 hover:bg-orange-200",
    activeColor: "border-orange-600",
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
    path: "/massive-planner",
    icon: CalendarClock,
    title: "SEISO - MASSIVO",
    description: "Planejamento Automático",
    colorClass: "bg-pink-50 hover:bg-pink-100",
    activeColor: "border-pink-500",
  },
  // {
  //   path: "/shitsuke",
  //   icon: CheckSquare,
  //   title: "SHITSUKE",
  //   description: "Revisão Diária",
  //   colorClass: "bg-green-50 hover:bg-green-100",
  //   activeColor: "border-green-500",
  // },
  {
    path: "/project-management",
    icon: FolderOpen,
    title: "PROJETOS 5W2H",
    description: "Gestão de Projetos",
    colorClass: "bg-teal-100 hover:bg-teal-200",
    activeColor: "border-teal-600",
  },
  {
    path: "/follow-up",
    icon: Users,
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
    path: "/task-report",
    icon: FileText,
    title: "RELATÓRIO",
    description: "Tabela e Exportação",
    colorClass: "bg-indigo-50 hover:bg-indigo-100",
    activeColor: "border-indigo-500",
  },
];

const HIDDEN_MODULES_STORAGE_KEY = "hidden_modules_preferences";
const DEFAULT_HIDDEN_MODULES = [
  "/seiketsu",
  "/seiton",
  "/planejador",
  "/project-management",
  "/follow-up",
  "/shitsuke", // Mantido aqui para garantir que o estado salvo do usuário o mantenha oculto
];

const MainNavigation = () => {
  const [hiddenModules, setHiddenModules] = useState<string[]>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem(HIDDEN_MODULES_STORAGE_KEY);
      if (saved) {
        return JSON.parse(saved);
      }
      return DEFAULT_HIDDEN_MODULES;
    }
    return DEFAULT_HIDDEN_MODULES;
  });
  const [isManageModulesOpen, setIsManageModulesOpen] = useState(false);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem(HIDDEN_MODULES_STORAGE_KEY, JSON.stringify(hiddenModules));
    }
  }, [hiddenModules]);

  const toggleModuleVisibility = (path: string, isHidden: boolean) => {
    setHiddenModules(prev => {
      if (isHidden) {
        return [...prev, path];
      } else {
        return prev.filter(p => p !== path);
      }
    });
  };

  const modulesToDisplay = modules.filter(module => !hiddenModules.includes(module.path));

  return (
    <nav className="p-4 bg-white shadow-md rounded-xl mb-6">
      <div className="flex justify-end mb-4">
        <Dialog open={isManageModulesOpen} onOpenChange={setIsManageModulesOpen}>
          <DialogTrigger asChild>
            <Button variant="outline" className="flex items-center gap-2">
              <Settings className="h-4 w-4" /> Gerenciar Módulos
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[425px]">
            <DialogHeader>
              <DialogTitle>Gerenciar Visibilidade dos Módulos</DialogTitle>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              {modules.map(module => (
                <div key={module.path} className="flex items-center justify-between">
                  <Label htmlFor={`module-switch-${module.path}`}>{module.title}</Label>
                  <Switch
                    id={`module-switch-${module.path}`}
                    checked={!hiddenModules.includes(module.path)}
                    onCheckedChange={(checked) => toggleModuleVisibility(module.path, !checked)}
                  />
                </div>
              ))}
            </div>
          </DialogContent>
        </Dialog>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-7 gap-4">
        {modulesToDisplay.map((module) => (
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