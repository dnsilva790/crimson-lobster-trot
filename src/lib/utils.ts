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

// Helper to extract content from a specific tag in the description
const extractSectionContent = (description: string, tag: string): string => {
  const escapedTag = tag.replace(/\[/g, '\\[').replace(/\]/g, '\\]');
  // Regex para encontrar a tag e capturar o conteúdo até a próxima tag ou fim da string
  const regex = new RegExp(`${escapedTag}\\s*([\\s\\S]*?)(?=\\n\\[[A-Z_]+\\]:|$|\\n\\n)`, 'i');
  const match = description.match(regex);
  return match && match[1] ? match[1].trim() : '';
};

// Helper to update or add a section in the description, preserving other content
export const updateDescriptionWithSection = (
  fullDescription: string,
  tag: string,
  newContent: string
): string => {
  const escapedTag = tag.replace(/\[/g, '\\[').replace(/\]/g, '\\]');
  const regex = new RegExp(`(${escapedTag}\\s*)([\\s\\S]*?)(?=\\n\\[[A-Z_]+\\]:|$|\\n\\n)`, 'i');

  if (newContent.trim()) {
    if (fullDescription.match(regex)) {
      // Replace existing section
      return fullDescription.replace(regex, `${tag} ${newContent.trim()}\n`);
    } else {
      // Add new section at the end if it doesn't exist
      return `${fullDescription.trim()}\n\n${tag} ${newContent.trim()}\n`;
    }
  } else {
    // Remove section if newContent is empty
    return fullDescription.replace(regex, '').trim();
  }
};

export function getSolicitante(task: TodoistTask): string | undefined {
  const description = task.description || '';
  const solicitante = extractSectionContent(description, '[SOLICITANTE]:');
  return solicitante || undefined;
}

export function isURL(str: string): boolean {
  try {
    new URL(str);
    return true;
  } catch (e) {
    return false;
  }
}