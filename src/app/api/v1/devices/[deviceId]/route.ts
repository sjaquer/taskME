import { NextRequest, NextResponse } from 'next/server';
import { FieldValue } from 'firebase-admin/firestore';
import { adminDb } from '@/server/firebase-admin';
import { requireUserIdFromRequest, RequestAuthError } from '@/server/request-auth';

export const runtime = 'nodejs';

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ deviceId: string }> }
) {
  try {
    const userId = await requireUserIdFromRequest(req);
    const { deviceId } = await params;

    if (!deviceId) {
      return NextResponse.json({ ok: false, error: 'Missing deviceId' }, { status: 400 });
    }

    const deviceRef = adminDb.collection('users').doc(userId).collection('devices').doc(deviceId);
    const snap = await deviceRef.get();

    if (!snap.exists) {
      return NextResponse.json({ ok: false, error: 'Device not found' }, { status: 404 });
    }

    await deviceRef.set(
      {
        isActive: false,
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true }
    );

    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof RequestAuthError) {
      return NextResponse.json({ ok: false, error: error.message }, { status: error.status });
    }

    return NextResponse.json({ ok: false, error: 'Internal server error' }, { status: 500 });
  }
}
