"use client";

import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Settings } from "lucide-react";

interface PlannerPromptEditorProps {
  initialPrompt: string;
  onSave: (newPrompt: string) => void;
  storageKey: string;
}

const PlannerPromptEditor: React.FC<PlannerPromptEditorProps> = ({
  initialPrompt,
  onSave,
  storageKey,
}) => {
  const [editedPrompt, setEditedPrompt] = useState(initialPrompt);
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    setEditedPrompt(initialPrompt);
  }, [initialPrompt]);

  const handleSave = () => {
    onSave(editedPrompt);
    toast.success("Prompt da IA do Planejador salvo com sucesso!");
    setIsOpen(false);
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="flex items-center gap-2">
          <Settings className="h-4 w-4" /> Editar Prompt da IA do Planejador
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[800px]">
        <DialogHeader>
          <DialogTitle>Editar Prompt do Tutor IA SEISO (Planejador)</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <Label htmlFor="planner-ai-prompt">
            Edite o prompt da IA aqui. Ele define como o Planejador sugere slots.
          </Label>
          <Textarea
            id="planner-ai-prompt"
            value={editedPrompt}
            onChange={(e) => setEditedPrompt(e.target.value)}
            rows={20}
            className="font-mono text-sm"
          />
        </div>
        <Button onClick={handleSave}>Salvar Prompt</Button>
      </DialogContent>
    </Dialog>
  );
};

export default PlannerPromptEditor;