'use client';

import {
  collection,
  doc,
  getDoc,
  getDocs,
  serverTimestamp,
  writeBatch,
  type Firestore,
} from 'firebase/firestore';
import type { AttachmentMeta } from '@/types/task';
import type { CompressedImage } from '@/lib/images';

// ── ATTACHMENTS (imágenes en base64, un documento por imagen) ──
// La tarea/nota guarda solo AttachmentMeta (con miniatura); la imagen completa
// se descarga al abrirla. Así las listas siguen livianas.

export type AttachmentParentType = 'task' | 'note';

/** Adjunto en un formulario: los nuevos traen la imagen completa (dataUrl). */
export type AttachmentDraft = AttachmentMeta & { dataUrl?: string };

function attachmentsRef(firestore: Firestore, userId: string) {
  return collection(firestore, 'users', userId, 'attachments');
}

/** Borrador listo para el formulario a partir de una imagen comprimida. */
export function draftFromCompressed(firestore: Firestore, userId: string, image: CompressedImage): AttachmentDraft {
  return {
    id: doc(attachmentsRef(firestore, userId)).id,
    name: image.name,
    mime: image.mime,
    size: image.size,
    width: image.width,
    height: image.height,
    thumb: image.thumb,
    dataUrl: image.dataUrl,
  };
}

/** Quita la imagen completa: lo que se guarda en la tarea/nota. */
export function toAttachmentMeta({ dataUrl: _dataUrl, ...meta }: AttachmentDraft): AttachmentMeta {
  return meta;
}

/**
 * Guarda las imágenes nuevas de un formulario y borra las que se quitaron.
 * Devuelve los metadatos para guardar en la tarea/nota.
 */
export async function syncAttachments(
  firestore: Firestore,
  userId: string,
  parent: { type: AttachmentParentType; id: string },
  drafts: AttachmentDraft[],
  previous: AttachmentMeta[] = []
): Promise<AttachmentMeta[]> {
  const batch = writeBatch(firestore);
  const keptIds = new Set(drafts.map((draft) => draft.id));
  let pending = 0;

  drafts.forEach((draft) => {
    if (!draft.dataUrl) return;
    pending += 1;
    batch.set(doc(attachmentsRef(firestore, userId), draft.id), {
      userId,
      parentType: parent.type,
      parentId: parent.id,
      name: draft.name,
      mime: draft.mime,
      size: draft.size,
      width: draft.width,
      height: draft.height,
      data: draft.dataUrl,
      createdAt: serverTimestamp(),
    });
  });
  previous
    .filter((meta) => !keptIds.has(meta.id))
    .forEach((meta) => {
      pending += 1;
      batch.delete(doc(attachmentsRef(firestore, userId), meta.id));
    });

  if (pending > 0) await batch.commit();
  return drafts.map(toAttachmentMeta);
}

/** Imagen completa (data URL) de un adjunto, o null si ya no existe. */
export async function fetchAttachmentData(firestore: Firestore, userId: string, attachmentId: string): Promise<string | null> {
  const snapshot = await getDoc(doc(attachmentsRef(firestore, userId), attachmentId));
  const data = snapshot.data()?.data;
  return typeof data === 'string' ? data : null;
}

export function deleteAttachments(firestore: Firestore, userId: string, attachmentIds: string[]) {
  if (attachmentIds.length === 0) return Promise.resolve();
  const batch = writeBatch(firestore);
  attachmentIds.forEach((id) => batch.delete(doc(attachmentsRef(firestore, userId), id)));
  return batch.commit();
}

// Mientras se puede "Deshacer" un borrado, las imágenes se conservan.
const UNDO_GRACE_MS = 10_000;

/**
 * Borra las imágenes de un elemento eliminado cuando ya no se puede deshacer.
 * Devuelve una función para cancelarlo (al tocar "Deshacer").
 */
export function scheduleAttachmentDeletion(firestore: Firestore, userId: string, attachmentIds: string[]): () => void {
  if (attachmentIds.length === 0) return () => {};
  const timeoutId = setTimeout(() => {
    deleteAttachments(firestore, userId, attachmentIds).catch((error) =>
      console.error('No se pudieron borrar las imágenes adjuntas:', error)
    );
  }, UNDO_GRACE_MS);
  return () => clearTimeout(timeoutId);
}

/**
 * Borra imágenes que ya no pertenecen a ninguna tarea ni nota (p. ej. si se
 * cerró la app justo después de borrar). Ignora las recién creadas.
 */
export async function cleanupOrphanAttachments(firestore: Firestore, userId: string): Promise<number> {
  const [attachments, tasks, notes] = await Promise.all([
    getDocs(attachmentsRef(firestore, userId)),
    getDocs(collection(firestore, 'users', userId, 'tasks')),
    getDocs(collection(firestore, 'users', userId, 'notes')),
  ]);
  const referenced = new Set<string>();
  [...tasks.docs, ...notes.docs].forEach((snapshot) => {
    const metas = snapshot.data().attachments as AttachmentMeta[] | undefined;
    metas?.forEach((meta) => referenced.add(meta.id));
  });
  const recentLimit = Date.now() - 60 * 60 * 1000;
  const orphans = attachments.docs
    .filter((snapshot) => !referenced.has(snapshot.id))
    .filter((snapshot) => {
      const createdAt = snapshot.data().createdAt as { toMillis?: () => number } | undefined;
      return !createdAt?.toMillis || createdAt.toMillis() < recentLimit;
    })
    .map((snapshot) => snapshot.id);
  await deleteAttachments(firestore, userId, orphans);
  return orphans.length;
}
