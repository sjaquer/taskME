import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { FieldValue } from 'firebase-admin/firestore';
import { adminDb } from '@/server/firebase-admin';
import { requireUserIdFromRequest, RequestAuthError } from '@/server/request-auth';

export const runtime = 'nodejs';

const registerDeviceSchema = z.object({
  platform: z.enum(['android', 'web']),
  pushToken: z.string().min(20).max(4096),
  appVersion: z.string().max(64).optional(),
  osVersion: z.string().max(64).optional(),
  deviceModel: z.string().max(120).optional(),
  locale: z.string().max(20).optional(),
  timezone: z.string().max(64).optional(),
});

export async function POST(req: NextRequest) {
  try {
    const userId = await requireUserIdFromRequest(req);
    const payload = registerDeviceSchema.parse(await req.json());

    const devicesRef = adminDb.collection('users').doc(userId).collection('devices');

    const duplicateTokenSnap = await devicesRef
      .where('pushToken', '==', payload.pushToken)
      .limit(1)
      .get();

    const deviceRef = duplicateTokenSnap.empty ? devicesRef.doc() : duplicateTokenSnap.docs[0].ref;

    await deviceRef.set(
      {
        userId,
        ...payload,
        isActive: true,
        updatedAt: FieldValue.serverTimestamp(),
        lastSeenAt: FieldValue.serverTimestamp(),
        createdAt: FieldValue.serverTimestamp(),
      },
      { merge: true }
    );

    return NextResponse.json({ ok: true, deviceId: deviceRef.id });
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
