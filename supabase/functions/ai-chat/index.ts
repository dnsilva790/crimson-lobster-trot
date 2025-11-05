import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { GoogleGenerativeAI } from 'https://esm.sh/@google/generative-ai@0.14.1';

console.log('Hello from AI Chat Edge Function!');

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { aiPrompt, userMessage, currentTask, allTasks, chatHistory } = await req.json();

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

    const safeAiPrompt = aiPrompt || '';
    const safeCurrentTask = currentTask || {};
    const safeAllTasks = allTasks || [];

    // Original chat mode
    const formattedChatHistoryForGemini = chatHistory.map((msg: any) => ({
      role: msg.sender === 'user' ? 'user' : 'model', // Ensure role is 'user' or 'model'
      parts: [{ text: msg.text || '' }], // Ensure text is always a string
    }));

    const fullPromptContent = `
      ${safeAiPrompt}

      --- CONTEXTO ATUAL ---
      ${safeCurrentTask.id ? `Tarefa em Foco:
      ID: ${safeCurrentTask.id}
      Conteúdo: ${safeCurrentTask.content || 'N/A'}
      Descrição: ${safeCurrentTask.description || 'N/A'}
      Prioridade: P${safeCurrentTask.priority || 'N/A'}
      Vencimento: ${safeCurrentTask.due?.datetime || safeCurrentTask.due?.date || 'N/A'}
      Deadline: ${safeCurrentTask.deadline || 'N/A'}
      Etiquetas: ${(safeCurrentTask.labels || []).join(', ') || 'N/A'}
      URL: ${safeCurrentTask.url || 'N/A'}
      ` : 'Nenhuma tarefa específica em foco.'}

      ${safeAllTasks.length > 0 ? `Todas as Tarefas (para Radar de Produtividade, se aplicável):
      ${safeAllTasks.map((task: any) => `- [P${task.priority || 'N/A'}] ${task.content || 'N/A'} (ID: ${task.id || 'N/A'}, Venc: ${task.due?.datetime || task.due?.date || 'N/A'}, Deadline: ${task.deadline || 'N/A'}, Labels: ${(task.labels || []).join(', ') || 'N/A'})`).join('\n')}
      ` : 'Nenhuma outra tarefa disponível para contexto.'}

      --- CONVERSA ---
      (O histórico de conversas abaixo é fornecido para contexto. A última mensagem é a do usuário atual.)
      ${userMessage}
    `;

    const contents = [
      { role: "user", parts: [{ text: fullPromptContent }] },
      ...formattedChatHistoryForGemini,
    ];

    const result = await model.generateContent({ contents });
    const response = await result.response;
    const text = response.text();

    return new Response(JSON.stringify({ response: text }), {
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      status: 200,
    });
    
  } catch (error) {
    console.error('Error in AI Chat Edge Function:', error.message);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      status: 500,
    });
  }
});