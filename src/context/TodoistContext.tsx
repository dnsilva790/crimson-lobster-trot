import React,
  {
    createContext,
    useContext,
    useState,
    ReactNode,
    useCallback,
    useEffect,
    useRef,
  } from "react";
import { todoistService } from "@/services/todoistService";
import { TodoistTask, TodoistProject } from "@/lib/types";
import { toast } from "sonner";

interface TodoistContextType {
  apiKey: string | null;
  setApiKey: (key: string) => void;
  clearApiKey: () => void;
  fetchTasks: (filter?: string, options?: { includeSubtasks?: boolean; includeRecurring?: boolean; includeCompleted?: boolean; parentId?: string }) => Promise<TodoistTask[]>;
  fetchTaskById: (taskId: string) => Promise<TodoistTask | undefined>;
  fetchProjects: () => Promise<TodoistProject[]>;
  closeTask: (taskId: string) => Promise<void>;
  deleteTask: (taskId: string) => Promise<void>;
  updateTask: (taskId: string, data: {
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
  }) => Promise<TodoistTask | undefined>;
  createTodoistTask: (data: {
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
  }) => Promise<TodoistTask | undefined>;
  isLoading: boolean;
}

type MakeApiCallFn = <T>(
  apiFunction: (key: string, ...args: any[]) => Promise<T>,
  ...args: any[]
) => Promise<T>;

const TodoistContext = createContext<TodoistContextType | undefined>(undefined);

const TODOIST_API_KEY_STORAGE_KEY = "todoist_api_key"; // Chave para o localStorage

const sanitizeTodoistTask = (task: TodoistTask): TodoistTask => {
  if (task.due === undefined || (typeof task.due === 'string' && task.due === 'undefined')) {
    task.due = null;
  } else if (task.due && typeof task.due === 'object') {
    if (task.due.date === undefined || (typeof task.due.date === 'string' && task.due.date === "undefined")) {
      task.due.date = null;
    }
    if (task.due.datetime === undefined || (typeof task.due.datetime === 'string' && task.due.datetime === "undefined")) {
      task.due.datetime = null;
    }
    if (task.due.string === undefined || (typeof task.due.string === 'string' && task.due.string === "undefined")) {
      task.due.string = null;
    }
    
    if (task.due.is_recurring === undefined) {
      task.due.is_recurring = false;
    }
  }

  if (task.deadline === undefined || task.deadline === null || (typeof task.deadline === 'string' && task.deadline === "undefined")) {
    task.deadline = null;
  } else if (typeof task.deadline !== 'string') {
    if (typeof task.deadline === 'object' && task.deadline !== null && 'date' in task.deadline && typeof (task.deadline as any).date === 'string') {
      task.deadline = (task.deadline as any).date;
    } else {
      console.warn(`TodoistContext: Task ${task.id} (${task.content}) has unexpected deadline format:`, task.deadline, ". Converting to null.");
      task.deadline = null;
    }
  }

  // Ensure recurrence_string is set from due.string
  task.recurrence_string = task.due?.string || null;

  // Ensure URL is always a string
  if (task.url === undefined || task.url === null || typeof task.url !== 'string') {
    console.warn(`TodoistContext: Task ${task.id} (${task.content}) has invalid URL format:`, task.url, ". Converting to placeholder.");
    task.url = `https://todoist.com/app/task/${task.id}`; // Default to Todoist task URL
  }
  
  return task;
};

export const TodoistProvider = ({ children }: { children: ReactNode }) => { // Corrigido o tipo de 'children'
  const [apiKey, setApiKeyInternal] = useState<string | null>(() => {
    // Carregar a chave da API do localStorage na inicialização
    if (typeof window !== 'undefined') {
      return localStorage.getItem(TODOIST_API_KEY_STORAGE_KEY);
    }
    return null;
  });
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [syncItemsCache, setSyncItemsCache] = useState<Map<string, any>>(new Map());
  const syncItemsCacheRef = useRef(syncItemsCache); // Use ref for immediate access in callbacks

  useEffect(() => {
    syncItemsCacheRef.current = syncItemsCache;
  }, [syncItemsCache]);

  const setApiKey = useCallback((key: string) => {
    setApiKeyInternal(key);
    // Salvar a chave da API no localStorage
    if (typeof window !== 'undefined') {
      localStorage.setItem(TODOIST_API_KEY_STORAGE_KEY, key);
    }
  }, []);

  const clearApiKey = useCallback(() => {
    setApiKeyInternal(null);
    // Remover a chave da API do localStorage
    if (typeof window !== 'undefined') {
      localStorage.removeItem(TODOIST_API_KEY_STORAGE_KEY);
    }
    setSyncItemsCache(new Map()); // Clear cache on API key clear
  }, []);

  const loadSyncItemsCache = useCallback(async (key: string) => {
    setIsLoading(true);
    try {
      const cache = await todoistService.fetchSyncItems(key);
      setSyncItemsCache(cache);
    } catch (error) {
      console.error("TodoistContext: Failed to load sync items cache:", error);
      toast.error("Falha ao carregar dados de sincronização do Todoist.");
      setSyncItemsCache(new Map());
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (apiKey) {
      loadSyncItemsCache(apiKey);
    }
  }, [apiKey, loadSyncItemsCache]);

  const makeApiCall: MakeApiCallFn = useCallback(
    async (apiFunction, ...args) => {
      const isFetchingList = (apiFunction === todoistService.fetchTasks || apiFunction === todoistService.fetchProjects || apiFunction === todoistService.fetchSyncItems);

      if (!apiKey) {
        toast.error("API key não configurada.");
        return isFetchingList ? [] as any : undefined as any; 
      }
      
      // Only set global loading for non-cache loading operations
      if (apiFunction !== todoistService.fetchSyncItems) {
        setIsLoading(true);
      }
      
      try {
        const result = await apiFunction(apiKey, ...args);
        return result;
      } catch (error: any) {
        console.error("Todoist API Error in makeApiCall:", error);
        if (error.status === 401 || error.status === 403) {
          toast.error("API key inválida ou sem permissão. Configure novamente.");
          clearApiKey();
        } else if (error.status === 500) {
          toast.error("Erro no servidor. Tente novamente.");
        } else if (error.status === 429) {
          toast.error(`Muitas requisições. Tente novamente em ${error.error_extra?.retry_after || 30} segundos.`);
        } else {
          toast.error(`Erro na API: ${error.message || "Erro desconhecido"}`);
        }
        
        return isFetchingList ? [] as any : undefined as any; 
      } finally {
        if (apiFunction !== todoistService.fetchSyncItems) {
          setIsLoading(false);
        }
      }
    },
    [apiKey, clearApiKey],
  );

  const fetchTasks = useCallback(
    async (filter?: string, options?: { includeSubtasks?: boolean; includeRecurring?: boolean; includeCompleted?: boolean; parentId?: string }) => {
      const finalOptions = {
        includeSubtasks: options?.includeSubtasks ?? false,
        includeRecurring: options?.includeRecurring ?? false,
        includeCompleted: options?.includeCompleted ?? false,
        parentId: options?.parentId ?? undefined, // Extract parentId
      };

      // Pass parentId to todoistService.fetchTasks
      const rawTasks = await makeApiCall(todoistService.fetchTasks, filter, syncItemsCacheRef.current, finalOptions.parentId);
      
      const sanitizedTasks = rawTasks.map(sanitizeTodoistTask);

      const filteredHourlyRecurring = sanitizedTasks.filter(task => {
        return !(task.due?.is_recurring === true && task.due?.string?.toLowerCase().includes("every hour"));
      });

      let processedTasks = filteredHourlyRecurring.map(task => {
        let estimatedDurationMinutes: number | undefined = undefined;
        if (task.duration) {
          if (task.duration.unit === "minute") {
            estimatedDurationMinutes = task.duration.amount;
          } else if (task.duration.unit === "day") {
            estimatedDurationMinutes = task.duration.amount * 8 * 60; // Assuming 8 hours per day
          }
        }
        return { ...task, estimatedDurationMinutes };
      });

      // Only filter out subtasks if includeSubtasks is explicitly false AND we are NOT specifically fetching for a parentId
      if (!finalOptions.includeSubtasks && !finalOptions.parentId) {
        processedTasks = processedTasks.filter(task => task.parent_id === null);
      }
      
      // Only filter out recurring tasks if includeRecurring is explicitly false
      if (!finalOptions.includeRecurring) {
        processedTasks = processedTasks.filter(task => task.due?.is_recurring !== true);
      }
      
      return processedTasks;
    },
    [makeApiCall, syncItemsCacheRef],
  );

  const fetchTaskById = useCallback(async (taskId: string) => {
    const rawTask = await makeApiCall(todoistService.fetchTaskById, taskId, syncItemsCacheRef.current);
    if (rawTask) {
      return sanitizeTodoistTask(rawTask);
    }
    return undefined;
  }, [makeApiCall, syncItemsCacheRef]);

  const fetchProjects = useCallback(async () => {
    return await makeApiCall(todoistService.fetchProjects);
  }, [makeApiCall]);

  const closeTask = useCallback(
    async (taskId: string) => {
      const result = await makeApiCall(todoistService.closeTask, taskId);
      if (result !== undefined) {
        // Remove from cache if closed
        setSyncItemsCache(prev => {
          const newCache = new Map(prev);
          newCache.delete(taskId);
          return newCache;
        });
      }
      return result;
    },
    [makeApiCall],
  );

  const deleteTask = useCallback(
    async (taskId: string) => {
      const result = await makeApiCall(todoistService.deleteTask, taskId);
      if (result !== undefined) {
        // Remove from cache if deleted
        setSyncItemsCache(prev => {
          const newCache = new Map(prev);
          newCache.delete(taskId);
          return newCache;
        });
      }
      return result;
    },
    [makeApiCall],
  );

  const updateTask = useCallback(
    async (taskId: string, data: {
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
    }) => {
      const updatedTask = await makeApiCall(todoistService.updateTask, taskId, data);
      if (updatedTask) {
        const sanitized = sanitizeTodoistTask(updatedTask);
        // Update cache with the latest data for this task
        setSyncItemsCache(prev => {
          const newCache = new Map(prev);
          newCache.set(sanitized.id, {
            ...newCache.get(sanitized.id), // Keep existing custom_fields if not updated
            deadline: sanitized.deadline,
            // Add other fields from sanitized if they are part of sync item structure
            // For now, only deadline is explicitly handled from sync API
          });
          return newCache;
        });
        return sanitized;
      }
      return undefined;
    },
    [makeApiCall],
  );

  const createTodoistTask = useCallback(
    async (data: {
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
    }) => {
      const newTask = await makeApiCall(todoistService.createTask, data);
      if (newTask) {
        const sanitized = sanitizeTodoistTask(newTask);
        // Add new task to cache
        setSyncItemsCache(prev => {
          const newCache = new Map(prev);
          newCache.set(sanitized.id, {
            deadline: sanitized.deadline,
            custom_fields: sanitized.custom_fields,
          });
          return newCache;
        });
        return sanitized;
      }
      return undefined;
    },
    [makeApiCall],
  );

  return (
    <TodoistContext.Provider
      value={{
        apiKey,
        setApiKey,
        clearApiKey,
        fetchTasks,
        fetchTaskById,
        fetchProjects,
        closeTask,
        deleteTask,
        updateTask,
        createTodoistTask,
        isLoading,
      }}
    >
      {children}
    </TodoistContext.Provider>
  );
};

export const useTodoist = () => {
  const context = useContext(TodoistContext);
  if (context === undefined) {
    throw new Error("useTodoist must be used within a TodoistProvider");
  }
  return context;
};