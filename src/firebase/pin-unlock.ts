'use client';

import { signInWithCustomToken, type Auth } from 'firebase/auth';

/**
 * Desbloquea la app en este dispositivo: el servidor valida el PIN y devuelve un
 * token para entrar como la dueña. La sesión queda guardada (no se vuelve a pedir).
 */
export async function unlockWithPin(auth: Auth, pin: string): Promise<void> {
  const response = await fetch('/api/v1/auth/pin', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ pin }),
  });
  const body = await response.json().catch(() => null);
  if (!response.ok || typeof body?.token !== 'string') {
    throw new Error(typeof body?.error === 'string' ? body.error : 'No se pudo desbloquear. Intenta de nuevo.');
  }
  await signInWithCustomToken(auth, body.token);
}
