'use client';

import { useEffect } from 'react';
import { useAuth, useUser } from '@/firebase';
import { doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { useFirestore } from '@/firebase/provider';
import { toast } from '@/hooks/use-toast';

/**
 * Proveedor global que escucha eventos enviados por la APK nativa
 * y los sincroniza con Firebase o el estado de la web.
 */
export function NativeBridgeProvider({ children }: { children: React.ReactNode }) {
  const { user } = useUser();
  const firestore = useFirestore();

  useEffect(() => {
    if (typeof window === 'undefined') return;

    // 1. Escuchar Token de Notificaciones (FCM)
    window.onNativeTokenReceived = async (token: string) => {
      console.log('FCM Token received from Native:', token);
      
      if (user && firestore) {
        try {
          const userRef = doc(firestore, 'users', user.uid);
          await updateDoc(userRef, {
            fcmToken: token,
            lastTokenSync: serverTimestamp(),
            platform: 'android-native'
          });
        } catch (err) {
          console.error('Error saving native FCM token:', err);
        }
      }
    };

    // 2. Escuchar resultado de Dictado por Voz (Micrófono Nativo)
    // Este evento será capturado por los componentes que lo necesiten
    // pero aquí podemos poner un log global o disparar un evento custom.
    window.onVoiceResult = (text: string) => {
      const event = new CustomEvent('nativeVoiceResult', { detail: text });
      window.dispatchEvent(event);
    };

    return () => {
      if (typeof window !== 'undefined') {
        window.onNativeTokenReceived = undefined;
        window.onVoiceResult = undefined;
      }
    };
  }, [user, firestore]);

  return <>{children}</>;
}
