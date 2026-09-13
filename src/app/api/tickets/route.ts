import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { FieldValue } from 'firebase-admin/firestore';
import { adminDb } from '@/server/firebase-admin';

export const runtime = 'nodejs';

// Endpoint público: cualquiera puede crear un ticket sin iniciar sesión.
// El ticket siempre se guarda bajo la cuenta del dueño del sistema (OWNER_UID).
const publicTicketSchema = z.object({
  title: z.string().trim().min(1).max(120),
  requestedAction: z.string().trim().min(1).max(2000),
  description: z.string().trim().max(2000).optional(),
  requesterName: z.string().trim().min(1).max(140),
  dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  reviewDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  referenceUrl: z.string().trim().url().max(2000).optional(),
  priority: z.enum(['baja', 'media', 'alta']),
  tags: z.array(z.string()).max(5).optional(),
});

export async function POST(req: NextRequest) {
  try {
    const ownerId = process.env.OWNER_UID;
    if (!ownerId) {
      console.error('OWNER_UID no está configurado en el entorno del servidor.');
      return NextResponse.json({ ok: false, error: 'El sistema de tickets no está disponible.' }, { status: 503 });
    }

    const payload = publicTicketSchema.parse(await req.json());

    const tasksRef = adminDb.collection('users').doc(ownerId).collection('tasks');
    const docRef = await tasksRef.add({
      title: payload.title,
      requestedAction: payload.requestedAction,
      description: payload.description || '',
      requesterName: payload.requesterName,
      priority: payload.priority,
      tags: payload.tags || [],
      context: 'Trabajo',
      status: 'Pendiente',
      isTicket: true,
      userId: ownerId,
      ...(payload.dueDate ? { dueDate: payload.dueDate } : {}),
      ...(payload.reviewDate ? { reviewDate: payload.reviewDate } : {}),
      ...(payload.referenceUrl ? { referenceUrl: payload.referenceUrl } : {}),
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });

    return NextResponse.json({ ok: true, ticketId: docRef.id });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { ok: false, error: 'Datos de ticket inválidos.', details: error.flatten() },
        { status: 400 }
      );
    }

    console.error('Error creating public ticket:', error);
    return NextResponse.json({ ok: false, error: 'No se pudo crear el ticket.' }, { status: 500 });
  }
}
