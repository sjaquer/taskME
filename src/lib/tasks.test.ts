import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  filterTasks,
  findOverlappingRoutines,
  getChecklistProgress,
  getDueDateTime,
  getDueMeta,
  getNextDueDate,
  groupTasksByStatus,
  isTaskStatus,
  normalizeTag,
  parseTagInput,
  sortTasks,
  timeToMinutes,
  toInputDateValue,
} from './tasks';
import type { Priority, TaskStatus } from '@/types/task';

// Miércoles 21 de octubre de 2026, 10:00 hora local.
const NOW = new Date(2026, 9, 21, 10, 0, 0);

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(NOW);
});
afterEach(() => {
  vi.useRealTimers();
});

describe('etiquetas', () => {
  it('normaliza espacios y mayúsculas', () => {
    expect(normalizeTag('  Diseño   Web ')).toBe('diseño web');
  });

  it('separa por comas, quita vacías y duplicadas, y limita a 5', () => {
    expect(parseTagInput('a, B, a, , c, d, e, f, g')).toEqual(['a', 'b', 'c', 'd', 'e']);
    expect(parseTagInput('')).toEqual([]);
  });
});

describe('getDueMeta', () => {
  it('una tarea que vence hoy no está vencida', () => {
    expect(getDueMeta('2026-10-21')).toMatchObject({ isOverdue: false, daysLeft: 0, label: 'Hoy' });
  });

  it('marca vencida una fecha pasada', () => {
    expect(getDueMeta('2026-10-20')).toMatchObject({ isOverdue: true, label: 'Vencida' });
  });

  it('con hora: vencida si la hora de hoy ya pasó', () => {
    expect(getDueMeta('2026-10-21', '09:30')?.isOverdue).toBe(true);
    expect(getDueMeta('2026-10-21', '18:00')).toMatchObject({ isOverdue: false, label: 'Hoy · 18:00' });
  });

  it('mañana y urgencia (≤ 3 días)', () => {
    expect(getDueMeta('2026-10-22')).toMatchObject({ label: 'Mañana', isUrgent: true });
    expect(getDueMeta('2026-10-30')?.isUrgent).toBe(false);
  });

  it('sin fecha o fecha inválida devuelve null', () => {
    expect(getDueMeta(undefined)).toBeNull();
    expect(getDueMeta('no-es-fecha')).toBeNull();
  });
});

describe('fechas auxiliares', () => {
  it('combina fecha y hora', () => {
    expect(getDueDateTime('2026-10-21', '14:30')?.getHours()).toBe(14);
    expect(getDueDateTime('2026-10-21', 'mal')?.getHours()).toBe(0);
  });

  it('formatea para <input type="date">', () => {
    expect(toInputDateValue('2026-01-05')).toBe('2026-01-05');
    expect(toInputDateValue(undefined)).toBe('');
  });
});

describe('getNextDueDate (tareas recurrentes)', () => {
  it('avanza un día, una semana o un mes', () => {
    expect(getNextDueDate('2026-10-21', 'daily')).toBe('2026-10-22');
    expect(getNextDueDate('2026-10-21', 'weekly')).toBe('2026-10-28');
    expect(getNextDueDate('2026-10-21', 'monthly')).toBe('2026-11-21');
  });

  it('si se completó con atraso, la próxima no queda en el pasado', () => {
    expect(getNextDueDate('2026-10-01', 'daily')).toBe('2026-10-21');
    expect(getNextDueDate('2026-09-30', 'weekly')).toBe('2026-10-21');
  });
});

type T = { id: string; title: string; priority: Priority; status: TaskStatus; dueDate?: string; dueTime?: string; projectId?: string; tags?: string[]; description?: string; createdAt?: unknown };

const tasks: T[] = [
  { id: '1', title: 'Informe', priority: 'media', status: 'Pendiente', dueDate: '2026-10-25', tags: ['oficina'], createdAt: { seconds: 100, nanoseconds: 0 } },
  { id: '2', title: 'Pagar luz', priority: 'alta', status: 'Haciendo', dueDate: '2026-10-19', projectId: 'p1', createdAt: { seconds: 300, nanoseconds: 0 } },
  { id: '3', title: 'Leer libro', priority: 'baja', status: 'Hecho', description: 'capítulo 3', createdAt: { seconds: 200, nanoseconds: 0 } },
  { id: '4', title: 'Llamar', priority: 'alta', status: 'Pendiente', dueDate: '2026-10-25', createdAt: { seconds: 50, nanoseconds: 0 } },
];

describe('filterTasks', () => {
  const base = { priority: 'all' as const, projectId: 'all', query: '' };

  it('filtra por prioridad, proyecto y vencidas', () => {
    expect(filterTasks(tasks, { ...base, priority: 'alta' }).map((t) => t.id)).toEqual(['2', '4']);
    expect(filterTasks(tasks, { ...base, projectId: 'p1' }).map((t) => t.id)).toEqual(['2']);
    expect(filterTasks(tasks, { ...base, onlyOverdue: true }).map((t) => t.id)).toEqual(['2']);
  });

  it('busca en título, descripción y etiquetas', () => {
    expect(filterTasks(tasks, { ...base, query: 'CAPÍTULO' }).map((t) => t.id)).toEqual(['3']);
    expect(filterTasks(tasks, { ...base, query: 'ofic' }).map((t) => t.id)).toEqual(['1']);
  });
});

describe('sortTasks', () => {
  it('inteligente: vencidas primero, luego por fecha y prioridad; sin fecha al final', () => {
    expect(sortTasks(tasks, 'smart').map((t) => t.id)).toEqual(['2', '4', '1', '3']);
  });

  it('por prioridad y por recientes', () => {
    expect(sortTasks(tasks, 'priority').map((t) => t.id)).toEqual(['2', '4', '1', '3']);
    expect(sortTasks(tasks, 'recent').map((t) => t.id)).toEqual(['2', '3', '1', '4']);
  });

  it('no modifica la lista original', () => {
    const copy = [...tasks];
    sortTasks(tasks, 'smart');
    expect(tasks).toEqual(copy);
  });
});

describe('estados y subtareas', () => {
  it('agrupa siempre las tres columnas', () => {
    const grouped = groupTasksByStatus(tasks);
    expect([...grouped.keys()]).toEqual(['Pendiente', 'Haciendo', 'Hecho']);
    expect(grouped.get('Pendiente')?.map((t) => t.id)).toEqual(['1', '4']);
  });

  it('valida estados conocidos', () => {
    expect(isTaskStatus('Hecho')).toBe(true);
    expect(isTaskStatus('Archivado')).toBe(false);
  });

  it('cuenta subtareas hechas', () => {
    expect(getChecklistProgress([{ done: true }, { done: false }])).toEqual({ done: 1, total: 2 });
    expect(getChecklistProgress([])).toBeNull();
  });
});

describe('rutinas', () => {
  it('convierte horas a minutos', () => {
    expect(timeToMinutes('18:30')).toBe(1110);
    expect(timeToMinutes('7:00')).toBeNull();
  });

  const routines = [
    { id: 'gym', startTime: '18:00', endTime: '19:00', recurringDays: [1, 3, 5] },
    { id: 'clase', startTime: '20:00', endTime: '21:00', recurringDays: [1] },
  ];

  it('detecta choques en días compartidos', () => {
    const overlap = findOverlappingRoutines({ startTime: '18:30', endTime: '19:30', recurringDays: [3] }, routines);
    expect(overlap.map((r) => r.id)).toEqual(['gym']);
  });

  it('no hay choque si los horarios solo se tocan o los días no coinciden', () => {
    expect(findOverlappingRoutines({ startTime: '19:00', endTime: '20:00', recurringDays: [1] }, routines)).toEqual([]);
    expect(findOverlappingRoutines({ startTime: '18:30', endTime: '19:30', recurringDays: [2] }, routines)).toEqual([]);
  });

  it('ignora la propia rutina al editarla', () => {
    expect(findOverlappingRoutines({ id: 'gym', startTime: '18:00', endTime: '19:00', recurringDays: [1] }, routines)).toEqual([]);
  });
});
