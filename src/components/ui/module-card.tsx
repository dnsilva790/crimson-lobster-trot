import React from "react";
import { cn } from "@/lib/utils";
import { Card } from "@/components/ui/card";
import { LucideIcon } from "lucide-react";

interface ModuleCardProps extends React.HTMLAttributes<HTMLDivElement> {
  icon: LucideIcon;
  title: string;
  description: string;
  colorClass: string; // Tailwind class for background color, e.g., "bg-green-500"
  isActive?: boolean;
}

const ModuleCard = ({
  icon: Icon,
  title,
  description,
  colorClass,
  isActive = false,
  className,
  ...props
}: ModuleCardProps) => {
  return (
    <Card
      className={cn(
        "flex flex-col items-center p-4 text-center rounded-xl cursor-pointer transition-all duration-200 ease-in-out",
        "hover:shadow-lg hover:scale-[1.02] border-2",
        colorClass, // Apply the background color
        isActive ? "border-indigo-600 shadow-lg scale-[1.02]" : "border-transparent",
        className,
      )}
      {...props}
    >
      <div
        className={cn(
          "p-3 rounded-full mb-3",
          isActive ? "bg-white/90 text-indigo-700" : "bg-white/70 text-gray-800",
        )}
      >
        <Icon size={28} />
      </div>
      <h3
        className={cn(
          "text-xl font-semibold mb-1",
          isActive ? "text-indigo-900" : "text-gray-900",
        )}
      >
        {title}
      </h3>
      <p
        className={cn(
          "text-sm",
          isActive ? "text-indigo-700" : "text-gray-700",
        )}
      >
        {description}
      </p>
    </Card>
  );
};

export default ModuleCard;