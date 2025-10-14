"use client";

import React, { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { PlusCircle, Settings, Trash2, Save } from "lucide-react";
import { toast } from "sonner";
import { DurationRange } from "@/lib/types";
import { getDurationRanges, saveDurationRanges } from "@/utils/durationRangeStorage";

interface DurationRangeConfigProps {
  onSave: (ranges: DurationRange[]) => void;
}

const DurationRangeConfig: React.FC<DurationRangeConfigProps> = ({ onSave }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [ranges, setRanges] = useState<DurationRange[]>([]);

  useEffect(() => {
    if (isOpen) {
      setRanges(getDurationRanges());
    }
  }, [isOpen]);

  const handleAddRange = useCallback(() => {
    setRanges((prev) => [
      ...prev,
      { id: Date.now().toString(), label: "", minMinutes: null, maxMinutes: null },
    ]);
  }, []);

  const handleUpdateRange = useCallback(
    (id: string, field: keyof DurationRange, value: string | number | null) => {
      setRanges((prev) =>
        prev.map((range) =>
          range.id === id
            ? {
                ...range,
                [field]:
                  field === "label"
                    ? (value as string)
                    : value === ""
                    ? null
                    : parseInt(value as string, 10),
              }
            : range
        )
      );
    },
    []
  );

  const handleDeleteRange = useCallback((id: string) => {
    setRanges((prev) => prev.filter((range) => range.id !== id));
  }, []);

  const handleSave = useCallback(() => {
    // Basic validation
    for (const range of ranges) {
      if (!range.label.trim()) {
        toast.error("Todos os rótulos de período devem ser preenchidos.");
        return;
      }
      if (
        (range.minMinutes !== null && isNaN(range.minMinutes)) ||
        (range.maxMinutes !== null && isNaN(range.maxMinutes))
      ) {
        toast.error("Os valores de minutos devem ser números válidos.");
        return;
      }
      if (
        range.minMinutes !== null &&
        range.maxMinutes !== null &&
        range.minMinutes > range.maxMinutes
      ) {
        toast.error(`O mínimo não pode ser maior que o máximo para o período "${range.label}".`);
        return;
      }
    }

    saveDurationRanges(ranges);
    onSave(ranges);
    toast.success("Períodos de duração salvos com sucesso!");
    setIsOpen(false);
  }, [ranges, onSave]);

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="flex items-center gap-2">
          <Settings className="h-4 w-4" /> Configurar Períodos
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>Configurar Períodos de Duração</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <p className="text-sm text-gray-600">
            Defina os intervalos de duração para agrupar suas tarefas. Use '0' para tarefas sem duração definida ou 'null' para limites abertos (ex: 'Mais de 60 minutos').
          </p>
          {ranges.map((range, index) => (
            <div key={range.id} className="flex items-center gap-2 border p-2 rounded-md">
              <Input
                placeholder="Rótulo (ex: 0-5 min)"
                value={range.label}
                onChange={(e) => handleUpdateRange(range.id, "label", e.target.value)}
                className="flex-1"
              />
              <Input
                type="number"
                placeholder="Min (minutos)"
                value={range.minMinutes === null ? "" : range.minMinutes}
                onChange={(e) => handleUpdateRange(range.id, "minMinutes", e.target.value)}
                className="w-24"
              />
              <Input
                type="number"
                placeholder="Max (minutos)"
                value={range.maxMinutes === null ? "" : range.maxMinutes}
                onChange={(e) => handleUpdateRange(range.id, "maxMinutes", e.target.value)}
                className="w-24"
              />
              <Button variant="destructive" size="icon" onClick={() => handleDeleteRange(range.id)}>
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}
          <Button variant="outline" onClick={handleAddRange} className="flex items-center gap-2">
            <PlusCircle className="h-4 w-4" /> Adicionar Período
          </Button>
        </div>
        <Button onClick={handleSave} className="flex items-center gap-2">
          <Save className="h-4 w-4" /> Salvar Configuração
        </Button>
      </DialogContent>
    </Dialog>
  );
};

export default DurationRangeConfig;