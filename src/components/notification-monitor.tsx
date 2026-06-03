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
import {
  collection,
  onSnapshot,
} from 'firebase/firestore';

/**
 * Componente que monitorea tareas, eventos y rutinas próximos
 * Se encarga de initializar el sistema de notificaciones globalmente
 */
export function NotificationMonitor() {
  const { user } = useUser();
  const firestore = useFirestore();
  const searchParams = useSearchParams();
  const [tasks, setTasks] = useState<any[]>([]);
  const [events, setEvents] = useState<any[]>([]);
  const [routines, setRoutines] = useState<any[]>([]);
  const [notificationsEnabled, setNotificationsEnabled] = useState(NotificationService.isEnabled());
  const nativeRegistrationRef = useRef<string | null>(null);
  const openedNotificationRef = useRef<string | null>(null);
  const appOpenLoggedRef = useRef<string | null>(null);

  // Inicializar el hook de notificaciones
  const { isEnabled } = useNotifications(
    tasks,
    events,
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

  // Cargar tareas en tiempo real
  useEffect(() => {
    if (!user || !firestore) return;

    const userTasksRef = collection(firestore, 'users', user.uid, 'tasks');
    const unsubscribe = onSnapshot(userTasksRef, (snapshot) => {
      const tasksList = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
      }));
      setTasks(tasksList);
    });

    return () => unsubscribe();
  }, [user, firestore]);

  // Cargar eventos en tiempo real
  useEffect(() => {
    if (!user || !firestore) return;

    const userEventsRef = collection(firestore, 'users', user.uid, 'events');
    const unsubscribe = onSnapshot(userEventsRef, (snapshot) => {
      const eventsList = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
      }));
      setEvents(eventsList);
    });

    return () => unsubscribe();
  }, [user, firestore]);

  // Cargar rutinas en tiempo real
  useEffect(() => {
    if (!user || !firestore) return;

    const userRoutinesRef = collection(firestore, 'users', user.uid, 'routines');
    const unsubscribe = onSnapshot(userRoutinesRef, (snapshot) => {
      const routinesList = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
      }));
      setRoutines(routinesList);
    });

    return () => unsubscribe();
  }, [user, firestore]);

  if (!user || !firestore) {
    return null;
  }

  return null;
}
