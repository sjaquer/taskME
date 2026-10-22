'use client';

import { collection, doc, serverTimestamp, writeBatch, Firestore, CollectionReference } from 'firebase/firestore';
import { addDocumentNonBlocking, deleteDocumentNonBlocking, setDocumentNonBlocking } from '@/firebase/non-blocking-updates';
import type { ContextDef } from '@/types/task';

// ── CONTEXTS (Trabajo, Estudio y los que cree el usuario) ──
export function getUserContextsRef(firestore: Firestore, userId: string): CollectionReference {
  return collection(firestore, 'users', userId, 'contexts');
}

type ContextFields = Pick<ContextDef, 'name' | 'color' | 'icon' | 'order'>;

/**
 * Los contextos por defecto existen solo en memoria hasta que el usuario edita
 * o crea alguno; en ese momento se guardan para que la lista quede completa.
 */
export function persistContexts(firestore: Firestore, userId: string, contexts: ContextDef[]) {
  const batch = writeBatch(firestore);
  contexts.forEach(({ id, name, color, icon, order }) => {
    batch.set(doc(firestore, 'users', userId, 'contexts', id), {
      userId,
      name,
      color,
      icon,
      order,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  });
  return batch.commit();
}

export function createContext(firestore: Firestore, userId: string, data: ContextFields) {
  return addDocumentNonBlocking(getUserContextsRef(firestore, userId), {
    ...data,
    userId,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
}

export function updateContext(firestore: Firestore, userId: string, contextId: string, data: Partial<ContextFields>) {
  setDocumentNonBlocking(
    doc(firestore, 'users', userId, 'contexts', contextId),
    // userId siempre: si el documento aún no existe, el merge lo crea y las reglas lo exigen.
    { ...data, userId, updatedAt: serverTimestamp() },
    { merge: true }
  );
}

export function deleteContext(firestore: Firestore, userId: string, contextId: string) {
  deleteDocumentNonBlocking(doc(firestore, 'users', userId, 'contexts', contextId));
}
