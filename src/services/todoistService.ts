import { TodoistTask } from "@/lib/types";

const TODOIST_API_BASE_URL = "https://api.todoist.com/rest/v2";
const TODOIST_API_V1_BASE_URL = "https://todoist.com/api/v8"; // API v1 (ou v8, que é a mesma base para deadlines)

interface TodoistError {
  status: number;
  message: string;
}

async function todoistApiCall<T>(
  endpoint: string,
  apiKey: string,
  method: string = "GET",
  body?: object,
  baseUrl: string = TODOIST_API_BASE_URL, // Adicionado parâmetro para URL base
): Promise<T> {
  // Sanitize the API key to ensure it only contains valid printable ASCII characters (0x20-0x7E).
  // This helps prevent "String contains non ISO-8859-1 code point" errors
  // if the API key was copied with invisible or non-standard characters.
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

  const url = `${baseUrl}${endpoint}`; // Usar a baseUrl fornecida
  console.log("Todoist API Request URL:", url); // Log da URL para depuração

  const response = await fetch(url, config);

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

  // --- Funções para testar a API v1 de Deadlines ---
  setDeadlineV1: async (apiKey: string, taskId: string, dateString: string): Promise<void> => {
    // A API v1 de deadlines espera 'item_id' e 'date'
    return todoistApiCall<void>(
      "/deadlines/set",
      apiKey,
      "POST",
      { item_id: taskId, date: dateString },
      TODOIST_API_V1_BASE_URL // Usar a URL base da API v1
    );
  },

  clearDeadlineV1: async (apiKey: string, taskId: string): Promise<void> => {
    // A API v1 de deadlines espera 'item_id'
    return todoistApiCall<void>(
      "/deadlines/clear",
      apiKey,
      "POST",
      { item_id: taskId },
      TODOIST_API_V1_BASE_URL // Usar a URL base da API v1
    );
  },
};