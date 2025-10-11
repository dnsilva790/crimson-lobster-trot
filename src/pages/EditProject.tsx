"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CalendarIcon, Save, ArrowLeft } from "lucide-react";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { Project } from "@/lib/types";
import { getProjects, updateProject } from "@/utils/projectStorage";
import { toast } from "sonner";

const EditProject = () => {
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();

  const [project, setProject] = useState<Project | null>(null);
  const [what, setWhat] = useState("");
  const [why, setWhy] = useState("");
  const [who, setWho] = useState("");
  const [where, setWhere] = useState("");
  const [when, setWhen] = useState<Date | undefined>(undefined);
  const [how, setHow] = useState("");
  const [howMuch, setHowMuch] = useState("");
  const [status, setStatus] = useState<Project['status']>("ativo");

  useEffect(() => {
    if (projectId) {
      const projects = getProjects();
      const foundProject = projects.find((p) => p.id === projectId);
      if (foundProject) {
        setProject(foundProject);
        setWhat(foundProject.what);
        setWhy(foundProject.why);
        setWho(foundProject.who);
        setWhere(foundProject.where);
        setWhen(parseISO(foundProject.when));
        setHow(foundProject.how);
        setHowMuch(foundProject.howMuch || "");
        setStatus(foundProject.status);
      } else {
        toast.error("Projeto não encontrado para edição.");
        navigate("/shitsuke");
      }
    }
  }, [projectId, navigate]);

  const handleUpdateProject = useCallback(() => {
    if (!project || !what.trim() || !why.trim() || !who.trim() || !when || !how.trim()) {
      toast.error("Por favor, preencha todos os campos obrigatórios (O Quê, Por Quê, Quem, Quando, Como).");
      return;
    }

    const subtasks = how.split('\n').map(s => s.trim()).filter(s => s.length > 0);

    const updatedProject: Project = {
      ...project,
      what: what.trim(),
      why: why.trim(),
      who: who.trim(),
      where: where.trim(),
      when: format(when, "yyyy-MM-dd"),
      how: how.trim(),
      howMuch: howMuch.trim(),
      status: status,
      subtasks: subtasks,
    };

    updateProject(updatedProject);
    toast.success("Projeto 5W2H atualizado com sucesso!");
    navigate(`/shitsuke/${project.id}`); // Voltar para os detalhes do projeto
  }, [project, what, why, who, when, how, howMuch, status, navigate]);

  if (!project) {
    return (
      <div className="p-4 text-center">
        <p className="text-lg text-gray-600">Carregando projeto para edição...</p>
        <Button onClick={() => navigate("/shitsuke")} className="mt-4">
          <ArrowLeft className="h-4 w-4 mr-2" /> Voltar para Projetos
        </Button>
      </div>
    );
  }

  return (
    <div className="p-4">
      <h2 className="text-3xl font-bold mb-2 text-gray-800">
        <Save className="inline-block h-8 w-8 mr-2 text-blue-600" /> Editar Projeto 5W2H
      </h2>
      <p className="text-lg text-gray-600 mb-6">
        Ajuste os detalhes do seu projeto existente.
      </p>

      <Card className="p-6 max-w-3xl mx-auto">
        <CardHeader>
          <CardTitle className="text-xl font-bold text-gray-800">Detalhes do Projeto</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-6">
          {/* O Quê (What) */}
          <div>
            <Label htmlFor="what">O Quê? (What)</Label>
            <Input
              id="what"
              value={what}
              onChange={(e) => setWhat(e.target.value)}
              placeholder="Ex: Lançar novo produto X"
              className="mt-1"
              required
            />
          </div>

          {/* Por Quê (Why) */}
          <div>
            <Label htmlFor="why">Por Quê? (Why)</Label>
            <Textarea
              id="why"
              value={why}
              onChange={(e) => setWhy(e.target.value)}
              placeholder="Ex: Aumentar a participação de mercado em 10%"
              rows={3}
              className="mt-1"
              required
            />
          </div>

          {/* Quem (Who) */}
          <div>
            <Label htmlFor="who">Quem? (Who)</Label>
            <Input
              id="who"
              value={who}
              onChange={(e) => setWho(e.target.value)}
              placeholder="Ex: Equipe de Marketing e Vendas"
              className="mt-1"
              required
            />
          </div>

          {/* Onde (Where) */}
          <div>
            <Label htmlFor="where">Onde? (Where)</Label>
            <Input
              id="where"
              value={where}
              onChange={(e) => setWhere(e.target.value)}
              placeholder="Ex: Mercado nacional, plataforma online"
              className="mt-1"
            />
          </div>

          {/* Quando (When) */}
          <div>
            <Label htmlFor="when">Quando? (When - Data de Vencimento)</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant={"outline"}
                  className={cn(
                    "w-full justify-start text-left font-normal mt-1",
                    !when && "text-muted-foreground"
                  )}
                  required
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {when ? format(when, "PPP", { locale: ptBR }) : <span>Selecione uma data</span>}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0">
                <Calendar
                  mode="single"
                  selected={when}
                  onSelect={setWhen}
                  initialFocus
                  locale={ptBR}
                />
              </PopoverContent>
            </Popover>
          </div>

          {/* Como (How) */}
          <div>
            <Label htmlFor="how">Como? (How - Passos, Metodologia - uma subtarefa por linha)</Label>
            <Textarea
              id="how"
              value={how}
              onChange={(e) => setHow(e.target.value)}
              placeholder="Ex:&#10;- Pesquisar mercado&#10;- Desenvolver protótipo&#10;- Lançar campanha"
              rows={5}
              className="mt-1"
              required
            />
          </div>

          {/* Quanto (How Much) */}
          <div>
            <Label htmlFor="howMuch">Quanto? (How Much - Custo, Recursos)</Label>
            <Input
              id="howMuch"
              value={howMuch}
              onChange={(e) => setHowMuch(e.target.value)}
              placeholder="Ex: R$ 10.000, 200 horas de trabalho"
              className="mt-1"
            />
          </div>

          {/* Status */}
          <div>
            <Label htmlFor="status">Status</Label>
            <Select value={status} onValueChange={(value: Project['status']) => setStatus(value)}>
              <SelectTrigger className="w-full mt-1">
                <SelectValue placeholder="Selecione o status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ativo">Ativo</SelectItem>
                <SelectItem value="concluido">Concluído</SelectItem>
                <SelectItem value="arquivado">Arquivado</SelectItem>
                <SelectItem value="cancelado">Cancelado</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <Button onClick={handleUpdateProject} className="w-full mt-4 flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white">
            <Save className="h-4 w-4" /> Salvar Alterações
          </Button>
          <Button onClick={() => navigate(`/shitsuke/${projectId}`)} variant="outline" className="w-full mt-2">
            Cancelar
          </Button>
        </CardContent>
      </Card>
    </div>
  );
};

export default EditProject;