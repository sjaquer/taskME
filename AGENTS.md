# AGENTS.md — TaskMe

Guía para agentes de IA y desarrolladores que trabajan en este repositorio. Léela antes de tocar código.
Cada regla existe por una razón concreta; si deja de aplicar, bórrala.

## Qué es

TaskMe es una app **100 % personal: una sola persona, sin cuentas ni varios usuarios**. Se desbloquea con un
PIN (`APP_PIN`) por dispositivo y todos los datos viven en `users/{OWNER_UID}`. No agregues registro, login,
perfiles ni nada multiusuario. Módulos: tablero Kanban, horario de rutinas, tickets (pedidos de terceros por
el formulario público `/tickets`; gestión en `/tickets/admin`), notas y personalización.
Se usa sobre todo **dentro de una APK Android que la carga en un WebView**.

## Stack

- Next.js 15 (App Router, Turbopack) + React 19 + TypeScript estricto
- Firebase: Auth, Firestore (cliente con caché persistente) y Admin SDK en las rutas `/api`
- Tailwind CSS + componentes Radix/shadcn (`src/components/ui`)
- Zustand (`src/lib/store.ts`) para preferencias persistidas en el dispositivo
- Genkit + Gemini para generar tareas con IA (`/api/v1/ai/tasks`)
- Hosting: Firebase App Hosting (`apphosting.yaml`)

## Comandos

```bash
npm install
npm run dev        # http://localhost:9002
npm run build
npm run typecheck  # tsc --noEmit

# Probar sin tocar el proyecto real (emuladores de Auth + Firestore, valida firestore.rules):
firebase emulators:start --only auth,firestore
NEXT_PUBLIC_FIREBASE_EMULATORS=true npm run dev

# Un segundo servidor (pruebas) debe usar otra carpeta para no pisar el .next del principal:
NEXT_DIST_DIR=.next-e2e NEXT_PUBLIC_FIREBASE_EMULATORS=true npx next dev -p 9127

# Las reglas NO se despliegan con la web:
firebase deploy --only firestore:rules
```

Antes de dar un cambio por terminado deben pasar `npm run check` (tipos + lint + unitarios) y
`npm run build`; si tocas reglas, `npm run test:rules`; si tocas flujos de UI, `npm run test:e2e`.

## Estructura

```
src/app/            páginas (todas "use client") y rutas /api
src/components/     ui/ (shadcn), forms/ (campos compartidos), kanban/, atoms/molecules/organisms, shell
src/services/       escrituras a Firestore por entidad (task, note, routine, project, user, restore, ai-task)
src/firebase/       inicialización, provider (auth), user-data (lecturas en tiempo real), useCollection
src/server/         solo servidor: firebase-admin, auth por Bearer token, rate limit
src/lib/            store, tasks.ts (helpers puros), schemas.ts (Zod), puente nativo, utilidades
src/types/          tipos del dominio (task.ts, mobile.ts, native-bridge.d.ts)
```

## Datos (Firestore)

- Todo cuelga de `users/{uid}/…`: `tasks` (un ticket es una task con `isTicket: true`), `routines`,
  `projects`, `notes`, `contexts`, `settings/app`, `devices`, `notifications`, `mobile_logs`.
- **Contextos**: el campo `context` de cada documento guarda el **id** de un doc de `contexts`. Los originales
  usan `Trabajo` y `Estudio` como id (sin migración). Nunca compares contra nombres fijos: usa
  `useContexts()` / `useActiveContext()` y muestra `name`. Los de fábrica viven en memoria hasta el primer cambio.
- `settings/app` se sincroniza con el store de Zustand (`SettingsSync`); si agregas una preferencia
  sincronizada, súmala al esquema de `settings-sync.tsx` y a `isValidSettingsDoc` en las reglas.
- `rate_limits/*` solo lo usa el servidor (Admin SDK); los clientes no tienen acceso.
- **`firestore.rules` valida el esquema con `hasOnly([...])`**: si agregas un campo a un documento,
  agrégalo también a la regla correspondiente o la escritura será rechazada en silencio
  (las escrituras son "non-blocking" y el error solo llega al `errorEmitter`).
- Las fechas `dueDate` / `reviewDate` se guardan como texto `YYYY-MM-DD`; la hora opcional va aparte en
  `dueTime` (`HH:mm`). Las tareas pueden tener `checklist` (subtareas) y `recurrence` (daily/weekly/monthly).
- Cambia el estado de una tarea con `setTaskStatus` (crea la siguiente ocurrencia de las recurrentes).
  Para quitar un campo opcional al editar, pásalo en `clear` de `updateTask` (updateDoc no borra campos).
- Los estados del Kanban son fijos: `Pendiente`, `Haciendo`, `Hecho`.

## Integración Android (WebView)

- **El código de la APK actual no está disponible**: no se pueden agregar acciones nativas nuevas.
  La web debe adaptarse a lo que la APK ya expone (ver `src/types/native-bridge.d.ts`):
  `window.AndroidNative` (googleLogin, vibrate, showToast, startVoiceRecognition…) y los callbacks
  `onNativeTokenReceived`, `onGoogleLoginSuccess`, `onVoiceResult`. El protocolo
  `AndroidBridge.postMessage` / `onNativeMessage` (ver `docs/android-webview-spec.md`) es para una APK futura.
- Evita diálogos modales: los formularios van embebidos en la página ("sin modal") por estabilidad en el
  WebView. Para acciones destructivas usa `toastWithUndo` (`src/components/undo-toast.tsx`).
- Todo panel que se abre sobre la página (formulario, filtros, IA) usa `useBackDismiss` para que el botón
  atrás de Android lo cierre (`FormPanel` ya lo incluye).
- Funciones del dispositivo en `src/lib/native-features.ts`: `haptic()` y dictado (`VoiceButton`), con la
  APK actual (`AndroidNative`) y respaldo del navegador.
- En el WebView la API `Notification` del navegador normalmente no existe.

## Convenciones

- Varios archivos usan fin de línea CRLF: al editarlos, consérvalo.
- UI y mensajes en español. Commits con prefijo convencional (`fix(kanban): …`), en español o inglés.
- **Lecturas**: usa `useTasks(context?)`, `useProjects`, `useNotes`, `useRoutines` de `@/firebase/user-data`.
  `UserDataProvider` mantiene una sola suscripción por colección; no abras `onSnapshot` nuevos en páginas.
- **Escrituras**: usa `src/services/*`; no llames a Firestore directamente desde páginas. Firestore aplica las
  escrituras locales al instante, así que no hace falta estado optimista propio.
- **Acceso**: `/login` es la pantalla de PIN; `/api/v1/auth/pin` valida el PIN y entrega un custom token de
  `OWNER_UID`. `ShellRouter` (`client-shell.tsx`) protege las rutas privadas y `requireUserIdFromRequest`
  rechaza en la API cualquier uid distinto de `OWNER_UID`. Las páginas no redirigen por su cuenta.
- **UI minimalista**: cada página usa `PageHeader` (título + una línea de resumen + acción compacta);
  herramientas secundarias van plegadas (filtros, menús "⋯"), no a la vista.
- **Formularios**: arma los formularios con `src/components/forms/form-fields.tsx` (FormPanel, Field,
  PrioritySelect, ProjectSelect, SubmitButton) y valida con los esquemas de `src/lib/schemas.ts`.
- Valida con Zod todo lo que entra por `/api` y lo que devuelve la IA.
- Las rutas `/api/v1/*` autenticadas usan `requireUserIdFromRequest` (token de Firebase en `Authorization: Bearer`).
- Nunca expongas secretos (`GEMINI_API_KEY`, credenciales de Admin) al cliente ni los escribas en archivos versionados.

## Plan de mejoras

Se trabaja por fases: 0 bugs → 1 base de código → 2 personalización (incluye contextos creados por el
usuario) → 3 integración WebView → 4 mejoras por página → 5 tests y lint. Todas completadas.
