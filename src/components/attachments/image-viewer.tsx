'use client';

import { useEffect, useState } from 'react';
import { ChevronLeft, ChevronRight, Download, Loader2, Share2, X } from 'lucide-react';
import { useBackDismiss } from '@/hooks/use-back-dismiss';
import { toast } from '@/hooks/use-toast';
import { dataUrlToBlob, formatBytes } from '@/lib/images';
import type { AttachmentMeta } from '@/types/task';

// Imágenes ya descargadas en esta sesión (para no volver a pedirlas).
const imageCache = new Map<string, string>();

interface ImageViewerProps {
  images: AttachmentMeta[];
  startIndex: number;
  /** Devuelve la imagen completa (data URL) o null si ya no existe. */
  loadImage: (id: string) => Promise<string | null>;
  onClose: () => void;
}

/** Visor a pantalla completa con descarga y compartir. El botón atrás lo cierra. */
export function ImageViewer({ images, startIndex, loadImage, onClose }: ImageViewerProps) {
  const [index, setIndex] = useState(startIndex);
  const [src, setSrc] = useState<string | null>(null);
  const [error, setError] = useState(false);
  const image = images[index];
  useBackDismiss(true, onClose);

  useEffect(() => {
    let cancelled = false;
    setError(false);
    const cached = imageCache.get(image.id);
    // Mientras carga se muestra la miniatura.
    setSrc(cached ?? image.thumb);
    if (cached) return;
    loadImage(image.id)
      .then((data) => {
        if (cancelled) return;
        if (!data) {
          setError(true);
          return;
        }
        imageCache.set(image.id, data);
        setSrc(data);
      })
      .catch((err) => {
        console.error('No se pudo cargar la imagen:', err);
        if (!cancelled) setError(true);
      });
    return () => {
      cancelled = true;
    };
  }, [image, loadImage]);

  useEffect(() => {
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
      if (event.key === 'ArrowRight') setIndex((i) => Math.min(images.length - 1, i + 1));
      if (event.key === 'ArrowLeft') setIndex((i) => Math.max(0, i - 1));
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [images.length, onClose]);

  const fullImage = imageCache.get(image.id);

  const download = () => {
    if (!fullImage) return;
    const url = URL.createObjectURL(dataUrlToBlob(fullImage));
    const link = document.createElement('a');
    link.href = url;
    link.download = image.name;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const share = async () => {
    if (!fullImage) return;
    const file = new File([dataUrlToBlob(fullImage)], image.name, { type: image.mime });
    try {
      if (typeof navigator.canShare === 'function' && navigator.canShare({ files: [file] })) {
        await navigator.share({ files: [file], title: image.name });
      } else {
        download();
      }
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') return;
      console.warn('No se pudo compartir la imagen:', err);
      toast({ variant: 'warning', title: 'No se pudo compartir', description: 'Prueba con "Descargar".' });
    }
  };

  return (
    <div role="dialog" aria-modal="true" aria-label={image.name} className="fixed inset-0 z-[100] flex flex-col bg-black/95 text-white">
      <div className="flex items-center gap-2 px-3 pb-2 pt-[calc(0.75rem+env(safe-area-inset-top))]">
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold">{image.name}</p>
          <p className="text-[11px] text-white/60">
            {image.width}×{image.height} · {formatBytes(image.size)}
            {images.length > 1 && ` · ${index + 1}/${images.length}`}
          </p>
        </div>
        <button type="button" onClick={share} disabled={!fullImage} aria-label="Compartir imagen" className="flex h-10 w-10 items-center justify-center rounded-xl hover:bg-white/10 disabled:opacity-40">
          <Share2 className="h-5 w-5" />
        </button>
        <button type="button" onClick={download} disabled={!fullImage} aria-label="Descargar imagen" className="flex h-10 w-10 items-center justify-center rounded-xl hover:bg-white/10 disabled:opacity-40">
          <Download className="h-5 w-5" />
        </button>
        <button type="button" onClick={onClose} aria-label="Cerrar visor" className="flex h-10 w-10 items-center justify-center rounded-xl hover:bg-white/10">
          <X className="h-5 w-5" />
        </button>
      </div>

      <div className="relative flex flex-1 items-center justify-center overflow-hidden px-2 pb-[env(safe-area-inset-bottom)]">
        {error ? (
          <p className="text-sm text-white/70">La imagen ya no está disponible.</p>
        ) : (
          src && (
            // eslint-disable-next-line @next/next/no-img-element -- data URL local, next/image no aplica
            <img src={src} alt={image.name} className="max-h-full max-w-full object-contain" />
          )
        )}
        {!fullImage && !error && <Loader2 className="absolute h-8 w-8 animate-spin text-white/70" aria-label="Cargando imagen" />}
        {index > 0 && (
          <button type="button" onClick={() => setIndex(index - 1)} aria-label="Imagen anterior" className="absolute left-2 flex h-11 w-11 items-center justify-center rounded-full bg-black/50 hover:bg-black/70">
            <ChevronLeft className="h-6 w-6" />
          </button>
        )}
        {index < images.length - 1 && (
          <button type="button" onClick={() => setIndex(index + 1)} aria-label="Imagen siguiente" className="absolute right-2 flex h-11 w-11 items-center justify-center rounded-full bg-black/50 hover:bg-black/70">
            <ChevronRight className="h-6 w-6" />
          </button>
        )}
      </div>
    </div>
  );
}
