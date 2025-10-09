import { TodoistTask } from "@/lib/types";

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
): Promise<T> {
  const headers: HeadersInit = {
    Authorization: `Bearer ${apiKey}`,
    "Content-Type": "application/json",
  };

  const config: RequestInit = {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  };

  const response = await fetch(`${TODOIST_API_BASE_URL}${endpoint}`, config);

  if (!response.ok) {
    const errorData: TodoistError = {
      status: response.status,
      message: await response.text(),
    };
    throw errorData;
  }

  if (response.status === 204) {
    return {} as T; // No content for successful DELETE/POST close
  }

  return response.json() as Promise<T>;
}

export const todoistService = {
  fetchTasks: async (apiKey: string, filter?: string): Promise<TodoistTask[]> => {
    const endpoint = filter ? `/tasks?filter=${encodeURIComponent(filter)}` : "/tasks";
    return todoistApiCall<TodoistTask[]>(endpoint, apiKey);
  },

  closeTask: async (apiKey: string, taskId: string): Promise<void> => {
    return todoistApiCall<void>(`/tasks/${taskId}/close`, apiKey, "POST");
  },

  deleteTask: async (apiKey: string, taskId: string): Promise<void> => {
    return todoistApiCall<void>(`/tasks/${taskId}`, apiKey, "DELETE");
  },

  // A API do Todoist espera due_date, due_datetime e priority como campos de nível superior
  updateTask: async (apiKey: string, taskId: string, data: {
    content?: string;
    description?: string;
    priority?: 1 | 2 | 3 | 4;
    due_date?: string | null; // YYYY-MM-DD
    due_datetime?: string | null; // YYYY-MM-DDTHH:MM:SS
    // deadline não pode ser atualizado via API REST v2
  }): Promise<TodoistTask> => {
    return todoistApiCall<TodoistTask>(`/tasks/${taskId}`, apiKey, "POST", data);
  },
};