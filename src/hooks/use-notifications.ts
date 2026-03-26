'use client';

import { useEffect, useRef } from 'react';
import { differenceInMinutes, isToday, parseISO, isAfter, isBefore } from 'date-fns';
import { useCallback } from 'react';
import { NotificationService } from '@/services/notification-service';

interface NotificationTracker {
  taskId?: string;
  eventId?: string;
  routineId?: string;
  sentAt?: number;
}

/**
 * Hook para monitorear tareas, eventos y rutinas próximos
 * Envía notificaciones cuando están a punto de vencer/comenzar
 *
 * @param tasks - Array de tareas del usuario
 * @param events - Array de eventos del usuario
 * @param routines - Array de rutinas del usuario
 * @param enabled - Si el monitoreo está habilitado
 */
export function useNotifications(
  tasks: any[] = [],
  events: any[] = [],
  routines: any[] = [],
  enabled: boolean = true
) {
  const notifiedRef = useRef<NotificationTracker[]>([]);
  const checkIntervalRef = useRef<NodeJS.Timeout | undefined>(undefined);

  // Configurar tiempos para notificaciones (en minutos)
  const NOTIFICATION_TIMES = {
    TASK_15MIN: 15, // Notificar cuando quedan 15 minutos
    TASK_1HOUR: 60,
    EVENT_15MIN: 15,
    EVENT_1HOUR: 60,
    ROUTINE_5MIN: 5, // Notificar 5 min antes de que comience
  };

  /**
   * Obtiene si ya fue notificado hace poco para evitar duplicados
   */
  const wasRecentlyNotified = useCallback((key: string, thresholdMs: number = 60000): boolean => {
    const tracker = notifiedRef.current.find(n =>
      (n.taskId === key || n.eventId === key || n.routineId === key)
    );

    if (!tracker || !tracker.sentAt) return false;

    const timeSinceSent = Date.now() - tracker.sentAt;
    return timeSinceSent < thresholdMs;
  }, []);

  /**
   * Marca como notificado
   */
  const markAsNotified = useCallback((key: string, type: 'task' | 'event' | 'routine') => {
    // Limpiar notificaciones antiguas (más de 24 horas)
    notifiedRef.current = notifiedRef.current.filter(n => {
      if (!n.sentAt) return true;
      return Date.now() - n.sentAt < 24 * 60 * 60 * 1000;
    });

    // Agregar nueva notificación
    const tracker: NotificationTracker = { sentAt: Date.now() };
    if (type === 'task') tracker.taskId = key;
    if (type === 'event') tracker.eventId = key;
    if (type === 'routine') tracker.routineId = key;

    notifiedRef.current.push(tracker);
  }, []);

  /**
   * Revisa tareas próximas a vencer
   */
  const checkUpcomingTasks = useCallback(() => {
    if (!tasks || tasks.length === 0) return;

    tasks.forEach(task => {
      if (!task.dueDate) return;

      try {
        const dueDate = typeof task.dueDate === 'string' ? parseISO(task.dueDate) : new Date(task.dueDate);
        const now = new Date();
        const minutesUntilDue = differenceInMinutes(dueDate, now);

        // Solo notificar si falta entre 1 y 120 minutos y hoy es el vencimiento
        if (minutesUntilDue > 0 && minutesUntilDue <= NOTIFICATION_TIMES.TASK_1HOUR && isToday(dueDate)) {
          if (!wasRecentlyNotified(`task-${task.id}`)) {
            NotificationService.taskDueNotification(task.title, minutesUntilDue);
            markAsNotified(`task-${task.id}`, 'task');
          }
        }
      } catch (error) {
        console.error('Error al procesar tarea para notificación:', error);
      }
    });
  }, [tasks, wasRecentlyNotified, markAsNotified, NOTIFICATION_TIMES.TASK_1HOUR]);

  /**
   * Revisa eventos próximos
   */
  const checkUpcomingEvents = useCallback(() => {
    if (!events || events.length === 0) return;

    events.forEach(event => {
      if (!event.startDate) return;

      try {
        const startDate = typeof event.startDate === 'string' ? parseISO(event.startDate) : new Date(event.startDate);
        const now = new Date();
        const minutesUntilStart = differenceInMinutes(startDate, now);

        // Notificar si falta entre 1 y 120 minutos
        if (minutesUntilStart > 0 && minutesUntilStart <= NOTIFICATION_TIMES.EVENT_1HOUR) {
          if (!wasRecentlyNotified(`event-${event.id}`)) {
            NotificationService.eventUpcomingNotification(event.title, minutesUntilStart);
            markAsNotified(`event-${event.id}`, 'event');
          }
        }
      } catch (error) {
        console.error('Error al procesar evento para notificación:', error);
      }
    });
  }, [events, wasRecentlyNotified, markAsNotified, NOTIFICATION_TIMES.EVENT_1HOUR]);

  /**
   * Revisa rutinas próximas a comenzar
   */
  const checkUpcomingRoutines = useCallback(() => {
    if (!routines || routines.length === 0) return;

    const now = new Date();
    const todayDayOfWeek = now.getDay();

    routines.forEach(routine => {
      if (!routine.startTime || !routine.recurringDays) return;

      // Verificar si la rutina es para hoy
      if (!routine.recurringDays.includes(todayDayOfWeek)) return;

      try {
        const [hours, minutes] = routine.startTime.split(':').map(Number);
        const routineStart = new Date();
        routineStart.setHours(hours, minutes, 0, 0);

        const minutesUntilStart = differenceInMinutes(routineStart, now);

        // Notificar 5 minutos antes de que comience
        if (minutesUntilStart > 0 && minutesUntilStart <= NOTIFICATION_TIMES.ROUTINE_5MIN) {
          if (!wasRecentlyNotified(`routine-${routine.id}`)) {
            NotificationService.routineStartsNotification(routine.title);
            markAsNotified(`routine-${routine.id}`, 'routine');
          }
        }
      } catch (error) {
        console.error('Error al procesar rutina para notificación:', error);
      }
    });
  }, [routines, wasRecentlyNotified, markAsNotified, NOTIFICATION_TIMES.ROUTINE_5MIN]);

  /**
   * Ejecuta todas las verificaciones
   */
  const runAllChecks = useCallback(() => {
    if (!enabled || !NotificationService.isEnabled()) return;

    checkUpcomingTasks();
    checkUpcomingEvents();
    checkUpcomingRoutines();
  }, [enabled, checkUpcomingTasks, checkUpcomingEvents, checkUpcomingRoutines]);

  /**
   * Configura el intervalo de chequeo
   */
  useEffect(() => {
    if (!enabled) {
      if (checkIntervalRef.current) {
        clearInterval(checkIntervalRef.current);
      }
      return;
    }

    // Ejecutar verificación inicial
    runAllChecks();

    // Ejecutar cada minuto
    checkIntervalRef.current = setInterval(runAllChecks, 60 * 1000);

    return () => {
      if (checkIntervalRef.current) {
        clearInterval(checkIntervalRef.current);
      }
    };
  }, [enabled, runAllChecks]);

  /**
   * Re-ejecutar si los datos cambian
   */
  useEffect(() => {
    runAllChecks();
  }, [tasks, events, routines, runAllChecks]);

  /**
   * Solicitar permiso de notificaciones
   */
  const requestNotificationPermission = useCallback(async () => {
    return await NotificationService.requestPermission();
  }, []);

  return {
    isEnabled: NotificationService.isEnabled(),
    requestPermission: requestNotificationPermission,
  };
}
