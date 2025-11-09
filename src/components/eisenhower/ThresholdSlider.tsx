"use client";

import React from "react";
import { Slider }ponents/ui/slider";
import { Label }ponents/ui/label";
import { cn } from "@/lib/utils";

interface ThresholdSliderProps {
  value: number;
  onValueChange: (value: number) => void;
  label: string;
  orientation: "horizontal" | "vertical";
  className?: string;
  max?: number; // NEW: Add max prop
}

const ThresholdSlider: React.FC<ThresholdSliderProps> = ({
  value,
  onValueChange,
  label,
  orientation,
  className,
  max = 100, // NEW: Default to 100 if not provided
}) => {
  return (
    <div className={cn("flex items-center", className)}>
      <div className={cn(
        "flex flex-col items-center",
        orientation === "vertical" ? "h-full" : "w-full"
      )}>
        <Label className={cn(
          "text-sm font-semibold mb-2",
          orientation === "vertical" ? "transform rotate-90 whitespace-nowrap" : "text-center"
        )}>
          {label}: {value.toFixed(0)}
        </Label>
        <Slider
          defaultValue={[value]}
          max={max} // Use the new max prop
          step={1}
          min={0}
          orientation={orientation}
          onValueChange={(v) => onValueChange(v[0])}
          className={cn(
            orientation === "vertical" ? "h-[300px] w-4" : "w-full h-4",
            "touch-none select-none"
          )}
        />
      </div>
    </div>
  );
};

export default ThresholdSlider;