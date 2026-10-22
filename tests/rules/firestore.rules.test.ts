import { readFileSync } from 'node:fs';
import { setLogLevel } from 'firebase/firestore';
import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest';
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing';

const OWNER = 'duena';
const STRANGER = 'extrana';

let env: RulesTestEnvironment;

beforeAll(async () => {
  // Los rechazos son esperados en estos tests; sin esto el SDK los imprime todos.
  setLogLevel('silent');
  const [host, port] = (process.env.FIRESTORE_EMULATOR_HOST ?? '127.0.0.1:8080').split(':');
  env = await initializeTestEnvironment({
    projectId: 'demo-taskme',
    firestore: { rules: readFileSync('firestore.rules', 'utf8'), host, port: Number(port) },
  });
});

beforeEach(async () => {
  await env.clearFirestore();
});

afterAll(async () => {
  await env.cleanup();
});

const ownerDb = () => env.authenticatedContext(OWNER).firestore();
const strangerDb = () => env.authenticatedContext(STRANGER).firestore();
const anonDb = () => env.unauthenticatedContext().firestore();
const userDoc = (db: ReturnType<typeof ownerDb>, path: string) => db.doc(`users/${OWNER}/${path}`);

const validTask = {
  userId: OWNER,
  title: 'Pagar servicios',
  priority: 'alta',
  status: 'Pendiente',
  context: 'Trabajo',
  tags: ['casa'],
  dueDate: '2026-10-21',
  dueTime: '18:30',
  recurrence: 'monthly',
  checklist: [{ id: 'a', text: 'Luz', done: false }],
};

describe('tareas', () => {
  it('la dueña crea una tarea completa (hora, subtareas, repetición)', async () => {
    await assertSucceeds(userDoc(ownerDb(), 'tasks/t1').set(validTask));
  });

  it('acepta contextos personalizados y rechaza el vacío', async () => {
    await assertSucceeds(userDoc(ownerDb(), 'tasks/t1').set({ ...validTask, context: 'Xy12ab' }));
    await assertFails(userDoc(ownerDb(), 'tasks/t2').set({ ...validTask, context: '' }));
  });

  it('otro usuario o alguien sin sesión no puede leer ni escribir', async () => {
    await env.withSecurityRulesDisabled(async (ctx) => {
      await ctx.firestore().doc(`users/${OWNER}/tasks/t1`).set(validTask);
    });
    await assertFails(userDoc(strangerDb(), 'tasks/t1').get());
    await assertFails(userDoc(anonDb(), 'tasks/t1').get());
    await assertFails(userDoc(strangerDb(), 'tasks/t2').set(validTask));
  });

  it('rechaza campos desconocidos y valores fuera de formato', async () => {
    const db = ownerDb();
    await assertFails(userDoc(db, 'tasks/a').set({ ...validTask, hacker: true }));
    await assertFails(userDoc(db, 'tasks/b').set({ ...validTask, dueTime: 'mañana' }));
    await assertFails(userDoc(db, 'tasks/c').set({ ...validTask, recurrence: 'yearly' }));
    await assertFails(userDoc(db, 'tasks/d').set({ ...validTask, status: 'Archivado' }));
    await assertFails(userDoc(db, 'tasks/e').set({ ...validTask, userId: STRANGER }));
    const tooMany = Array.from({ length: 31 }, (_, i) => ({ id: `s${i}`, text: 'x', done: false }));
    await assertFails(userDoc(db, 'tasks/f').set({ ...validTask, checklist: tooMany }));
  });
});

describe('contextos', () => {
  const context = { userId: OWNER, name: 'Personal', color: '#a855f7', icon: 'home', order: 2 };

  it('la dueña crea y edita sus contextos', async () => {
    await assertSucceeds(userDoc(ownerDb(), 'contexts/c1').set(context));
    await assertSucceeds(userDoc(ownerDb(), 'contexts/c1').set({ name: 'Casa' }, { merge: true }));
  });

  it('rechaza nombre vacío o demasiado largo, sin userId o de otra persona', async () => {
    await assertFails(userDoc(ownerDb(), 'contexts/c2').set({ ...context, name: '' }));
    await assertFails(userDoc(ownerDb(), 'contexts/c3').set({ ...context, name: 'x'.repeat(41) }));
    const { userId: _userId, ...withoutUser } = context;
    await assertFails(userDoc(ownerDb(), 'contexts/c4').set(withoutUser));
    await assertFails(userDoc(strangerDb(), 'contexts/c5').set(context));
  });
});

describe('ajustes sincronizados', () => {
  it('acepta las preferencias nuevas', async () => {
    await assertSucceeds(
      userDoc(ownerDb(), 'settings/app').set({
        theme: 'custom',
        colorMode: 'system',
        customAccent: '#ff8800',
        accentFromContext: true,
        pureBlack: true,
        fontScale: 1.1,
        reduceMotion: false,
        haptics: true,
        navOrder: ['kanban', 'dashboard'],
        ticketsContext: 'Trabajo',
        activeModules: { dashboard: true },
      })
    );
  });

  it('rechaza claves desconocidas y valores fuera de rango', async () => {
    await assertFails(userDoc(ownerDb(), 'settings/app').set({ secreto: 1 }));
    await assertFails(userDoc(ownerDb(), 'settings/app').set({ fontScale: 3 }));
    await assertFails(userDoc(ownerDb(), 'settings/app').set({ colorMode: 'neon' }));
  });
});

describe('notas', () => {
  const note = { userId: OWNER, title: 'Ideas', content: 'Texto', category: 'Otro', context: 'Estudio' };

  it('permite fijar notas con un booleano', async () => {
    await assertSucceeds(userDoc(ownerDb(), 'notes/n1').set({ ...note, pinned: true }));
    await assertFails(userDoc(ownerDb(), 'notes/n2').set({ ...note, pinned: 'sí' }));
  });
});

describe('adjuntos (attachments)', () => {
  const validAttachment = {
    userId: OWNER,
    parentType: 'task',
    parentId: 't1',
    name: 'foto.webp',
    mime: 'image/webp',
    size: 2048,
    width: 800,
    height: 600,
    data: 'data:image/webp;base64,YWJj',
  };

  it('la dueña crea un adjunto válido y puede leerlo y borrarlo', async () => {
    await assertSucceeds(userDoc(ownerDb(), 'attachments/att1').set(validAttachment));
    await assertSucceeds(userDoc(ownerDb(), 'attachments/att1').get());
    await assertSucceeds(userDoc(ownerDb(), 'attachments/att1').delete());
  });

  it('los adjuntos son inmutables: rechaza modificaciones (update)', async () => {
    await env.withSecurityRulesDisabled(async (ctx) => {
      await ctx.firestore().doc(`users/${OWNER}/attachments/att1`).set(validAttachment);
    });
    await assertFails(userDoc(ownerDb(), 'attachments/att1').update({ name: 'nuevo.webp' }));
  });

  it('otro usuario o alguien sin sesión no puede leer ni escribir adjuntos', async () => {
    await env.withSecurityRulesDisabled(async (ctx) => {
      await ctx.firestore().doc(`users/${OWNER}/attachments/att1`).set(validAttachment);
    });
    await assertFails(userDoc(strangerDb(), 'attachments/att1').get());
    await assertFails(userDoc(anonDb(), 'attachments/att1').get());
    await assertFails(userDoc(strangerDb(), 'attachments/att2').set(validAttachment));
  });

  it('rechaza adjuntos con campos inválidos, mime desconocido o dataUrl mal formateada', async () => {
    const db = ownerDb();
    await assertFails(userDoc(db, 'attachments/a1').set({ ...validAttachment, hacker: true }));
    await assertFails(userDoc(db, 'attachments/a2').set({ ...validAttachment, mime: 'image/gif' }));
    await assertFails(userDoc(db, 'attachments/a3').set({ ...validAttachment, parentType: 'usuario' }));
    await assertFails(userDoc(db, 'attachments/a4').set({ ...validAttachment, size: 700_000 }));
    await assertFails(userDoc(db, 'attachments/a5').set({ ...validAttachment, data: 'no-es-data-url' }));
  });

  it('tareas y notas aceptan hasta 6 adjuntos y rechazan más de 6', async () => {
    const db = ownerDb();
    const item = (i: number) => ({ id: `att-${i}`, name: `f${i}.webp`, mime: 'image/webp', size: 100, width: 100, height: 100, thumb: 't' });
    await assertSucceeds(userDoc(db, 'tasks/t-att').set({ ...validTask, attachments: Array.from({ length: 6 }, (_, i) => item(i)) }));
    await assertFails(userDoc(db, 'tasks/t-att-max').set({ ...validTask, attachments: Array.from({ length: 7 }, (_, i) => item(i)) }));
  });
});

describe('colecciones del servidor', () => {
  it('los clientes no acceden a rate_limits', async () => {
    await assertFails(ownerDb().doc('rate_limits/public_tickets_global').get());
    await assertFails(ownerDb().doc('rate_limits/x').set({ count: 0 }));
  });

  it('las notificaciones solo las crea el servidor', async () => {
    await assertFails(userDoc(ownerDb(), 'notifications/n1').set({ title: 'Hola' }));
  });
});
