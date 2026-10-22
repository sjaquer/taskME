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
  setDocumentNonBlocking,
  updateDocumentNonBlocking,
  deleteDocumentNonBlocking,
} from '@/firebase/non-blocking-updates';
import type { AppContext, AttachmentMeta, NoteCategory } from '@/types/task';

// ── NOTES (recordatorios y apuntes libres) ─────────────────
export function getUserNotesRef(firestore: Firestore, userId: string): CollectionReference {
  return collection(firestore, 'users', userId, 'notes');
}

function getNoteDocRef(firestore: Firestore, userId: string, noteId: string): DocumentReference {
  return doc(firestore, 'users', userId, 'notes', noteId);
}

/** Id para una nota nueva (sirve para enlazarle imágenes antes de crearla). */
export function newNoteId(firestore: Firestore, userId: string): string {
  return doc(getUserNotesRef(firestore, userId)).id;
}

export function createNote(
  firestore: Firestore,
  userId: string,
  data: {
    title: string;
    content: string;
    category: NoteCategory;
    context: AppContext;
    attachments?: AttachmentMeta[];
  },
  noteId?: string
) {
  const payload = { ...data, userId, createdAt: serverTimestamp(), updatedAt: serverTimestamp() };
  if (noteId) {
    setDocumentNonBlocking(getNoteDocRef(firestore, userId, noteId), payload, {});
    return;
  }
  return addDocumentNonBlocking(getUserNotesRef(firestore, userId), payload);
}

export function updateNote(
  firestore: Firestore,
  userId: string,
  noteId: string,
  data: Partial<{ title: string; content: string; category: NoteCategory; pinned: boolean; attachments: AttachmentMeta[] }>
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
