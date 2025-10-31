/// <reference lib="webworker" />

import { EisenhowerTask } from "@/lib/types";

// Define a interface para as mensagens que o worker pode receber
interface WorkerMessage {
  type: 'start';
  tasks: EisenhowerTask[];
  geminiChatFunctionUrl: string;
}

// Define a interface para as mensagens que o worker pode enviar
interface WorkerResponseMessage {
  type: 'progress' | 'complete' | 'error';
  processedCount?: number;
  totalCount?: number;
  updatedTasks?: EisenhowerTask[];
  error?: string;
}

const processTasks = async (tasks: EisenhowerTask[], geminiChatFunctionUrl: string) => {
  let updatedTasks = [...tasks];
  const totalCount = tasks.length;

  for (let i = 0; i < totalCount; i++) {
    const task = updatedTasks[i];
    try {
      const response = await fetch(geminiChatFunctionUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          eisenhowerRatingRequest: true,
          currentTask: task,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `Edge Function error: ${response.statusText}`);
      }

      const data = await response.json();
      const aiSuggestion = data.response;

      if (aiSuggestion && typeof aiSuggestion.urgency === 'number' && typeof aiSuggestion.importance === 'number') {
        updatedTasks[i] = {
          ...task,
          urgency: Math.max(0, Math.min(100, Math.round(aiSuggestion.urgency))),
          importance: Math.max(0, Math.min(100, Math.round(aiSuggestion.importance))),
        };
      } else {
        console.warn(`AI did not return valid suggestions for task ${task.id}. Skipping.`);
      }
    } catch (error: any) {
      console.error(`Error processing task ${task.id} with AI:`, error);
      // Continue processing other tasks even if one fails
    }

    // Envia progresso de volta para a thread principal
    self.postMessage({
      type: 'progress',
      processedCount: i + 1,
      totalCount: totalCount,
      updatedTasks: updatedTasks, // Envia as tarefas atualizadas a cada passo
    } as WorkerResponseMessage);

    // Pequeno delay para evitar sobrecarga e permitir que a UI atualize
    await new Promise(resolve => setTimeout(resolve, 200));
  }

  // Envia mensagem de conclusão
  self.postMessage({
    type: 'complete',
    updatedTasks: updatedTasks,
  } as WorkerResponseMessage);
};

// Listener para mensagens da thread principal
self.onmessage = (event: MessageEvent<WorkerMessage>) => {
  const { type, tasks, geminiChatFunctionUrl } = event.data;

  if (type === 'start') {
    processTasks(tasks, geminiChatFunctionUrl).catch(error => {
      self.postMessage({ type: 'error', error: error.message } as WorkerResponseMessage);
    });
  }
};