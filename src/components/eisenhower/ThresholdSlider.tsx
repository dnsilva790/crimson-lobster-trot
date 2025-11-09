"use client";

import React from "react";
import { Slider } from "@/components/ui/slider";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button"; // Importar Button
import { Plus, Minus } from "lucide-react"; // Importar ícones
import { cn } from "@/lib/utils";

interface ThresholdSliderProps {
  value: number;
  onValueChange: (value: number) => void;
  label: string;
  orientation: "horizontal" | "vertical";
  className?: string;
  max?: number;
  min?: number; // Adicionado min prop
}

const ThresholdSlider: React.FC<ThresholdSliderProps> = ({
  value,
  onValueChange,
  label,
  orientation,
  className,
  max = 100,
  min = 0, // Default min to 0
}) => {
  const handleIncrement = () => {
    onValueChange(Math.min(max, value + 1));
  };

  const handleDecrement = () => {
    onValueChange(Math.max(min, value - 1));
  };

  return (
    <div className={cn("flex flex-col items-center gap-2", className)}>
      <Label className="text-sm font-semibold text-center">
        {label}: <span className="font-bold text-indigo-600">{value.toFixed(0)}</span>
      </Label>
      <div className="flex items-center gap-2 w-full">
        <Button 
          variant="outline" 
          size="icon" 
          onClick={handleDecrement} 
          disabled={value <= min}
          className="h-8 w-8"
        >
          <Minus className="h-4 w-4" />
        </Button>
        <Slider
          defaultValue={[value]}
          max={max}
          step={1}
          min={min}
          orientation={orientation}
          onValueChange={(v) => onValueChange(v[0])}
          className={cn(
            orientation === "vertical" ? "h-[300px] w-4" : "flex-grow h-4",
            "touch-none select-none"
          )}
        />
        <Button 
          variant="outline" 
          size="icon" 
          onClick={handleIncrement} 
          disabled={value >= max}
          className="h-8 w-8"
        >
          <Plus className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
};

export default ThresholdSlider;