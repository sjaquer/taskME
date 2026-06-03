import { NextRequest, NextResponse } from 'next/server';
import { FieldValue } from 'firebase-admin/firestore';
import { adminDb } from '@/server/firebase-admin';
import { requireUserIdFromRequest, RequestAuthError } from '@/server/request-auth';

export const runtime = 'nodejs';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ notificationId: string }> }
) {
  try {
    const userId = await requireUserIdFromRequest(req);
    const { notificationId } = await params;

    if (!notificationId) {
      return NextResponse.json({ ok: false, error: 'Missing notificationId' }, { status: 400 });
    }

    const notificationRef = adminDb
      .collection('users')
      .doc(userId)
      .collection('notifications')
      .doc(notificationId);

    const snap = await notificationRef.get();
    if (!snap.exists) {
      return NextResponse.json({ ok: false, error: 'Notification not found' }, { status: 404 });
    }

    await notificationRef.set(
      {
        openedAt: FieldValue.serverTimestamp(),
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
