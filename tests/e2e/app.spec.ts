import { expect, test, type Page } from '@playwright/test';

const PROJECT_ID = 'demo-taskme';
const OWNER_UID = 'e2e-owner';
const PIN = '2468'; // APP_PIN de playwright.config.ts
// Mensaje de error del PIN (getByRole('alert') también encuentra el anunciador de rutas de Next).
const pinError = (page: Page) => page.locator('#pin-error');
const ownerHeaders = { Authorization: 'Bearer owner', 'Content-Type': 'application/json' };

const pad = (n: number) => String(n).padStart(2, '0');
const ymd = (date: Date) => `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;

/** Borra todos los datos del emulador: cada test parte de cero (incluye intentos de PIN). */
async function resetEmulatorData() {
  await fetch(`http://127.0.0.1:8080/emulator/v1/projects/${PROJECT_ID}/databases/(default)/documents`, { method: 'DELETE' });
}

/** Desbloquea la app con el PIN (no hay cuentas: se entra como la dueña). */
async function unlock(page: Page) {
  await page.goto('/login');
  await page.getByLabel('PIN').fill(PIN);
  await page.getByRole('button', { name: 'Desbloquear' }).click();
  await page.waitForURL((url) => !url.pathname.startsWith('/login'));
}

async function openKanban(page: Page) {
  await page.goto('/kanban');
  await expect(page.getByLabel('Título de la nueva tarea')).toBeVisible();
}

async function addTask(page: Page, title: string) {
  const input = page.getByLabel('Título de la nueva tarea');
  await input.fill(title);
  await input.press('Enter');
  await expect(page.getByRole('button', { name: `Completar "${title}"` })).toBeVisible();
}

const taskForm = (page: Page) => page.locator('div.glass-card-elevated', { has: page.getByRole('heading', { name: /tarea$/ }) });

/** Documentos de una subcolección de la dueña, leídos del emulador. */
async function readUserCollection(collection: string) {
  const response = await fetch(
    `http://127.0.0.1:8080/v1/projects/${PROJECT_ID}/databases/(default)/documents/users/${OWNER_UID}/${collection}`,
    { headers: ownerHeaders }
  );
  const body = (await response.json()) as { documents?: { fields: Record<string, { stringValue?: string }> }[] };
  return (body.documents ?? []).map((doc) => doc.fields);
}

test.beforeEach(async () => {
  await resetEmulatorData();
});

test.describe('acceso con PIN', () => {
  test('PIN incorrecto muestra error; el correcto desbloquea y queda recordado', async ({ page }) => {
    await page.goto('/kanban');
    await expect(page).toHaveURL(/\/login$/);
    await page.getByLabel('PIN').fill('0000');
    await page.getByRole('button', { name: 'Desbloquear' }).click();
    await expect(pinError(page)).toHaveText('PIN incorrecto.');
    await page.getByLabel('PIN').fill(PIN);
    await page.getByRole('button', { name: 'Desbloquear' }).click();
    await page.waitForURL((url) => !url.pathname.startsWith('/login'));
    await page.reload();
    await page.goto('/kanban');
    await expect(page.getByLabel('Título de la nueva tarea')).toBeVisible();
  });

  test('tras 5 intentos fallidos se bloquea, incluso con el PIN correcto', async ({ page }) => {
    await page.goto('/login');
    for (let attempt = 0; attempt < 5; attempt++) {
      await page.getByLabel('PIN').fill(`99${attempt}9`);
      await page.getByRole('button', { name: 'Desbloquear' }).click();
      await expect(pinError(page)).toHaveText('PIN incorrecto.');
    }
    await page.getByLabel('PIN').fill(PIN);
    await page.getByRole('button', { name: 'Desbloquear' }).click();
    await expect(pinError(page)).toHaveText(/Demasiados intentos/);
  });

  test('"Bloquear este dispositivo" vuelve a pedir el PIN', async ({ page }) => {
    await unlock(page);
    await page.goto('/settings');
    await page.getByRole('button', { name: 'Bloquear este dispositivo' }).click();
    await expect(page).toHaveURL(/\/login$/);
    await page.goto('/kanban');
    await expect(page).toHaveURL(/\/login$/);
  });

  test('ya no existen registro, invitado ni login con Google', async ({ page }) => {
    await page.goto('/login');
    await expect(page.getByRole('button', { name: /invitado|google|registr|crear cuenta/i })).toHaveCount(0);
    await expect(page.getByRole('textbox', { name: /correo|email/i })).toHaveCount(0);
  });
});

test.describe('con la app desbloqueada', () => {
  test.beforeEach(async ({ page }) => {
    await unlock(page);
  });

  test('la página se desplaza con el dedo', async ({ page }) => {
    await page.goto('/settings');
    await expect(page.getByRole('heading', { name: 'Ajustes' })).toBeVisible();
    const cdp = await page.context().newCDPSession(page);
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: 200, y: 650 }] });
    for (let y = 640; y >= 250; y -= 15) {
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: 200, y }] });
    }
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await expect.poll(() => page.evaluate(() => document.scrollingElement?.scrollTop ?? 0)).toBeGreaterThan(100);
  });

  test('atajo /kanban?new=1 enfoca "Añadir tarea" y limpia la URL', async ({ page }) => {
    await page.goto('/kanban?new=1');
    await expect(page.getByLabel('Título de la nueva tarea')).toBeFocused();
    await expect(page).toHaveURL(/\/kanban$/);
  });

  test('el botón atrás cierra formularios y paneles, también tras cerrarlos con la X', async ({ page }) => {
    await openKanban(page);
    for (let round = 0; round < 2; round++) {
      await page.getByRole('button', { name: 'Añadir con detalles' }).click();
      await page.getByRole('button', { name: 'Cerrar formulario' }).click();
      await page.getByRole('button', { name: /^Filtros/ }).click();
      await expect(page.getByRole('button', { name: 'Recientes' })).toBeVisible();
      await page.goBack();
      await expect(page.getByRole('button', { name: 'Recientes' })).toBeHidden();
      await expect(page).toHaveURL(/\/kanban$/);
    }
  });

  test('tarea con hora, subtareas y repetición; al completarla se crea la próxima', async ({ page }) => {
    await openKanban(page);
    await page.getByRole('button', { name: 'Añadir con detalles' }).click();
    const form = taskForm(page);
    await form.locator('input').first().fill('Pagar servicios');
    await form.locator('input[type=date]').fill(ymd(new Date()));
    await form.locator('input[type=time]').fill('23:59');
    await form.getByRole('combobox').filter({ hasText: 'No se repite' }).click();
    await page.getByRole('option', { name: 'Cada día' }).click();
    for (const item of ['Luz', 'Agua']) {
      await form.getByLabel('Nueva subtarea').fill(item);
      await form.getByLabel('Nueva subtarea').press('Enter');
    }
    await form.getByRole('button', { name: 'Crear tarea' }).click();

    await expect(page.getByText('Hoy · 23:59', { exact: true })).toBeVisible();
    await page.getByText('0/2 subtareas').click();
    await page.getByRole('button', { name: 'Luz' }).click();
    await expect(page.getByText('1/2 subtareas')).toBeVisible();

    await page.getByRole('button', { name: 'Completar "Pagar servicios"' }).first().click();
    // exact: el aviso también menciona la fecha ("Próxima: Mañana · 23:59.").
    await expect(page.getByText('Mañana · 23:59', { exact: true })).toBeVisible();

    await expect.poll(async () => (await readUserCollection('tasks')).filter((t) => t.title.stringValue === 'Pagar servicios').length).toBe(2);
  });

  test('quitar la fecha al editar la elimina del documento', async ({ page }) => {
    await openKanban(page);
    await page.getByRole('button', { name: 'Añadir con detalles' }).click();
    let form = taskForm(page);
    await form.locator('input').first().fill('Tarea con fecha');
    await form.locator('input[type=date]').fill('2030-01-15');
    await form.getByRole('button', { name: 'Crear tarea' }).click();
    await page.getByRole('button', { name: /^Tarea con fecha/ }).first().click();
    form = taskForm(page);
    await form.locator('input[type=date]').fill('');
    await form.getByRole('button', { name: 'Guardar cambios' }).click();
    await expect
      .poll(async () => (await readUserCollection('tasks')).find((t) => t.title.stringValue === 'Tarea con fecha'))
      .toEqual(expect.not.objectContaining({ dueDate: expect.anything() }));
  });

  test('borrar una tarea se puede deshacer', async ({ page }) => {
    await openKanban(page);
    await addTask(page, 'Tarea temporal');
    await page.getByRole('button', { name: 'Acciones de "Tarea temporal"' }).click();
    await page.getByRole('menuitem', { name: 'Eliminar' }).click();
    await expect(page.getByRole('button', { name: 'Completar "Tarea temporal"' })).toBeHidden();
    await page.getByRole('button', { name: 'Deshacer' }).click();
    await expect(page.getByRole('button', { name: 'Completar "Tarea temporal"' })).toBeVisible();
  });

  test('filtros: orden y "Solo vencidas" cuentan como activos', async ({ page }) => {
    await openKanban(page);
    await page.getByRole('button', { name: /^Filtros/ }).click();
    await page.getByRole('button', { name: 'Prioridad', exact: true }).click();
    await page.getByRole('button', { name: 'Solo vencidas' }).click();
    await expect(page.getByRole('button', { name: 'Filtros (1 activos)' })).toBeVisible();
  });

  test('contextos: crear uno y que sobreviva a la recarga', async ({ page }) => {
    await page.goto('/settings');
    await page.getByRole('button', { name: /nuevo contexto/i }).click();
    await page.getByPlaceholder('Ej. Personal, Gimnasio, Freelance...').fill('Personal');
    await page.getByRole('button', { name: 'Crear contexto' }).click();
    await page.getByRole('button', { name: /cambiar contexto/i }).click();
    await page.getByRole('menuitem', { name: 'Personal' }).click();
    await page.goto('/kanban');
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Personal');
  });

  test('notas: atajo ?new=1, fijar y buscar', async ({ page }) => {
    await page.goto('/notes?new=1');
    await expect(page.getByRole('heading', { name: 'Nueva Nota' })).toBeVisible();
    await page.getByPlaceholder('Ej. Apuntes de la clase de hoy').fill('Ideas del proyecto');
    await page.getByPlaceholder('Escribe tu recordatorio o apunte...').fill('Revisar la propuesta');
    await page.getByRole('button', { name: 'Crear nota' }).click();
    await page.getByRole('button', { name: 'Fijar "Ideas del proyecto"' }).click();
    await expect(page.getByRole('button', { name: 'Desfijar "Ideas del proyecto"' })).toBeVisible();
    await page.getByLabel('Buscar notas').fill('zzz');
    await expect(page.getByText('Ninguna nota coincide con la búsqueda.')).toBeVisible();
  });

  test('horario: avisa choques y navega por semanas', async ({ page }) => {
    await page.goto('/schedule');
    for (const [title, start, end] of [['Gimnasio', '18:00', '19:00'], ['Clase de inglés', '18:30', '19:30']]) {
      await page.getByRole('button', { name: 'Nueva' }).click();
      await page.getByPlaceholder('Ej: Gimnasio, Estudio, Reunión...').fill(title);
      for (const day of ['L', 'M', 'X', 'J', 'V', 'S', 'D']) await page.getByRole('button', { name: day, exact: true }).click();
      await page.locator('input[type=time]').nth(0).fill(start);
      await page.locator('input[type=time]').nth(1).fill(end);
      await page.getByRole('button', { name: 'Crear Rutina' }).click();
    }
    await expect(page.getByText(/con choque de horario/).first()).toBeVisible();
    const range = page.getByText(/\d+ \w+ – \d+ \w+/).first();
    const before = await range.textContent();
    await page.getByRole('button', { name: 'Semana siguiente' }).click();
    await expect(range).not.toHaveText(before ?? '');
  });

  test('tickets: /tickets es público con botón Administrar; Tickets no está en la barra', async ({ page }) => {
    await page.goto('/tickets');
    await expect(page.getByRole('heading', { name: 'Enviar una solicitud' })).toBeVisible();
    await expect(page.getByRole('navigation', { name: 'Navegación principal' })).toHaveCount(0);
    await page.getByRole('link', { name: 'Administrar tickets' }).click();
    await expect(page).toHaveURL(/\/tickets\/admin$/);
    await page.getByRole('radio', { name: /Historial/ }).click();
    await expect(page.getByText('Todavía no hay tickets completados.')).toBeVisible();
    const navLabels = await page.getByRole('navigation', { name: 'Navegación principal' }).getByRole('link').allTextContents();
    expect(navLabels.join(' ')).not.toMatch(/tickets/i);
  });

  test('Ajustes tiene la sección Tickets: compartir enlace y administrar', async ({ page }) => {
    await page.goto('/settings');
    await expect(page.getByRole('button', { name: 'Compartir enlace del formulario' })).toBeVisible();
    await page.getByRole('link', { name: 'Administrar' }).click();
    await expect(page).toHaveURL(/\/tickets\/admin$/);
    await expect(page.getByRole('button', { name: 'Compartir el formulario público de tickets' })).toHaveText('Compartir');
  });

  test('sin conexión aparece el aviso', async ({ page, context }) => {
    await openKanban(page);
    await context.setOffline(true);
    await expect(page.getByText(/Sin conexión/)).toBeVisible();
    await context.setOffline(false);
  });

  test('exportar descarga un respaldo con fechas ISO', async ({ page }) => {
    await openKanban(page);
    await addTask(page, 'Para el respaldo');
    await page.goto('/settings');
    const downloadPromise = page.waitForEvent('download');
    await page.getByRole('button', { name: /Exportar mis datos/ }).click();
    const download = await downloadPromise;
    const data = JSON.parse(await (await download.createReadStream()).toArray().then((chunks) => Buffer.concat(chunks).toString('utf8')));
    expect(data.tasks.map((t: { title: string }) => t.title)).toContain('Para el respaldo');
    expect(data.tasks[0].createdAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  test('IA: muestra la propuesta antes de crear (requiere E2E_AI=1 y GEMINI_API_KEY)', async ({ page }) => {
    test.skip(!process.env.E2E_AI, 'Llama a Gemini de verdad; se activa con E2E_AI=1');
    await openKanban(page);
    await page.getByRole('button', { name: 'Planificar con IA' }).click();
    await page.getByPlaceholder(/Describe lo que tienes que hacer/).fill('Mañana llamar al dentista y el viernes entregar el informe');
    await page.getByRole('button', { name: 'Proponer tareas' }).click();
    await expect(page.getByText('Revisa la propuesta')).toBeVisible({ timeout: 60_000 });
    await page.getByRole('button', { name: /^Crear \d+ tarea/ }).click();
    await expect(page.getByText('Tareas creadas con IA')).toBeVisible();
  });
});

test.describe('sin desbloquear', () => {
  test('el formulario público envía un ticket a la cuenta dueña', async ({ page }) => {
    await page.goto('/tickets');
    await expect(page.getByRole('link', { name: 'Administrar tickets' })).toHaveCount(0);
    await page.getByPlaceholder('Ej. Ajustar reporte mensual').fill('Cambiar el logo');
    await page.getByPlaceholder('¿Qué necesitas que se haga exactamente?').fill('Usar la versión nueva del logo en la portada');
    await page.getByPlaceholder('Ej. María, equipo de marketing...').fill('Ana');
    await page.getByRole('button', { name: 'Crear ticket' }).click();
    await expect(page.getByRole('heading', { name: 'Solicitud enviada' })).toBeVisible();

    const response = await fetch(
      `http://127.0.0.1:8080/v1/projects/${PROJECT_ID}/databases/(default)/documents/users/${OWNER_UID}/tasks`,
      { headers: ownerHeaders }
    );
    const body = (await response.json()) as { documents?: { fields: Record<string, { stringValue?: string; booleanValue?: boolean }> }[] };
    const ticket = body.documents?.find((doc) => doc.fields.title.stringValue === 'Cambiar el logo');
    expect(ticket?.fields.isTicket.booleanValue).toBe(true);
    expect(ticket?.fields.requesterName.stringValue).toBe('Ana');
  });

  test('la administración de tickets exige desbloquear la app', async ({ page }) => {
    await page.goto('/tickets/admin');
    await expect(page).toHaveURL(/\/login$/);
  });
});
