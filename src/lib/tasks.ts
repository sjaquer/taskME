import { addDays, addMonths, addWeeks, differenceInCalendarDays, format, isBefore, isValid, parseISO, startOfDay } from 'date-fns';
import type { Priority, Recurrence, TaskStatus } from '@/types/task';

// Estados fijos: el Kanban nunca admite estados personalizados adicionales.
export const TASK_STATUSES: readonly TaskStatus[] = ['Pendiente', 'Haciendo', 'Hecho'];

export function isTaskStatus(value: string): value is TaskStatus {
  return (TASK_STATUSES as readonly string[]).includes(value);
}

export const PRIORITIES: readonly Priority[] = ['alta', 'media', 'baja'];

export const MAX_TAGS_PER_TASK = 5;

// Días antes del vencimiento en que una tarea se marca como urgente.
const URGENT_DAYS = 3;

export function normalizeTag(tag: string) {
  return tag.trim().toLowerCase().replace(/\s+/g, ' ');
}

/** Convierte "a, b, c" en etiquetas normalizadas, únicas y con máximo MAX_TAGS_PER_TASK. */
export function parseTagInput(input: string) {
  const uniqueTags = new Set<string>();
  input
    .split(',')
    .map(normalizeTag)
    .filter(Boolean)
    .forEach((tag) => {
      if (uniqueTags.size < MAX_TAGS_PER_TASK) uniqueTags.add(tag);
    });
  return Array.from(uniqueTags);
}

export function toDate(value: string | Date | undefined | null): Date | null {
  if (!value) return null;
  const parsed = typeof value === 'string' ? parseISO(value) : value;
  return isValid(parsed) ? parsed : null;
}

/** Valor para un <input type="date"> (YYYY-MM-DD) o "" si no hay fecha válida. */
export function toInputDateValue(value: string | Date | undefined) {
  const parsed = toDate(value);
  return parsed ? format(parsed, 'yyyy-MM-dd') : '';
}

export function formatShortDate(value: Date) {
  return new Intl.DateTimeFormat('es-ES', { day: '2-digit', month: 'short' }).format(value);
}

export interface DueMeta {
  isOverdue: boolean;
  isUrgent: boolean;
  daysLeft: number;
  label: string;
}

/** Fecha y hora de vencimiento combinadas (la hora es opcional). */
export function getDueDateTime(dueDate: string | Date | undefined | null, dueTime?: string): Date | null {
  const parsed = toDate(dueDate);
  if (!parsed) return null;
  if (!dueTime || !/^\d{2}:\d{2}$/.test(dueTime)) return parsed;
  const [hours, minutes] = dueTime.split(':').map(Number);
  const withTime = new Date(parsed);
  withTime.setHours(hours, minutes, 0, 0);
  return withTime;
}

/**
 * Estado de vencimiento por días calendario: una tarea que vence hoy no está
 * vencida, salvo que tenga hora y esa hora ya pasó.
 */
export function getDueMeta(dueDate: string | Date | undefined | null, dueTime?: string): DueMeta | null {
  const parsed = toDate(dueDate);
  if (!parsed) return null;

  const now = new Date();
  const daysLeft = differenceInCalendarDays(parsed, now);
  const withTime = dueTime ? getDueDateTime(parsed, dueTime) : null;
  const isOverdue = daysLeft < 0 || (daysLeft === 0 && withTime !== null && isBefore(withTime, now));
  const dayLabel = daysLeft === 0 ? 'Hoy' : daysLeft === 1 ? 'Mañana' : formatShortDate(parsed);
  return {
    isOverdue,
    isUrgent: !isOverdue && daysLeft <= URGENT_DAYS,
    daysLeft,
    label: isOverdue ? 'Vencida' : dueTime ? `${dayLabel} · ${dueTime}` : dayLabel,
  };
}

export const RECURRENCE_LABELS: Record<Recurrence, string> = {
  daily: 'Cada día',
  weekly: 'Cada semana',
  monthly: 'Cada mes',
};

/**
 * Próxima fecha de una tarea recurrente. Si se completó con atraso, avanza
 * hasta hoy o después para no crear ocurrencias ya vencidas.
 */
export function getNextDueDate(dueDate: string, recurrence: Recurrence): string {
  const step = (date: Date) =>
    recurrence === 'daily' ? addDays(date, 1) : recurrence === 'weekly' ? addWeeks(date, 1) : addMonths(date, 1);
  const today = startOfDay(new Date());
  let next = step(parseISO(dueDate));
  while (isBefore(next, today)) next = step(next);
  return format(next, 'yyyy-MM-dd');
}

/** Progreso de subtareas, o null si no tiene. */
export function getChecklistProgress(checklist: { done: boolean }[] | undefined) {
  if (!checklist || checklist.length === 0) return null;
  return { done: checklist.filter((item) => item.done).length, total: checklist.length };
}

const PRIORITY_META: Record<Priority, { label: string; className: string }> = {
  alta: { label: 'Alta', className: 'border-red-500/30 bg-red-500/10 text-red-300' },
  media: { label: 'Media', className: 'border-amber-500/30 bg-amber-500/10 text-amber-300' },
  baja: { label: 'Baja', className: 'border-blue-500/30 bg-blue-500/10 text-blue-300' },
};

export function getPriorityMeta(priority: Priority) {
  return PRIORITY_META[priority] ?? PRIORITY_META.media;
}

export interface TaskFilters {
  priority: Priority | 'all';
  projectId: string | 'all';
  query: string;
  onlyOverdue?: boolean;
}

/** Filtra por prioridad, proyecto y texto (título, descripción o etiqueta). */
export function filterTasks<
  T extends { priority: Priority; projectId?: string; title: string; description?: string; tags?: string[]; dueDate?: string | Date; dueTime?: string }
>(
  tasks: T[],
  filters: TaskFilters
): T[] {
  const query = filters.query.trim().toLowerCase();
  return tasks.filter((task) => {
    if (filters.priority !== 'all' && task.priority !== filters.priority) return false;
    if (filters.projectId !== 'all' && task.projectId !== filters.projectId) return false;
    if (filters.onlyOverdue && !getDueMeta(task.dueDate, task.dueTime)?.isOverdue) return false;
    if (!query) return true;
    return (
      task.title.toLowerCase().includes(query) ||
      (task.description || '').toLowerCase().includes(query) ||
      (task.tags || []).some((tag) => normalizeTag(tag).includes(query))
    );
  });
}

/** Agrupa por estado manteniendo siempre las tres columnas, aunque estén vacías. */
export function groupTasksByStatus<T extends { status: TaskStatus }>(tasks: T[]): Map<TaskStatus, T[]> {
  const grouped = new Map<TaskStatus, T[]>(TASK_STATUSES.map((status) => [status, []]));
  tasks.forEach((task) => grouped.get(task.status)?.push(task));
  return grouped;
}

export type TaskSort = 'smart' | 'due' | 'priority' | 'recent';

export const TASK_SORT_LABELS: Record<TaskSort, string> = {
  smart: 'Inteligente',
  due: 'Vencimiento',
  priority: 'Prioridad',
  recent: 'Recientes',
};

const PRIORITY_ORDER: Record<Priority, number> = { alta: 0, media: 1, baja: 2 };

/** Milisegundos de un Timestamp de Firestore (o de su forma serializada); 0 si no hay. */
export function getTimestampMillis(value: unknown): number {
  if (value && typeof value === 'object' && 'seconds' in value && typeof (value as { seconds: unknown }).seconds === 'number') {
    return (value as { seconds: number }).seconds * 1000;
  }
  return 0;
}

type SortableTask = { priority: Priority; dueDate?: string | Date; dueTime?: string; createdAt?: unknown };

/**
 * Ordena sin modificar la lista original.
 * - smart: vencidas primero, luego por fecha (sin fecha al final) y prioridad.
 * - due / priority / recent: por vencimiento, prioridad o creación más reciente.
 */
export function sortTasks<T extends SortableTask>(tasks: T[], sort: TaskSort): T[] {
  const due = (task: T) => getDueDateTime(task.dueDate, task.dueTime)?.getTime() ?? Number.POSITIVE_INFINITY;
  const byPriority = (a: T, b: T) => PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority];
  const byDue = (a: T, b: T) => due(a) - due(b);
  const byRecent = (a: T, b: T) => getTimestampMillis(b.createdAt) - getTimestampMillis(a.createdAt);

  const comparators: Record<TaskSort, (a: T, b: T) => number> = {
    smart: (a, b) => byDue(a, b) || byPriority(a, b) || byRecent(a, b),
    due: (a, b) => byDue(a, b) || byPriority(a, b),
    priority: (a, b) => byPriority(a, b) || byDue(a, b),
    recent: byRecent,
  };
  return [...tasks].sort(comparators[sort]);
}

/** "HH:mm" → minutos desde medianoche, o null si no es válido. */
export function timeToMinutes(time: string | undefined): number | null {
  if (!time || !/^\d{2}:\d{2}$/.test(time)) return null;
  const [hours, minutes] = time.split(':').map(Number);
  return hours * 60 + minutes;
}

/**
 * Rutinas que comparten algún día y se superponen en horario con `candidate`
 * (se ignora la propia rutina al editarla).
 */
export function findOverlappingRoutines<
  T extends { id: string; startTime: string; endTime: string; recurringDays: number[] }
>(candidate: { id?: string; startTime: string; endTime: string; recurringDays: number[] }, routines: T[]): T[] {
  const start = timeToMinutes(candidate.startTime);
  const end = timeToMinutes(candidate.endTime);
  if (start === null || end === null) return [];
  return routines.filter((routine) => {
    if (routine.id === candidate.id) return false;
    if (!routine.recurringDays?.some((day) => candidate.recurringDays.includes(day))) return false;
    const otherStart = timeToMinutes(routine.startTime);
    const otherEnd = timeToMinutes(routine.endTime);
    return otherStart !== null && otherEnd !== null && start < otherEnd && otherStart < end;
  });
}
