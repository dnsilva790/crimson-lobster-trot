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
  deadline?: string | null; // Adicionado o campo deadline
  isMeeting?: boolean; // Adicionado para identificar reuniões
  custom_fields?: TodoistCustomField[]; // Adicionado para capturar campos personalizados brutos
}

export interface TodoistProject {
  id: string;
  name: string;
  color: string;
  is_shared: boolean;
  is_favorite: boolean;
  sync_id: number;
  url: string;
  comment_count: number;
}

// Interface para o estado salvo do Seiton
export interface SeitonStateSnapshot {
  tasksToProcess: TodoistTask[];
  rankedTasks: TodoistTask[];
  currentTaskToPlace: TodoistTask | null;
  comparisonCandidate: TodoistTask | null;
  comparisonIndex: number;
  tournamentState: "initial" | "comparing" | "finished";
  selectedPrioritizationContext: "none" | "pessoal" | "profissional";
  customSortingPreferences: CustomSortingPreference; // Adicionado
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
  dueDate?: string | null; // Novo campo para data de vencimento (YYYY-MM-DD)
  dueTime?: string | null; // Novo campo para hora de vencimento (HH:mm)
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

// Nova interface para definições de campos personalizados (retornada pela Sync API)
export interface TodoistCustomFieldDefinition {
  id: string;
  name: string;
  project_id: string | null; // Pode ser null para campos globais
  type: "text" | "number" | "date" | "checkbox" | "dropdown";
  config: {
    name: string;
    type: string;
    options?: { id: string; name: string }[];
  };
}

// Nova interface para o campo custom_fields dentro de uma tarefa (Sync API)
export interface TodoistCustomField {
  id: string; // ID da definição do campo personalizado
  value: string | null; // Valor do campo
}

// Nova interface para o módulo Shitsuke (Revisão Diária)
export interface DailyReviewEntry {
  date: string; // YYYY-MM-DD
  reflection: string;
  improvements: string;
  createdAt: string;
  updatedAt: string;
}

// Novos tipos para ordenação personalizada no Seiton
export type SortingCriterion =
  | "starred"
  | "deadline"
  | "priority"
  | "duration"
  | "due_date_time"
  | "category"
  | "created_at";

export interface CustomSortingPreference {
  primary: SortingCriterion | "none";
  secondary: SortingCriterion | "none";
  tertiary: SortingCriterion | "none";
}