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
  
  // Regex para encontrar a tag e o conteúdo associado, incluindo quebras de linha
  // Captura a tag e o conteúdo até a próxima tag ou o final da string.
  // Adicionado \s* para capturar espaços/quebras de linha após o conteúdo da tag.
  const regex = new RegExp(`(\\n\\n|\\n|^)(${escapedTag}\\s*)([\\s\\S]*?)(?=\\n\\[[A-Z_]+\\]:|$|\\n\\n)`, 'i');

  if (newContent.trim()) {
    const contentToInsert = `${tag} ${newContent.trim()}`;
    
    if (fullDescription.match(regex)) {
      // Se a tag existir, substitui a seção inteira (incluindo a tag e o conteúdo antigo)
      // Usamos uma regex mais simples para substituição para evitar problemas com grupos de captura complexos
      const replacementRegex = new RegExp(`(${escapedTag}\\s*)([\\s\\S]*?)(?=\\n\\[[A-Z_]+\\]:|$|\\n\\n)`, 'i');
      
      // Se a descrição começar com a tag, substitui sem adicionar quebra de linha extra
      if (fullDescription.trim().startsWith(tag)) {
        return fullDescription.replace(replacementRegex, `${tag} ${newContent.trim()}`);
      }
      
      // Caso contrário, garante que haja uma quebra de linha antes da tag
      return fullDescription.replace(replacementRegex, `${tag} ${newContent.trim()}`);
    } else {
      // Adiciona nova seção no final, garantindo pelo menos duas quebras de linha antes
      const trimmedDescription = fullDescription.trim();
      return `${trimmedDescription}${trimmedDescription ? '\n\n' : ''}${contentToInsert}\n`;
    }
  } else {
    // Remove a seção inteira (incluindo a tag e o conteúdo) se newContent for vazio
    // A regex busca a tag e o conteúdo, e remove a quebra de linha anterior se houver.
    const removalRegex = new RegExp(`(\\n\\n|\\n|^)(${escapedTag}\\s*)([\\s\\S]*?)(?=\\n\\[[A-Z_]+\\]:|$|\\n\\n)`, 'i');
    return fullDescription.replace(removalRegex, '\n').trim();
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

// --- Funções 5W2H ---

export function get5W2H(task: TodoistTask): {
  what: string;
  why: string;
  who: string;
  where: string;
  when: string;
  how: string;
  howMuch: string;
} {
  const description = task.description || '';
  return {
    what: extractSectionContent(description, '[WHAT]:'),
    why: extractSectionContent(description, '[WHY]:'),
    who: extractSectionContent(description, '[WHO]:'),
    where: extractSectionContent(description, '[WHERE]:'),
    when: extractSectionContent(description, '[WHEN]:'),
    how: extractSectionContent(description, '[HOW]:'),
    howMuch: extractSectionContent(description, '[HOW_MUCH]:'),
  };
}

// --- Funções Eisenhower (NOVO) ---

const EISENHOWER_TAG = '[EISENHOWER_RATING]:';

export function getEisenhowerRating(task: TodoistTask): { urgency: number | null; importance: number | null; quadrant: 'do' | 'decide' | 'delegate' | 'delete' | null } {
  const description = task.description || '';
  const content = extractSectionContent(description, EISENHOWER_TAG);
  
  if (!content) {
    return { urgency: null, importance: null, quadrant: null };
  }

  const urgencyMatch = content.match(/U:(\d+)/);
  const importanceMatch = content.match(/I:(\d+)/);
  const quadrantMatch = content.match(/Q:(\w+)/);

  const urgency = urgencyMatch ? parseInt(urgencyMatch[1], 10) : null;
  const importance = importanceMatch ? parseInt(importanceMatch[1], 10) : null;
  const quadrant = quadrantMatch ? (quadrantMatch[1] as 'do' | 'decide' | 'delegate' | 'delete') : null;

  return { urgency, importance, quadrant };
}

export function updateEisenhowerRating(
  fullDescription: string,
  urgency: number | null,
  importance: number | null,
  quadrant: 'do' | 'decide' | 'delegate' | 'delete' | null
): string {
  let newContent = '';
  
  if (urgency !== null && importance !== null) {
    newContent += `U:${urgency}, I:${importance}`;
  }
  
  if (quadrant) {
    if (newContent) newContent += ', ';
    newContent += `Q:${quadrant}`;
  }

  return updateDescriptionWithSection(fullDescription, EISENHOWER_TAG, newContent);
}