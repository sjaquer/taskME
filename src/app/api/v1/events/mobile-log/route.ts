import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { FieldValue } from 'firebase-admin/firestore';
import { adminDb } from '@/server/firebase-admin';
import { requireUserIdFromRequest, RequestAuthError } from '@/server/request-auth';

export const runtime = 'nodejs';

const mobileLogSchema = z.object({
  name: z.string().min(3).max(100),
  source: z.enum(['android', 'web']),
  level: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
  appBuild: z.string().max(64).optional(),
  correlationId: z.string().max(120).optional(),
  data: z.record(z.string(), z.unknown()).optional(),
});

export async function POST(req: NextRequest) {
  try {
    const userId = await requireUserIdFromRequest(req);
    const payload = mobileLogSchema.parse(await req.json());

    await adminDb
      .collection('users')
      .doc(userId)
      .collection('mobile_logs')
      .add({
        ...payload,
        userId,
        createdAt: FieldValue.serverTimestamp(),
      });

    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof RequestAuthError) {
      return NextResponse.json({ ok: false, error: error.message }, { status: error.status });
    }

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { ok: false, error: 'Invalid request payload', details: error.flatten() },
        { status: 400 }
      );
    }

    return NextResponse.json({ ok: false, error: 'Internal server error' }, { status: 500 });
  }
}
