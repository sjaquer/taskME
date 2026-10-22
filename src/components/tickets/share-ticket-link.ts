'use client';

import { toast } from '@/hooks/use-toast';

/** Enlace del formulario público donde otras personas te envían tickets. */
export function getTicketFormUrl() {
  return `${window.location.origin}/tickets`;
}

/** Comparte el enlace (WhatsApp, correo…) o, si no se puede, lo copia al portapapeles. */
export async function shareTicketFormLink() {
  const url = getTicketFormUrl();
  try {
    if (typeof navigator.share === 'function') {
      await navigator.share({ title: 'Enviar un ticket', text: 'Envíame tu solicitud desde aquí:', url });
      return;
    }
    await navigator.clipboard.writeText(url);
    toast({ variant: 'success', title: 'Enlace copiado', description: url });
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') return;
    console.warn('No se pudo compartir el enlace:', error);
    toast({ variant: 'warning', title: 'Copia el enlace manualmente', description: url });
  }
}
