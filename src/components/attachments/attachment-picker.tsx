'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { ImagePlus, Loader2, X } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { compressImage, formatBytes, ImageProcessingError, type CompressedImage } from '@/lib/images';
import type { AttachmentDraft } from '@/services/attachment-service';
import { cn } from '@/lib/utils';

interface AttachmentPickerProps {
  value: AttachmentDraft[];
  onChange: (images: AttachmentDraft[]) => void;
  /** Crea el borrador (con id) a partir de la imagen comprimida. */
  toDraft: (image: CompressedImage) => AttachmentDraft;
  max: number;
  /** Escuchar "pegar" en toda la página mientras el formulario está abierto. */
  pasteTarget?: 'document' | 'none';
}

function imagesFrom(items: Iterable<{ kind?: string; type: string; getAsFile?: () => File | null }> | FileList): File[] {
  const files: File[] = [];
  for (const item of Array.from(items as ArrayLike<File | DataTransferItem>)) {
    if (item instanceof File) {
      if (item.type.startsWith('image/')) files.push(item);
    } else if (item.kind === 'file' && item.type.startsWith('image/')) {
      const file = item.getAsFile();
      if (file) files.push(file);
    }
  }
  return files;
}

/**
 * Adjuntar imágenes: botón (archivo o cámara), arrastrar y soltar, o pegar
 * (Ctrl+V / "Pegar" en el teléfono). Cada imagen se comprime automáticamente.
 */
export function AttachmentPicker({ value, onChange, toDraft, max, pasteTarget = 'document' }: AttachmentPickerProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [processing, setProcessing] = useState(0);
  const [dragging, setDragging] = useState(false);
  // Último valor, para agregar imágenes que terminan de comprimirse en distinto orden.
  const valueRef = useRef(value);
  valueRef.current = value;

  const addFiles = useCallback(
    async (files: File[]) => {
      if (files.length === 0) return;
      const room = max - valueRef.current.length;
      if (room <= 0) {
        toast({ variant: 'warning', title: 'Límite de imágenes', description: `Puedes adjuntar hasta ${max}.` });
        return;
      }
      const accepted = files.slice(0, room);
      if (files.length > room) {
        toast({ variant: 'warning', title: 'Límite de imágenes', description: `Solo se agregaron ${room}; el máximo es ${max}.` });
      }
      setProcessing((count) => count + accepted.length);
      for (const file of accepted) {
        try {
          const compressed = await compressImage(file);
          onChange([...valueRef.current, toDraft(compressed)]);
          if (file.size > compressed.size * 1.5) {
            toast({
              variant: 'success',
              title: 'Imagen optimizada',
              description: `${formatBytes(file.size)} → ${formatBytes(compressed.size)}`,
            });
          }
        } catch (error) {
          console.error('Error al comprimir la imagen:', error);
          toast({
            variant: 'destructive',
            title: 'No se pudo adjuntar',
            description: error instanceof ImageProcessingError ? error.message : 'No se pudo procesar la imagen.',
          });
        } finally {
          setProcessing((count) => count - 1);
        }
      }
    },
    [max, onChange, toDraft]
  );

  useEffect(() => {
    if (pasteTarget !== 'document') return;
    const handlePaste = (event: ClipboardEvent) => {
      const files = event.clipboardData ? imagesFrom(event.clipboardData.items) : [];
      if (files.length === 0) return; // pegar texto sigue funcionando normal
      event.preventDefault();
      addFiles(files);
    };
    document.addEventListener('paste', handlePaste);
    return () => document.removeEventListener('paste', handlePaste);
  }, [addFiles, pasteTarget]);

  const remove = (id: string) => onChange(value.filter((image) => image.id !== id));
  const canAdd = value.length + processing < max;

  return (
    <div
      onDragOver={(event) => {
        event.preventDefault();
        setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={(event) => {
        event.preventDefault();
        setDragging(false);
        addFiles(imagesFrom(event.dataTransfer.files));
      }}
      className={cn('space-y-2 rounded-2xl border border-dashed p-2 transition-colors', dragging ? 'border-primary bg-primary/5' : 'border-border')}
    >
      {(value.length > 0 || processing > 0) && (
        <ul className="grid grid-cols-3 gap-2 sm:grid-cols-4">
          {value.map((image) => (
            <li key={image.id} className="relative overflow-hidden rounded-xl border border-border bg-muted/20">
              {/* eslint-disable-next-line @next/next/no-img-element -- data URL local, next/image no aplica */}
              <img src={image.thumb} alt={image.name} className="aspect-square w-full object-cover" />
              <span className="absolute bottom-0 left-0 right-0 bg-black/60 px-1 py-0.5 text-center text-[10px] text-white">
                {formatBytes(image.size)}
              </span>
              <button
                type="button"
                onClick={() => remove(image.id)}
                aria-label={`Quitar ${image.name}`}
                className="absolute right-1 top-1 flex h-6 w-6 items-center justify-center rounded-full bg-black/70 text-white hover:bg-red-500"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </li>
          ))}
          {Array.from({ length: processing }, (_, index) => (
            <li key={`processing-${index}`} className="flex aspect-square items-center justify-center rounded-xl border border-border bg-muted/20">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              <span className="sr-only">Optimizando imagen…</span>
            </li>
          ))}
        </ul>
      )}

      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={!canAdd}
        className="flex w-full items-center justify-center gap-2 rounded-xl py-2.5 text-xs font-semibold text-muted-foreground transition-colors hover:bg-muted/30 hover:text-foreground disabled:opacity-40"
      >
        <ImagePlus className="h-4 w-4" />
        {canAdd ? `Agregar imagen (o pegar) · ${value.length}/${max}` : `Máximo ${max} imágenes`}
      </button>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        multiple
        aria-label="Seleccionar imágenes"
        className="hidden"
        onChange={(event) => {
          addFiles(imagesFrom(event.target.files ?? []));
          event.target.value = '';
        }}
      />
    </div>
  );
}
