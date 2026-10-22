'use client';

import { useCallback, useState } from 'react';
import { useFirestore, useUser } from '@/firebase/provider';
import { fetchAttachmentData } from '@/services/attachment-service';
import { ImageViewer } from '@/components/attachments/image-viewer';
import { cn } from '@/lib/utils';
import type { AttachmentMeta } from '@/types/task';

/** Miniaturas de los adjuntos; al tocar una se abre el visor con descarga. */
export function AttachmentGallery({ attachments, className }: { attachments: AttachmentMeta[]; className?: string }) {
  const firestore = useFirestore();
  const { user } = useUser();
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  const loadImage = useCallback(
    (id: string) => (user ? fetchAttachmentData(firestore, user.uid, id) : Promise.resolve(null)),
    [firestore, user]
  );

  if (attachments.length === 0) return null;

  return (
    <>
      <ul className={cn('flex flex-wrap gap-2', className)}>
        {attachments.map((attachment, index) => (
          <li key={attachment.id}>
            <button
              type="button"
              onClick={() => setOpenIndex(index)}
              aria-label={`Ver imagen ${attachment.name}`}
              className="block h-16 w-16 overflow-hidden rounded-xl border border-border bg-muted/20 transition-opacity hover:opacity-80"
            >
              {/* eslint-disable-next-line @next/next/no-img-element -- miniatura en data URL */}
              <img src={attachment.thumb} alt="" className="h-full w-full object-cover" />
            </button>
          </li>
        ))}
      </ul>
      {openIndex !== null && (
        <ImageViewer images={attachments} startIndex={openIndex} loadImage={loadImage} onClose={() => setOpenIndex(null)} />
      )}
    </>
  );
}
