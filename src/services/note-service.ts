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
import type { AppContext, NoteCategory } from '@/types/task';

// ── NOTES (recordatorios y apuntes libres) ─────────────────
function getUserNotesRef(firestore: Firestore, userId: string): CollectionReference {
  return collection(firestore, 'users', userId, 'notes');
}

function getNoteDocRef(firestore: Firestore, userId: string, noteId: string): DocumentReference {
  return doc(firestore, 'users', userId, 'notes', noteId);
}

export function buildNotesQuery(firestore: Firestore, userId: string, context: AppContext) {
  return query(
    getUserNotesRef(firestore, userId),
    where('context', '==', context)
  );
}

export function createNote(
  firestore: Firestore,
  userId: string,
  data: {
    title: string;
    content: string;
    category: NoteCategory;
    context: AppContext;
  }
) {
  const colRef = getUserNotesRef(firestore, userId);
  return addDocumentNonBlocking(colRef, {
    ...data,
    userId,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
}

export function updateNote(
  firestore: Firestore,
  userId: string,
  noteId: string,
  data: Record<string, unknown>
) {
  const docRef = getNoteDocRef(firestore, userId, noteId);
  updateDocumentNonBlocking(docRef, {
    ...data,
    updatedAt: serverTimestamp(),
  });
}

export function deleteNote(firestore: Firestore, userId: string, noteId: string) {
  const docRef = getNoteDocRef(firestore, userId, noteId);
  deleteDocumentNonBlocking(docRef);
}
