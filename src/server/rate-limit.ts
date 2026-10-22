import { createHash } from 'node:crypto';
import type { NextRequest } from 'next/server';
import { adminDb } from '@/server/firebase-admin';

// Contadores en Firestore (colección rate_limits, solo accesible con Admin SDK;
// firestore.rules deniega todo a los clientes). Funciona aunque haya varias
// instancias del servidor, a diferencia de un contador en memoria.
const RATE_LIMITS_COLLECTION = 'rate_limits';

export interface RateLimitRule {
  /** Identificador del contador, p. ej. "public_tickets_ip_<hash>". */
  key: string;
  limit: number;
  windowMs: number;
}

/** IP del cliente hasheada: no se guarda la IP en claro. */
export function getClientIpHash(req: NextRequest): string {
  const forwarded = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim();
  const ip = forwarded || req.headers.get('x-real-ip') || 'unknown';
  return createHash('sha256').update(`${process.env.OWNER_UID ?? ''}:${ip}`).digest('hex').slice(0, 32);
}

/**
 * Consume una unidad de cada regla de forma atómica.
 * Devuelve false (sin consumir nada) si alguna regla ya alcanzó su límite.
 */
export async function consumeRateLimits(rules: RateLimitRule[]): Promise<boolean> {
  const now = Date.now();
  const refs = rules.map((rule) => adminDb.collection(RATE_LIMITS_COLLECTION).doc(rule.key));

  return adminDb.runTransaction(async (tx) => {
    const snaps = await Promise.all(refs.map((ref) => tx.get(ref)));

    const nextStates = rules.map((rule, index) => {
      const data = snaps[index].data() as { windowStart?: number; count?: number } | undefined;
      const windowActive = data?.windowStart !== undefined && now - data.windowStart < rule.windowMs;
      const count = windowActive ? data?.count ?? 0 : 0;
      return {
        allowed: count < rule.limit,
        windowStart: windowActive ? data!.windowStart! : now,
        count: count + 1,
        expiresAt: new Date((windowActive ? data!.windowStart! : now) + rule.windowMs),
      };
    });

    if (nextStates.some((state) => !state.allowed)) return false;

    nextStates.forEach((state, index) => {
      tx.set(refs[index], {
        windowStart: state.windowStart,
        count: state.count,
        // Permite configurar una política TTL en Firestore para limpiar contadores viejos.
        expiresAt: state.expiresAt,
      });
    });
    return true;
  });
}
