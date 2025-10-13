import { TodoistTask, TodoistProject, TodoistCustomFieldDefinition } from "@/lib/types";

const TODOIST_API_BASE_URL = "https://api.todoist.com/rest/v2";
const TODOIST_SYNC_API_BASE_URL = "https://api.todoist.com/sync/v9";
// A API v1 não será mais usada para o deadline devido a problemas de CORS e payload.
// const TODOIST_API_V1_BASE_URL = "https://api.todoist.com/api/v1"; 

interface TodoistError {
  status: number;
  message: string;
}

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

// A API v1 não será mais usada para o deadline devido a problemas de CORS e payload.
// async function todoistApiCallV1<T>(
//   endpoint: string,
//   apiKey: string,
//   method: string = "POST",
//   body?: object,
// ): Promise<T | undefined> {
//   const sanitizedApiKey = apiKey.replace(/[^\x20-\x7E]/g, '');

//   const headers: HeadersInit = {
//     Authorization: `Bearer ${sanitizedApiKey}`,
//     "Content-Type": "application/json",
//   };

//   const config: RequestInit = {
//     method,
//     headers,
//     body: body ? JSON.stringify(body) : undefined,
//   };

//   const url = `${TODOIST_API_V1_BASE_URL}${endpoint}`;
//   console.log("Todoist API v1 Request URL:", url);
//   console.log("Todoist API v1 Request Body:", JSON.stringify(body));

//   const response = await fetch(url, config);

//   console.log(`Todoist API v1 Response Status for ${url}:`, response.status);

//   if (!response.ok) {
//     const errorText = await response.text();
//     console.error(`Todoist API v1 Error Response Body for ${url}:`, errorText);
//     const errorData: TodoistError = {
//       status: response.status,
//       message: errorText,
//     };
//     throw errorData;
//   }

//   if (response.status === 204) {
//     console.log(`Todoist API v1 Response Body for ${url}:`, "No Content (204)");
//     return undefined;
//   }

//   try {
//     const jsonResponse = await response.json();
//     console.log(`Todoist API v1 Response Body for ${url}:`, jsonResponse);
//     return jsonResponse as T;
//   } catch (e) {
//     console.log(`Todoist API v1 Response for ${url} had no JSON body.`);
//     return undefined;
//   }
// }


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

// A função updateTaskDeadlineV1 não será mais usada.
// async function updateTaskDeadlineV1(apiKey: string, taskId: string, newDeadlineDate: string | null): Promise<void> {
//   const payload = {
//     deadline: newDeadlineDate ? {
//       string: newDeadlineDate,
//       date: newDeadlineDate,
//       datetime: null,
//       timezone: null,
//     } : null,
//   };
//   await todoistApiCallV1<void>(`/tasks/${taskId}`, apiKey, "POST", payload);
// }


export const todoistService = {
  fetchTasks: async (apiKey: string, filter?: string): Promise<TodoistTask[]> => {
    const endpoint = filter ? `/tasks?filter=${encodeURIComponent(filter)}` : "/tasks";
    const restTasks = await todoistApiCall<TodoistTask[]>(endpoint, apiKey);

    if (!restTasks || restTasks.length === 0) {
      return restTasks || [];
    }

    // Buscar informações adicionais (incluindo o campo 'deadline') via Sync API v9
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
        let deadlineValue: string | null = null;
        // Verifica se syncItem.deadline existe e é um objeto, e se possui a propriedade 'date'
        if (syncItem.deadline && typeof syncItem.deadline === 'object' && syncItem.deadline.date) {
          deadlineValue = syncItem.deadline.date;
        } else if (syncItem.deadline && typeof syncItem.deadline === 'string') {
          // Caso raro onde deadline já é uma string (para compatibilidade, embora não esperado para o campo nativo)
          deadlineValue = syncItem.deadline;
        } else if (syncItem.deadline !== null && syncItem.deadline !== undefined) {
          // Loga o formato inesperado para depuração
          console.warn(`TodoistService: Task ${task.id} (${task.content}) has unexpected deadline object format:`, syncItem.deadline);
        }
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

    // Buscar informações adicionais (incluindo o campo 'deadline') via Sync API v9
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
      let deadlineValue: string | null = null;
      // Verifica se syncItem.deadline existe e é um objeto, e se possui a propriedade 'date'
      if (syncItem.deadline && typeof syncItem.deadline === 'object' && syncItem.deadline.date) {
        deadlineValue = syncItem.deadline.date;
      } else if (syncItem.deadline && typeof syncItem.deadline === 'string') {
        deadlineValue = syncItem.deadline;
      } else if (syncItem.deadline !== null && syncItem.deadline !== undefined) {
        console.warn(`TodoistService: Task ${taskId} (${restTask.content}) has unexpected deadline object format:`, syncItem.deadline);
      }
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
    let syncApiCommands: any[] = [];
    let deadlineUpdateNeeded = false;
    let deadlineValue: string | null | undefined;

    // Separar o campo 'deadline' dos outros campos para a Sync API
    if (data.deadline !== undefined) {
      deadlineValue = data.deadline;
      deadlineUpdateNeeded = true;
      // Remover 'deadline' do payload da REST API v2
      const { deadline, ...restOfData } = data;
      Object.assign(restApiPayload, restOfData);
    } else {
      Object.assign(restApiPayload, data);
    }

    // 1. Realizar a atualização via REST API v2, se houver outros campos
    if (Object.keys(restApiPayload).length > 0) {
      await todoistApiCall<TodoistTask>(`/tasks/${taskId}`, apiKey, "POST", restApiPayload);
    }

    // 2. Realizar a atualização do deadline via Sync API v9, se necessário
    if (deadlineUpdateNeeded) {
      const deadlinePayload = deadlineValue ? {
        string: deadlineValue,
        date: deadlineValue, // A Sync API v9 espera 'date' para o formato YYYY-MM-DD
        datetime: null,
        timezone: null,
      } : null;

      syncApiCommands.push({
        type: "item_update",
        uuid: generateUuid(),
        args: {
          id: taskId,
          deadline: deadlinePayload,
        },
      });
      await todoistSyncApiCall(apiKey, syncApiCommands);
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
      // Se o deadline foi fornecido, atualizá-lo via Sync API v9 após a criação
      const syncApiCommands = [{
        type: "item_update",
        uuid: generateUuid(),
        args: {
          id: newTask.id,
          deadline: {
            string: deadlineValue,
            date: deadlineValue,
            datetime: null,
            timezone: null,
          },
        },
      }];
      await todoistSyncApiCall(apiKey, syncApiCommands);
      // Buscar a tarefa novamente para obter o deadline atualizado
      return todoistService.fetchTaskById(apiKey, newTask.id);
    }

    return newTask;
  },
};