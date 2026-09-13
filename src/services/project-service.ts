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
import type { AppContext } from '@/types/task';

// ── PROJECTS (agrupación de tareas y tickets) ──────────────
function getUserProjectsRef(firestore: Firestore, userId: string): CollectionReference {
  return collection(firestore, 'users', userId, 'projects');
}

function getProjectDocRef(firestore: Firestore, userId: string, projectId: string): DocumentReference {
  return doc(firestore, 'users', userId, 'projects', projectId);
}

export function buildProjectsQuery(firestore: Firestore, userId: string, context: AppContext) {
  return query(
    getUserProjectsRef(firestore, userId),
    where('context', '==', context)
  );
}

export function createProject(
  firestore: Firestore,
  userId: string,
  data: {
    name: string;
    category: string;
    color: string;
    context: AppContext;
  }
) {
  const colRef = getUserProjectsRef(firestore, userId);
  return addDocumentNonBlocking(colRef, {
    ...data,
    archived: false,
    userId,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
}

export function updateProject(
  firestore: Firestore,
  userId: string,
  projectId: string,
  data: Record<string, unknown>
) {
  const docRef = getProjectDocRef(firestore, userId, projectId);
  updateDocumentNonBlocking(docRef, {
    ...data,
    updatedAt: serverTimestamp(),
  });
}

export function archiveProject(firestore: Firestore, userId: string, projectId: string) {
  updateProject(firestore, userId, projectId, { archived: true });
}

export function deleteProject(firestore: Firestore, userId: string, projectId: string) {
  const docRef = getProjectDocRef(firestore, userId, projectId);
  deleteDocumentNonBlocking(docRef);
}
