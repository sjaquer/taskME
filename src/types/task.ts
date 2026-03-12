export type Priority = 'baja' | 'media' | 'alta';

export type AppContext = 'Trabajo' | 'Estudio';

export type TaskStatus = 'Pendiente' | 'Haciendo' | 'Hecho' | string;

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
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface TaskFormData {
  title: string;
  description: string;
  priority: Priority;
  status: string;
  tags: string;
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

// ── Calendar Events (eventos puntuales) ────────────────────
export type EventColor = 'tomato' | 'flamingo' | 'tangerine' | 'banana' | 'sage' | 'basil' | 'peacock' | 'blueberry' | 'lavender' | 'grape' | 'graphite';

export interface CalendarEvent {
  id: string;
  title: string;
  description?: string;
  startDate: string;         // ISO datetime
  endDate: string;           // ISO datetime
  allDay: boolean;
  location?: string;
  color: EventColor;
  context: AppContext;
  userId: string;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface CalendarEventFormData {
  title: string;
  description: string;
  startDate: string;          // "YYYY-MM-DD"
  startTime: string;          // "HH:mm"
  endDate: string;            // "YYYY-MM-DD"
  endTime: string;            // "HH:mm"
  allDay: boolean;
  location: string;
  color: EventColor;
}
