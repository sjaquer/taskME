import { differenceInCalendarDays, format, isValid, parseISO } from 'date-fns';
import type { Priority, TaskStatus } from '@/types/task';

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

/**
 * Estado de vencimiento por días calendario: una tarea que vence hoy no está vencida.
 */
export function getDueMeta(dueDate: string | Date | undefined | null): DueMeta | null {
  const parsed = toDate(dueDate);
  if (!parsed) return null;

  const daysLeft = differenceInCalendarDays(parsed, new Date());
  const isOverdue = daysLeft < 0;
  return {
    isOverdue,
    isUrgent: !isOverdue && daysLeft <= URGENT_DAYS,
    daysLeft,
    label: isOverdue ? 'Vencida' : formatShortDate(parsed),
  };
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
}

/** Filtra por prioridad, proyecto y texto (título, descripción o etiqueta). */
export function filterTasks<T extends { priority: Priority; projectId?: string; title: string; description?: string; tags?: string[] }>(
  tasks: T[],
  filters: TaskFilters
): T[] {
  const query = filters.query.trim().toLowerCase();
  return tasks.filter((task) => {
    if (filters.priority !== 'all' && task.priority !== filters.priority) return false;
    if (filters.projectId !== 'all' && task.projectId !== filters.projectId) return false;
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
