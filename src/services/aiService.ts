import { TodoistTask } from "@/lib/types";

const GEMINI_CHAT_FUNCTION_URL = "https://nesiwmsujsulwncbmcnc.supabase.co/functions/v1/ai-chat";

interface AiChatRequest {
  aiPrompt: string;
  userMessage: string;
  currentTask: TodoistTask | null;
  allTasks: TodoistTask[];
  chatHistory: { sender: 'user' | 'ai'; text: string }[];
}

interface AiRatingSuggestion {
  urgency: number;
  importance: number;
  reasoning: string;
}

/**
 * Calls the AI Edge Function to get a rating suggestion for an Eisenhower Task.
 * It relies on the AI Prompt to instruct the model to return a specific JSON structure.
 */
export async function suggestEisenhowerRating(
  task: TodoistTask,
  learningContext: string,
): Promise<AiRatingSuggestion | null> {
  const RATING_PROMPT = `
    Você é um especialista em priorização de tarefas usando a Matriz de Eisenhower (Urgência vs. Importância, escala 0-100).
    Sua tarefa é analisar a 'Tarefa em Foco' e, com base no contexto de aprendizado fornecido, sugerir uma pontuação de Urgência e Importância.
    
    **REGRAS DE SAÍDA:**
    1. **NÃO** responda com texto conversacional.
    2. **APENAS** retorne um objeto JSON válido no formato: 
       { "urgency": [0-100], "importance": [0-100], "reasoning": "Explicação concisa da pontuação." }
    3. A pontuação deve ser um número inteiro.
    
    --- CONTEXTO DE APRENDIZAGEM ---
    ${learningContext}
    
    --- TAREFA EM FOCO ---
    Conteúdo: ${task.content}
    Descrição: ${task.description || 'N/A'}
    Prioridade Todoist: P${task.priority}
    Vencimento: ${task.due?.datetime || task.due?.date || 'N/A'}
    Deadline: ${task.deadline || 'N/A'}
    Etiquetas: ${task.labels.join(', ') || 'N/A'}
    
    Qual é a sugestão de pontuação?
  `;

  try {
    const response = await fetch(GEMINI_CHAT_FUNCTION_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        aiPrompt: RATING_PROMPT,
        userMessage: "Sugira a pontuação de Eisenhower para a tarefa acima.",
        currentTask: task,
        allTasks: [],
        chatHistory: [],
      } as AiChatRequest),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || `Erro na função Edge: ${response.statusText}`);
    }

    const data = await response.json();
    let rawResponse = data.response.trim();

    // Tenta extrair JSON do bloco de código markdown se a IA o usou
    if (rawResponse.startsWith('```json')) {
      rawResponse = rawResponse.substring(7, rawResponse.lastIndexOf('```')).trim();
    } else if (rawResponse.startsWith('```')) {
      rawResponse = rawResponse.substring(3, rawResponse.lastIndexOf('```')).trim();
    }

    const suggestion: AiRatingSuggestion = JSON.parse(rawResponse);
    
    if (typeof suggestion.urgency !== 'number' || typeof suggestion.importance !== 'number') {
        throw new Error("Resposta da IA não contém pontuações numéricas válidas.");
    }

    return suggestion;

  } catch (error) {
    console.error("Erro ao obter sugestão de rating da IA:", error);
    return null;
  }
}