import React, {
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
  fetchTasks: (filter?: string, options?: { includeSubtasks?: boolean; includeRecurring?: boolean; includeCompleted?: boolean }) => Promise<TodoistTask[]>;
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
  }) => Promise<TodoistTask | undefined>;
  isLoading: boolean;
}

type MakeApiCallFn = <T>(
  apiFunction: (key: string, ...args: any[]) => Promise<T>,
  ...args: any[]
) => Promise<T>;

const TodoistContext = createContext<TodoistContextType | undefined>(undefined);

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
      console.log(`TodoistContext: Successfully extracted date from object deadline for task ${task.id}. New deadline:`, task.deadline);
    } else {
      console.warn(`TodoistContext: Task ${task.id} (${task.content}) has unexpected deadline format:`, task.deadline, ". Converting to null.");
      task.deadline = null;
    }
  }
  
  return task;
};

export const TodoistProvider = ({ children }: { children: ReactNode }) => {
  const [apiKey, setApiKeyInternal] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [syncItemsCache, setSyncItemsCache] = useState<Map<string, any>>(new Map());
  const syncItemsCacheRef = useRef(syncItemsCache); // Use ref for immediate access in callbacks

  useEffect(() => {
    syncItemsCacheRef.current = syncItemsCache;
  }, [syncItemsCache]);

  const setApiKey = useCallback((key: string) => {
    setApiKeyInternal(key);
  }, []);

  const clearApiKey = useCallback(() => {
    setApiKeyInternal(null);
    setSyncItemsCache(new Map()); // Clear cache on API key clear
  }, []);

  const loadSyncItemsCache = useCallback(async (key: string) => {
    setIsLoading(true);
    try {
      const cache = await todoistService.fetchSyncItems(key);
      setSyncItemsCache(cache);
      console.log("TodoistContext: Sync items cache loaded successfully.", cache.size, "items.");
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
    async (filter?: string, options?: { includeSubtasks?: boolean; includeRecurring?: boolean; includeCompleted?: boolean }) => {
      const finalOptions = {
        includeSubtasks: options?.includeSubtasks ?? false,
        includeRecurring: options?.includeRecurring ?? false,
        includeCompleted: options?.includeCompleted ?? false,
      };

      const rawTasks = await makeApiCall(todoistService.fetchTasks, filter, syncItemsCacheRef.current);
      
      console.log("TodoistContext: Tarefas brutas da API (verificando status de recorrência):");
      rawTasks.forEach(task => {
        console.log(`  Task ID: ${task.id}, Content: "${task.content}", is_recurring: ${task.due?.is_recurring}, due.string: "${task.due?.string}", parent_id: ${task.parent_id}, is_completed: ${task.is_completed}, deadline: ${task.deadline}`);
      });

      const sanitizedTasks = rawTasks.map(sanitizeTodoistTask);

      const filteredHourlyRecurring = sanitizedTasks.filter(task => {
        return !(task.due?.is_recurring === true && task.due?.string?.toLowerCase().includes("every hour"));
      });

      console.log("TodoistContext: Tarefas após filtro 'every hour'. Original:", rawTasks.length, "Filtrado:", filteredHourlyRecurring.length);

      const tasksWithDuration = filteredHourlyRecurring.map(task => {
        let estimatedDurationMinutes = 15;
        if (task.duration) {
          if (task.duration.unit === "minute") {
            estimatedDurationMinutes = task.duration.amount;
          } else if (task.duration.unit === "day") {
            estimatedDurationMinutes = task.duration.amount * 8 * 60;
          }
        }
        return { ...task, estimatedDurationMinutes };
      });

      let processedTasks = tasksWithDuration;

      if (!finalOptions.includeSubtasks) {
        processedTasks = processedTasks.filter(task => task.parent_id === null);
        console.log("TodoistContext: Filtrando subtarefas. Contagem:", processedTasks.length);
      }
      
      if (!finalOptions.includeRecurring) {
        processedTasks = processedTasks.filter(task => task.due?.is_recurring !== true);
        console.log("TodoistContext: Filtrando tarefas recorrentes. Contagem:", processedTasks.length);
      }
      
      console.log("TodoistContext: fetchTasks finalizado. Contagem:", processedTasks.length);
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