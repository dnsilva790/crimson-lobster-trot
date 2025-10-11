"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { ArrowLeft, Edit, Trash2 } from "lucide-react";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { Project } from "@/lib/types";
import { getProjects, deleteProject } from "@/utils/projectStorage";
import { toast } from "sonner";

const ProjectDetail = () => {
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();
  const [project, setProject] = useState<Project | null>(null);

  const loadProject = useCallback(() => {
    if (projectId) {
      const projects = getProjects();
      const foundProject = projects.find((p) => p.id === projectId);
      if (foundProject) {
        setProject(foundProject);
      } else {
        toast.error("Projeto não encontrado.");
        navigate("/shitsuke");
      }
    }
  }, [projectId, navigate]);

  useEffect(() => {
    loadProject();
  }, [loadProject]);

  const handleDeleteProject = useCallback(() => {
    if (project) {
      deleteProject(project.id);
      toast.success(`Projeto "${project.what}" excluído com sucesso!`);
      navigate("/shitsuke");
    }
  }, [project, navigate]);

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

  if (!project) {
    return (
      <div className="p-4 text-center">
        <p className="text-lg text-gray-600">Carregando detalhes do projeto...</p>
        <Button onClick={() => navigate("/shitsuke")} className="mt-4">
          <ArrowLeft className="h-4 w-4 mr-2" /> Voltar para Projetos
        </Button>
      </div>
    );
  }

  return (
    <div className="p-4">
      <h2 className="text-3xl font-bold mb-2 text-gray-800">Detalhes do Projeto</h2>
      <p className="text-lg text-gray-600 mb-6">
        Visualize todas as informações do projeto "{project.what}".
      </p>

      <Card className="p-6 max-w-3xl mx-auto">
        <CardHeader>
          <CardTitle className="text-2xl font-bold text-gray-800">{project.what}</CardTitle>
          <div className="flex items-center gap-2 mt-2">
            <span className={cn("px-2.5 py-0.5 rounded-full text-sm font-medium", getStatusBadgeClass(project.status))}>
              {project.status.charAt(0).toUpperCase() + project.status.slice(1)}
            </span>
            <span className="text-sm text-gray-500">Criado em: {format(parseISO(project.createdAt), "dd/MM/yyyy", { locale: ptBR })}</span>
          </div>
        </CardHeader>
        <CardContent className="grid gap-6 text-gray-700">
          <div>
            <Label className="font-semibold text-base">Por Quê? (Why)</Label>
            <p className="mt-1 text-sm whitespace-pre-wrap">{project.why}</p>
          </div>
          <div>
            <Label className="font-semibold text-base">Quem? (Who)</Label>
            <p className="mt-1 text-sm">{project.who}</p>
          </div>
          <div>
            <Label className="font-semibold text-base">Onde? (Where)</Label>
            <p className="mt-1 text-sm">{project.where || "Não especificado"}</p>
          </div>
          <div>
            <Label className="font-semibold text-base">Quando? (When - Data de Vencimento)</Label>
            <p className="mt-1 text-sm">{format(parseISO(project.when), "dd/MM/yyyy", { locale: ptBR })}</p>
          </div>
          <div>
            <Label className="font-semibold text-base">Como? (How - Passos, Metodologia)</Label>
            <ul className="list-disc list-inside mt-1 text-sm space-y-1">
              {project.subtasks.length > 0 ? (
                project.subtasks.map((subtask, index) => (
                  <li key={index}>{subtask}</li>
                ))
              ) : (
                <li>Nenhum passo detalhado.</li>
              )}
            </ul>
          </div>
          <div>
            <Label className="font-semibold text-base">Quanto? (How Much - Custo, Recursos)</Label>
            <p className="mt-1 text-sm">{project.howMuch || "Não especificado"}</p>
          </div>

          <div className="flex flex-col md:flex-row gap-4 mt-4">
            <Button onClick={() => navigate("/shitsuke")} variant="outline" className="flex-1">
              <ArrowLeft className="h-4 w-4 mr-2" /> Voltar para Projetos
            </Button>
            <Button onClick={() => navigate(`/shitsuke/edit/${project.id}`)} className="flex-1 bg-blue-600 hover:bg-blue-700 text-white">
              <Edit className="h-4 w-4 mr-2" /> Editar Projeto
            </Button>
            <Button onClick={handleDeleteProject} variant="destructive" className="flex-1">
              <Trash2 className="h-4 w-4 mr-2" /> Excluir Projeto
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default ProjectDetail;