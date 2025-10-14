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

interface AIAgentPromptEditorProps {
  initialPrompt: string;
  onSave: (newPrompt: string) => void;
  storageKey: string;
}

const AIAgentPromptEditor: React.FC<AIAgentPromptEditorProps> = ({
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
    toast.success("Prompt do Tutor IA SEISO salvo com sucesso!");
    setIsOpen(false);
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="flex items-center gap-2">
          <Settings className="h-4 w-4" /> Editar Prompt do Tutor IA
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[800px]">
        <DialogHeader>
          <DialogTitle>Editar Prompt do Tutor IA SEISO</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <Label htmlFor="ai-agent-prompt">
            Edite o prompt do Tutor IA aqui. Ele define o comportamento do seu coach.
          </Label>
          <Textarea
            id="ai-agent-prompt"
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

export default AIAgentPromptEditor;