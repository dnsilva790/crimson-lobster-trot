import { TodoistTask, TodoistProject } from "@/lib/types";

const TODOIST_API_BASE_URL = "https://api.todoist.com/rest/v2";

interface TodoistError {
  status: number;
  message: string;
}

async function todoistApiCall<T>(
  endpoint: string,
  apiKey: string,
  method: string = "GET",
  body?: object,
  baseUrl: string = TODOIST_API_BASE_URL,
): Promise<T | undefined> { // Alterado para retornar T | undefined para 204
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
    throw errorData;
  }

  if (response.status === 204) {
    console.log(`Todoist API Response Body for ${url}:`, "No Content (204)");
    return undefined; // Retorna undefined para 204
  }

  const jsonResponse = await response.json();
  console.log(`Todoist API Response Body for ${url}:`, jsonResponse);

  // Esta verificação ainda é útil para garantir que a resposta bruta seja um array se esperado
  if ((endpoint.startsWith("/tasks") || endpoint.startsWith("/projects")) && !Array.isArray(jsonResponse)) {
    console.warn(`Todoist API: Expected array for ${endpoint}, but received non-array. Returning empty array.`);
    return [] as T; // Retorna array vazio se o tipo estiver incorreto
  }

  return jsonResponse as T;
}

export const todoistService = {
  fetchTasks: async (apiKey: string, filter?: string): Promise<TodoistTask[]> => {
    const endpoint = filter ? `/tasks?filter=${encodeURIComponent(filter)}` : "/tasks";
    try {
      const result = await todoistApiCall<TodoistTask[]>(endpoint, apiKey);
      return result || []; // Garante que sempre seja um array, mesmo se todoistApiCall retornar undefined (para 204)
    } catch (error) {
      console.error("todoistService.fetchTasks failed:", error);
      return []; // Retorna array vazio em caso de erro
    }
  },

  fetchProjects: async (apiKey: string): Promise<TodoistProject[]> => {
    try {
      const result = await todoistApiCall<TodoistProject[]>("/projects", apiKey);
      return result || []; // Garante que sempre seja um array
    } catch (error) {
      console.error("todoistService.fetchProjects failed:", error);
      return []; // Retorna array vazio em caso de erro
    }
  },

  closeTask: async (apiKey: string, taskId: string): Promise<void> => {
    // todoistApiCall para void pode retornar undefined para 204, o que é aceitável para Promise<void>
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
  }): Promise<TodoistTask> => {
    return todoistApiCall<TodoistTask>(`/tasks/${taskId}`, apiKey, "POST", data);
  },
};