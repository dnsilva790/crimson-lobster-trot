import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { TodoistTask, InternalTask } from "@/lib/types"; // Importar tipos necessários

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function getTaskCategory(task: TodoistTask | InternalTask): "pessoal" | "profissional" | undefined {
  if ('labels' in task) { // É uma TodoistTask
    const labels = task.labels.map(label => label.toLowerCase());
    if (labels.includes("profissional")) {
      return "profissional";
    }
    if (labels.includes("pessoal")) {
      return "pessoal";
    }
  } else if ('category' in task) { // É uma InternalTask
    return task.category;
  }
  return undefined;
}