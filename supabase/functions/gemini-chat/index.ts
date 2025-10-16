import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { GoogleGenerativeAI } from 'https://esm.sh/@google/generative-ai@0.14.1';

console.log('Hello from Gemini Chat Edge Function!');

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type' } });
  }

  try {
    const { aiPrompt, userMessage, currentTask, allTasks, chatHistory } = await req.json(); // Receive chatHistory

    const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY');
    if (!GEMINI_API_KEY) {
      throw new Error('GEMINI_API_KEY is not set in environment variables.');
    }

    const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);

    const model = genAI.getGenerativeModel({ 
      model: "gemini-2.5-flash",
      generationConfig: {
        temperature: 0.9,
        topP: 1,
        topK: 40,
        maxOutputTokens: 8192,
      },
      safetySettings: [
        {
          category: "HARM_CATEGORY_HARASSMENT",
          threshold: "BLOCK_MEDIUM_AND_ABOVE",
        },
        {
          category: "HARM_CATEGORY_HATE_SPEECH",
          threshold: "BLOCK_MEDIUM_AND_ABOVE",
        },
        {
          category: "HARM_CATEGORY_SEXUALLY_EXPLICIT",
          threshold: "BLOCK_MEDIUM_AND_ABOVE",
        },
        {
          category: "HARM_CATEGORY_DANGEROUS_CONTENT",
          threshold: "BLOCK_MEDIUM_AND_ABOVE",
        },
      ],
    });

    // Format chat history for Gemini
    const formattedChatHistory = chatHistory.map((msg: any) => ({
      role: msg.role,
      parts: [{ text: msg.text }],
    }));

    // Add the current user message to the history for the model
    formattedChatHistory.push({ role: "user", parts: [{ text: userMessage }] });

    const fullPrompt = `
      ${aiPrompt}

      --- CONTEXTO ATUAL ---
      ${currentTask ? `Tarefa em Foco:
      ID: ${currentTask.id}
      Conteúdo: ${currentTask.content}
      Descrição: ${currentTask.description || 'N/A'}
      Prioridade: P${currentTask.priority}
      Vencimento: ${currentTask.due?.datetime || currentTask.due?.date || 'N/A'}
      Deadline: ${currentTask.deadline || 'N/A'}
      Etiquetas: ${currentTask.labels.join(', ') || 'N/A'}
      URL: ${currentTask.url}
      ` : 'Nenhuma tarefa específica em foco.'}

      ${allTasks && allTasks.length > 0 ? `Todas as Tarefas (para Radar de Produtividade, se aplicável):
      ${allTasks.map((task: any) => `- [P${task.priority}] ${task.content} (ID: ${task.id}, Venc: ${task.due?.datetime || task.due?.date || 'N/A'}, Deadline: ${task.deadline || 'N/A'}, Labels: ${task.labels.join(', ') || 'N/A'})`).join('\n')}
      ` : 'Nenhuma outra tarefa disponível para contexto.'}

      --- CONVERSA ---
      (O histórico de conversas abaixo é fornecido para contexto. A última mensagem é a do usuário atual.)
    `;

    const result = await model.generateContent({
      contents: [
        { role: "user", parts: [{ text: fullPrompt }] }, // System instruction + context
        ...formattedChatHistory, // The actual conversation history
      ],
    });
    const response = await result.response;
    const text = response.text();

    return new Response(JSON.stringify({ response: text }), {
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      status: 200,
    });
  } catch (error) {
    console.error('Error in Gemini Chat Edge Function:', error.message);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      status: 500,
    });
  }
});