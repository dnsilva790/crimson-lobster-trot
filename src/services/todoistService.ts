import { TodoistTask, TodoistProject, TodoistCustomFieldDefinition } from "@/lib/types";

const TODOIST_API_BASE_URL = "https://api.todoist.com/rest/v2";
const TODOIST_SYNC_API_BASE_URL = "https://api.todoist.com/sync/v9";
const TODOIST_API_V1_BASE_URL = "https://api.todoist.com/api/v1"; // Nova URL para a API v1

interface TodoistError {
  status: number;
  message: string;
}

// Cache para definições de campos personalizados e o ID do campo 'Deadline'
let deadlineCustomFieldId: string | null = null;
let lastCustomFieldFetchTime: number = 0;
const CUSTOM_FIELD_CACHE_DURATION = 5 * 60 * 1000; // 5 minutos

// Função para gerar UUIDs aleatórios, necessários para a Sync API
export function generateUuid(): string {
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
    if (response.status === 404 && endpoint.startsWith("/tasks/") && endpoint.split('/').length === 3) {
      return undefined;
    }
    throw errorData;
  }

  if (response.status === 204) {
    console.log(`Todoist API Response Body for ${url}:`, "No Content (204)");
    if (endpoint.startsWith("/tasks") && endpoint.split('/').length === 3) {
      return undefined;
    }
    if (endpoint.startsWith("/tasks") || endpoint.startsWith("/projects")) {
      return [] as T;
    }
    return undefined;
  }

  const jsonResponse = await response.json();
  console.log(`Todoist API Response Body for ${url}:`, jsonResponse);

  if (((endpoint.startsWith("/tasks") && endpoint.split('/').length === 2) || endpoint.startsWith("/projects")) && !Array.isArray(jsonResponse)) {
    console.warn(`Todoist API: Expected array for ${endpoint}, but received non-array. Returning empty array.`);
    return [] as T;
  }

  return jsonResponse as T;
}

// Nova função para chamadas à API v1
async function todoistApiCallV1<T>(
  endpoint: string,
  apiKey: string,
  method: string = "POST", // Default para POST na v1 conforme especificado
  body?: object,
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

  const url = `${TODOIST_API_V1_BASE_URL}${endpoint}`;
  console.log("Todoist API v1 Request URL:", url);
  console.log("Todoist API v1 Request Body:", JSON.stringify(body));

  const response = await fetch(url, config);

  console.log(`Todoist API v1 Response Status for ${url}:`, response.status);

  if (!response.ok) {
    const errorText = await response.text();
    console.error(`Todoist API v1 Error Response Body for ${url}:`, errorText);
    const errorData: TodoistError = {
      status: response.status,
      message: errorText,
    };
    throw errorData;
  }

  if (response.status === 204) {
    console.log(`Todoist API v1 Response Body for ${url}:`, "No Content (204)");
    return undefined; // Conforme especificado para 204
  }

  // A API v1 pode retornar um corpo mesmo para 2xx, mas o usuário especificou 204 para sucesso.
  // Se houver um corpo, tentamos parsear, caso contrário, retornamos undefined.
  try {
    const jsonResponse = await response.json();
    console.log(`Todoist API v1 Response Body for ${url}:`, jsonResponse);
    return jsonResponse as T;
  } catch (e) {
    console.log(`Todoist API v1 Response for ${url} had no JSON body.`);
    return undefined;
  }
}


export async function todoistSyncApiCall(
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

async function getDeadlineCustomFieldId(apiKey: string): Promise<string | null> {
  const now = Date.now();
  if (deadlineCustomFieldId && (now - lastCustomFieldFetchTime < CUSTOM_FIELD_CACHE_DURATION)) {
    return deadlineCustomFieldId;
  }

  try {
    const response = await todoistSyncApiCall(apiKey, [{
      type: "sync",
      uuid: generateUuid(),
      args: {
        resource_types: ["project_sections"],
      },
    }]);

    if (response && response.project_sections) {
      const deadlineField = response.project_sections.find(
        (section: TodoistCustomFieldDefinition) => section.type === "date" && section.config?.name === "Deadline"
      );
      if (deadlineField) {
        deadlineCustomFieldId = deadlineField.id;
        lastCustomFieldFetchTime = now;
        console.log("TodoistService: Encontrado ID do campo personalizado 'Deadline':", deadlineCustomFieldId);
        return deadlineCustomFieldId;
      }
    }
    console.warn("TodoistService: Definição do campo personalizado 'Deadline' não encontrada.");
    return null;
  } catch (error) {
    console.error("TodoistService: Falha ao buscar definições de campos personalizados:", error);
    return null;
  }
}

function extractDeadlineFromCustomFields(task: any, deadlineFieldId: string | null): string | null {
  if (!deadlineFieldId || !task.custom_fields || !Array.isArray(task.custom_fields)) {
    return null;
  }
  const deadlineField = task.custom_fields.find((cf: any) => cf.field_id === deadlineFieldId);
  return deadlineField?.value || null;
}

// Nova função para atualizar o deadline via API v1
async function updateTaskDeadlineV1(apiKey: string, taskId: string, newDeadlineDate: string | null): Promise<void> {
  const payload = {
    deadline: newDeadlineDate ? {
      string: newDeadlineDate,
      date: newDeadlineDate,
      datetime: null,
      timezone: null,
    } : null,
  };
  // A API v1 retorna 204 No Content para sucesso, então o tipo de retorno é void
  await todoistApiCallV1<void>(`/tasks/${taskId}`, apiKey, "POST", payload);
}


export const todoistService = {
  fetchTasks: async (apiKey: string, filter?: string): Promise<TodoistTask[]> => {
    const endpoint = filter ? `/tasks?filter=${encodeURIComponent(filter)}` : "/tasks";
    const restTasks = await todoistApiCall<TodoistTask[]>(endpoint, apiKey);

    if (!restTasks || restTasks.length === 0) {
      return restTasks || [];
    }

    const deadlineFieldId = await getDeadlineCustomFieldId(apiKey);

    if (!deadlineFieldId) {
      return restTasks;
    }

    const syncResponse = await todoistSyncApiCall(apiKey, [{
      type: "sync",
      uuid: generateUuid(),
      args: {
        resource_types: ["items"],
        sync_token: "*",
      },
    }]);

    const syncItems: any[] = syncResponse?.items || [];
    const syncItemsMap = new Map<string, any>();
    syncItems.forEach(item => syncItemsMap.set(item.id, item));

    const mergedTasks = restTasks.map(task => {
      const syncItem = syncItemsMap.get(task.id);
      if (syncItem) {
        const deadlineValue = extractDeadlineFromCustomFields(syncItem, deadlineFieldId);
        return { ...task, deadline: deadlineValue, custom_fields: syncItem.custom_fields };
      }
      return task;
    });
    return mergedTasks || [];
  },

  fetchTaskById: async (apiKey: string, taskId: string): Promise<TodoistTask | undefined> => {
    const restTask = await todoistApiCall<TodoistTask>(`/tasks/${taskId}`, apiKey, "GET");
    if (!restTask) {
      return undefined;
    }

    const deadlineFieldId = await getDeadlineCustomFieldId(apiKey);
    if (!deadlineFieldId) {
      return restTask;
    }

    const syncResponse = await todoistSyncApiCall(apiKey, [{
      type: "sync",
      uuid: generateUuid(),
      args: {
        resource_types: ["items"],
        ids: [taskId],
      },
    }]);

    const syncItem = syncResponse?.items?.[0];
    if (syncItem) {
      const deadlineValue = extractDeadlineFromCustomFields(syncItem, deadlineFieldId);
      return { ...restTask, deadline: deadlineValue, custom_fields: syncItem.custom_fields };
    }
    return restTask;
  },

  fetchProjects: async (apiKey: string): Promise<TodoistProject[]> => {
    const result = await todoistApiCall<TodoistProject[]>("/projects", apiKey);
    return result || [];
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
    deadline?: string | null;
  }): Promise<TodoistTask | undefined> => {
    const restApiPayload: any = {};
    let needsRestApiCall = false;
    let deadlineUpdateNeeded = false;
    let deadlineValue: string | null | undefined;

    // Separar o campo 'deadline' dos outros campos
    if (data.deadline !== undefined) {
      deadlineValue = data.deadline;
      deadlineUpdateNeeded = true;
      // Remover 'deadline' do payload da REST API v2
      const { deadline, ...restOfData } = data;
      Object.assign(restApiPayload, restOfData);
    } else {
      Object.assign(restApiPayload, data);
    }

    // Verificar se há outros campos para a REST API v2
    if (Object.keys(restApiPayload).length > 0) {
      needsRestApiCall = true;
    }

    // 1. Realizar a atualização via REST API v2, se necessário
    if (needsRestApiCall) {
      await todoistApiCall<TodoistTask>(`/tasks/${taskId}`, apiKey, "POST", restApiPayload);
    }

    // 2. Realizar a atualização do deadline via API v1, se necessário
    if (deadlineUpdateNeeded) {
      // updateTaskDeadlineV1 já lida com null para remover o deadline
      await updateTaskDeadlineV1(apiKey, taskId, deadlineValue as string | null);
    }

    // 3. Buscar a tarefa novamente para obter o estado mais atualizado do Todoist
    const fetchedTaskAfterUpdates = await todoistService.fetchTaskById(apiKey, taskId);

    console.log("TodoistService: Resultado final de updateTask:", fetchedTaskAfterUpdates);
    return fetchedTaskAfterUpdates;
  },

  createTask: async (apiKey: string, data: {
    content: string;
    description?: string;
    project_id?: string;
    parent_id?: string;
    due_date?: string;
    due_datetime?: string;
    priority?: 1 | 2 | 3 | 4;
    labels?: string[];
    duration?: number;
    duration_unit?: "minute" | "day";
    deadline?: string;
  }): Promise<TodoistTask | undefined> => {
    const restApiPayload: any = { ...data };
    let deadlineValue: string | undefined = undefined;

    if (restApiPayload.deadline !== undefined) {
      deadlineValue = restApiPayload.deadline;
      delete restApiPayload.deadline; // Remove do payload da REST API v2
    }

    const newTask = await todoistApiCall<TodoistTask>("/tasks", apiKey, "POST", restApiPayload);

    if (newTask && deadlineValue !== undefined) {
      // Se o deadline foi fornecido, atualizá-lo via API v1 após a criação
      await updateTaskDeadlineV1(apiKey, newTask.id, deadlineValue);
      // Buscar a tarefa novamente para obter o deadline atualizado
      return todoistService.fetchTaskById(apiKey, newTask.id);
    }

    return newTask;
  },
};