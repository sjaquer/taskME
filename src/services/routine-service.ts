'use client';

import {
  collection,
  doc,
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

// ── ROUTINES (Horario semanal) ─────────────────────────────
export function getUserRoutinesRef(firestore: Firestore, userId: string): CollectionReference {
  return collection(firestore, 'users', userId, 'routines');
}

function getRoutineDocRef(firestore: Firestore, userId: string, routineId: string): DocumentReference {
  return doc(firestore, 'users', userId, 'routines', routineId);
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
