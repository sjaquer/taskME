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

  useEffect(() => {
    if (!open || typeof window === 'undefined') return;

    const marker = `${Date.now()}-${Math.random()}`;
    // Se conserva el estado de Next.js para que su router no pierda la ruta actual.
    window.history.pushState({ ...window.history.state, taskmeOverlay: marker }, '');
    let closedByBack = false;

    const handlePopState = () => {
      if (pendingProgrammaticBacks > 0) {
        pendingProgrammaticBacks -= 1;
        return;
      }
      closedByBack = true;
      onCloseRef.current();
    };
    window.addEventListener('popstate', handlePopState);

    return () => {
      window.removeEventListener('popstate', handlePopState);
      // Cerrado desde la UI (no con "atrás"): se retira la entrada que agregamos,
      // salvo que ya se haya navegado a otra ruta.
      if (!closedByBack && window.history.state?.taskmeOverlay === marker) {
        pendingProgrammaticBacks += 1;
        window.history.back();
      }
    };
  }, [open]);
}
