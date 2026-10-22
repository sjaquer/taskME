'use client';

import type { User } from 'firebase/auth';

/** Tarea tal como la devuelve /api/v1/ai/tasks; se valida con Zod antes de guardarla. */
export interface GeneratedTaskDraft {
  title?: unknown;
  description?: unknown;
  priority?: unknown;
  tags?: unknown;
  dueDate?: unknown;
}

export async function generateTasksFromPrompt(user: User, prompt: string): Promise<GeneratedTaskDraft[]> {
  const idToken = await user.getIdToken();
  const response = await fetch('/api/v1/ai/tasks', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${idToken}`,
    },
    body: JSON.stringify({
      prompt,
      timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    }),
  });

  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    const rawMessage = typeof payload?.error === 'string' ? payload.error : 'Error al generar tareas desde la IA';
    if (response.status === 401 || rawMessage.toLowerCase().includes('bearer token')) {
      throw new Error('Sesión no autenticada. Vuelve a iniciar sesión y prueba otra vez.');
    }
    throw new Error(rawMessage);
  }

  if (!Array.isArray(payload?.tasks)) {
    throw new Error('La IA no devolvió una lista válida de tareas.');
  }
  return payload.tasks as GeneratedTaskDraft[];
}
