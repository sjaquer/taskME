import { NextRequest, NextResponse } from 'next/server';
import { genkit, z } from 'genkit';
import { googleAI } from '@genkit-ai/google-genai';

export const runtime = 'nodejs';

const requestSchema = z.object({
  prompt: z.string().min(3).max(4000),
});

const TaskSchema = z.object({
  title: z.string().describe('Título breve y directo de la tarea'),
  description: z.string().describe('Descripción detallada de la tarea a realizar').optional(),
  priority: z.enum(['baja', 'media', 'alta']).describe('Prioridad sugerida de la tarea'),
  context: z.enum(['Trabajo', 'Estudio']).describe('Contexto o área al que pertenece la tarea'),
  tags: z.array(z.string()).describe('Lista de etiquetas cortas para clasificar la tarea (ej. "lectura", "desarrollo")'),
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
    const { prompt } = requestSchema.parse(await req.json());
    const ai = getAiClient();
    const preferredModel = process.env.GEMINI_MODEL?.trim() || 'googleai/gemini-2.5-flash';
    const fallbackModel = 'googleai/gemini-2.0-flash';

    const generationPrompt = `Actuas como un asistente organizador de tareas altamente eficiente.
A partir del siguiente texto del usuario, extrae y organiza las tareas a realizar.
Genera una lista de tareas estructuradas. Clasifica cada tarea en el contexto "Trabajo" o "Estudio" segun corresponda. Si no esta claro, asume el contexto que mejor encaje.
Prioridad: alta, media, o baja.
Crea etiquetas (tags) utiles (maximo 3 por tarea).

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

    const message = error instanceof Error ? error.message : 'Error interno al procesar la solicitud de IA';
    console.error('Error generating tasks:', message);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
