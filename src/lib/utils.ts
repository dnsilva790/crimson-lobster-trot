import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { TodoistTask } from "@/lib/types";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function getTaskType(task: TodoistTask): "Pessoal" | "Profissional" | undefined {
  const content = task.content.toLowerCase();
  const description = task.description?.toLowerCase() || "";

  if (content.includes("[profissional]") || description.includes("[profissional]")) {
    return "Profissional";
  }
  if (content.includes("[pessoal]") || description.includes("[pessoal]")) {
    return "Pessoal";
  }
  return undefined;
}