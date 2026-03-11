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
import type { Task, Priority, AppContext, RecurrenceType } from '@/types/task';

function getUserTasksRef(firestore: Firestore, userId: string): CollectionReference {
  return collection(firestore, 'users', userId, 'tasks');
}

function getTaskDocRef(firestore: Firestore, userId: string, taskId: string): DocumentReference {
  return doc(firestore, 'users', userId, 'tasks', taskId);
}

export function buildTasksQuery(firestore: Firestore, userId: string, context: AppContext) {
  return query(
    getUserTasksRef(firestore, userId),
    where('context', '==', context)
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
    context: AppContext;
    dueDate?: string;
    location?: string;
    category?: string;
    recurrenceType?: RecurrenceType;
    isRecurring?: boolean;
    recurringDays?: number[];
    scheduledStartTime?: string;
    scheduledEndTime?: string;
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

export function moveTaskToStatus(
  firestore: Firestore,
  userId: string,
  taskId: string,
  newStatus: string
) {
  updateTask(firestore, userId, taskId, { status: newStatus });
}
