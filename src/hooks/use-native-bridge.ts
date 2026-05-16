'use client';

import { useEffect, useCallback } from 'react';

/**
 * Hook para gestionar la comunicación bidireccional con la APK nativa.
 */
export function useNativeBridge() {
  const isNative = typeof window !== 'undefined' && !!window.AndroidNative;

  // Enviar mensaje al sistema nativo
  const callNative = useCallback((fn: keyof NonNullable<typeof window.AndroidNative>, ...args: any[]) => {
    if (isNative && window.AndroidNative && typeof window.AndroidNative[fn] === 'function') {
      try {
        (window.AndroidNative[fn] as Function)(...args);
      } catch (err) {
        console.error(`Error calling native function ${fn}:`, err);
      }
    }
  }, [isNative]);

  // Vribrar (Feedback háptico)
  const vibrate = (ms: number = 50) => callNative('vibrate', ms);

  // Mostrar Toast nativo
  const showToast = (msg: string) => callNative('showToast', msg);

  return {
    isNative,
    vibrate,
    showToast,
    callNative,
  };
}
