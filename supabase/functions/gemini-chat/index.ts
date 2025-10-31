import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { GoogleGenerativeAI } from 'https://esm.sh/@google/generative-ai@0.14.1';

console.log('Hello from Gemini Chat Edge Function!');

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type' } });
  }

  try {
    const { aiPrompt, userMessage, currentTask, allTasks, chatHistory, eisenhowerRatingRequest } = await req.json(); // Receive new eisenhowerRatingRequest

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

    // Ensure all text parts are strings and roles are correct for Gemini
    const safeAiPrompt = aiPrompt || '';
    const safeCurrentTask = currentTask || {};
    const safeAllTasks = allTasks || [];

    if (eisenhowerRatingRequest && safeCurrentTask.id) {
      // Special mode for Eisenhower rating
      const eisenhowerPrompt = `
        Você é um especialista em produtividade e na Matriz de Eisenhower. Sua tarefa é avaliar a seguinte tarefa e atribuir pontuações de Urgência e Importância de 0 a 100.

        **Definições:**
        *   **Urgência (0-100)**: Quão sensível ao tempo é a tarefa? Precisa ser feita imediatamente ou há um prazo muito próximo? (0 = Nenhuma urgência, 100 = Urgência máxima, precisa ser feito agora).
        *   **Importância (0-100)**: Quão significativa é a tarefa para os objetivos de longo prazo, missão pessoal/profissional ou impacto geral? (0 = Nenhuma importância, 100 = Extremamente importante, alto impacto).

        **Tarefa a ser avaliada:**
        ID: ${safeCurrentTask.id}
        Conteúdo: ${safeCurrentTask.content || 'N/A'}
        Descrição: ${safeCurrentTask.description || 'N/A'}
        Prioridade Todoist: P${safeCurrentTask.priority || 'N/A'}
        Vencimento: ${safeCurrentTask.due?.datetime || safeCurrentTask.due?.date || 'N/A'}
        Deadline: ${safeCurrentTask.deadline || 'N/A'}
        Etiquetas: ${(safeCurrentTask.labels || []).join(', ') || 'N/A'}

        Por favor, retorne um objeto JSON com as pontuações de urgência e importância, e um breve raciocínio.
        Exemplo de formato de saída:
        {
          "urgency": 85,
          "importance": 90,
          "reasoning": "Esta tarefa é urgente devido ao prazo iminente e importante por seu impacto direto nos objetivos do projeto X."
        }
      `;

      const result = await model.generateContent({ contents: [{ role: "user", parts: [{ text: eisenhowerPrompt }] }] });
      const response = await result.response;
      let text = response.text();

      // --- CORREÇÃO: Remover marcadores de bloco de código Markdown ---
      text = text.replace(/```json\s*/g, '').replace(/\s*```/g, '');
      // -----------------------------------------------------------------

      // Attempt to parse JSON, handle cases where AI might not return perfect JSON
      try {
        const jsonResponse = JSON.parse(text);
        return new Response(JSON.stringify({ response: jsonResponse }), {
          headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
          status: 200,
        });
      } catch (jsonError) {
        console.error('Error parsing AI JSON response:', jsonError);
        return new Response(JSON.stringify({ error: "AI returned malformed JSON. Raw response: " + text }), {
          headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
          status: 500,
        });
      }

    } else {
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
    }
  } catch (error) {
    console.error('Error in Gemini Chat Edge Function:', error.message);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      status: 500,
    });
  }
});