'use client';

import { useEffect, useRef } from 'react';

// Cierres hechos desde la UI que llaman a history.back(): su popstate no debe
// interpretarse como un "atrás" del usuario.
let pendingProgrammaticBacks = 0;

/**
 * Mientras `open` es true, el botón atrás (Android/WebView o navegador) cierra
 * el panel en lugar de salir de la página. Agrega una entrada al historial al
 * abrir y la quita si el panel se cierra desde la propia interfaz.
 */
export function useBackDismiss(open: boolean, onClose: () => void) {
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  // Entrada de historial propia; se conserva si el efecto se vuelve a ejecutar
  // de inmediato (StrictMode en desarrollo) para no apilar ni perder entradas.
  const markerRef = useRef<string | null>(null);
  const activeRef = useRef(false);
  const closedByBackRef = useRef(false);

  useEffect(() => {
    if (!open || typeof window === 'undefined') return;
    activeRef.current = true;

    if (!markerRef.current) {
      markerRef.current = `${Date.now()}-${Math.random()}`;
      closedByBackRef.current = false;
      // Se conserva el estado de Next.js para que su router no pierda la ruta actual.
      window.history.pushState({ ...window.history.state, taskmeOverlay: markerRef.current }, '');
    }

    const handlePopState = () => {
      if (pendingProgrammaticBacks > 0) {
        pendingProgrammaticBacks -= 1;
        return;
      }
      closedByBackRef.current = true;
      onCloseRef.current();
    };
    window.addEventListener('popstate', handlePopState);

    return () => {
      window.removeEventListener('popstate', handlePopState);
      activeRef.current = false;
      const marker = markerRef.current;
      // Diferido: si el efecto se vuelve a montar enseguida, la entrada se reutiliza.
      setTimeout(() => {
        if (activeRef.current) return;
        markerRef.current = null;
        // Cerrado desde la UI (no con "atrás"): se retira la entrada que agregamos,
        // salvo que ya se haya navegado a otra ruta.
        if (!closedByBackRef.current && window.history.state?.taskmeOverlay === marker) {
          pendingProgrammaticBacks += 1;
          window.history.back();
        }
      }, 0);
    };
  }, [open]);
}
