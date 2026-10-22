'use client';

import {
  collection,
  doc,
  query,
  where,
  serverTimestamp,
  getDocs,
  writeBatch,
  Firestore,
  CollectionReference,
  DocumentReference,
} from 'firebase/firestore';
import {
  addDocumentNonBlocking,
  updateDocumentNonBlocking,
  deleteDocumentNonBlocking,
} from '@/firebase/non-blocking-updates';
import type { AppContext, Priority } from '@/types/task';
import type { TaskRetentionPeriod } from '@/lib/store';

// ── TASKS (Kanban + Tickets) ───────────────────────────────
// Un ticket es una Task con isTicket: true y context: 'Trabajo'.
export function getUserTasksRef(firestore: Firestore, userId: string): CollectionReference {
  return collection(firestore, 'users', userId, 'tasks');
}

function getTaskDocRef(firestore: Firestore, userId: string, taskId: string): DocumentReference {
  return doc(firestore, 'users', userId, 'tasks', taskId);
}

const RETENTION_DAYS: Record<TaskRetentionPeriod, number> = {
  weekly: 7,
  monthly: 30,
  quarterly: 90,
  yearly: 365,
};

// Borrado manual: elimina las tareas "Hecho" cuya última actualización supera
// el periodo elegido por el usuario. Solo se ejecuta cuando el usuario lo pide.
export async function cleanupCompletedTasks(
  firestore: Firestore,
  userId: string,
  period: TaskRetentionPeriod
): Promise<number> {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - RETENTION_DAYS[period]);

  const snap = await getDocs(
    query(getUserTasksRef(firestore, userId), where('status', '==', 'Hecho'))
  );

  const staleDocs = snap.docs.filter((d) => {
    const updatedAt = d.data().updatedAt;
    const updatedDate = updatedAt?.toDate ? updatedAt.toDate() : null;
    return updatedDate ? updatedDate < cutoff : false;
  });

  if (staleDocs.length === 0) return 0;

  const batch = writeBatch(firestore);
  staleDocs.forEach((d) => batch.delete(d.ref));
  await batch.commit();

  return staleDocs.length;
}

export interface TaskInput {
  title: string;
  description?: string;
  priority: Priority;
  status: string;
  tags?: string[];
  dueDate?: string;
  context: AppContext;
  projectId?: string;
  isTicket?: boolean;
  requestedAction?: string;
  requesterName?: string;
  reviewDate?: string;
  referenceUrl?: string;
}

export function createTask(firestore: Firestore, userId: string, data: TaskInput) {
  const colRef = getUserTasksRef(firestore, userId);
  return addDocumentNonBlocking(colRef, {
    ...data,
    userId,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
}

export function updateTask(
  firestore: Firestore,
  userId: string,
  taskId: string,
  data: Record<string, unknown>
) {
  const docRef = getTaskDocRef(firestore, userId, taskId);
  updateDocumentNonBlocking(docRef, {
    ...data,
    updatedAt: serverTimestamp(),
  });
}

export function deleteTask(firestore: Firestore, userId: string, taskId: string) {
  const docRef = getTaskDocRef(firestore, userId, taskId);
  deleteDocumentNonBlocking(docRef);
}

/** Borra varias tareas en un solo batch (p. ej. "Limpiar Hechos"). */
export function deleteTasks(firestore: Firestore, userId: string, taskIds: string[]) {
  const batch = writeBatch(firestore);
  taskIds.forEach((taskId) => batch.delete(getTaskDocRef(firestore, userId, taskId)));
  return batch.commit();
}

export function completeTask(firestore: Firestore, userId: string, taskId: string) {
  updateTask(firestore, userId, taskId, { status: 'Hecho' });
}
