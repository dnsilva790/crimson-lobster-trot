import { TodoistTask } from "@/lib/types";
import { updateDescriptionWithSection } from "@/lib/utils";

const EISENHOWER_TAG = '[EISENHOWER_RATING]:';

// Helper to extract content from a specific tag in the description
const extractSectionContent = (description: string, tag: string): string => {
  const escapedTag = tag.replace(/\[/g, '\\[').replace(/\]/g, '\\]');
  const regex = new RegExp(`${escapedTag}\\s*([\\s\\S]*?)(?=\\n\\[[A-Z_]+\\]:|$|\\n\\n)`, 'i');
  const match = description.match(regex);
  return match && match[1] ? match[1].trim() : '';
};

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