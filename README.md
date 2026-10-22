# ⚡ TaskMe

App personal de productividad con estética "Cyber-Focus": tablero Kanban, horario de rutinas, tickets,
notas y una capa de IA para convertir texto libre en tareas. Pensada para usarse dentro de una APK
Android (WebView) y también desde el navegador.

## Módulos

- **Inicio**: resumen del contexto activo (pendientes, críticas, próxima tarea).
- **Inicio**: lo de ahora y de hoy (rutina en curso, tareas que vencen, prioridad alta).
- **Tablero (Kanban)**: lista o columnas; tareas con fecha y hora, subtareas y repetición diaria/semanal/
  mensual; orden inteligente, filtros (prioridad, proyecto, vencidas), búsqueda, proyectos y planificador IA
  (Gemini) con vista previa antes de crear.
- **Horario**: rutinas semanales por semana, progreso en vivo y aviso de choques de horario.
- **Tickets**: pedidos de terceros con historial y búsqueda. Sin sesión, `/tickets` muestra un formulario
  público (con anti-spam) cuyo enlace se puede compartir.
- **Notas**: apuntes por categoría, con búsqueda, notas fijadas y dictado por voz.
- **Ajustes**: contextos, apariencia, navegación, mantenimiento, exportar datos (JSON), notificaciones y
  diagnóstico de la app.

En el teléfono (APK WebView o navegador): el botón atrás cierra paneles, vibración al completar, dictado por
voz, aviso sin conexión, barra inferior que se oculta con el teclado y atajos del manifest
(`/kanban?new=1`, `/notes?new=1`).

Todo se organiza por **contextos** (Trabajo y Estudio de fábrica, más los que crees en Ajustes, con
nombre, color e icono), seleccionables desde la cabecera. Las preferencias (tema, acento, modo
Oscuro/Claro/Sistema, negro puro, tamaño de texto, navegación) se sincronizan entre dispositivos.

## Tecnologías

Next.js 15 (App Router, Turbopack) · React 19 · TypeScript · Firebase Auth + Firestore + Admin SDK ·
Tailwind CSS + Radix UI · Zustand · Genkit + Gemini · dnd-kit · Framer Motion · Zod

## Puesta en marcha

Requisitos: Node.js 20+ y un proyecto de Firebase con Auth y Firestore.

```bash
npm install
npm run dev   # http://localhost:9002
```

### Variables de entorno (`.env.local`)

```env
# Firebase (cliente)
NEXT_PUBLIC_FIREBASE_API_KEY=
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=
NEXT_PUBLIC_FIREBASE_PROJECT_ID=
NEXT_PUBLIC_FIREBASE_APP_ID=
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=
NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID=

# Firebase Admin (servidor). Si faltan, se usan las credenciales por defecto del entorno.
FIREBASE_PROJECT_ID=
FIREBASE_CLIENT_EMAIL=
FIREBASE_PRIVATE_KEY=

# App personal (una sola persona, sin cuentas):
# UID de Firebase de la dueña: todos los datos viven en users/{OWNER_UID}
OWNER_UID=
# PIN para desbloquear la app en cada dispositivo (mínimo 4 caracteres; solo en el servidor)
APP_PIN=

# IA (Gemini)
GEMINI_API_KEY=
# Opcional: modelo a usar (por defecto googleai/gemini-flash-latest)
GEMINI_MODEL=
```

### Acceso con PIN (sin cuentas)

No hay registro ni inicio de sesión: la primera vez en cada dispositivo se escribe el PIN y la sesión
queda recordada (Ajustes → Acerca de → "Bloquear este dispositivo" la cierra). El servidor valida el PIN,
bloquea tras 5 intentos fallidos en 15 minutos y entrega un token de Firebase para entrar como `OWNER_UID`;
la API rechaza cualquier otro usuario.

Para producción (Firebase App Hosting):

1. Define `APP_PIN` y `OWNER_UID` en el backend (por ejemplo como secretos:
   `firebase apphosting:secrets:set APP_PIN`).
2. El servidor firma el token con su cuenta de servicio: dale el rol
   **Service Account Token Creator** (`roles/iam.serviceAccountTokenCreator`) a la cuenta de servicio del
   backend, o configura `FIREBASE_CLIENT_EMAIL` / `FIREBASE_PRIVATE_KEY`.
3. Recomendado: en Firebase Console → Authentication, desactiva los proveedores que ya no se usan
   (correo/contraseña, Google, anónimo). El acceso por PIN no los necesita.

Las reglas de seguridad están en `firestore.rules` y se despliegan aparte de la web:

```bash
firebase deploy --only firestore:rules
```

### Probar con emuladores (sin tocar el proyecto real)

```bash
firebase emulators:start --only auth,firestore
NEXT_PUBLIC_FIREBASE_EMULATORS=true FIREBASE_AUTH_EMULATOR_HOST=127.0.0.1:9099 \
  FIRESTORE_EMULATOR_HOST=127.0.0.1:8080 APP_PIN=1234 OWNER_UID=yo npm run dev
```

## Tests

```bash
npm run check       # tipos + lint + tests unitarios
npm test            # tests unitarios (Vitest)
npm run test:rules  # firestore.rules contra el emulador
npm run test:e2e    # de punta a punta con Playwright (levanta emuladores y un servidor aislado)
```

Los tests de punta a punta usan un proyecto `demo-` en los emuladores: nunca tocan datos reales. El de la
IA llama a Gemini de verdad y solo corre con `E2E_AI=1`.

## Scripts

```bash
npm run dev         # servidor de desarrollo (puerto 9002)
npm run build       # build de producción
npm run start       # servir el build
npm run typecheck   # chequeo de tipos
npm run lint        # ESLint
```

## Estructura

```
src/app/         páginas y rutas /api
src/components/  componentes (ui, atoms, molecules, organisms, kanban, navegación)
src/services/    acceso a Firestore por entidad
src/firebase/    inicialización y hooks de Firestore
src/server/      código solo de servidor (Admin SDK, auth, rate limit)
src/lib/         store, puente nativo Android, utilidades
src/types/       tipos del dominio
docs/            especificación del puente WebView ↔ Android
```

## API

| Ruta | Auth | Uso |
|---|---|---|
| `POST /api/v1/auth/pin` | pública (con límite) | validar el PIN y obtener la sesión de la dueña |
| `POST /api/tickets` | pública (con límite) | crear ticket desde el formulario público |
| `POST /api/v1/ai/tasks` | Bearer | generar tareas desde texto |
| `POST /api/v1/devices/register` | Bearer | registrar token push de un dispositivo |
| `DELETE /api/v1/devices/{id}` | Bearer | dar de baja un dispositivo |
| `POST /api/v1/notifications/{id}/opened` · `/read` | Bearer | marcar notificación |
| `POST /api/v1/events/mobile-log` | Bearer | telemetría mínima de la app |

Las rutas Bearer esperan `Authorization: Bearer <Firebase ID token>` de la dueña (`OWNER_UID`).

## Licencia

MIT. Ver [LICENSE](LICENSE).
