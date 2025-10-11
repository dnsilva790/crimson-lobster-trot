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
    // For endpoints expecting an array (like /tasks or /projects), return an empty array
    // For single item endpoints (like /tasks/{id}), return undefined
    if (endpoint.startsWith("/tasks") && endpoint.split('/').length === 3) { // e.g., /tasks/{id}
      return undefined;
    }
    if (endpoint.startsWith("/tasks") || endpoint.startsWith("/projects")) {
      return [] as T;
    }
    return undefined; // For other endpoints (like closeTask, deleteTask)
  }

  const jsonResponse = await response.json();
  console.log(`Todoist API Response Body for ${url}:`, jsonResponse);

  // Corrected logic: only return empty array if an array is expected but a non-array is received
  // and the endpoint is NOT for a single item.
  if ((endpoint.startsWith("/tasks") && endpoint.split('/').length === 2) || endpoint.startsWith("/projects")) { // e.g., /tasks (list) or /projects
    if (!Array.isArray(jsonResponse)) {
      console.warn(`Todoist API: Expected array for ${endpoint}, but received non-array. Returning empty array.`);
      return [] as T;
    }
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
    const restApiData: any = {};
    const syncApiCommands: any[] = [];
    let needsRestApiCall = false;
    let needsSyncApiCall = false;

    // Processar campos para a REST API v2
    if (data.content !== undefined) { restApiData.content = data.content; needsRestApiCall = true; }
    if (data.description !== undefined) { restApiData.description = data.description; needsRestApiCall = true; }
    if (data.priority !== undefined) { restApiData.priority = data.priority; needsRestApiCall = true; }
    if (data.due_date !== undefined) { restApiData.due_date = data.due_date; needsRestApiCall = true; }
    if (data.due_datetime !== undefined) { restApiData.due_datetime = data.due_datetime; needsRestApiCall = true; }
    if (data.labels !== undefined) { restApiData.labels = data.labels; needsRestApiCall = true; }
    if (data.duration !== undefined) { restApiData.duration = data.duration; needsRestApiCall = true; }
    if (data.duration_unit !== undefined) { restApiData.duration_unit = data.duration_unit; needsRestApiCall = true; }

    // Processar campo deadline para a Sync API v9
    if (data.deadline !== undefined) {
      syncApiCommands.push({
        type: "item_update",
        uuid: generateUuid(),
        args: {
          id: taskId,
          deadline: data.deadline,
        },
      });
      needsSyncApiCall = true;
    }

    let restApiResult: TodoistTask | undefined;
    let syncApiResult: any;

    if (needsRestApiCall) {
      restApiResult = await todoistApiCall<TodoistTask>(`/tasks/${taskId}`, apiKey, "POST", restApiData);
    }

    if (needsSyncApiCall) {
      syncApiResult = await todoistSyncApiCall(apiKey, syncApiCommands);
      // Após a chamada da Sync API, re-buscamos a tarefa para obter o estado mais recente.
      // No entanto, a REST API v2 pode não retornar campos personalizados.
      // Então, garantimos que o deadline seja explicitamente definido se foi atualizado via Sync API.
      const fetchedTask = await todoistApiCall<TodoistTask>(`/tasks/${taskId}`, apiKey, "GET");
      restApiResult = fetchedTask; // Usamos a tarefa buscada como base

      // Se um deadline foi fornecido nos dados e a chamada da Sync API foi feita,
      // atualizamos manualmente o deadline no objeto retornado para consistência.
      if (data.deadline !== undefined && restApiResult) {
        restApiResult.deadline = data.deadline;
      }
    }

    // Se apenas a Sync API foi chamada, ou se a REST API foi chamada e depois a Sync,
    // o restApiResult final deve conter o estado mais atualizado da tarefa.
    return restApiResult;
  },
};