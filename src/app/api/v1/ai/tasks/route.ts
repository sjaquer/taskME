import { NextRequest, NextResponse } from 'next/server';
import { genkit, z } from 'genkit';
import { googleAI } from '@genkit-ai/google-genai';
import { requireUserIdFromRequest, RequestAuthError } from '@/server/request-auth';

export const runtime = 'nodejs';

const requestSchema = z.object({
  prompt: z.string().min(3).max(4000),
});

const TaskSchema = z.object({
  title: z.string().describe('Título breve y directo de la tarea'),
  description: z.string().describe('Descripción detallada de la tarea a realizar').optional(),
  priority: z.enum(['baja', 'media', 'alta']).describe('Prioridad sugerida de la tarea'),
  context: z.enum(['Trabajo', 'Estudio']).describe('Contexto o área al que pertenece la tarea'),
  tags: z.array(z.string()).describe('Lista de etiquetas cortas y precisas para clasificar la tarea (ej. "diseño", "bug", "examen")'),
  dueDate: z.string().describe('Fecha de vencimiento en formato ISO 8601 (YYYY-MM-DD). Solo si se menciona una fecha, plazo o día específico.').optional(),
});

const TaskListSchema = z.array(TaskSchema);

function getAiClient() {
  const apiKey = process.env.GEMINI_API_KEY?.trim();

  if (!apiKey) {
    throw new Error('Falta configurar GEMINI_API_KEY en .env.local');
  }

  return genkit({
    plugins: [googleAI({ apiKey })],
  });
}

export async function POST(req: NextRequest) {
  try {
    await requireUserIdFromRequest(req);
    const { prompt } = requestSchema.parse(await req.json());
    const ai = getAiClient();
    const preferredModel = process.env.GEMINI_MODEL?.trim() || 'googleai/gemini-1.5-flash'; // Simpler, quota-friendly choice
    const fallbackModel = 'googleai/gemini-1.5-flash';

    const now = new Date();
    const dateStr = now.toISOString().split('T')[0];
    const dayOfWeek = now.toLocaleDateString('es-ES', { weekday: 'long' });

    const generationPrompt = `Actuas como un asistente organizador de tareas experto en productividad.
Fecha actual: ${dateStr} (${dayOfWeek})

A partir del siguiente texto del usuario, extrae y organiza las tareas a realizar con máxima precisión.

REGLAS DE CLASIFICACIÓN:
1. Contexto: Clasifica rigurosamente en "Trabajo" (tareas profesionales, proyectos, oficina) o "Estudio" (clases, exámenes, investigación académica, aprendizaje).
2. Etiquetas (Tags): Genera hasta 3 etiquetas que describan la NATURALEZA de la tarea (ej. "urgente", "reunión", "código", "lectura"). Deben ser consistentes y útiles para filtrar.
3. Fecha de Vencimiento (dueDate): 
   - Si el usuario dice "mañana", "lunes", "en 3 días", calcula la fecha exacta basada en la fecha actual (${dateStr}).
   - Si no hay mención de tiempo, deja el campo vacío.
   - Formato requerido: YYYY-MM-DD.
4. Prioridad: Evalúa el tono y la urgencia del texto para asignar baja, media o alta.

Texto del usuario:
"${prompt}"`;

    let output: z.infer<typeof TaskListSchema> | null = null;

    try {
      const result = await ai.generate({
        model: preferredModel,
        prompt: generationPrompt,
        output: { schema: TaskListSchema },
      });
      output = result.output;
    } catch (primaryError) {
      if (preferredModel !== fallbackModel) {
        try {
          const fallbackResult = await ai.generate({
            model: fallbackModel,
            prompt: generationPrompt,
            output: { schema: TaskListSchema },
          });
          output = fallbackResult.output;
        } catch {
          throw primaryError;
        }
      } else {
        throw new Error('No se pudo generar la respuesta del modelo de IA');
      }
    }

    if (!output) {
      return NextResponse.json({ ok: false, error: 'La IA no devolvio tareas validas' }, { status: 502 });
    }

    return NextResponse.json({ ok: true, tasks: output });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { ok: false, error: 'Prompt invalido. Debe tener entre 3 y 4000 caracteres.' },
        { status: 400 }
      );
    }

    if (error instanceof RequestAuthError) {
      return NextResponse.json({ ok: false, error: error.message }, { status: error.status });
    }

    let message = error instanceof Error ? error.message : 'Error interno al procesar la solicitud de IA';
    console.error('Error generating tasks:', message);


    if (
      message.toLowerCase().includes('api key not valid') ||
      message.toLowerCase().includes('invalid api key') ||
      message.toLowerCase().includes('api_key_invalid') ||
      (message.includes('400') && message.toLowerCase().includes('key')) ||
      message.includes('403')
    ) {
      const errorMsg = 'Error de Autenticación de IA: La API Key de Gemini ingresada no es válida o está deshabilitada. Genera una nueva clave activa en Google AI Studio (https://aistudio.google.com) e indícala en tu .env.local.';
      return NextResponse.json({ ok: false, error: errorMsg, code: 'INVALID_API_KEY' }, { status: 403 });
    }

    // Intercept quota exceeded or 429 rate limits to return a beautiful Spanish message
    if (
      message.includes('429') ||
      message.toLowerCase().includes('quota exceeded') ||
      message.toLowerCase().includes('too many requests') ||
      message.toLowerCase().includes('rate limit')
    ) {
      message = 'Límite de peticiones de IA excedido (Quota Exceeded). Por favor, espera unos minutos o reintenta mañana.';
      return NextResponse.json({ ok: false, error: message, code: 'QUOTA_EXCEEDED' }, { status: 429 });
    }

    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
