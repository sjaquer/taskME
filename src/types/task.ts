export type Priority = 'baja' | 'media' | 'alta';

/**
 * Clave de un contexto: id del documento en users/{uid}/contexts.
 * Los contextos originales usan sus nombres ('Trabajo', 'Estudio') como id, así
 * los datos anteriores siguen asociados sin migración.
 */
export type AppContext = string;

export interface ContextDef {
  id: AppContext;
  name: string;
  color: string;
  icon: string;
  order: number;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export type TaskStatus = 'Pendiente' | 'Haciendo' | 'Hecho';

export type Recurrence = 'daily' | 'weekly' | 'monthly';

/**
 * Imagen adjunta. La imagen completa (base64) vive en users/{uid}/attachments/{id};
 * aquí solo se guardan los datos y una miniatura para mostrarla sin descargarla.
 */
export interface AttachmentMeta {
  id: string;
  name: string;
  mime: 'image/webp' | 'image/jpeg' | 'image/png';
  /** Bytes de la imagen comprimida. */
  size: number;
  width: number;
  height: number;
  /** Miniatura como data URL. */
  thumb: string;
}

/** Subtarea dentro de una tarea. */
export interface ChecklistItem {
  id: string;
  text: string;
  done: boolean;
}

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
  dueDate?: string | Date;   // YYYY-MM-DD (opcional)
  dueTime?: string;          // "HH:mm" (opcional, requiere dueDate)
  checklist?: ChecklistItem[];
  /** Al completarla se crea la siguiente ocurrencia (requiere dueDate). */
  recurrence?: Recurrence;
  attachments?: AttachmentMeta[];
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
  /** Fijada arriba de la lista. */
  pinned?: boolean;
  attachments?: AttachmentMeta[];
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface NoteFormData {
  title: string;
  content: string;
  category: NoteCategory;
}
