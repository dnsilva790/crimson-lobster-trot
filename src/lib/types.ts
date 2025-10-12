export interface TodoistTask {
  id: string;
  project_id: string;
  section_id: string | null;
  content: string;
  description: string;
  is_completed: boolean;
  labels: string[];
  parent_id: string | null;
  order: number;
  priority: 1 | 2 | 3 | 4; // 1: P4 (Baixa), 2: P3 (Média), 3: P2 (Média), 4: P1 (Urgente)
  due: {
    date: string | null; // Alterado para permitir null
    string: string | null; // Alterado para permitir null
    lang: string;
    is_recurring: boolean | undefined; // Alterado para permitir undefined
    datetime: string | null;
    timezone: string | null;
  } | null;
  duration: { // Adicionado o campo duration conforme a API do Todoist
    amount: number;
    unit: "minute" | "day";
  } | null;
  url: string;
  comment_count: number;
  created_at: string;
  creator_id: string;
  // Propriedade adicionada no front-end para facilitar o planejamento
  estimatedDurationMinutes?: number;
  // Adicionado com base na saída do cURL, agora será controlável via Sync API
  deadline?: string | null; // YYYY-MM-DD
  isMeeting?: boolean; // Adicionado para identificar reuniões
}

export interface TodoistProject {
  id: string;
  name: string;
  color: string;
  comment_count: number;
  is_shared: boolean;
  is_favorite: boolean;
  sync_id: number;
  url: string;
}

// Interface para o estado salvo do Seiton
export interface SeitonStateSnapshot {
  tasksToProcess: TodoistTask[];
  rankedTasks: TodoistTask[];
  currentTaskToPlace: TodoistTask | null;
  comparisonCandidate: TodoistTask | null;
  comparisonIndex: number;
  tournamentState: "initial" | "comparing" | "finished";
}

// Nova interface para tarefas gerenciadas internamente
export interface InternalTask {
  id: string;
  content: string;
  description?: string;
  category: "pessoal" | "profissional";
  isCompleted: boolean;
  createdAt: string;
  estimatedDurationMinutes?: number; // Adicionado para tarefas internas
}

// Novas interfaces para o Planejador
export type TimeBlockType = "work" | "personal" | "break";
export type DayOfWeek = "0" | "1" | "2" | "3" | "4" | "5" | "6"; // 0 = Sunday, 6 = Saturday

export interface TimeBlock {
  id: string;
  start: string; // HH:mm
  end: string;   // HH:mm
  type: TimeBlockType;
  label?: string; // e.g., "Almoço", "Foco Profissional"
}

export interface RecurringTimeBlock extends TimeBlock {
  dayOfWeek: DayOfWeek; // Day of the week this block applies to
}

export interface ScheduledTask {
  id: string;
  taskId: string; // ID da tarefa do Todoist ou InternalTask
  content: string;
  description?: string;
  start: string; // HH:mm
  end: string;   // HH:mm
  priority: 1 | 2 | 3 | 4;
  category: "pessoal" | "profissional";
  estimatedDurationMinutes: number; // Duração da tarefa agendada
  originalTask?: TodoistTask | InternalTask; // Referência à tarefa original
  isMeeting?: boolean; // Adicionado para identificar reuniões
}

export interface DaySchedule {
  date: string; // YYYY-MM-DD
  timeBlocks: TimeBlock[]; // Specific blocks for this date
  scheduledTasks: ScheduledTask[];
}

// Nova interface para Projetos (5W2H)
export interface Project {
  id: string;
  what: string; // O Quê
  why: string;  // Por Quê
  who: string;  // Quem
  where: string; // Onde
  when: string; // Quando (data de vencimento, YYYY-MM-DD)
  how: string;  // Como (passos, metodologia)
  howMuch?: string; // Quanto (custo, recursos)
  createdAt: string; // Data de criação (ISO string)
  status: "ativo" | "concluido" | "arquivado" | "cancelado"; // Status do projeto
  todoistTaskId?: string; // Opcional: ID da tarefa Todoist que originou o projeto
  subtasks: string[]; // Subtarefas geradas a partir do campo 'how'
}