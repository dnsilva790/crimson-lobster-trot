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
  fetchTasks: (filter?: string, includeSubtasksAndRecurring?: boolean) => Promise<TodoistTask[]>;
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
  }) => Promise<TodoistTask | undefined>;
  isLoading: boolean;
}

type MakeApiCallFn = <T>(
  apiFunction: (key: string, ...args: any[]) => Promise<T>,
  ...args: any[]
) => Promise<T | undefined>;

const TodoistContext = createContext<TodoistContextType | undefined>(undefined);

export const TodoistProvider = ({ children }: { children: ReactNode }) => {
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
      if (!apiKey) {
        toast.error("API key não configurada.");
        return undefined;
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
        
        // Se a função API esperava um array (como fetchTasks ou fetchProjects),
        // retorne um array vazio em caso de erro para evitar que o código que espera um array falhe.
        if (apiFunction === todoistService.fetchTasks || apiFunction === todoistService.fetchProjects) {
          return [] as typeof apiFunction extends (...args: any[]) => Promise<infer R> ? R : undefined;
        }
        return undefined;
      } finally {
        setIsLoading(false);
      }
    },
    [apiKey, clearApiKey],
  );

  const fetchTasks = useCallback(
    async (filter?: string, includeSubtasksAndRecurring: boolean = false) => {
      let allTasks: TodoistTask[] = [];
      try {
        const rawTasks = await makeApiCall(todoistService.fetchTasks, filter);
        if (Array.isArray(rawTasks)) {
          allTasks = rawTasks;
        } else {
          console.warn("TodoistContext: makeApiCall did not return an array for tasks. Received:", rawTasks);
          allTasks = [];
        }
      } catch (error) {
        console.error("TodoistContext: Error fetching tasks:", error);
        allTasks = [];
      }
      
      console.log("TodoistContext: Tarefas brutas da API (verificando status de recorrência):");
      allTasks.forEach(task => {
        console.log(`  Task ID: ${task.id}, Content: "${task.content}", is_recurring: ${task.due?.is_recurring}, parent_id: ${task.parent_id}`);
      });

      const tasksWithDuration = allTasks.map(task => {
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

      const shouldFilterOutSubtasksAndRecurring = includeSubtasksAndRecurring === false || (includeSubtasksAndRecurring === undefined && filter !== undefined);

      console.log("TodoistContext: fetchTasks chamado com filter:", filter, "includeSubtasksAndRecurring:", includeSubtasksAndRecurring, "shouldFilterOutSubtasksAndRecurring:", shouldFilterOutSubtasksAndRecurring);

      if (shouldFilterOutSubtasksAndRecurring) {
        const processedTasks = tasksWithDuration
          .filter(task => task.parent_id === null && task.due?.is_recurring !== true);
        
        console.log("TodoistContext: Filtrando tarefas (subtarefas e recorrentes). Contagem original:", tasksWithDuration.length, "Contagem filtrada:", processedTasks.length);
        return processedTasks;
      } else {
        console.log("TodoistContext: Não filtrando tarefas (subtarefas e recorrentes). Contagem:", tasksWithDuration.length);
        return tasksWithDuration;
      }
    },
    [makeApiCall],
  );

  const fetchProjects = useCallback(async () => {
    return (await makeApiCall(todoistService.fetchProjects)) || [];
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
    }) => {
      return await makeApiCall(todoistService.updateTask, taskId, data);
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
        fetchProjects,
        closeTask,
        deleteTask,
        updateTask,
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