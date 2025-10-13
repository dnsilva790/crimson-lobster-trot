import { TodoistTask, TodoistProject } from "@/lib/types";

const TODOIST_API_BASE_URL = "https://api.todoist.com/rest/v2";
// Removido: const TODOIST_SYNC_API_BASE_URL = "https://api.todoist.com/sync/v9"; // Nova URL para a Sync API

interface TodoistError {
  status: number;
  message: string;
}

// Removido: Cache para definições de campos personalizados e o ID do campo 'Deadline'
// Removido: let deadlineCustomFieldId: string | null = null;
// Removido: let lastCustomFieldFetchTime: number = 0;
// Removido: const CUSTOM_FIELD_CACHE_DURATION = 5 * 60 * 1000; // 5 minutos

// Removido: Função para gerar UUIDs aleatórios, necessários para a Sync API
// Removido: function generateUuid(): string {
// Removido:   return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
// Removido:     const r = Math.random() * 16 | 0, v = c === 'x' ? r : (r & 0x3 | 0x8);
// Removido:     return v.toString(16);
// Removido:   });
// Removido: }

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

// Removido: Nova função para chamadas à Sync API
// Removido: async function todoistSyncApiCall(
// Removido:   apiKey: string,
// Removido:   commands: any[],
// Removido: ): Promise<any | undefined> {
// Removido:   const sanitizedApiKey = apiKey.replace(/[^\x20-\x7E]/g, '');

// Removido:   const headers: HeadersInit = {
// Removido:     Authorization: `Bearer ${sanitizedApiKey}`,
// Removido:     "Content-Type": "application/json",
// Removido:   };

// Removido:   const config: RequestInit = {
// Removido:     method: "POST",
// Removido:     headers,
// Removido:     body: JSON.stringify({ commands }),
// Removido:   };

// Removido:   const url = `${TODOIST_SYNC_API_BASE_URL}/sync`;
// Removido:   console.log("Todoist Sync API Request URL:", url);
// Removido:   console.log("Todoist Sync API Request Body:", JSON.stringify({ commands }));

// Removido:   const response = await fetch(url, config);

// Removido:   console.log(`Todoist Sync API Response Status for ${url}:`, response.status);

// Removido:   if (!response.ok) {
// Removido:     const errorText = await response.text();
// Removido:     console.error(`Todoist Sync API Error Response Body for ${url}:`, errorText);
// Removido:     const errorData: TodoistError = {
// Removido:       status: response.status,
// Removido:       message: errorText,
// Removido:     };
// Removido:     throw errorData;
// Removido:   }

// Removido:   const jsonResponse = await response.json();
// Removido:   console.log(`Todoist Sync API Response Body for ${url}:`, jsonResponse);
// Removido:   return jsonResponse;
// Removido: }

// Removido: NEW: Função para buscar definições de campos personalizados e encontrar o ID do campo 'Deadline'
// Removido: async function getDeadlineCustomFieldId(apiKey: string): Promise<string | null> {
// Removido:   const now = Date.now();
// Removido:   if (deadlineCustomFieldId && (now - lastCustomFieldFetchTime < CUSTOM_FIELD_CACHE_DURATION)) {
// Removido:     return deadlineCustomFieldId; // Retorna o ID em cache se disponível e não expirado
// Removido:   }

// Removido:   try {
// Removido:     // O endpoint /sync da Sync API com resource_types=["project_sections"] retorna definições de campos personalizados
// Removido:     const response = await todoistSyncApiCall(apiKey, [{
// Removido:       type: "sync",
// Removido:       uuid: generateUuid(),
// Removido:       args: {
// Removido:         resource_types: ["project_sections"], // Este tipo de recurso inclui definições de campos personalizados
// Removido:       },
// Removido:     }]);

// Removido:     if (response && response.project_sections) {
// Removido:       const deadlineField = response.project_sections.find(
// Removido:         (section: TodoistCustomFieldDefinition) => section.type === "date" && section.config?.name === "Deadline"
// Removido:       );
// Removido:       if (deadlineField) {
// Removido:         deadlineCustomFieldId = deadlineField.id;
// Removido:         lastCustomFieldFetchTime = now;
// Removido:         console.log("TodoistService: Encontrado ID do campo personalizado 'Deadline':", deadlineCustomFieldId);
// Removido:         return deadlineCustomFieldId;
// Removido:       }
// Removido:     }
// Removido:     console.warn("TodoistService: Definição do campo personalizado 'Deadline' não encontrada.");
// Removido:     return null;
// Removido:   } catch (error) {
// Removido:     console.error("TodoistService: Falha ao buscar definições de campos personalizados:", error);
// Removido:     return null;
// Removido:   }
// Removido: }

// Removido: Helper para extrair o deadline de um array de custom_fields
// Removido: function extractDeadlineFromCustomFields(task: any, deadlineFieldId: string | null): string | null {
// Removido:   if (!deadlineFieldId || !task.custom_fields || !Array.isArray(task.custom_fields)) {
// Removido:     return null;
// Removido:   }
// Removido:   const deadlineField = task.custom_fields.find((cf: any) => cf.field_id === deadlineFieldId);
// Removido:   return deadlineField?.value || null;
// Removido: }


export const todoistService = {
  fetchTasks: async (apiKey: string, filter?: string): Promise<TodoistTask[]> => {
    const endpoint = filter ? `/tasks?filter=${encodeURIComponent(filter)}` : "/tasks";
    const tasks = await todoistApiCall<TodoistTask[]>(endpoint, apiKey);
    // Removido: const deadlineFieldId = await getDeadlineCustomFieldId(apiKey);

    // Removido: Toda a lógica de Sync API para buscar custom_fields e mergear deadlines
    // Removido: if (!restTasks || restTasks.length === 0 || !deadlineFieldId) {
    // Removido:   return restTasks || [];
    // Removido: }
    // Removido: const syncResponse = await todoistSyncApiCall(apiKey, [{
    // Removido:   type: "sync",
    // Removido:   uuid: generateUuid(),
    // Removido:   args: {
    // Removido:     resource_types: ["items"],
    // Removido:     sync_token: "*",
    // Removido:   },
    // Removido: }]);
    // Removido: const syncItems: any[] = syncResponse?.items || [];
    // Removido: const syncItemsMap = new Map<string, any>();
    // Removido: syncItems.forEach(item => syncItemsMap.set(item.id, item));
    // Removido: const mergedTasks = restTasks.map(task => {
    // Removido:   const syncItem = syncItemsMap.get(task.id);
    // Removido:   if (syncItem) {
    // Removido:     const deadlineValue = extractDeadlineFromCustomFields(syncItem, deadlineFieldId);
    // Removido:     return { ...task, deadline: deadlineValue };
    // Removido:   }
    // Removido:   return task;
    // Removido: });
    // Removido: return mergedTasks || [];

    return tasks || [];
  },

  fetchTaskById: async (apiKey: string, taskId: string): Promise<TodoistTask | undefined> => {
    const task = await todoistApiCall<TodoistTask>(`/tasks/${taskId}`, apiKey, "GET");
    // Removido: if (!restTask) {
    // Removido:   return undefined;
    // Removido: }
    // Removido: const deadlineFieldId = await getDeadlineCustomFieldId(apiKey);
    // Removido: if (!deadlineFieldId) {
    // Removido:   return restTask;
    // Removido: }
    // Removido: const syncResponse = await todoistSyncApiCall(apiKey, [{
    // Removido:   type: "sync",
    // Removido:   uuid: generateUuid(),
    // Removido:   args: {
    // Removido:     resource_types: ["items"],
    // Removido:     ids: [taskId],
    // Removido:   },
    // Removido: }]);
    // Removido: const syncItem = syncResponse?.items?.[0];
    // Removido: if (syncItem) {
    // Removido:   const deadlineValue = extractDeadlineFromCustomFields(syncItem, deadlineFieldId);
    // Removido:   return { ...restTask, deadline: deadlineValue };
    // Removido: }
    return task;
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
    // Removido: deadline?: string | null; // Adicionado o campo deadline
  }): Promise<TodoistTask | undefined> => {
    const restApiPayload: any = {};
    // Removido: const syncApiCommands: any[] = [];
    let needsRestApiCall = false;
    // Removido: let needsSyncApiCall = false;

    // 1. Identificar campos para a REST API v2
    if (data.content !== undefined) { restApiPayload.content = data.content; needsRestApiCall = true; }
    if (data.description !== undefined) { restApiPayload.description = data.description; needsRestApiCall = true; }
    if (data.priority !== undefined) { restApiPayload.priority = data.priority; needsRestApiCall = true; }
    if (data.due_date !== undefined) { restApiPayload.due_date = data.due_date; needsRestApiCall = true; }
    if (data.due_datetime !== undefined) { restApiPayload.due_datetime = data.due_datetime; needsRestApiCall = true; }
    if (data.labels !== undefined) { restApiPayload.labels = data.labels; needsRestApiCall = true; }
    if (data.duration !== undefined) { restApiPayload.duration = data.duration; needsRestApiCall = true; }
    if (data.duration_unit !== undefined) { restApiPayload.duration_unit = data.duration_unit; needsRestApiCall = true; }

    // Removido: 2. Identificar campo deadline para a Sync API v9 (como campo personalizado)
    // Removido: if (data.deadline !== undefined) {
    // Removido:   const deadlineFieldId = await getDeadlineCustomFieldId(apiKey); // Obter o ID
    // Removido:   if (deadlineFieldId) {
    // Removido:     const customFieldsPayload: { [key: string]: string | null } = {};
    // Removido:     customFieldsPayload[deadlineFieldId] = data.deadline; // Usar o ID real do campo

    // Removido:     syncApiCommands.push({
    // Removido:       type: "item_update",
    // Removido:       uuid: generateUuid(),
    // Removido:       args: {
    // Removido:         id: taskId,
    // Removido:         custom_fields: customFieldsPayload, // Usar custom_fields para a Sync API
    // Removido:       },
    // Removido:     });
    // Removido:     needsSyncApiCall = true;
    // Removido:     console.log("todoistService: Comando da Sync API para deadline:", syncApiCommands); // Log de depuração
    // Removido:   } else {
    // Removido:     console.warn("TodoistService: Não foi possível encontrar o ID do campo personalizado 'Deadline' para atualização.");
    // Removido:   }
    // Removido: }

    let restApiUpdateResult: TodoistTask | undefined;

    // 3. Realizar a atualização via REST API, se necessário
    if (needsRestApiCall) {
      restApiUpdateResult = await todoistApiCall<TodoistTask>(`/tasks/${taskId}`, apiKey, "POST", restApiPayload);
    }

    // Removido: 4. Realizar a atualização via Sync API, se necessário
    // Removido: if (needsSyncApiCall) {
    // Removido:   await todoistSyncApiCall(apiKey, syncApiCommands);
    // Removido: }

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