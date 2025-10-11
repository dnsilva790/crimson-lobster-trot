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
  fetchTasks: (filter?: string, options?: { includeSubtasks?: boolean; includeRecurring?: boolean }) => Promise<TodoistTask[]>;
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
    deadline?: string | null; // Adicionado o campo deadline
  }) => Promise<TodoistTask | undefined>;
  isLoading: boolean;
}

// Alterado o tipo de retorno para sempre T, assumindo que T é um array para funções de busca de lista
type MakeApiCallFn = <T>(
  apiFunction: (key: string, ...args: any[]) => Promise<T>,
  ...args: any[]
) => Promise<T>;

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
      const isFetchingList = (apiFunction === todoistService.fetchTasks || apiFunction === todoistService.fetchProjects);

      if (!apiKey) {
        toast.error("API key não configurada.");
        // Retorna um array vazio para funções que buscam listas, undefined para outras
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
        
        // Retorna um array vazio em caso de erro para funções que buscam listas
        return isFetchingList ? [] as any : undefined as any; 
      } finally {
        setIsLoading(false);
      }
    },
    [apiKey, clearApiKey],
  );

  const fetchTasks = useCallback(
    async (filter?: string, options?: { includeSubtasks?: boolean; includeRecurring?: boolean }) => {
      const rawTasks = await makeApiCall(todoistService.fetchTasks, filter);
      
      console.log("TodoistContext: Tarefas brutas da API (verificando status de recorrência):");
      rawTasks.forEach(task => {
        console.log(`  Task ID: ${task.id}, Content: "${task.content}", is_recurring: ${task.due?.is_recurring}, due.string: "${task.due?.string}", parent_id: ${task.parent_id}`);
      });

      // FILTRO UNIVERSAL: Remover tarefas recorrentes "every hour"
      const filteredHourlyRecurring = rawTasks.filter(task => 
        !(task.due?.is_recurring === true && task.due?.string.toLowerCase().includes("every hour"))
      );

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

      // Aplicar filtragem com base nas novas opções
      const finalOptions = {
        includeSubtasks: options?.includeSubtasks ?? true, // Padrão: incluir subtarefas
        includeRecurring: options?.includeRecurring ?? true, // Padrão: incluir recorrentes
      };

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

  const fetchProjects = useCallback(async () => {
    return await makeApiCall(todoistService.fetchProjects); // Sempre retornará um array
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
      deadline?: string | null; // Adicionado o campo deadline
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