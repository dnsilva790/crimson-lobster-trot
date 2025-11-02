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

export function getDelegateNameFromLabels(labels: string[]): string | undefined {
  const delegateLabel = labels.find(label => label.startsWith("espera_de_"));
  if (delegateLabel) {
    // Remove 'espera_de_' prefix and replace underscores with spaces, then capitalize first letter of each word
    const name = delegateLabel.replace("espera_de_", "").replace(/_/g, " ");
    return (name || '').split(' ').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' '); // Adicionado (name || '').
  }
  return undefined;
}

export function isURL(str: string): boolean {
  try {
    new URL(str);
    return true;
  } catch (_) {
    return false;
  }
}