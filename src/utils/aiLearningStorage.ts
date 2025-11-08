import { EisenhowerTask } from "@/lib/types";

const AI_LEARNING_CRITERIA_STORAGE_KEY = "ai_learning_criteria_feedback";

interface LearningFeedback {
  taskId: string;
  aiUrgency: number;
  aiImportance: number;
  userUrgency: number;
  userImportance: number;
  reason: string;
  timestamp: string;
}

export const getLearningFeedback = (): LearningFeedback[] => {
  try {
    const stored = localStorage.getItem(AI_LEARNING_CRITERIA_STORAGE_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch (error) {
    console.error("Failed to load AI learning feedback", error);
    return [];
  }
};

export const addLearningFeedback = (feedback: LearningFeedback): void => {
  const existing = getLearningFeedback();
  // Keep only the last 50 entries to prevent storage bloat
  const updated = [feedback, ...existing].slice(0, 50); 
  try {
    localStorage.setItem(AI_LEARNING_CRITERIA_STORAGE_KEY, JSON.stringify(updated));
  } catch (error) {
    console.error("Failed to save AI learning feedback", error);
  }
};

export const getLearningContextForPrompt = (): string => {
  const feedback = getLearningFeedback();
  if (feedback.length === 0) return "";

  const recentFeedback = feedback.slice(0, 5); // Use only the 5 most recent entries

  const context = recentFeedback.map(f => {
    return `\n- Tarefa ID ${f.taskId}: AI sugeriu U:${f.aiUrgency}, I:${f.aiImportance}. Usuário corrigiu para U:${f.userUrgency}, I:${f.userImportance}. Razão: ${f.reason}`;
  }).join('');

  return `\n\n--- CONTEXTO DE APRENDIZAGEM (Últimas Correções do Usuário) ---${context}\n\n`;
};