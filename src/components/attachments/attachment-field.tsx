'use client';

import { useCallback } from 'react';
import { useFirestore, useUser } from '@/firebase/provider';
import { AttachmentPicker } from '@/components/attachments/attachment-picker';
import { MAX_ATTACHMENTS, type CompressedImage } from '@/lib/images';
import { draftFromCompressed, type AttachmentDraft } from '@/services/attachment-service';

/** Campo "Imágenes" de los formularios de tareas, notas y tickets (con sesión). */
export function AttachmentField({
  value,
  onChange,
  max = MAX_ATTACHMENTS,
}: {
  value: AttachmentDraft[];
  onChange: (attachments: AttachmentDraft[]) => void;
  max?: number;
}) {
  const firestore = useFirestore();
  const { user } = useUser();
  const toDraft = useCallback(
    (image: CompressedImage) => draftFromCompressed(firestore, user?.uid ?? 'sin-sesion', image),
    [firestore, user]
  );
  return <AttachmentPicker value={value} onChange={onChange} toDraft={toDraft} max={max} />;
}
