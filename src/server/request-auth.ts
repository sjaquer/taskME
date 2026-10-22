import type { NextRequest } from 'next/server';
import { adminAuth } from '@/server/firebase-admin';

export class RequestAuthError extends Error {
  status: number;

  constructor(message: string, status = 401) {
    super(message);
    this.status = status;
    this.name = 'RequestAuthError';
  }
}

export async function requireUserIdFromRequest(req: NextRequest): Promise<string> {
  const authHeader = req.headers.get('authorization') || '';
  const bearerPrefix = 'Bearer ';

  if (!authHeader.startsWith(bearerPrefix)) {
    throw new RequestAuthError('Falta el token Bearer de Firebase. Desbloquea la app otra vez.', 401);
  }

  const token = authHeader.slice(bearerPrefix.length).trim();
  if (!token) {
    throw new RequestAuthError('El token Bearer de Firebase está vacío o es inválido.', 401);
  }

  const uid = await verifyTokenUid(token);

  // App personal: solo la dueña (OWNER_UID) puede usar la API.
  const ownerUid = process.env.OWNER_UID?.trim();
  if (ownerUid && uid !== ownerUid) {
    throw new RequestAuthError('Esta app es personal: tu sesión no tiene acceso.', 403);
  }
  return uid;
}

async function verifyTokenUid(token: string): Promise<string> {
  try {
    const decoded = await adminAuth.verifyIdToken(token, true);
    return decoded.uid;
  } catch (err) {
    // Fallback for local development when Firebase Admin credentials are not fully set up.
    // Decodes the JWT payload locally to extract the user ID without signature verification.
    if (process.env.NODE_ENV === 'development' && !process.env.FIREBASE_PRIVATE_KEY) {
      console.warn('⚠️ ATENCIÓN: Verificación de firma JWT deshabilitada. NO USAR EN PRODUCCIÓN.');

      try {
        const parts = token.split('.');
        if (parts.length === 3) {
          const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString('utf-8'));
          const uid = payload?.uid || payload?.user_id || payload?.sub;
          if (typeof uid === 'string' && uid) {
            return uid;
          }
        }
      } catch (decodeErr) {
        console.error('Failed to decode JWT token payload locally in development:', decodeErr);
      }
    }

    console.error('Authentication verification failed:', err instanceof Error ? err.message : err);
    throw new RequestAuthError('No se pudo validar tu sesión. Desbloquea la app otra vez.', 401);
  }
}
