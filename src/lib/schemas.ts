import { z } from 'zod';

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

export const taskSchema = z.object({
  title: z.string().trim().min(1, 'El título es requerido').max(120),
  description: z.string().trim().max(2000).optional(),
  priority: prioritySchema,
  status: taskStatusSchema,
  tags: z.array(z.string()),
  dueDate: isoDate('Fecha inválida').optional(),
  context: contextSchema,
  projectId: z.string().optional(),
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
