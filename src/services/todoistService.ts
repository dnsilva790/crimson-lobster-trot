import { TodoistTask, TodoistProject, TodoistCustomFieldDefinition } from "@/lib/types";

const TODOIST_API_BASE_URL = "/api/todoist/rest/v2"; // Atualizado para usar o proxy
const TODOIST_SYNC_API_BASE_URL = "/api/todoist/sync/v9"; // Atualizado para usar o proxy

interface TodoistError {
  status: number;
  message: string;
}

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

export const todoistService = {
  fetchSyncItems: async (apiKey: string): Promise<Map<string, any>> => {
    const syncResponse = await todoistSyncApiCall(apiKey, [{
      type: "sync",
      uuid: generateUuid(),
      args: {
        resource_types: ["items"],
        sync_token: "*",
      },
    }]);

    const syncItemsMap = new Map<string, any>();
    if (syncResponse && syncResponse.items) {
      syncResponse.items.forEach((item: any) => syncItemsMap.set(item.id, item));
    }
    return syncItemsMap;
  },

  fetchTasks: async (apiKey: string, filter?: string, syncItemsCache?: Map<string, any>, parentId?: string): Promise<TodoistTask[]> => {
    let endpoint = "/tasks";
    const queryParams = new URLSearchParams();

    if (filter && filter.trim() !== "") {
      queryParams.append("filter", filter.trim());
    }
    if (parentId) {
      queryParams.append("parent_id", parentId); // Use parent_id as a query parameter
    }

    if (queryParams.toString()) {
      endpoint += `?${queryParams.toString()}`;
    }
    
    const restTasks = await todoistApiCall<TodoistTask[]>(endpoint, apiKey);

    if (!restTasks || restTasks.length === 0) {
      return restTasks || [];
    }

    const mergedTasks = restTasks.map(task => {
      if (syncItemsCache) {
        const syncItem = syncItemsCache.get(task.id);
        if (syncItem) {
          let deadlineValue: string | null = null;
          if (syncItem.deadline && typeof syncItem.deadline === 'object' && syncItem.deadline.date) {
            deadlineValue = syncItem.deadline.date;
          } else if (syncItem.deadline && typeof syncItem.deadline === 'string') {
            deadlineValue = syncItem.deadline;
          } else if (syncItem.deadline !== null && syncItem.deadline !== undefined) {
            console.warn(`TodoistService: Task ${task.id} (${task.content}) has unexpected deadline object format:`, syncItem.deadline);
          }
          return { ...task, deadline: deadlineValue, custom_fields: syncItem.custom_fields, recurrence_string: task.due?.string || null };
        }
      }
      return { ...task, recurrence_string: task.due?.string || null };
    });

    return mergedTasks || [];
  },

  fetchTaskById: async (apiKey: string, taskId: string, syncItemsCache?: Map<string, any>): Promise<TodoistTask | undefined> => {
    const restTask = await todoistApiCall<TodoistTask>(`/tasks/${taskId}`, apiKey, "GET");
    if (!restTask) {
      return undefined;
    }

    if (syncItemsCache) {
      const syncItem = syncItemsCache.get(taskId);
      if (syncItem) {
        let deadlineValue: string | null = null;
        if (syncItem.deadline && typeof syncItem.deadline === 'object' && syncItem.deadline.date) {
          deadlineValue = syncItem.deadline.date;
        } else if (syncItem.deadline && typeof syncItem.deadline === 'string') {
          deadlineValue = syncItem.deadline;
        } else if (syncItem.deadline !== null && syncItem.deadline !== undefined) {
          console.warn(`TodoistService: Task ${taskId} (${restTask.content}) has unexpected deadline format:`, syncItem.deadline);
        }
        return { ...restTask, deadline: deadlineValue, custom_fields: syncItem.custom_fields, recurrence_string: restTask.due?.string || null };
      }
    }
    return { ...restTask, recurrence_string: restTask.due?.string || null };
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
    recurrence_string?: string | null; // Adicionado
  }): Promise<TodoistTask | undefined> => {
    const restApiPayload: any = {};
    let syncApiCommands: any[] = [];
    let deadlineUpdateNeeded = false;
    let deadlineValue: string | null | undefined;

    // Fetch the original task to get its current recurrence_string
    const originalTask = await todoistService.fetchTaskById(apiKey, taskId);

    if (data.deadline !== undefined) {
      deadlineValue = data.deadline;
      deadlineUpdateNeeded = true;
      const { deadline, ...restOfData } = data;
      Object.assign(restApiPayload, restOfData);
    } else {
      Object.assign(restApiPayload, data);
    }

    // --- REVISED DUE DATE/DATETIME/RECURRENCE LOGIC ---
    let finalRecurrenceString: string | null | undefined;

    if (data.recurrence_string !== undefined) {
      // User explicitly provided a recurrence_string (could be null to clear)
      finalRecurrenceString = data.recurrence_string;
    } else if (originalTask?.recurrence_string) {
      // User did NOT provide recurrence_string, but original task HAS one. Preserve it.
      finalRecurrenceString = originalTask.recurrence_string;
    } else {
      // No recurrence_string from data or original task.
      finalRecurrenceString = undefined; // Don't send 'string' field if no recurrence
    }

    // Construct the 'due' object for the REST API
    if (finalRecurrenceString === null || (finalRecurrenceString !== undefined && finalRecurrenceString.trim() === '')) {
      // Explicitly clearing recurrence or setting to empty string
      restApiPayload.due = null;
    } else if (data.due_date !== undefined || data.due_datetime !== undefined || finalRecurrenceString) {
      // If any due date/datetime is provided OR a recurrence string is present
      restApiPayload.due = {
        string: finalRecurrenceString, // Use the determined recurrence string
        date: data.due_date,
        datetime: data.due_datetime,
      };
      // If recurrence_string is undefined, the 'string' field will be omitted from 'due' object.
      // If date/datetime are undefined, they will be omitted.
      // This allows flexible updates.
    }
    // If none of the above, 'due' is not added to payload, meaning no change to due date/recurrence.
    // --- END REVISED DUE DATE/DATETIME/RECURRENCE LOGIC ---

    // Remove recurrence_string from restApiPayload if it was added directly from data,
    // as it's now handled within the 'due' object.
    delete restApiPayload.recurrence_string;

    if (Object.keys(restApiPayload).length > 0) {
      await todoistApiCall<TodoistTask>(`/tasks/${taskId}`, apiKey, "POST", restApiPayload);
    }

    if (deadlineUpdateNeeded) {
      const deadlinePayload = deadlineValue ? {
        string: deadlineValue,
        date: deadlineValue,
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
    recurrence_string?: string; // Adicionado
  }): Promise<TodoistTask | undefined> => {
    const restApiPayload: any = { ...data };
    let deadlineValue: string | undefined = undefined;

    if (restApiPayload.deadline !== undefined) {
      deadlineValue = restApiPayload.deadline;
      delete restApiPayload.deadline;
    }

    // Handle recurrence_string for creation
    if (restApiPayload.recurrence_string !== undefined) {
      restApiPayload.due = { string: restApiPayload.recurrence_string };
      delete restApiPayload.due_date;
      delete restApiPayload.due_datetime;
      delete restApiPayload.recurrence_string; // Remove from payload after processing
    }

    const newTask = await todoistApiCall<TodoistTask>("/tasks", apiKey, "POST", restApiPayload);

    if (newTask && deadlineValue !== undefined) {
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
      return todoistService.fetchTaskById(apiKey, newTask.id);
    }

    return newTask;
  },
};