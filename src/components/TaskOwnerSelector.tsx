"use client";

import React, { useState, useEffect } from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { User } from "lucide-react";

interface TaskOwnerSelectorProps {
  taskId: string;
  currentContent: string;
  onUpdateTaskContent: (taskId: string, newContent: string) => Promise<void>;
  isLoading: boolean;
}

const teamMembers = [
  { initials: "EU", name: "Eu" },
  { initials: "ING", name: "Ingrid" },
  { initials: "JOA", name: "João" },
  { initials: "SAM", name: "Samara" },
  { initials: "FRA", name: "Francisco" },
  { initials: "DAV", name: "David" },
  { initials: "CAZ", name: "Cazé/Ana Julia" },
];

const TaskOwnerSelector: React.FC<TaskOwnerSelectorProps> = ({
  taskId,
  currentContent,
  onUpdateTaskContent,
  isLoading,
}) => {
  const [selectedOwnerInitials, setSelectedOwnerInitials] = useState<string>("");

  useEffect(() => {
    // Tenta extrair as iniciais do conteúdo atual da tarefa
    const match = currentContent.match(/^\[([A-Z\/]+)\]\s*-\s*(.*)/);
    if (match && teamMembers.some(member => member.initials === match[1])) {
      setSelectedOwnerInitials(match[1]);
    } else {
      setSelectedOwnerInitials(""); // Nenhuma inicial ou não reconhecida
    }
  }, [currentContent]);

  const handleOwnerChange = async (newInitials: string) => {
    if (isLoading) return;

    let newContent = currentContent;
    const currentInitialsMatch = currentContent.match(/^\[([A-Z\/]+)\]\s*-\s*(.*)/);

    if (newInitials === "") {
      // Remove as iniciais se "Nenhum" for selecionado
      if (currentInitialsMatch) {
        newContent = currentInitialsMatch[2].trim();
      }
    } else {
      // Adiciona ou altera as iniciais
      const member = teamMembers.find(m => m.initials === newInitials);
      if (!member) return; // Não deveria acontecer

      if (currentInitialsMatch) {
        // Substitui as iniciais existentes
        newContent = `[${newInitials}] - ${currentInitialsMatch[2].trim()}`;
      } else {
        // Adiciona novas iniciais
        newContent = `[${newInitials}] - ${currentContent.trim()}`;
      }
    }

    if (newContent !== currentContent) {
      await onUpdateTaskContent(taskId, newContent);
      setSelectedOwnerInitials(newInitials);
      // A mensagem de sucesso será exibida pela função onUpdateTaskContent em Execucao.tsx
    }
  };

  return (
    <div className="grid gap-1.5">
      <Label htmlFor="task-owner" className="text-gray-700 flex items-center gap-1">
        <User className="h-4 w-4" /> Responsável
      </Label>
      <Select
        value={selectedOwnerInitials}
        onValueChange={handleOwnerChange}
        disabled={isLoading}
      >
        <SelectTrigger className="w-full">
          <SelectValue placeholder="Selecione o responsável" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="">Nenhum</SelectItem>
          {teamMembers.map((member) => (
            <SelectItem key={member.initials} value={member.initials}>
              {member.name} ({member.initials})
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
};

export default TaskOwnerSelector;