import { z } from 'zod';
import { MAX_ATTACHMENTS, MAX_STORED_BYTES } from '@/lib/images';

// Esquemas Zod compartidos entre formularios del cliente y rutas /api.
// Deben mantenerse alineados con las validaciones de firestore.rules.

const isoDate = (message: string) => z.string().regex(/^\d{4}-\d{2}-\d{2}$/, message);
const optionalIsoDate = (message: string) => isoDate(message).optional().or(z.literal(''));

export const prioritySchema = z.enum(['baja', 'media', 'alta']);
export const taskStatusSchema = z.enum(['Pendiente', 'Haciendo', 'Hecho']);
export const contextSchema = z.string().trim().min(1).max(64);

export const contextDefSchema = z.object({
  name: z.string().trim().min(1, 'El contexto necesita un nombre').max(40),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/, 'Color inválido'),
  icon: z.string().min(1).max(32),
});

const imageDataUrl = (maxLength: number) =>
  z.string().max(maxLength).regex(/^data:image\/(webp|jpeg|png);base64,[A-Za-z0-9+/]+=*$/, 'Imagen inválida');

/** Datos de un adjunto guardados junto a la tarea/nota (con miniatura). */
export const attachmentMetaSchema = z.object({
  id: z.string().min(1).max(40),
  name: z.string().min(1).max(120),
  mime: z.enum(['image/webp', 'image/jpeg', 'image/png']),
  size: z.number().int().positive().max(MAX_STORED_BYTES),
  width: z.number().int().positive().max(10_000),
  height: z.number().int().positive().max(10_000),
  thumb: imageDataUrl(30_000),
});

/** Imagen enviada desde el formulario público de tickets (ya comprimida en el navegador). */
export const publicAttachmentSchema = attachmentMetaSchema.omit({ id: true }).extend({
  dataUrl: imageDataUrl(900_000),
});

export const recurrenceSchema = z.enum(['daily', 'weekly', 'monthly']);

export const checklistItemSchema = z.object({
  id: z.string().min(1).max(40),
  text: z.string().trim().min(1, 'La subtarea no puede estar vacía').max(200),
  done: z.boolean(),
});

export const taskSchema = z
  .object({
    title: z.string().trim().min(1, 'El título es requerido').max(120),
    description: z.string().trim().max(2000).optional(),
    priority: prioritySchema,
    status: taskStatusSchema,
    tags: z.array(z.string()),
    dueDate: isoDate('Fecha inválida').optional(),
    dueTime: z.string().regex(/^\d{2}:\d{2}$/, 'Hora inválida').optional(),
    checklist: z.array(checklistItemSchema).max(30, 'Máximo 30 subtareas').optional(),
    recurrence: recurrenceSchema.optional(),
    attachments: z.array(attachmentMetaSchema).max(MAX_ATTACHMENTS, `Máximo ${MAX_ATTACHMENTS} imágenes`).optional(),
    context: contextSchema,
    projectId: z.string().optional(),
  })
  .refine((task) => !task.dueTime || task.dueDate, {
    message: 'Para poner hora, elige también una fecha',
    path: ['dueTime'],
  })
  .refine((task) => !task.recurrence || task.dueDate, {
    message: 'Una tarea que se repite necesita fecha',
    path: ['recurrence'],
  });

export const ticketFormSchema = z.object({
  title: z.string().trim().min(1, 'El título es requerido').max(120),
  requestedAction: z.string().trim().min(1, 'Indica la acción que se solicita').max(2000),
  description: z.string().trim().max(2000).optional(),
  requesterName: z.string().trim().min(1, 'Indica quién lo solicita').max(140),
  dueDate: optionalIsoDate('Fecha límite inválida'),
  reviewDate: optionalIsoDate('Fecha de revisión inválida'),
  referenceUrl: z.string().trim().url('URL inválida').max(2000).optional().or(z.literal('')),
  priority: prioritySchema,
  tags: z.string(),
  projectId: z.string(),
});

/** Formulario público de tickets (sin sesión). */
export const publicTicketFormSchema = ticketFormSchema.pick({
  title: true,
  requestedAction: true,
  description: true,
  requesterName: true,
  dueDate: true,
  referenceUrl: true,
  priority: true,
});

export const noteSchema = z.object({
  title: z.string().trim().min(1, 'El título es requerido').max(140),
  content: z.string().trim().min(1, 'Escribe el contenido de la nota').max(5000),
  category: z.enum(['Clases', 'Tareas', 'Grupos', 'Trabajo', 'Tickets', 'Otro']),
  attachments: z.array(attachmentMetaSchema).max(MAX_ATTACHMENTS, `Máximo ${MAX_ATTACHMENTS} imágenes`).optional(),
});

export const routineSchema = z
  .object({
    title: z.string().trim().min(1, 'El nombre es requerido').max(100),
    startTime: z.string().regex(/^\d{2}:\d{2}$/, 'Hora de inicio inválida'),
    endTime: z.string().regex(/^\d{2}:\d{2}$/, 'Hora de fin inválida'),
    priority: prioritySchema,
    recurringDays: z.array(z.number().int().min(0).max(6)).min(1, 'Selecciona al menos un día'),
    color: z.string(),
  })
  .refine((data) => data.endTime > data.startTime, {
    message: 'La hora de fin debe ser posterior a la de inicio',
    path: ['endTime'],
  });
