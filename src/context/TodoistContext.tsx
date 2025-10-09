import React, {
  createContext,
  useContext,
  useState,
  ReactNode,
  useCallback,
} from "react";
import { todoistService } from "@/services/todoistService";
import { TodoistTask } from "@/lib/types";
import { toast } from "sonner";

interface TodoistContextType {
  apiKey: string | null;
  setApiKey: (key: string) => void;
  clearApiKey: () => void;
  fetchTasks: (filter?: string, includeSubtasksAndRecurring?: boolean) => Promise<TodoistTask[]>;
  closeTask: (taskId: string) => Promise<void>;
  deleteTask: (taskId: string) => Promise<void>;
  updateTask: (taskId: string, data: {
    content?: string;
    description?: string;
    priority?: 1 | 2 | 3 | 4;
    due_date?: string | null;
    due_datetime?: string | null;
    labels?: string[];
    duration?: number; // Adicionado para a API do Todoist
    duration_unit?: "minute" | "day"; // Adicionado para a API do Todoist
  }) => Promise<TodoistTask | undefined>;
  setDeadlineV1: (taskId: string, dateString: string) => Promise<void>; // Nova função v1
  clearDeadlineV1: (taskId: string) => Promise<void>; // Nova função v1
  isLoading: boolean;
}

type MakeApiCallFn = <T>(
  apiFunction: (key: string, ...args: any[]) => Promise<T>,
  ...args: any[]
) => Promise<T | undefined>;

const TodoistContext = createContext<TodoistContextType | undefined>(undefined);

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
      if (!apiKey) {
        toast.error("API key não configurada.");
        return undefined;
      }
      setIsLoading(true);
      try {
        const result = await apiFunction(apiKey, ...args);
        return result;
      } catch (error: any) {
        console.error("Todoist API Error:", error);
        if (error.status === 401 || error.status === 403) { // Tratamento para 401 e 403
          toast.error("API key inválida ou sem permissão. Configure novamente.");
          clearApiKey();
        } else if (error.status === 500) {
          toast.error("Erro no servidor. Tente novamente.");
        } else {
          toast.error(`Erro na API: ${error.message || "Erro desconhecido"}`);
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
      const allTasks = (await makeApiCall(todoistService.fetchTasks, filter)) || [];
      
      // Calcula estimatedDurationMinutes para todas as tarefas
      const tasksWithDuration = allTasks.map(task => {
        let estimatedDurationMinutes = 15; // Padrão de 15 minutos
        if (task.duration) {
          if (task.duration.unit === "minute") {
            estimatedDurationMinutes = task.duration.amount;
          } else if (task.duration.unit === "day") {
            // Assumindo 8 horas de trabalho por dia para converter dias em minutos
            estimatedDurationMinutes = task.duration.amount * 8 * 60;
          }
        }
        return { ...task, estimatedDurationMinutes };
      });

      // Lógica de filtragem aprimorada:
      // - Se includeSubtasksAndRecurring for explicitamente true, não filtra.
      // - Se includeSubtasksAndRecurring for explicitamente false, filtra.
      // - Se includeSubtasksAndRecurring for undefined (não passado):
      //   - Se um filtro for fornecido, filtra (comportamento padrão para visualizações filtradas).
      //   - Se NENHUM filtro for fornecido, NÃO filtra (comportamento padrão para visualizações de "todas as tarefas").
      const shouldFilter = includeSubtasksAndRecurring === false || (includeSubtasksAndRecurring === undefined && filter !== undefined);

      if (shouldFilter) {
        const processedTasks = tasksWithDuration
          .filter(task => task.parent_id === null && task.due?.is_recurring !== true);
        
        return processedTasks;
      } else {
        return tasksWithDuration;
      }
    },
    [makeApiCall],
  );

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

  const setDeadlineV1 = useCallback(
    async (taskId: string, dateString: string) => {
      return await makeApiCall(todoistService.setDeadlineV1, taskId, dateString);
    },
    [makeApiCall],
  );

  const clearDeadlineV1 = useCallback(
    async (taskId: string) => {
      return await makeApiCall(todoistService.clearDeadlineV1, taskId);
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
        closeTask,
        deleteTask,
        updateTask,
        setDeadlineV1, // Expondo a nova função
        clearDeadlineV1, // Expondo a nova função
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