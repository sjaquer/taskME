'use client';

import { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useUser, useFirestore } from '@/firebase';
import { useNotifications } from '@/hooks/use-notifications';
import { NotificationService } from '@/services/notification-service';
import {
  markNotificationAsOpened,
  registerMobileLogEvent,
  registerNativeAndroidDevice,
} from '@/services/mobile-integration-service';
import { useRoutines, useTasks } from '@/firebase/user-data';

/**
 * Componente que monitorea tareas, eventos y rutinas próximos
 * Se encarga de initializar el sistema de notificaciones globalmente
 */
export function NotificationMonitor() {
  const { user } = useUser();
  const firestore = useFirestore();
  const searchParams = useSearchParams();
  // Todas las tareas y rutinas (de cualquier contexto), compartidas con las páginas.
  const { data: tasks } = useTasks();
  const { data: routines } = useRoutines();
  const [notificationsEnabled, setNotificationsEnabled] = useState(NotificationService.isEnabled());
  const nativeRegistrationRef = useRef<string | null>(null);
  const openedNotificationRef = useRef<string | null>(null);
  const appOpenLoggedRef = useRef<string | null>(null);

  // Inicializar el hook de notificaciones
  useNotifications(
    tasks,
    routines,
    notificationsEnabled
  );

  useEffect(() => {
    setNotificationsEnabled(NotificationService.isEnabled());
  }, []);

  useEffect(() => {
    if (!user) return;
    if (appOpenLoggedRef.current === user.uid) return;

    appOpenLoggedRef.current = user.uid;
    registerMobileLogEvent(user, {
      name: 'web_session_open',
      source: 'web',
      level: 'info',
      data: {
        hasBrowserNotifications: NotificationService.isEnabled(),
      },
    }).catch(() => {
      // No romper el flujo principal por telemetria fallida.
    });
  }, [user]);

  useEffect(() => {
    if (!user) return;
    if (nativeRegistrationRef.current === user.uid) return;

    nativeRegistrationRef.current = user.uid;

    registerNativeAndroidDevice(user).then((result) => {
      registerMobileLogEvent(user, {
        name: result.ok ? 'mobile_bridge_ready' : 'mobile_bridge_unavailable',
        source: 'web',
        level: result.ok ? 'info' : 'warn',
        data: {
          reason: result.ok ? null : result.reason,
        },
      }).catch(() => {
        // No bloquear UX por errores de telemetria.
      });
    });
  }, [user]);

  useEffect(() => {
    if (!user) return;

    const notificationId = searchParams.get('notificationId');
    if (!notificationId) return;
    if (openedNotificationRef.current === notificationId) return;

    openedNotificationRef.current = notificationId;
    markNotificationAsOpened(user, notificationId).catch(() => {
      // La UI no debe romperse si falla la confirmacion de apertura.
    });
  }, [searchParams, user]);

  if (!user || !firestore) {
    return null;
  }

  return null;
}
