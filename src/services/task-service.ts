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
import type { Priority, AppContext } from '@/types/task';

// ── TASKS (Kanban) ─────────────────────────────────────────
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

export function createTask(
  firestore: Firestore,
  userId: string,
  data: {
    title: string;
    description?: string;
    priority: Priority;
    status: string;
    tags?: string[];
    dueDate?: string;
    context: AppContext;
  }
) {
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

// ── ROUTINES (Horario semanal) ─────────────────────────────
function getUserRoutinesRef(firestore: Firestore, userId: string): CollectionReference {
  return collection(firestore, 'users', userId, 'routines');
}

function getRoutineDocRef(firestore: Firestore, userId: string, routineId: string): DocumentReference {
  return doc(firestore, 'users', userId, 'routines', routineId);
}

export function buildRoutinesQuery(firestore: Firestore, userId: string, context: AppContext) {
  return query(
    getUserRoutinesRef(firestore, userId),
    where('context', '==', context)
  );
}

export function createRoutine(
  firestore: Firestore,
  userId: string,
  data: {
    title: string;
    startTime: string;
    endTime: string;
    recurringDays: number[];
    priority: Priority;
    context: AppContext;
    color?: string;
  }
) {
  const colRef = getUserRoutinesRef(firestore, userId);
  return addDocumentNonBlocking(colRef, {
    ...data,
    userId,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
}

export function updateRoutine(
  firestore: Firestore,
  userId: string,
  routineId: string,
  data: Record<string, unknown>
) {
  const docRef = getRoutineDocRef(firestore, userId, routineId);
  updateDocumentNonBlocking(docRef, {
    ...data,
    updatedAt: serverTimestamp(),
  });
}

export function deleteRoutine(firestore: Firestore, userId: string, routineId: string) {
  const docRef = getRoutineDocRef(firestore, userId, routineId);
  deleteDocumentNonBlocking(docRef);
}

// ── EVENTS (Calendario de eventos puntuales) ───────────────
function getUserEventsRef(firestore: Firestore, userId: string): CollectionReference {
  return collection(firestore, 'users', userId, 'events');
}

function getEventDocRef(firestore: Firestore, userId: string, eventId: string): DocumentReference {
  return doc(firestore, 'users', userId, 'events', eventId);
}

export function buildEventsQuery(firestore: Firestore, userId: string, context: AppContext) {
  return query(
    getUserEventsRef(firestore, userId),
    where('context', '==', context)
  );
}

export function createEvent(
  firestore: Firestore,
  userId: string,
  data: {
    title: string;
    description?: string;
    startDate: string;
    endDate: string;
    allDay: boolean;
    location?: string;
    color: string;
    context: AppContext;
  }
) {
  const colRef = getUserEventsRef(firestore, userId);
  return addDocumentNonBlocking(colRef, {
    ...data,
    userId,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
}

export function updateEvent(
  firestore: Firestore,
  userId: string,
  eventId: string,
  data: Record<string, unknown>
) {
  const docRef = getEventDocRef(firestore, userId, eventId);
  updateDocumentNonBlocking(docRef, {
    ...data,
    updatedAt: serverTimestamp(),
  });
}

export function deleteEvent(firestore: Firestore, userId: string, eventId: string) {
  const docRef = getEventDocRef(firestore, userId, eventId);
  deleteDocumentNonBlocking(docRef);
}
