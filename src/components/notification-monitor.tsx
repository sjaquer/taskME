'use client';

import { useEffect, useState } from 'react';
import { useUser, useFirestore } from '@/firebase';
import { useNotifications } from '@/hooks/use-notifications';
import { NotificationSetup } from '@/components/notification-setup';
import {
  collection,
  query,
  where,
  onSnapshot,
  Firestore,
} from 'firebase/firestore';

/**
 * Componente que monitorea tareas, eventos y rutinas próximos
 * Se encarga de initializar el sistema de notificaciones globalmente
 */
export function NotificationMonitor() {
  const { user } = useUser();
  const firestore = useFirestore();
  const [tasks, setTasks] = useState<any[]>([]);
  const [events, setEvents] = useState<any[]>([]);
  const [routines, setRoutines] = useState<any[]>([]);
  const [notificationsEnabled, setNotificationsEnabled] = useState(false);

  // Inicializar el hook de notificaciones
  const { isEnabled } = useNotifications(
    tasks,
    events,
    routines,
    notificationsEnabled
  );

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

  return (
    <div className="hidden">
      <NotificationSetup onPermissionChanged={setNotificationsEnabled} />
    </div>
  );
}
