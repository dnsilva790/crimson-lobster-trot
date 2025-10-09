import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { TodoistTask } from "@/lib/types";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function getTaskType(task: TodoistTask): "Pessoal" | "Profissional" | undefined {
  const labels = task.labels.map(label => label.toLowerCase());

  if (labels.includes("profissional")) {
    return "Profissional";
  }
  if (labels.includes("pessoal")) {
    return "Pessoal";
  }
  return undefined;
}