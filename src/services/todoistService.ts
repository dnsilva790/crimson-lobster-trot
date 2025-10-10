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
): Promise<T> {
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

  try {
    const response = await fetch(url, config);

    console.log(`Todoist API Response Status for ${url}:`, response.status);

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`Todoist API Error Response Body for ${url}:`, errorText);
      const errorData: TodoistError = {
        status: response.status,
        message: errorText,
      };
      throw errorData; // Re-throw para ser capturado pelo makeApiCall
    }

    if (response.status === 204) {
      console.log(`Todoist API Response Body for ${url}:`, "No Content (204)");
      if (endpoint.startsWith("/tasks") || endpoint.startsWith("/projects")) {
        return [] as T;
      }
      return undefined as T;
    }

    const jsonResponse = await response.json();
    console.log(`Todoist API Response Body for ${url}:`, jsonResponse);

    if ((endpoint.startsWith("/tasks") || endpoint.startsWith("/projects")) && !Array.isArray(jsonResponse)) {
      console.warn(`Todoist API: Expected array for ${endpoint}, but received non-array. Returning empty array.`);
      return [] as T;
    }

    return jsonResponse as T;

  } catch (error: any) {
    console.error(`Todoist API Call failed for ${url}:`, error);
    // Se for um endpoint de tarefas ou projetos, retorna um array vazio em caso de erro
    if (endpoint.startsWith("/tasks") || endpoint.startsWith("/projects")) {
      return [] as T;
    }
    throw error; // Re-lança outros erros
  }
}

export const todoistService = {
  fetchTasks: async (apiKey: string, filter?: string): Promise<TodoistTask[]> => {
    const endpoint = filter ? `/tasks?filter=${encodeURIComponent(filter)}` : "/tasks";
    return todoistApiCall<TodoistTask[]>(endpoint, apiKey);
  },

  fetchProjects: async (apiKey: string): Promise<TodoistProject[]> => {
    return todoistApiCall<TodoistProject[]>("/projects", apiKey);
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
  }): Promise<TodoistTask> => {
    return todoistApiCall<TodoistTask>(`/tasks/${taskId}`, apiKey, "POST", data);
  },
};