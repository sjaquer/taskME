'use client';

import { useEffect, useRef } from 'react';
import { useUser } from '@/firebase';
import { registerAndroidPushToken } from '@/services/mobile-integration-service';

/**
 * Proveedor global que escucha eventos enviados por la APK nativa
 * y los sincroniza con el backend o el estado de la web.
 */
export function NativeBridgeProvider({ children }: { children: React.ReactNode }) {
  const { user } = useUser();
  // La APK puede entregar el token antes de que exista sesión; se guarda hasta entonces.
  const pendingTokenRef = useRef<string | null>(null);
  const registeredRef = useRef<string | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    // 1. Token de notificaciones (FCM) entregado por la APK
    window.onNativeTokenReceived = (token: string) => {
      if (typeof token !== 'string' || token.length < 20) return;
      pendingTokenRef.current = token;
      if (user) syncPendingToken(user);
    };

    // 2. Resultado de dictado por voz (micrófono nativo), reenviado como evento
    // para los componentes que lo necesiten.
    window.onVoiceResult = (text: string) => {
      window.dispatchEvent(new CustomEvent('nativeVoiceResult', { detail: text }));
    };

    if (user) syncPendingToken(user);

    return () => {
      window.onNativeTokenReceived = undefined;
      window.onVoiceResult = undefined;
    };

    function syncPendingToken(currentUser: NonNullable<typeof user>) {
      const token = pendingTokenRef.current;
      const key = `${currentUser.uid}:${token}`;
      if (!token || registeredRef.current === key) return;
      registeredRef.current = key;
      registerAndroidPushToken(currentUser, token)
        .then((ok) => {
          if (!ok) registeredRef.current = null;
        })
        .catch((err) => {
          registeredRef.current = null;
          console.error('Error registering native FCM token:', err);
        });
    }
  }, [user]);

  return <>{children}</>;
}
