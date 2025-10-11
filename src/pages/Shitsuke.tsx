"use client";

import React, { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PlusCircle, Search } from "lucide-react";
import { Project } from "@/lib/types";
import { getProjects } from "@/utils/projectStorage";
import { toast } from "sonner";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { useNavigate } from "react-router-dom";

const Shitsuke = () => {
  const navigate = useNavigate();
  const [projects, setProjects] = useState<Project[]>([]);
  const [filteredProjects, setFilteredProjects] = useState<Project[]>([]);
  const [searchTerm, setSearchTerm] = useState<string>("");

  const loadProjects = useCallback(() => {
    const loadedProjects = getProjects();
    setProjects(loadedProjects);
  }, []);

  useEffect(() => {
    loadProjects();
  }, [loadProjects]);

  useEffect(() => {
    const lowerCaseSearchTerm = searchTerm.toLowerCase();
    const filtered = projects.filter(
      (project) =>
        project.what.toLowerCase().includes(lowerCaseSearchTerm) ||
        project.why.toLowerCase().includes(lowerCaseSearchTerm) ||
        project.who.toLowerCase().includes(lowerCaseSearchTerm) ||
        project.status.toLowerCase().includes(lowerCaseSearchTerm)
    );
    setFilteredProjects(filtered);
  }, [searchTerm, projects]);

  const handleCreateNewProject = () => {
    navigate("/shitsuke/create");
  };

  const handleViewProjectDetail = (projectId: string) => {
    navigate(`/shitsuke/${projectId}`);
  };

  const getStatusBadgeClass = (status: Project['status']) => {
    switch (status) {
      case "ativo":
        return "bg-blue-100 text-blue-800";
      case "concluido":
        return "bg-green-100 text-green-800";
      case "arquivado":
        return "bg-gray-100 text-gray-800";
      case "cancelado":
        return "bg-red-100 text-red-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  return (
    <div className="p-4">
      <h2 className="text-3xl font-bold mb-2 text-gray-800">🌟 SHITSUKE - Manutenção e Disciplina</h2>
      <p className="text-lg text-gray-600 mb-6">
        Gerencie seus projetos 5W2H e mantenha a disciplina na execução.
      </p>

      <div className="flex flex-col md:flex-row gap-4 mb-6">
        <div className="relative flex-grow">
          <Label htmlFor="project-search" className="sr-only">Buscar Projetos</Label>
          <Input
            id="project-search"
            type="text"
            placeholder="Buscar projetos por O Quê, Por Quê, Quem ou Status..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500" />
        </div>
        <Button onClick={handleCreateNewProject} className="w-full md:w-auto flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white">
          <PlusCircle className="h-4 w-4" /> Criar Novo Projeto
        </Button>
      </div>

      {filteredProjects.length === 0 ? (
        <div className="text-center p-8 border rounded-lg bg-gray-50">
          <p className="text-gray-600 text-lg mb-4">Nenhum projeto encontrado.</p>
          <Button onClick={handleCreateNewProject} className="bg-indigo-600 hover:bg-indigo-700 text-white">
            Criar o primeiro projeto
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredProjects.map((project) => (
            <Card 
              key={project.id} 
              className="flex flex-col cursor-pointer hover:shadow-lg hover:scale-[1.01] transition-all duration-200"
              onClick={() => handleViewProjectDetail(project.id)}
            >
              <CardHeader>
                <CardTitle className="text-xl font-bold text-gray-800">{project.what}</CardTitle>
              </CardHeader>
              <CardContent className="flex-grow space-y-2 text-sm text-gray-700">
                <p><strong>Por Quê:</strong> {project.why}</p>
                <p><strong>Quem:</strong> {project.who}</p>
                <p><strong>Quando:</strong> {format(parseISO(project.when), "dd/MM/yyyy", { locale: ptBR })}</p>
                <div className="flex items-center gap-2 mt-2">
                  <span className={cn("px-2.5 py-0.5 rounded-full text-xs font-medium", getStatusBadgeClass(project.status))}>
                    {project.status.charAt(0).toUpperCase() + project.status.slice(1)}
                  </span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};

export default Shitsuke;