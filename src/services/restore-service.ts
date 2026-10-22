'use client';

import { doc, serverTimestamp, Timestamp, writeBatch, Firestore } from 'firebase/firestore';
import { setDocumentNonBlocking } from '@/firebase/non-blocking-updates';

// Colecciones de usuario que se pueden restaurar con "Deshacer" tras un borrado.
export type RestorableCollection = 'tasks' | 'notes' | 'routines';

type StoredItem = { id: string; createdAt?: unknown };

// Los datos pueden venir del caché en localStorage, donde los Timestamp quedan
// serializados como objetos planos que firestore.rules rechaza.
function toRestorableData(item: StoredItem): Record<string, unknown> {
  const { id: _id, createdAt, ...data } = item as StoredItem & Record<string, unknown>;
  return {
    ...data,
    createdAt: createdAt instanceof Timestamp ? createdAt : serverTimestamp(),
    updatedAt: serverTimestamp(),
  };
}

/** Vuelve a crear un documento borrado, con el mismo id. */
export function restoreUserDocument(
  firestore: Firestore,
  userId: string,
  collectionName: RestorableCollection,
  item: StoredItem
) {
  const docRef = doc(firestore, 'users', userId, collectionName, item.id);
  setDocumentNonBlocking(docRef, toRestorableData(item), {});
}

/** Restaura varios documentos en un solo batch. */
export function restoreUserDocuments(
  firestore: Firestore,
  userId: string,
  collectionName: RestorableCollection,
  items: StoredItem[]
) {
  const batch = writeBatch(firestore);
  items.forEach((item) => {
    batch.set(doc(firestore, 'users', userId, collectionName, item.id), toRestorableData(item));
  });
  return batch.commit();
}
