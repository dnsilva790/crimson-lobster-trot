import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
// Removido: import { TodoistTask } from "@/lib/types";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Removido: export function getTaskType(task: TodoistTask): "Pessoal" | "Profissional" | undefined {
// Removido:   const labels = task.labels.map(label => label.toLowerCase());
// Removido:
// Removido:   if (labels.includes("profissional")) {
// Removido:     return "Profissional";
// Removido:   }
// Removido:   if (labels.includes("pessoal")) {
// Removido:     return "Pessoal";
// Removido:   }
// Removido:   return undefined;
// Removido: }