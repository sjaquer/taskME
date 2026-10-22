# ⚡ TaskMe

App personal de productividad con estética "Cyber-Focus": tablero Kanban, horario de rutinas, tickets,
notas y una capa de IA para convertir texto libre en tareas. Pensada para usarse dentro de una APK
Android (WebView) y también desde el navegador.

## Módulos

- **Inicio**: resumen del contexto activo (pendientes, críticas, próxima tarea).
- **Tablero (Kanban)**: vista lista o columnas con arrastrar y soltar, filtros por prioridad y proyecto,
  búsqueda, proyectos, captura rápida y generación de tareas con IA (Gemini).
- **Horario**: rutinas semanales recurrentes con indicador de progreso en vivo.
- **Tickets**: pedidos de trabajo de terceros. Sin sesión, `/tickets` muestra un formulario público
  (con anti-spam) que los envía a la cuenta dueña.
- **Notas**: apuntes rápidos por categoría.
- **Ajustes**: módulos visibles, tema y modo de color, efectos visuales, página de inicio, limpieza de
  tareas completadas y notificaciones.

Todo se organiza por **contexto** (`Trabajo` / `Estudio`), seleccionable desde la cabecera.

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

# UID de la cuenta dueña: destino de los tickets enviados por el formulario público
OWNER_UID=

# IA (Gemini)
GEMINI_API_KEY=
# Opcional: modelo a usar (por defecto googleai/gemini-flash-latest)
GEMINI_MODEL=
```

Las reglas de seguridad están en `firestore.rules` (despliegue con `firebase deploy --only firestore`).

## Scripts

```bash
npm run dev         # servidor de desarrollo (puerto 9002)
npm run build       # build de producción
npm run start       # servir el build
npm run typecheck   # chequeo de tipos
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
| `POST /api/tickets` | pública (con límite) | crear ticket desde el formulario público |
| `POST /api/v1/ai/tasks` | Bearer | generar tareas desde texto |
| `POST /api/v1/devices/register` | Bearer | registrar token push de un dispositivo |
| `DELETE /api/v1/devices/{id}` | Bearer | dar de baja un dispositivo |
| `POST /api/v1/notifications/{id}/opened` · `/read` | Bearer | marcar notificación |
| `POST /api/v1/events/mobile-log` | Bearer | telemetría mínima de la app |

Las rutas Bearer esperan `Authorization: Bearer <Firebase ID token>`.

## Licencia

MIT. Ver [LICENSE](LICENSE).
