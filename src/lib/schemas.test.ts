import { describe, expect, it } from 'vitest';
import {
  attachmentMetaSchema,
  contextDefSchema,
  noteSchema,
  publicAttachmentSchema,
  publicTicketFormSchema,
  routineSchema,
  taskSchema,
  ticketFormSchema,
} from './schemas';

const validTask = { title: 'Pagar luz', priority: 'alta', status: 'Pendiente', tags: [], context: 'Trabajo' } as const;

describe('taskSchema', () => {
  it('acepta una tarea mínima y contextos personalizados', () => {
    expect(taskSchema.safeParse(validTask).success).toBe(true);
    expect(taskSchema.safeParse({ ...validTask, context: 'aB3xYz9' }).success).toBe(true);
  });

  it('rechaza título vacío o contexto vacío', () => {
    expect(taskSchema.safeParse({ ...validTask, title: '   ' }).success).toBe(false);
    expect(taskSchema.safeParse({ ...validTask, context: '' }).success).toBe(false);
  });

  it('la hora y la repetición necesitan fecha', () => {
    const withTime = taskSchema.safeParse({ ...validTask, dueTime: '10:00' });
    expect(withTime.success).toBe(false);
    expect(withTime.error?.errors[0].message).toMatch(/fecha/);
    expect(taskSchema.safeParse({ ...validTask, recurrence: 'daily' }).success).toBe(false);
    expect(taskSchema.safeParse({ ...validTask, dueDate: '2026-10-21', dueTime: '10:00', recurrence: 'weekly' }).success).toBe(true);
  });

  it('limita subtareas a 30 y exige texto', () => {
    const item = (i: number) => ({ id: `s${i}`, text: `Paso ${i}`, done: false });
    expect(taskSchema.safeParse({ ...validTask, checklist: Array.from({ length: 30 }, (_, i) => item(i)) }).success).toBe(true);
    expect(taskSchema.safeParse({ ...validTask, checklist: Array.from({ length: 31 }, (_, i) => item(i)) }).success).toBe(false);
    expect(taskSchema.safeParse({ ...validTask, checklist: [{ id: 'a', text: ' ', done: false }] }).success).toBe(false);
  });
});

describe('routineSchema', () => {
  const routine = { title: 'Gimnasio', startTime: '18:00', endTime: '19:00', priority: 'media', recurringDays: [1], color: '#fff' };

  it('exige que el fin sea posterior al inicio', () => {
    expect(routineSchema.safeParse(routine).success).toBe(true);
    expect(routineSchema.safeParse({ ...routine, endTime: '18:00' }).success).toBe(false);
  });

  it('exige al menos un día válido', () => {
    expect(routineSchema.safeParse({ ...routine, recurringDays: [] }).success).toBe(false);
    expect(routineSchema.safeParse({ ...routine, recurringDays: [7] }).success).toBe(false);
  });
});

describe('adjuntos e imágenes', () => {
  const validMeta = {
    id: 'att1',
    name: 'foto.webp',
    mime: 'image/webp' as const,
    size: 2048,
    width: 800,
    height: 600,
    thumb: 'data:image/webp;base64,YWJj',
  };

  it('attachmentMetaSchema valida metadatos de imágenes', () => {
    expect(attachmentMetaSchema.safeParse(validMeta).success).toBe(true);
    expect(attachmentMetaSchema.safeParse({ ...validMeta, mime: 'image/gif' }).success).toBe(false);
    expect(attachmentMetaSchema.safeParse({ ...validMeta, size: 700 * 1024 }).success).toBe(false);
    expect(attachmentMetaSchema.safeParse({ ...validMeta, thumb: 'no-es-data-url' }).success).toBe(false);
  });

  it('publicAttachmentSchema requiere dataUrl válida', () => {
    const { id: _id, ...withoutId } = validMeta;
    const publicAtt = { ...withoutId, dataUrl: 'data:image/webp;base64,YWJj' };
    expect(publicAttachmentSchema.safeParse(publicAtt).success).toBe(true);
    expect(publicAttachmentSchema.safeParse({ ...publicAtt, dataUrl: 'invalido' }).success).toBe(false);
  });

  it('ticketFormSchema y publicTicketFormSchema aceptan adjuntos dentro del límite', () => {
    const ticket = {
      title: 'Ajuste',
      requestedAction: 'Cambiar logo',
      requesterName: 'Ana',
      priority: 'media' as const,
      tags: '',
      projectId: '',
      attachments: [validMeta],
    };
    expect(ticketFormSchema.safeParse(ticket).success).toBe(true);

    const { id: _id, ...withoutId } = validMeta;
    const publicTicket = {
      title: 'Ajuste',
      requestedAction: 'Cambiar logo',
      requesterName: 'Ana',
      priority: 'media' as const,
      attachments: [{ ...withoutId, dataUrl: 'data:image/webp;base64,YWJj' }],
    };
    expect(publicTicketFormSchema.safeParse(publicTicket).success).toBe(true);
  });
});

describe('otros esquemas', () => {
  it('contextos: nombre y color hex', () => {
    expect(contextDefSchema.safeParse({ name: 'Personal', color: '#3dbd7d', icon: 'home' }).success).toBe(true);
    expect(contextDefSchema.safeParse({ name: '', color: '#3dbd7d', icon: 'home' }).success).toBe(false);
    expect(contextDefSchema.safeParse({ name: 'X', color: 'verde', icon: 'home' }).success).toBe(false);
  });

  it('notas: categoría conocida', () => {
    expect(noteSchema.safeParse({ title: 'A', content: 'B', category: 'Otro' }).success).toBe(true);
    expect(noteSchema.safeParse({ title: 'A', content: 'B', category: 'Inventada' }).success).toBe(false);
  });

  it('ticket público: URL opcional pero válida', () => {
    const ticket = { title: 'Ajuste', requestedAction: 'Cambiar logo', requesterName: 'Ana', priority: 'media', referenceUrl: '' };
    expect(publicTicketFormSchema.safeParse(ticket).success).toBe(true);
    expect(publicTicketFormSchema.safeParse({ ...ticket, referenceUrl: 'no es url' }).success).toBe(false);
  });
});
