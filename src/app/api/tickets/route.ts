import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { FieldValue } from 'firebase-admin/firestore';
import { adminDb } from '@/server/firebase-admin';
import { prioritySchema } from '@/lib/schemas';
import { DEFAULT_TICKETS_CONTEXT } from '@/lib/contexts';
import { consumeRateLimits, getClientIpHash } from '@/server/rate-limit';

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
  priority: prioritySchema,
  tags: z.array(z.string()).max(5).optional(),
  // Campo trampa: oculto en el formulario, solo lo completan los bots.
  website: z.string().max(200).optional(),
});

const HOUR_MS = 60 * 60 * 1000;
const MAX_TICKETS_PER_IP_PER_HOUR = 5;
const MAX_PUBLIC_TICKETS_PER_DAY = 50;

// Contexto elegido por el dueño en Ajustes (sincronizado en settings/app).
async function getTicketsContext(ownerRef: FirebaseFirestore.DocumentReference): Promise<string> {
  try {
    const settings = await ownerRef.collection('settings').doc('app').get();
    const value = settings.get('ticketsContext');
    if (typeof value === 'string' && value.length > 0 && value.length <= 64) return value;
  } catch (error) {
    console.error('No se pudo leer el contexto de tickets; se usa el predeterminado:', error);
  }
  return DEFAULT_TICKETS_CONTEXT;
}

export async function POST(req: NextRequest) {
  try {
    const ownerId = process.env.OWNER_UID;
    if (!ownerId) {
      console.error('OWNER_UID no está configurado en el entorno del servidor.');
      return NextResponse.json({ ok: false, error: 'El sistema de tickets no está disponible.' }, { status: 503 });
    }

    const payload = publicTicketSchema.parse(await req.json());

    if (payload.website) {
      // Respuesta exitosa para no darle pistas al bot; no se guarda nada.
      return NextResponse.json({ ok: true });
    }

    const allowed = await consumeRateLimits([
      { key: `public_tickets_ip_${getClientIpHash(req)}`, limit: MAX_TICKETS_PER_IP_PER_HOUR, windowMs: HOUR_MS },
      { key: 'public_tickets_global', limit: MAX_PUBLIC_TICKETS_PER_DAY, windowMs: 24 * HOUR_MS },
    ]);
    if (!allowed) {
      return NextResponse.json(
        { ok: false, error: 'Se enviaron demasiados tickets. Intenta de nuevo más tarde.', code: 'RATE_LIMIT_EXCEEDED' },
        { status: 429 }
      );
    }

    const ownerRef = adminDb.collection('users').doc(ownerId);
    const tasksRef = ownerRef.collection('tasks');
    const docRef = await tasksRef.add({
      title: payload.title,
      requestedAction: payload.requestedAction,
      description: payload.description || '',
      requesterName: payload.requesterName,
      priority: payload.priority,
      tags: payload.tags || [],
      context: await getTicketsContext(ownerRef),
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
