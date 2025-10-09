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
  priority: 1 | 2 | 3 | 4; // 1: P4 (Baixa), 2: P3 (Média), 3: P2 (Alta), 4: P1 (Urgente)
  due: {
    date: string;
    string: string;
    lang: string;
    is_recurring: boolean;
    datetime: string | null;
    timezone: string | null;
  } | null;
  deadline: { // Novo campo deadline
    date: string;
  } | null;
  url: string;
  comment_count: number;
  created_at: string;
  creator_id: string;
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