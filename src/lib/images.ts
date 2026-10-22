// Compresión de imágenes en el cliente para guardarlas como base64 en Firestore.
// Firestore admite documentos de hasta 1 MiB: cada imagen se guarda sola en un
// documento y comprimida bastante por debajo de ese límite (y de los 2 MB pedidos).

/** Tamaño máximo del archivo original que se acepta para comprimir. */
export const MAX_INPUT_BYTES = 25 * 1024 * 1024;
/** Tamaño máximo de la imagen ya comprimida (binario; en base64 ocupa ~33 % más). */
export const MAX_STORED_BYTES = 600 * 1024;
/** Lado mayor de la imagen guardada. */
export const MAX_DIMENSION = 1600;
/** Lado mayor de la miniatura que se guarda junto a la tarea/nota/ticket. */
export const THUMB_DIMENSION = 240;
/** Máximo de imágenes por tarea, nota o ticket. */
export const MAX_ATTACHMENTS = 6;
/** Máximo de imágenes en el formulario público de tickets. */
export const MAX_PUBLIC_ATTACHMENTS = 3;

export const ALLOWED_IMAGE_TYPES = ['image/webp', 'image/jpeg', 'image/png'] as const;
export type StoredImageType = (typeof ALLOWED_IMAGE_TYPES)[number];

export interface CompressedImage {
  name: string;
  mime: StoredImageType;
  /** Data URL completa (data:image/webp;base64,...). */
  dataUrl: string;
  /** Bytes de la imagen comprimida (binario). */
  size: number;
  width: number;
  height: number;
  /** Miniatura como data URL (unos pocos KB). */
  thumb: string;
}

/** Dimensiones escaladas para que el lado mayor no supere `max` (nunca agranda). */
export function fitWithin(width: number, height: number, max: number): { width: number; height: number } {
  const scale = Math.min(1, max / Math.max(width, height));
  return { width: Math.max(1, Math.round(width * scale)), height: Math.max(1, Math.round(height * scale)) };
}

/** Bytes binarios que representa una cadena base64 (o una data URL). */
export function base64ByteLength(base64OrDataUrl: string): number {
  const base64 = base64OrDataUrl.includes(',') ? base64OrDataUrl.slice(base64OrDataUrl.indexOf(',') + 1) : base64OrDataUrl;
  const padding = base64.endsWith('==') ? 2 : base64.endsWith('=') ? 1 : 0;
  return Math.floor((base64.length * 3) / 4) - padding;
}

/** "1,2 MB", "350 KB". */
export function formatBytes(bytes: number): string {
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1).replace('.', ',')} MB`;
  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

/** Nombre de archivo con la extensión correcta para el formato comprimido. */
export function withExtension(name: string, mime: StoredImageType): string {
  const base = name.replace(/\.[a-z0-9]+$/i, '').trim() || 'imagen';
  const extension = mime === 'image/webp' ? 'webp' : mime === 'image/png' ? 'png' : 'jpg';
  return `${base.slice(0, 80)}.${extension}`;
}

export class ImageProcessingError extends Error {}

function canvasToBlob(canvas: HTMLCanvasElement, type: string, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new ImageProcessingError('No se pudo procesar la imagen.'))), type, quality);
  });
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new ImageProcessingError('No se pudo leer la imagen.'));
    reader.readAsDataURL(blob);
  });
}

function drawScaled(source: ImageBitmap, width: number, height: number): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d');
  if (!context) throw new ImageProcessingError('Este dispositivo no permite procesar imágenes.');
  context.imageSmoothingQuality = 'high';
  context.drawImage(source, 0, 0, width, height);
  return canvas;
}

/** WebP si el navegador sabe generarlo; si no, JPEG. */
async function encode(canvas: HTMLCanvasElement, quality: number): Promise<Blob> {
  const webp = await canvasToBlob(canvas, 'image/webp', quality);
  return webp.type === 'image/webp' ? webp : canvasToBlob(canvas, 'image/jpeg', quality);
}

/**
 * Comprime una imagen: la lleva a máximo MAX_DIMENSION px y baja la calidad
 * (y si hace falta, el tamaño) hasta quedar por debajo de MAX_STORED_BYTES.
 */
export async function compressImage(file: Blob & { name?: string }): Promise<CompressedImage> {
  if (!file.type.startsWith('image/')) {
    throw new ImageProcessingError('Solo se pueden adjuntar imágenes.');
  }
  if (file.size > MAX_INPUT_BYTES) {
    throw new ImageProcessingError(`La imagen pesa ${formatBytes(file.size)}; el máximo es ${formatBytes(MAX_INPUT_BYTES)}.`);
  }

  let bitmap: ImageBitmap;
  try {
    // Respeta la orientación EXIF de las fotos del teléfono.
    bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
  } catch {
    throw new ImageProcessingError('No se pudo abrir la imagen (¿formato no soportado?).');
  }

  try {
    let target = fitWithin(bitmap.width, bitmap.height, MAX_DIMENSION);
    let blob: Blob | null = null;
    for (let attempt = 0; attempt < 6 && !blob; attempt++) {
      const canvas = drawScaled(bitmap, target.width, target.height);
      for (const quality of [0.82, 0.72, 0.62, 0.52]) {
        const candidate = await encode(canvas, quality);
        if (candidate.size <= MAX_STORED_BYTES) {
          blob = candidate;
          break;
        }
      }
      if (!blob) target = fitWithin(target.width, target.height, Math.round(Math.max(target.width, target.height) * 0.75));
    }
    if (!blob) throw new ImageProcessingError('La imagen no se pudo comprimir lo suficiente.');

    const thumbSize = fitWithin(bitmap.width, bitmap.height, THUMB_DIMENSION);
    const thumbBlob = await encode(drawScaled(bitmap, thumbSize.width, thumbSize.height), 0.6);
    const mime = (blob.type === 'image/webp' ? 'image/webp' : 'image/jpeg') as StoredImageType;

    return {
      name: withExtension(file.name ?? 'imagen', mime),
      mime,
      dataUrl: await blobToDataUrl(blob),
      size: blob.size,
      width: target.width,
      height: target.height,
      thumb: await blobToDataUrl(thumbBlob),
    };
  } finally {
    bitmap.close();
  }
}

/** Convierte una data URL en Blob (para descargar o compartir). */
export function dataUrlToBlob(dataUrl: string): Blob {
  const [header, base64] = dataUrl.split(',');
  const mime = /data:([^;]+)/.exec(header)?.[1] ?? 'application/octet-stream';
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new Blob([bytes], { type: mime });
}
