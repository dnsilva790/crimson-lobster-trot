import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { GoogleGenerativeAI } from 'npm:@google/generative-ai';

console.log('Hello from Gemini Chat Edge Function!');

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type' } });
  }

  try {
    const { aiPrompt, userMessage, currentTask, allTasks } = await req.json();

    // Ensure GEMINI_API_KEY is set in Supabase environment variables
    const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY');
    if (!GEMINI_API_KEY) {
      throw new Error('GEMINI_API_KEY is not set in environment variables.');
    }

    const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
    // Alterando o modelo para 'gemini-1.0-pro' para maior compatibilidade e estabilidade
    const model = genAI.getGenerativeModel({ model: 'gemini-1.0-pro' });

    // Construct the full prompt for Gemini
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
      ${allTasks.map(task => `- [P${task.priority}] ${task.content} (ID: ${task.id}, Venc: ${task.due?.datetime || task.due?.date || 'N/A'}, Deadline: ${task.deadline || 'N/A'}, Labels: ${task.labels.join(', ') || 'N/A'})`).join('\n')}
      ` : 'Nenhuma outra tarefa disponível para contexto.'}

      --- CONVERSA ---
      Usuário: ${userMessage}
      Tutor IA:
    `;

    const result = await model.generateContent({
      contents: [{ role: "user", parts: [{ text: fullPrompt }] }],
      generationConfig: {
        temperature: 0.4, // Um valor mais baixo para respostas mais focadas e menos criativas
        maxOutputTokens: 1024, // Limite de tokens para a resposta, ajuste conforme necessário
      },
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