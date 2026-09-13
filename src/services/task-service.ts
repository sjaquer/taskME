'use client';

import {
  collection,
  doc,
  query,
  where,
  serverTimestamp,
  Firestore,
  CollectionReference,
  DocumentReference,
} from 'firebase/firestore';
import {
  addDocumentNonBlocking,
  updateDocumentNonBlocking,
  deleteDocumentNonBlocking,
} from '@/firebase/non-blocking-updates';
import type { AppContext, Priority, Task } from '@/types/task';

// ── TASKS (Kanban + Tickets) ───────────────────────────────
// Un ticket es una Task con isTicket: true y context: 'Trabajo'.
function getUserTasksRef(firestore: Firestore, userId: string): CollectionReference {
  return collection(firestore, 'users', userId, 'tasks');
}

function getTaskDocRef(firestore: Firestore, userId: string, taskId: string): DocumentReference {
  return doc(firestore, 'users', userId, 'tasks', taskId);
}

export function buildTasksQuery(firestore: Firestore, userId: string, context: AppContext) {
  // Optimization: Calculate a "Focus Window" (e.g., 30 days)
  // Tasks older than this that are already 'Hecho' are not fetched to save reads.
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  // Note: For complex filtering with multiple 'where', Firestore requires a composite index.
  // If the index doesn't exist, Firebase will throw an error with a link to create it.
  return query(
    getUserTasksRef(firestore, userId),
    where('context', '==', context),
    where('updatedAt', '>=', thirtyDaysAgo)
  );
}

// Los tickets siempre viven en el contexto 'Trabajo'; se filtra en memoria
// sobre el resultado de buildTasksQuery para evitar un índice compuesto extra.
export function buildTicketsQuery(firestore: Firestore, userId: string) {
  return buildTasksQuery(firestore, userId, 'Trabajo');
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

export function completeTask(firestore: Firestore, userId: string, taskId: string) {
  updateTask(firestore, userId, taskId, { status: 'Hecho' });
}

export function filterTickets(tasks: Task[]): Task[] {
  return tasks.filter((task) => task.isTicket);
}
