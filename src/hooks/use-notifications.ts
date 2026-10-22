'use client';

import { useCallback, useEffect } from 'react';
import { differenceInMinutes, format, isToday, isValid, parseISO } from 'date-fns';
import { NotificationService } from '@/services/notification-service';
import type { Routine, Task } from '@/types/task';
import { getDueDateTime } from '@/lib/tasks';

const NOTIFIED_STORAGE_KEY = 'taskme:notified';
const NOTIFIED_TTL_MS = 48 * 60 * 60 * 1000;
const DATE_ONLY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

const NOTIFICATION_TIMES = {
  TASK_MINUTES_BEFORE: 60,
  ROUTINE_MINUTES_BEFORE: 5,
};

// Registro persistente de avisos enviados: evita repetirlos en cada chequeo
// o al reabrir la app el mismo día.
function readNotified(): Record<string, number> {
  try {
    const raw = window.localStorage.getItem(NOTIFIED_STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : {};
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

function markNotified(key: string) {
  const now = Date.now();
  const entries = Object.entries(readNotified()).filter(([, sentAt]) => now - sentAt < NOTIFIED_TTL_MS);
  const next = Object.fromEntries([...entries, [key, now]]);
  try {
    window.localStorage.setItem(NOTIFIED_STORAGE_KEY, JSON.stringify(next));
  } catch (error) {
    console.warn('No se pudo guardar el registro de notificaciones:', error);
  }
}

function wasNotified(key: string) {
  return key in readNotified();
}

/**
 * Monitorea tareas y rutinas y envía notificaciones del navegador:
 * - Tarea con fecha (sin hora): un aviso el día que vence.
 * - Tarea con fecha y hora: un aviso dentro de la hora previa.
 * - Rutina: un aviso 5 minutos antes de empezar, una vez por día.
 */
export function useNotifications(tasks: Task[] = [], routines: Routine[] = [], enabled: boolean = true) {
  const checkUpcomingTasks = useCallback(() => {
    const now = new Date();
    const today = format(now, 'yyyy-MM-dd');

    tasks.forEach((task) => {
      if (!task.dueDate || task.status === 'Hecho') return;

      // Con hora (dueTime) se avisa en la hora previa; sin hora, una vez el día que vence.
      const isDateOnly = !task.dueTime && typeof task.dueDate === 'string' && DATE_ONLY_PATTERN.test(task.dueDate);
      const dueDate = getDueDateTime(task.dueDate, task.dueTime) ?? (typeof task.dueDate === 'string' ? parseISO(task.dueDate) : new Date(task.dueDate));
      if (!isValid(dueDate) || !isToday(dueDate)) return;

      if (isDateOnly) {
        const key = `task-${task.id}-${today}`;
        if (wasNotified(key)) return;
        NotificationService.taskDueTodayNotification(task.id, task.title);
        markNotified(key);
        return;
      }

      const minutesUntilDue = differenceInMinutes(dueDate, now);
      if (minutesUntilDue > 0 && minutesUntilDue <= NOTIFICATION_TIMES.TASK_MINUTES_BEFORE) {
        const key = `task-${task.id}-${dueDate.toISOString()}`;
        if (wasNotified(key)) return;
        NotificationService.taskDueNotification(task.id, task.title, minutesUntilDue);
        markNotified(key);
      }
    });
  }, [tasks]);

  const checkUpcomingRoutines = useCallback(() => {
    const now = new Date();
    const today = format(now, 'yyyy-MM-dd');

    routines.forEach((routine) => {
      if (!routine.startTime || !routine.recurringDays?.includes(now.getDay())) return;

      const [hours, minutes] = routine.startTime.split(':').map(Number);
      if (Number.isNaN(hours) || Number.isNaN(minutes)) return;

      const routineStart = new Date(now);
      routineStart.setHours(hours, minutes, 0, 0);
      const minutesUntilStart = differenceInMinutes(routineStart, now);

      if (minutesUntilStart > 0 && minutesUntilStart <= NOTIFICATION_TIMES.ROUTINE_MINUTES_BEFORE) {
        const key = `routine-${routine.id}-${today}`;
        if (wasNotified(key)) return;
        NotificationService.routineStartsNotification(routine.id, routine.title);
        markNotified(key);
      }
    });
  }, [routines]);

  const runAllChecks = useCallback(() => {
    if (!enabled || !NotificationService.isEnabled()) return;
    checkUpcomingTasks();
    checkUpcomingRoutines();
  }, [enabled, checkUpcomingTasks, checkUpcomingRoutines]);

  // Chequeo inicial, cada vez que cambian los datos y luego cada minuto.
  useEffect(() => {
    if (!enabled) return;
    runAllChecks();
    const intervalId = setInterval(runAllChecks, 60 * 1000);
    return () => clearInterval(intervalId);
  }, [enabled, runAllChecks]);

  const requestPermission = useCallback(() => NotificationService.requestPermission(), []);

  return {
    isEnabled: NotificationService.isEnabled(),
    requestPermission,
  };
}
