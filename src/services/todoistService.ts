import { TodoistTask, TodoistProject, TodoistCustomField, TodoistCustomFieldDefinition } from "@/lib/types";

const TODOIST_API_BASE_URL = "https://api.todoist.com/rest/v2";
const TODOIST_SYNC_API_BASE_URL = "https://api.todoist.com/sync/v9"; // Nova URL para a Sync API

interface TodoistError {
  status: number;
  message: string;
}

// Cache para definições de campos personalizados e o ID do campo 'Deadline'
let deadlineCustomFieldId: string | null = null;
let lastCustomFieldFetchTime: number = 0;
const CUSTOM_FIELD_CACHE_DURATION = 5 * 60 * 1000; // 5 minutos

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
    // Se for 404 (Not Found) para uma tarefa específica, significa que ela foi concluída ou excluída.
    // Não lançamos um erro para que o contexto possa tratar isso como 'não encontrada'.
    if (response.status === 404 && endpoint.startsWith("/tasks/") && endpoint.split('/').length === 3) {
      return undefined;
    }
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

// NEW: Função para buscar definições de campos personalizados e encontrar o ID do campo 'Deadline'
async function getDeadlineCustomFieldId(apiKey: string): Promise<string | null> {
  const now = Date.now();
  if (deadlineCustomFieldId && (now - lastCustomFieldFetchTime < CUSTOM_FIELD_CACHE_DURATION)) {
    return deadlineCustomFieldId; // Retorna o ID em cache se disponível e não expirado
  }

  try {
    // O endpoint /sync da Sync API com resource_types=["project_sections"] retorna definições de campos personalizados
    const response = await todoistSyncApiCall(apiKey, [{
      type: "sync",
      uuid: generateUuid(),
      args: {
        resource_types: ["project_sections"], // Este tipo de recurso inclui definições de campos personalizados
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

// Helper para extrair o deadline de um array de custom_fields
function extractDeadlineFromCustomFields(task: any, deadlineFieldId: string | null): string | null {
  if (!deadlineFieldId || !task.custom_fields || !Array.isArray(task.custom_fields)) {
    return null;
  }
  const deadlineField = task.custom_fields.find((cf: any) => cf.field_id === deadlineFieldId);
  return deadlineField?.value || null;
}


export const todoistService = {
  fetchTasks: async (apiKey: string, filter?: string): Promise<TodoistTask[]> => {
    const endpoint = filter ? `/tasks?filter=${encodeURIComponent(filter)}` : "/tasks";
    const restTasks = await todoistApiCall<TodoistTask[]>(endpoint, apiKey);
    const deadlineFieldId = await getDeadlineCustomFieldId(apiKey);

    if (!restTasks || restTasks.length === 0 || !deadlineFieldId) {
      return restTasks || [];
    }

    // Buscar todos os itens da Sync API para obter campos personalizados
    // Isso é ineficiente, mas necessário para obter campos personalizados para todas as tarefas
    const syncResponse = await todoistSyncApiCall(apiKey, [{
      type: "sync",
      uuid: generateUuid(),
      args: {
        resource_types: ["items"],
        sync_token: "*", // Sincronização inicial, busca todos os itens
      },
    }]);

    const syncItems: any[] = syncResponse?.items || [];
    const syncItemsMap = new Map<string, any>();
    syncItems.forEach(item => syncItemsMap.set(item.id, item));

    const mergedTasks = restTasks.map(task => {
      const syncItem = syncItemsMap.get(task.id);
      if (syncItem) {
        const deadlineValue = extractDeadlineFromCustomFields(syncItem, deadlineFieldId);
        return { ...task, deadline: deadlineValue };
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
      return restTask; // Retorna sem deadline se o ID não for encontrado
    }

    // Buscar item específico da Sync API para obter campos personalizados
    const syncResponse = await todoistSyncApiCall(apiKey, [{
      type: "sync",
      uuid: generateUuid(),
      args: {
        resource_types: ["items"],
        ids: [taskId], // Solicita apenas este item específico
      },
    }]);

    const syncItem = syncResponse?.items?.[0];
    if (syncItem) {
      const deadlineValue = extractDeadlineFromCustomFields(syncItem, deadlineFieldId);
      return { ...restTask, deadline: deadlineValue };
    }

    return restTask;
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
      const deadlineFieldId = await getDeadlineCustomFieldId(apiKey); // Obter o ID
      if (deadlineFieldId) {
        const customFieldsPayload: { [key: string]: string | null } = {};
        customFieldsPayload[deadlineFieldId] = data.deadline; // Usar o ID real do campo

        syncApiCommands.push({
          type: "item_update",
          uuid: generateUuid(),
          args: {
            id: taskId,
            custom_fields: customFieldsPayload, // Usar custom_fields para a Sync API
          },
        });
        needsSyncApiCall = true;
        console.log("todoistService: Comando da Sync API para deadline:", syncApiCommands); // Log de depuração
      } else {
        console.warn("TodoistService: Não foi possível encontrar o ID do campo personalizado 'Deadline' para atualização.");
      }
    }

    let restApiUpdateResult: TodoistTask | undefined;

    // 3. Realizar a atualização via REST API, se necessário
    if (needsRestApiCall) {
      restApiUpdateResult = await todoistApiCall<TodoistTask>(`/tasks/${taskId}`, apiKey, "POST", restApiPayload);
    }

    // 4. Realizar a atualização via Sync API, se necessário
    if (needsSyncApiCall) {
      await todoistSyncApiCall(apiKey, syncApiCommands);
    }

    // 5. Buscar a tarefa novamente para obter o estado mais atualizado do Todoist
    // Esta chamada agora também buscará os campos personalizados
    const fetchedTaskAfterUpdates = await todoistService.fetchTaskById(apiKey, taskId); // Usar o fetchTaskById modificado

    console.log("TodoistService: Resultado final de updateTask:", fetchedTaskAfterUpdates);
    return fetchedTaskAfterUpdates;
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