import { TodoistTask, TodoistProject } from "@/lib/types";

const TODOIST_API_BASE_URL = "https://api.todoist.com/api/v1";

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

  const response = await fetch(url, config);

  if (!response.ok) {
    const errorData: TodoistError = {
      status: response.status,
      message: await response.text(),
    };
    throw errorData;
  }

  if (response.status === 204) {
    // Se o endpoint é para buscar uma lista de tarefas (e.g., /tasks), retorna um array vazio.
    // Para outras respostas 204 (e.g., fechar uma tarefa), retorna undefined (que é tratado por makeApiCall).
    if (endpoint === "/tasks" || (endpoint.startsWith("/tasks?") && !endpoint.includes("/tasks/"))) {
      return [] as T; // Retorna array vazio para lista de tarefas
    }
    return undefined as T; // Para outros 204s (e.g., closeTask, que espera void)
  }

  const jsonResponse = await response.json();

  // Adicionado: Garantir que se um array é esperado (para /tasks), e a resposta não é um array,
  // retorne um array vazio para evitar TypeError: .forEach is not a function
  if ((endpoint === "/tasks" || (endpoint.startsWith("/tasks?") && !endpoint.includes("/tasks/"))) && !Array.isArray(jsonResponse)) {
    console.warn(`Todoist API: Expected array for ${endpoint}, but received non-array. Returning empty array.`);
    return [] as T;
  }

  return jsonResponse as T;
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
    due_date?: string | null; // YYYY-MM-DD
    due_datetime?: string | null; // YYYY-MM-DDTHH:MM:SS
    labels?: string[];
    duration?: number; // Adicionado para a API do Todoist
    duration_unit?: "minute" | "day"; // Adicionado para a API do Todoist
  }): Promise<TodoistTask> => {
    return todoistApiCall<TodoistTask>(`/tasks/${taskId}`, apiKey, "POST", data);
  },
};