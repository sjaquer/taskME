'use client';

import {
  collection,
  doc,
  query,
  where,
  serverTimestamp,
  deleteField,
  getDocs,
  writeBatch,
  Firestore,
  CollectionReference,
  DocumentReference,
} from 'firebase/firestore';
import {
  addDocumentNonBlocking,
  setDocumentNonBlocking,
  updateDocumentNonBlocking,
  deleteDocumentNonBlocking,
} from '@/firebase/non-blocking-updates';
import type { AppContext, AttachmentMeta, ChecklistItem, Priority, Recurrence, Task, TaskStatus } from '@/types/task';
import { getNextDueDate } from '@/lib/tasks';
import type { TaskRetentionPeriod } from '@/lib/store';

// ── TASKS (Kanban + Tickets) ───────────────────────────────
// Un ticket es una Task con isTicket: true, en el contexto elegido para tickets.
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
  status: TaskStatus;
  tags?: string[];
  dueDate?: string;
  dueTime?: string;
  checklist?: ChecklistItem[];
  recurrence?: Recurrence;
  attachments?: AttachmentMeta[];
  context: AppContext;
  projectId?: string;
  isTicket?: boolean;
  requestedAction?: string;
  requesterName?: string;
  reviewDate?: string;
  referenceUrl?: string;
}

/** Id para una tarea nueva (sirve para enlazarle imágenes antes de crearla). */
export function newTaskId(firestore: Firestore, userId: string): string {
  return doc(getUserTasksRef(firestore, userId)).id;
}

export function createTask(firestore: Firestore, userId: string, data: TaskInput, taskId?: string) {
  const payload = {
    ...data,
    userId,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };
  if (taskId) {
    setDocumentNonBlocking(getTaskDocRef(firestore, userId, taskId), payload, {});
    return Promise.resolve(getTaskDocRef(firestore, userId, taskId));
  }
  return addDocumentNonBlocking(getUserTasksRef(firestore, userId), payload);
}

/** Campos opcionales que se pueden quitar al editar (fecha, hora, proyecto…). */
export type ClearableTaskField = 'dueDate' | 'dueTime' | 'recurrence' | 'projectId';

/**
 * Actualiza una tarea. updateDoc solo agrega/modifica campos: los opcionales que
 * el usuario vació deben listarse en `clear` para eliminarlos del documento.
 */
export function updateTask(
  firestore: Firestore,
  userId: string,
  taskId: string,
  data: Partial<TaskInput>,
  clear: ClearableTaskField[] = []
) {
  const docRef = getTaskDocRef(firestore, userId, taskId);
  updateDocumentNonBlocking(docRef, {
    ...data,
    ...Object.fromEntries(clear.map((field) => [field, deleteField()])),
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


/**
 * Cambia el estado de una tarea. Si se completa una tarea recurrente, crea la
 * siguiente ocurrencia (pendiente, con subtareas desmarcadas) y devuelve su fecha.
 */
export function setTaskStatus(firestore: Firestore, userId: string, task: Task, status: TaskStatus): string | null {
  updateTask(firestore, userId, task.id, { status });

  const dueDate = typeof task.dueDate === 'string' ? task.dueDate : undefined;
  if (status !== 'Hecho' || task.status === 'Hecho' || !task.recurrence || !dueDate) return null;

  const nextDueDate = getNextDueDate(dueDate, task.recurrence);
  createTask(firestore, userId, {
    title: task.title,
    description: task.description,
    priority: task.priority,
    status: 'Pendiente',
    tags: task.tags,
    dueDate: nextDueDate,
    dueTime: task.dueTime,
    checklist: task.checklist?.map((item) => ({ ...item, done: false })),
    recurrence: task.recurrence,
    context: task.context,
    projectId: task.projectId,
  });
  return nextDueDate;
}
