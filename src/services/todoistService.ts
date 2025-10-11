import { TodoistTask, TodoistProject } from "@/lib/types";

const TODOIST_API_BASE_URL = "https://api.todoist.com/rest/v2";
const TODOIST_SYNC_API_BASE_URL = "https://api.todoist.com/sync/v9"; // Nova URL para a Sync API

interface TodoistError {
  status: number;
  message: string;
}

// Função para gerar UUIDs aleatórios, necessários para a Sync API
function generateUuid(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0, v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

async function todoistApiCall<T>(
  endpoint: string,
  apiKey: string,
  method: string = "GET",
  body?: object,
  baseUrl: string = TODOIST_API_BASE_URL,
): Promise<T | undefined> {
  const sanitizedApiKey = apiKey.replace(/[^\x20-\x7E]/g, '');

  const headers: HeadersInit = {
    Authorization: `Bearer ${sanitizedApiKey}`,
    "Content-Type": "application/json",
  };

  const config: RequestInit = {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  };

  const url = `${baseUrl}${endpoint}`;
  console.log("Todoist API Request URL:", url);

  const response = await fetch(url, config);

  console.log(`Todoist API Response Status for ${url}:`, response.status);

  if (!response.ok) {
    const errorText = await response.text();
    console.error(`Todoist API Error Response Body for ${url}:`, errorText);
    const errorData: TodoistError = {
      status: response.status,
      message: errorText,
    };
    throw errorData; // Re-throw para ser capturado pelo makeApiCall no contexto
  }

  if (response.status === 204) {
    console.log(`Todoist API Response Body for ${url}:`, "No Content (204)");
    // Para endpoints de item único (como /tasks/{id}), retorna undefined
    if (endpoint.startsWith("/tasks") && endpoint.split('/').length === 3) {
      return undefined;
    }
    // Para endpoints de lista, retorna um array vazio
    if (endpoint.startsWith("/tasks") || endpoint.startsWith("/projects")) {
      return [] as T;
    }
    return undefined; // Para outros endpoints (como closeTask, deleteTask)
  }

  const jsonResponse = await response.json();
  console.log(`Todoist API Response Body for ${url}:`, jsonResponse);

  // Se for um endpoint de lista e a resposta não for um array, retorna um array vazio
  if (((endpoint.startsWith("/tasks") && endpoint.split('/').length === 2) || endpoint.startsWith("/projects")) && !Array.isArray(jsonResponse)) {
    console.warn(`Todoist API: Expected array for ${endpoint}, but received non-array. Returning empty array.`);
    return [] as T;
  }

  return jsonResponse as T;
}

// Nova função para chamadas à Sync API
async function todoistSyncApiCall(
  apiKey: string,
  commands: any[],
): Promise<any | undefined> {
  const sanitizedApiKey = apiKey.replace(/[^\x20-\x7E]/g, '');

  const headers: HeadersInit = {
    Authorization: `Bearer ${sanitizedApiKey}`,
    "Content-Type": "application/json",
  };

  const config: RequestInit = {
    method: "POST",
    headers,
    body: JSON.stringify({ commands }),
  };

  const url = `${TODOIST_SYNC_API_BASE_URL}/sync`;
  console.log("Todoist Sync API Request URL:", url);
  console.log("Todoist Sync API Request Body:", JSON.stringify({ commands }));

  const response = await fetch(url, config);

  console.log(`Todoist Sync API Response Status for ${url}:`, response.status);

  if (!response.ok) {
    const errorText = await response.text();
    console.error(`Todoist Sync API Error Response Body for ${url}:`, errorText);
    const errorData: TodoistError = {
      status: response.status,
      message: errorText,
    };
    throw errorData;
  }

  const jsonResponse = await response.json();
  console.log(`Todoist Sync API Response Body for ${url}:`, jsonResponse);
  return jsonResponse;
}


export const todoistService = {
  fetchTasks: async (apiKey: string, filter?: string): Promise<TodoistTask[]> => {
    const endpoint = filter ? `/tasks?filter=${encodeURIComponent(filter)}` : "/tasks";
    const result = await todoistApiCall<TodoistTask[]>(endpoint, apiKey);
    return result || []; // Garante que sempre seja um array, mesmo se todoistApiCall retornar undefined (para 204)
  },

  fetchProjects: async (apiKey: string): Promise<TodoistProject[]> => {
    const result = await todoistApiCall<TodoistProject[]>("/projects", apiKey);
    return result || []; // Garante que sempre seja um array
  },

  closeTask: async (apiKey: string, taskId: string): Promise<void> => {
    return todoistApiCall<void>(`/tasks/${taskId}/close`, apiKey, "POST");
  },

  deleteTask: async (apiKey: string, taskId: string): Promise<void> => {
    return todoistApiCall<void>(`/tasks/${taskId}`, apiKey, "DELETE");
  },

  updateTask: async (apiKey: string, taskId: string, data: {
    content?: string;
    description?: string;
    priority?: 1 | 2 | 3 | 4;
    due_date?: string | null;
    due_datetime?: string | null;
    labels?: string[];
    duration?: number;
    duration_unit?: "minute" | "day";
    deadline?: string | null; // Adicionado o campo deadline
  }): Promise<TodoistTask | undefined> => {
    const restApiPayload: any = {};
    const syncApiCommands: any[] = [];
    let needsRestApiCall = false;
    let needsSyncApiCall = false;

    // 1. Identificar campos para a REST API v2
    if (data.content !== undefined) { restApiPayload.content = data.content; needsRestApiCall = true; }
    if (data.description !== undefined) { restApiPayload.description = data.description; needsRestApiCall = true; }
    if (data.priority !== undefined) { restApiPayload.priority = data.priority; needsRestApiCall = true; }
    if (data.due_date !== undefined) { restApiPayload.due_date = data.due_date; needsRestApiCall = true; }
    if (data.due_datetime !== undefined) { restApiPayload.due_datetime = data.due_datetime; needsRestApiCall = true; }
    if (data.labels !== undefined) { restApiPayload.labels = data.labels; needsRestApiCall = true; }
    if (data.duration !== undefined) { restApiPayload.duration = data.duration; needsRestApiCall = true; }
    if (data.duration_unit !== undefined) { restApiPayload.duration_unit = data.duration_unit; needsRestApiCall = true; }

    // 2. Identificar campo deadline para a Sync API v9 (como campo personalizado)
    if (data.deadline !== undefined) {
      const fieldValues: { [key: string]: string | null } = {};
      // Usando "Deadline" como a chave, conforme sugerido pelo seu documento
      fieldValues["Deadline"] = data.deadline; 

      syncApiCommands.push({
        type: "item_update",
        uuid: generateUuid(),
        args: {
          id: taskId,
          field_values: fieldValues, // Enviar campos personalizados via field_values
        },
      });
      needsSyncApiCall = true;
    }

    let restApiUpdateResult: TodoistTask | undefined;
    let fetchedTaskAfterUpdates: TodoistTask | undefined;

    // 3. Realizar a atualização via REST API, se necessário
    if (needsRestApiCall) {
      restApiUpdateResult = await todoistApiCall<TodoistTask>(`/tasks/${taskId}`, apiKey, "POST", restApiPayload);
    }

    // 4. Realizar a atualização via Sync API, se necessário
    if (needsSyncApiCall) {
      await todoistSyncApiCall(apiKey, syncApiCommands);
    }

    // 5. Buscar a tarefa novamente para obter o estado mais atualizado do Todoist
    // Isso é importante porque a REST API POST pode não retornar todos os campos,
    // e a Sync API não retorna o item atualizado diretamente.
    fetchedTaskAfterUpdates = await todoistApiCall<TodoistTask>(`/tasks/${taskId}`, apiKey, "GET");

    // 6. Construir o objeto de resultado final
    let finalResult: TodoistTask | undefined = fetchedTaskAfterUpdates;

    // Sobrepor campos do resultado da atualização REST API se for mais completo
    if (restApiUpdateResult) {
        finalResult = { ...(finalResult || {}), ...restApiUpdateResult } as TodoistTask;
    }

    // A API GET (REST v2) para tarefas NÃO retorna campos personalizados.
    // Então, precisamos garantir que `finalResult.deadline` reflita o que acabamos de enviar via Sync API.
    if (finalResult) {
        finalResult.deadline = data.deadline; // Definir manualmente o deadline a partir dos dados de entrada
    }

    console.log("TodoistService: updateTask final result:", finalResult);
    return finalResult;
  },

  createTask: async (apiKey: string, data: {
    content: string;
    description?: string;
    project_id?: string;
    parent_id?: string; // Para criar subtarefas
    due_date?: string;
    due_datetime?: string;
    priority?: 1 | 2 | 3 | 4;
    labels?: string[];
    duration?: number;
    duration_unit?: "minute" | "day";
  }): Promise<TodoistTask | undefined> => {
    return todoistApiCall<TodoistTask>("/tasks", apiKey, "POST", data);
  },
};