import { timingSafeEqual } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { adminAuth } from '@/server/firebase-admin';
import { consumeRateLimits, getClientIpHash, isRateLimited, type RateLimitRule } from '@/server/rate-limit';

export const runtime = 'nodejs';

// App personal de un solo usuario: no hay cuentas. Quien conoce el PIN (APP_PIN,
// solo en el servidor) recibe un token para entrar como la dueña (OWNER_UID).
const requestSchema = z.object({ pin: z.string().min(1).max(64) });

const FAILED_ATTEMPTS_WINDOW_MS = 15 * 60 * 1000;
const MAX_FAILED_PER_IP = 5;
const MAX_FAILED_GLOBAL = 20;

function failedAttemptRules(req: NextRequest): RateLimitRule[] {
  return [
    { key: `pin_failed_ip_${getClientIpHash(req)}`, limit: MAX_FAILED_PER_IP, windowMs: FAILED_ATTEMPTS_WINDOW_MS },
    { key: 'pin_failed_global', limit: MAX_FAILED_GLOBAL, windowMs: FAILED_ATTEMPTS_WINDOW_MS },
  ];
}

function pinMatches(candidate: string, expected: string): boolean {
  const a = Buffer.from(candidate);
  const b = Buffer.from(expected);
  // Comparación en tiempo constante (la longitud distinta se descarta igual sin filtrar el PIN).
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function POST(req: NextRequest) {
  const expectedPin = process.env.APP_PIN?.trim();
  const ownerUid = process.env.OWNER_UID?.trim();
  if (!expectedPin || expectedPin.length < 4 || !ownerUid) {
    console.error('Acceso por PIN no configurado: faltan APP_PIN (mínimo 4 caracteres) u OWNER_UID.');
    return NextResponse.json({ ok: false, error: 'El acceso no está configurado en el servidor.' }, { status: 503 });
  }

  const parsed = requestSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: 'Escribe tu PIN.' }, { status: 400 });
  }

  try {
    const rules = failedAttemptRules(req);
    if (await isRateLimited(rules)) {
      return NextResponse.json(
        { ok: false, error: 'Demasiados intentos fallidos. Espera 15 minutos.', code: 'RATE_LIMIT_EXCEEDED' },
        { status: 429 }
      );
    }

    if (!pinMatches(parsed.data.pin.trim(), expectedPin)) {
      await consumeRateLimits(rules);
      return NextResponse.json({ ok: false, error: 'PIN incorrecto.' }, { status: 401 });
    }

    const token = await adminAuth.createCustomToken(ownerUid);
    return NextResponse.json({ ok: true, token });
  } catch (error) {
    console.error('Error al validar el PIN:', error instanceof Error ? error.message : error);
    return NextResponse.json({ ok: false, error: 'No se pudo validar el PIN. Intenta de nuevo.' }, { status: 500 });
  }
}
