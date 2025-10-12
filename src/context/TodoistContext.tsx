import React, {
  createContext,
  useContext,
  useState,
  ReactNode,
  useCallback,
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
  }) => Promise<TodoistTask | undefined>;
  isLoading: boolean;
}

type MakeApiCallFn = <T>(
  apiFunction: (key: string, ...args: any[]) => Promise<T>,
  ...args: any[]
) => Promise<T>;

const TodoistContext = createContext<TodoistContextType | undefined>(undefined);

// Função auxiliar para sanitizar uma única tarefa
const sanitizeTodoistTask = (task: TodoistTask): TodoistTask => {
  // Sanitize task.due object
  if (task.due === undefined || (typeof task.due === 'string' && task.due === 'undefined')) {
    task.due = null;
  } else if (task.due && typeof task.due === 'object') {
    // Explicitly handle 'undefined' string literal and primitive undefined for date fields
    if (task.due.date === undefined || (typeof task.due.date === 'string' && task.due.date === "undefined")) {
      task.due.date = null;
    }
    if (task.due.datetime === undefined || (typeof task.due.datetime === 'string' && task.due.datetime === "undefined")) {
      task.due.datetime = null;
    }
    if (task.due.string === undefined || (typeof task.due.string === 'string' && task.due.string === "undefined")) {
      task.due.string = null;
    }
    
    // Ensure is_recurring is always a boolean
    if (task.due.is_recurring === undefined) {
      task.due.is_recurring = false;
    }
  }

  // Sanitize task.deadline
  // Ensure deadline is a string or null, not an object
  if (task.deadline === undefined || task.deadline === null || (typeof task.deadline === 'string' && task.deadline === "undefined")) {
    task.deadline = null;
  } else if (typeof task.deadline !== 'string') {
    // If it's an object or any other type, convert to string or null
    console.warn(`TodoistContext: Task ${task.id} (${task.content}) has non-string/null deadline:`, task.deadline, ". Converting to null.");
    task.deadline = null;
  }
  
  console.log(`TodoistContext: Sanitized task ${task.id} (${task.content}) deadline: ${task.deadline}`); // Debug log
  return task;
};

export const TodoistProvider = ({ children }: { ReactNode }) => {
  const [apiKey, setApiKeyInternal] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);

  const setApiKey = useCallback((key: string) => {
    setApiKeyInternal(key);
  }, []);

  const clearApiKey = useCallback(() => {
    setApiKeyInternal(null);
  }, []);

  const makeApiCall: MakeApiCallFn = useCallback(
    async (apiFunction, ...args) => {
      const isFetchingList = (apiFunction === todoistService.fetchTasks || apiFunction === todoistService.fetchProjects);

      if (!apiKey) {
        toast.error("API key não configurada.");
        return isFetchingList ? [] as any : undefined as any; 
      }
      setIsLoading(true);
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
        } else {
          toast.error(`Erro na API: ${error.message || "Erro desconhecido"}`);
        }
        
        return isFetchingList ? [] as any : undefined as any; 
      } finally {
        setIsLoading(false);
      }
    },
    [apiKey, clearApiKey],
  );

  const fetchTasks = useCallback(
    async (filter?: string, options?: { includeSubtasks?: boolean; includeRecurring?: boolean; includeCompleted?: boolean }) => {
      const finalOptions = {
        includeSubtasks: options?.includeSubtasks ?? false, // Default to false for subtasks
        includeRecurring: options?.includeRecurring ?? false, // Default to false for recurring
        includeCompleted: options?.includeCompleted ?? false, // Default to false for completed
      };

      let todoistApiFilter = filter || "";
      if (!finalOptions.includeCompleted) {
        todoistApiFilter = todoistApiFilter ? `${todoistApiFilter} & !is_completed` : "!is_completed";
      }

      const rawTasks = await makeApiCall(todoistService.fetchTasks, todoistApiFilter);
      
      console.log("TodoistContext: Tarefas brutas da API (verificando status de recorrência):");
      rawTasks.forEach(task => {
        console.log(`  Task ID: ${task.id}, Content: "${task.content}", is_recurring: ${task.due?.is_recurring}, due.string: "${task.due?.string}", parent_id: ${task.parent_id}, is_completed: ${task.is_completed}`);
      });

      // Sanitização completa das tarefas
      const sanitizedTasks = rawTasks.map(sanitizeTodoistTask);

      // FILTRO UNIVERSAL: Remover tarefas recorrentes "every hour"
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
    [makeApiCall],
  );

  const fetchTaskById = useCallback(async (taskId: string) => {
    const rawTask = await makeApiCall(todoistService.fetchTaskById, taskId);
    if (rawTask) {
      return sanitizeTodoistTask(rawTask); // Aplicar sanitização aqui também
    }
    return undefined;
  }, [makeApiCall]);

  const fetchProjects = useCallback(async () => {
    return await makeApiCall(todoistService.fetchProjects);
  }, [makeApiCall]);

  const closeTask = useCallback(
    async (taskId: string) => {
      return await makeApiCall(todoistService.closeTask, taskId);
    },
    [makeApiCall],
  );

  const deleteTask = useCallback(
    async (taskId: string) => {
      return await makeApiCall(todoistService.deleteTask, taskId);
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
        return sanitizeTodoistTask(updatedTask); // Sanitizar a tarefa retornada após a atualização
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
    }) => {
      const newTask = await makeApiCall(todoistService.createTask, data);
      if (newTask) {
        return sanitizeTodoistTask(newTask); // Sanitizar a tarefa recém-criada
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