export type Priority = 'baja' | 'media' | 'alta';

export type AppContext = 'Trabajo' | 'Estudio';

export type TaskStatus = 'Pendiente' | 'Haciendo' | 'Hecho';

// ── Kanban Tasks (tablero) ─────────────────────────────────
export interface Task {
  id: string;
  title: string;
  description?: string;
  status: TaskStatus;
  priority: Priority;
  context: AppContext;
  userId: string;
  tags?: string[];
  dueDate?: string | Date;   // ISO datetime (opcional)
  projectId?: string;
  // ── Campos de Ticket (cuando isTicket es true) ────────────
  isTicket?: boolean;
  requestedAction?: string;   // Acción que se pide realizar
  requesterName?: string;     // Quién lo solicitó
  reviewDate?: string;        // Fecha de revisión (distinta de dueDate)
  referenceUrl?: string;      // Link de referencia (adjuntos múltiples: futuro)
  createdAt?: unknown;
  updatedAt?: unknown;
}

// ── Routines (horario semanal recurrente) ──────────────────
export interface Routine {
  id: string;
  title: string;
  startTime: string;        // "HH:mm"
  endTime: string;           // "HH:mm"
  recurringDays: number[];   // 0=Dom, 1=Lun ... 6=Sab
  priority: Priority;
  context: AppContext;
  userId: string;
  color?: string;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface RoutineFormData {
  title: string;
  startTime: string;
  endTime: string;
  priority: Priority;
  recurringDays: number[];
  color: string;
}

// ── Projects (agrupación de tareas y tickets) ──────────────
export interface Project {
  id: string;
  name: string;
  category: string;
  color: string;
  context: AppContext;
  userId: string;
  archived?: boolean;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface ProjectFormData {
  name: string;
  category: string;
  color: string;
}

// ── Notes (recordatorios y apuntes libres) ─────────────────
export type NoteCategory = 'Clases' | 'Tareas' | 'Grupos' | 'Trabajo' | 'Tickets' | 'Otro';

export interface Note {
  id: string;
  title: string;
  content: string;
  category: NoteCategory;
  context: AppContext;
  userId: string;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface NoteFormData {
  title: string;
  content: string;
  category: NoteCategory;
}
