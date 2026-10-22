'use client';

import { useEffect, useState } from 'react';
import { WifiOff } from 'lucide-react';

// Altura que el teclado virtual debe ocupar para considerarlo abierto.
const KEYBOARD_THRESHOLD_PX = 150;

/**
 * Estado del dispositivo:
 * - Aviso discreto cuando no hay conexión (Firestore guarda los cambios y los
 *   sube al reconectar).
 * - Marca data-keyboard="open" en <html> mientras el teclado virtual está
 *   visible, para ocultar la barra inferior y no tapar el campo.
 */
export function DeviceState() {
  const [online, setOnline] = useState(true);

  useEffect(() => {
    setOnline(navigator.onLine);
    const handleOnline = () => setOnline(true);
    const handleOffline = () => setOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  useEffect(() => {
    const viewport = window.visualViewport;
    if (!viewport) return;
    const update = () => {
      const keyboardOpen = window.innerHeight - viewport.height > KEYBOARD_THRESHOLD_PX;
      document.documentElement.dataset.keyboard = keyboardOpen ? 'open' : 'closed';
    };
    update();
    viewport.addEventListener('resize', update);
    return () => viewport.removeEventListener('resize', update);
  }, []);

  if (online) return null;

  return (
    <div
      role="status"
      className="fixed left-1/2 top-[calc(4.25rem+env(safe-area-inset-top))] z-50 flex -translate-x-1/2 items-center gap-2 rounded-full border border-amber-500/30 bg-background/95 px-3 py-1.5 text-xs text-amber-500 shadow-sm"
    >
      <WifiOff className="h-3.5 w-3.5" />
      Sin conexión · los cambios se guardarán al reconectar
    </div>
  );
}
