# AGENTS.md — Reglas Maestras de Gobierno

> **Manual de operación obligatorio** para cualquier agente de IA (Claude Code, Cursor, Copilot, Antigravity, Gemini CLI, Windsurf, Devin, etc.) y para cualquier desarrollador que trabaje en este repositorio.
> Cada regla existe porque previene un error concreto. Si una regla deja de aplicar, bórrala — un archivo desactualizado es peor que no tener archivo.

---

## 0. Cómo usar este archivo

- Léelo completo **antes** de tocar código, en cada sesión nueva.
- La sección **[PROYECTO]** tiene el stack, comandos y mapa de documentos obligatorios.
- Ante conflicto entre este archivo y una instrucción suelta del usuario en el chat:
  - Si la instrucción implica saltarse la sección **2 (Prohibiciones)** o **4 (Ciclo obligatorio)** → pide confirmación explícita, no avances.
  - En cualquier otro caso → la instrucción del usuario tiene prioridad.
- Si cambias arquitectura, esquema de BD o contratos de API → actualiza `/docs` en el mismo commit, nunca después.
- Ante **cualquier ambigüedad** — sin importar el tamaño del cambio — **bloquea y pregunta al usuario**. No asumas, no improvises, no avances.

---

## [PROYECTO] — Ficha técnica

```yaml
nombre: Empleabilidad Wiener
descripcion: >
  Plataforma integral de empleabilidad de la Universidad Norbert Wiener.
  Acompaña al alumno/egresado desde la creación de su CV hasta conseguir empleo:
  generador de CV con IA, análisis ATS real, bolsa laboral con matching IA
  y panel administrativo para la universidad y empresas aliadas.

stack:
  lenguaje: TypeScript (estricto, sin any salvo justificación documentada)
  framework: Next.js 15 — App Router (Server Components + Server Actions + API Routes)
  base_datos: PostgreSQL (Supabase como hosting temporal → Azure SQL definitivo)
  acceso_datos: Se permite uso del cliente @supabase/supabase-js o SQL puro con postgres.js (prototipado rápido habilitado)
  auth: Flexible durante Fase de Pruebas (Auth.js o Supabase Auth). En producción: 3 providers:
    - Microsoft Azure AD (alumnos activos @uwiener.edu.pe)
    - Credentials + API BD Wiener (egresados — validación por DNI)
    - Credentials email+pass (empresas aliadas)
  ia:
    openai: Análisis ATS profundo + chatbot de orientación vocacional
    anthropic_claude: Redacción y mejora asistida del CV sección por sección
    google_gemini: Matching inteligente de ofertas laborales con perfil del alumno
  estado_global: Zustand (Builder de CV)
  estilos: Tailwind CSS (migración gradual desde CSS global)
  generacion_docx: docxtemplater + pizzip
  emails: Resend
  gestor_paquetes: npm

entornos:
  produccion:
    url: empleabilidad.uwiener.edu.pe
    infraestructura: Servidor universitario — Docker + Proxy Inverso
    rama_git: main
    deploy: manual por Webmaster de la UNW (git pull + docker compose up --build)
  qa_staging:
    url: empleakit-wiener.vercel.app
    infraestructura: Vercel (auto-deploy)
    rama_git: feat/* (rama activa de desarrollo)
    proposito: Solo revisión de QA — NO es producción

comandos:
  instalar: "npm install"
  dev: "npm run dev"
  build: "npm run build"
  test: "npm test"
  typecheck: "npx tsc --noEmit"
  lint: "npx eslint src --ext .ts,.tsx"
  check_env: "npm run check:env"
  migraciones: "Ver src/lib/db/migrations/ — aplicar con Supabase CLI o psql"
  seed: "psql $DATABASE_URL < src/lib/db/seeds/faculties_careers.sql"

zona_horaria: "America/Lima (UTC-5)"

docs_obligatorias:
  - "docs/plan-estrategico-v2.md — plan de arquitectura y fases aprobado"
  - "docs/EXPEDIENTE_TECNICO_DESPLIEGUE_WIENER.md — guía de despliegue TI"
  - "SECURITY.md — política de seguridad y reporte de vulnerabilidades"

archivos_intocables:
  - "public/plantillas_cv/*.docx (9 plantillas institucionales oficiales — NO modificar)"
  - "public/plantillas_cv_internacionales/*.docx (5 plantillas internacionales — NO modificar)"
  - "src/lib/db/migrations/*.sql (migraciones ya aplicadas — NUNCA editar, crear nueva)"
  - "src/lib/db/seeds/faculties_careers.sql (catálogo oficial UNW — solo TI puede actualizarlo)"
  - "docs/EXPEDIENTE_TECNICO_DESPLIEGUE_WIENER.md (aprobado por TI — no editar sin autorización)"
```

---

## 1. Principios Rectores

1. **Nunca adivines lo que puedes verificar.** Si no sabes cómo se llama una tabla, función o endpoint, búscalo en el código o en `/docs` antes de escribirlo.
2. **Ante ambigüedad: bloquea y pregunta.** No importa el tamaño del cambio. Si no tienes certeza, para y pregunta antes de escribir una sola línea.
3. **Cambios pequeños, quirúrgicos y reversibles.** Si detectas que hace falta un refactor grande, propónlo por separado — no lo mezcles con la tarea pedida.
4. **Reusa antes de crear.** Antes de escribir cualquier función, componente o query nueva, busca en todo el repo si ya existe algo equivalente.
5. **La evidencia manda sobre la afirmación.** "Ya funciona" no es válido sin el output del test, build o comando que lo demuestra.
6. **Pensado para 78,923 usuarios simultáneos.** Antes de cerrar una tarea, pregúntate: ¿esto rompe si 1,000 usuarios hacen lo mismo a la vez? ¿si el campo llega nulo? ¿si la IA no responde?
7. **`docs/plan-estrategico-v2.md` es la fuente de verdad.** Si el código contradice ese documento, para y pregunta cuál es correcto.

---

## 2. Prohibiciones Estrictas (NO NEGOCIABLES)

Ningún agente ni desarrollador puede hacer lo siguiente sin aprobación explícita del propietario del proyecto:

### 2.1 Base de Datos
- `DROP TABLE`, `DROP DATABASE`, `DROP SCHEMA`, `TRUNCATE` — en cualquier entorno.
- `DELETE` o `UPDATE` sin cláusula `WHERE` explícita con condición real (no `WHERE 1=1`).
- **Editar** una migración SQL ya committeada en el repositorio. Si necesitas cambiar el esquema, crea una nueva migración numerada.
- Ejecutar cualquier query destructiva contra producción (`empleabilidad.uwiener.edu.pe`) sin que el usuario lo pida explícitamente y confirme el entorno.
- Usar concatenación insegura de strings para construir queries SQL en caso de usar SQL directo. Se permite el uso de clientes oficiales como `@supabase/supabase-js` para prototipado rápido y desarrollo.
- En producción, preferir centralizar el acceso a datos en `src/lib/` (vía `queries/*.ts` o servicios modulares).

### 2.2 Capa de IA
- Exponer API Keys de OpenAI, Anthropic o Google al cliente (browser). Todas las llamadas a IA se hacen desde Server Side (API Routes de Next.js).
- Enviar el contenido completo del CV (incluyendo DNI, fecha de nacimiento, datos médicos) a una IA sin antes sanitizar campos que no son necesarios para el análisis.
- Guardar el prompt enviado a la IA o la respuesta completa en logs de producción. Solo se registra: `{ provider, duration_ms, score, user_id, listing_id }`.
- Superar los rate limits por usuario: **20 análisis ATS / día**, **50 asistencias de redacción / día**. Si se alcanza el límite, retornar HTTP 429 con mensaje claro.

### 2.3 Seguridad y Datos Personales (Ley N.° 29733)
- Secretos, tokens, API keys o contraseñas hardcodeadas en código fuente — incluyendo en archivos `.md` de documentación.
- Loggear en texto plano: contraseñas, tokens JWT, DNI completo, números de teléfono, datos de salud.
- Almacenar el DNI del egresado en texto claro. **Siempre**: hash `bcrypt` en la columna `dni_hash`.
- Omitir validación de dominio `@uwiener.edu.pe` en el callback de Azure AD.
- Permitir que un usuario acceda a CVs, postulaciones o notificaciones de otro usuario. Toda query de datos de usuario debe incluir `WHERE user_id = $userId` o equivalente.

### 2.4 Archivos del Proyecto
- Modificar cualquier archivo de la lista `archivos_intocables` del bloque `[PROYECTO]`.
- Agregar nuevas dependencias npm al `package.json` sin avisar explícitamente al usuario y esperar confirmación (cada dependencia nueva es un vector de ataque potencial y afecta el bundle).
- Crear migraciones que alteren tablas del catálogo UNW (`faculties`, `careers`) sin confirmación explícita del propietario — estos datos los gestiona TI.

### 2.5 Calidad de Código
- `try/catch` vacíos o que silencien errores sin logguearlos.
- Retornar datos mockeados o hardcodeados en código de producción.
- Comentar o deshabilitar tests para que pasen.
- Marcar una tarea como terminada sin haber corrido build + typecheck + tests.

---

## 3. Arquitectura y Convenciones del Proyecto

### 3.1 Estructura de Capas (obligatoria)

```
src/
├── app/              → Rutas Next.js (páginas y API Routes) — sin lógica de negocio
├── components/       → Componentes React reutilizables — sin lógica de negocio
├── lib/
│   ├── auth/         → Configuración Auth.js — solo auth
│   ├── db/
│   │   ├── client.ts       → Una sola instancia del pool de conexión
│   │   ├── migrations/     → SQL numerados, nunca se editan una vez aplicados
│   │   ├── seeds/          → Datos de catálogo UNW (solo lectura para agentes)
│   │   └── queries/        → TODO el acceso a datos va aquí, nunca en otro lado
│   └── ai/
│       ├── router.ts       → Decide qué IA usar según el tipo de request
│       ├── openai.ts       → Solo wrapper de OpenAI, sin lógica de negocio
│       ├── claude.ts       → Solo wrapper de Anthropic
│       └── gemini.ts       → Solo wrapper de Gemini
├── store/            → Estado global Zustand (solo Builder de CV)
└── types/            → Tipos TypeScript del dominio — importar desde aquí, nunca redefinir
```

**Regla de dependencias:** `app` puede importar de `lib` y `components`. `lib` NO puede importar de `app` ni de `components`. `components` puede importar de `lib` pero nunca de `app`.

### 3.2 Convenciones de Nombrado

| Contexto | Convención | Ejemplo |
|---------|-----------|---------|
| Tablas y columnas SQL | `snake_case` | `job_listings`, `created_at`, `user_id` |
| Archivos TypeScript | `camelCase` para utils, `PascalCase` para componentes | `cvQueries.ts`, `CVPreview.tsx` |
| Variables y funciones TS | `camelCase` | `getUserCVs`, `listingId` |
| Tipos e Interfaces TS | `PascalCase` | `CVDocument`, `JobListing` |
| Slugs de facultad/carrera | `kebab-case` | `ciencias-salud`, `ingenieria-sistemas` |
| Rutas API | `kebab-case` | `/api/ai/analyze`, `/api/saved-jobs` |
| Variables de entorno | `SCREAMING_SNAKE_CASE` | `OPENAI_API_KEY`, `DATABASE_URL` |

### 3.3 Reglas de Base de Datos

1. **Acceso a datos unificado** — usar el cliente correspondiente (`src/lib/supabaseClient.ts` para Supabase o `src/lib/db/client.ts` para PostgreSQL directo).
2. **Consultas seguras** — si se usa SQL puro, usar placeholders parametrizados. Si se usa el SDK de Supabase, apoyarse en RLS (Row Level Security).
3. **Naming**: tablas en plural `snake_case` (`users`, `job_listings`), columnas en `snake_case`, PKs siempre `uuid` generado con `gen_random_uuid()`.
4. **Toda nueva tabla** necesita como mínimo: `id uuid PK`, `created_at timestamptz DEFAULT now()`.
5. **Toda tabla con mutaciones** (update/delete) necesita además: `updated_at timestamptz DEFAULT now()`.
6. **Migraciones**: archivos en `src/lib/db/migrations/` nombrados `NNN_descripcion_corta.sql` (ej: `003_add_saved_jobs.sql`). Una vez committeada y aplicada, es inmutable.
7. **Nunca tocar `faculties` ni `careers`** directamente desde código de la aplicación. Son datos de catálogo de TI. Solo lectura desde la app.
8. **RLS (Row Level Security)**: cuando se migre a Azure SQL o se use Supabase con RLS, toda tabla de datos de usuario debe tener políticas que validen `user_id = auth.uid()`. Documenta en el SQL de la migración si se activa o no RLS y por qué.

### 3.4 Reglas de la Capa de IA

1. **Responsabilidades fijas** — no intercambiar el rol de cada IA sin aprobación:
   - `openai.ts` → ATS + chatbot de orientación
   - `claude.ts` → Redacción y mejora del CV
   - `gemini.ts` → Job matching con perfil del alumno
2. **Retry policy**: 1 reintento con backoff exponencial (espera 2s) si la API retorna 429 o 5xx. Si falla el reintento → lanzar error HTTP 503 con mensaje amigable al usuario.
3. **Nunca enviar campos innecesarios al prompt**. El DNI, fecha de nacimiento y datos de salud se excluyen del prompt antes de enviarlo a cualquier IA.
4. **Logging permitido en producción**: `{ ai_provider, endpoint, duration_ms, score, user_id, listing_id, error_code }`. Nada más.
5. **Rate limiting por usuario**: verificar contra BD antes de llamar a la IA. Si el usuario supera el límite, retornar `{ error: "RATE_LIMIT_EXCEEDED", resetAt: "..." }` con HTTP 429.

### 3.5 Flujo de Ramas y Deploys

```
feat/<nombre>  →  push  →  Vercel QA (auto-deploy, para revisión de QA)
                               ↓
                        QA aprueba → merge PR a main
                                         ↓
                               Webmaster UNW hace: git pull + docker compose up --build
                                         ↓
                               Producción: empleabilidad.uwiener.edu.pe
```

- **Nunca mergear directamente a `main`** sin aprobación de QA.
- **Nunca deployar manualmente a producción** — esa responsabilidad es del Webmaster de la UNW.
- Los commits deben tener mensajes descriptivos en español o inglés: `feat(auth): agrega validación de DNI para egresados`.

### 3.6 TypeScript

- **Modo estricto activado** — `strict: true` en `tsconfig.json`.
- **Sin `any`** salvo que sea absolutamente inevitable, en cuyo caso documenta el porqué con un comentario.
- **Tipos del dominio** en `src/types/` — importar siempre desde ahí. Si el tipo no existe, créalo ahí antes de usarlo.
- **Validación en bordes del sistema**: todo input que viene del exterior (formularios, APIs externas, respuestas de IA) debe validarse con Zod antes de usarse.

---

## 4. Ciclo Obligatorio de Trabajo: Explorar → Planificar → Implementar → Verificar → Entregar

Todo cambio pasa por estas fases en orden. No se salta ninguna.

### Fase 1 — Explorar (solo lectura)
1. Lee `[PROYECTO]` y las `docs_obligatorias` relevantes a la tarea.
2. Busca en el repo funciones, queries o componentes que ya resuelvan el problema.
3. Identifica todas las tablas, columnas, endpoints y componentes afectados.
4. Si algo es ambiguo → **bloquea y pregunta**. No asumas.

### Fase 2 — Planificar (sin escribir código de producción)
1. Redacta qué archivos se crean/modifican, qué migraciones se necesitan y qué riesgos existen.
2. Para cambios que tocan BD o seguridad → **presenta el plan al usuario y espera confirmación** antes de implementar.
3. Divide en slices verticales (BD + servicio + API + UI de una funcionalidad), no horizontales.
4. Enumera qué tests vas a escribir.

### Fase 3 — Implementar
1. Sigue la sección 3 (Arquitectura y Convenciones).
2. Cambios pequeños y verificables en cada paso — no acumules 15 archivos sin probar nada.
3. Si el cambio altera arquitectura, esquema o contrato de API → actualiza `/docs` en el mismo commit.

### Fase 4 — Verificar
1. Corre: `npm run build` + `npx tsc --noEmit` + `npm test`.
2. Si algo falla → arréglalo antes de continuar. Nunca se entrega con errores conocidos.
3. Para cambios de BD: verifica que la migración es reversible si hay datos existentes.

### Fase 5 — Entregar
1. Resume: qué se cambió, por qué, evidencia real de los tests (no solo "funciona").
2. Señala deuda técnica introducida a propósito o seguimiento pendiente.
3. No marcar como completo si build o tests no pasan al 100%.

---

## 5. QA y Pruebas

### 5.1 Qué probar siempre
- **Función o endpoint nuevo/modificado**: caso feliz, caso límite (nulo, vacío, máximo), caso de error.
- **Queries de BD**: verificar que incluyen filtro `user_id` donde corresponde. Nunca retornar datos de otro usuario.
- **Capa de IA**: qué pasa cuando la API retorna error 429, 500, timeout, respuesta malformada.
- **Autenticación**: verificar que rutas protegidas retornan 401/403 sin sesión válida.

### 5.2 Checklist de cierre (obligatorio)
- [ ] `npm run build` sin errores
- [ ] `npx tsc --noEmit` sin errores
- [ ] `npm test` en verde
- [ ] Pruebas nuevas: caso feliz + límite + error
- [ ] Queries de BD incluyen filtro de usuario correcto
- [ ] Sin secretos hardcodeados
- [ ] Sin `try/catch` vacíos
- [ ] Sin SQL concatenado
- [ ] Documentación en `/docs` actualizada si cambió arquitectura, esquema o API
- [ ] Resumen con evidencia real (output del terminal), no solo afirmación

### 5.3 Autorrevisión antes de entregar
- ¿Hay código duplicado que ya existía?
- ¿Los nombres reflejan el dominio del negocio?
- ¿Un usuario puede acceder accidentalmente a datos de otro usuario?
- ¿Qué pasa si la IA no responde?
- ¿El cambio es reversible?

---

## 6. Seguridad y Privacidad (Ley N.° 29733)

La plataforma maneja datos personales identificables de más de 78,000 usuarios (nombre, DNI, correo, historial de postulaciones, CVs con datos de salud en algunos casos). Reglas no negociables:

1. **DNI**: solo se almacena como hash `bcrypt`. Nunca en texto claro. La API de validación de la UNW solo devuelve `{ es_egresado: boolean, nombre: string }` — no guardamos más.
2. **JWT / Sesiones**: tokens de Auth.js nunca se exponen en logs ni en respuestas de API innecesariamente.
3. **CORS**: la whitelist en `middleware.ts` o `next.config.ts` solo permite `empleabilidad.uwiener.edu.pe` y `empleakit-wiener.vercel.app`. Nunca `*`.
4. **Variables de entorno**: todo secreto en `.env.local` (local) o en las variables de entorno del servidor (producción). Nunca en código fuente ni en archivos `.md`.
5. **Datos médicos**: egresados de Salud pueden tener publicaciones o experiencias con datos clínicos. Estos se excluyen del prompt de IA salvo que sea estrictamente necesario para el análisis.
6. **Derecho al olvido**: el sistema debe permitir eliminar cuenta + todos los datos asociados del usuario. Al implementar cualquier tabla nueva de datos de usuario, considera este caso.

---

## 7. Gestión de Contexto y Comunicación

- **Bloquea ante ambigüedad** — no improvises, especialmente en BD y seguridad.
- **Reporta bloqueos de inmediato**, no al final de una sesión larga de intentos fallidos.
- **El resumen de cierre incluye**: qué cambió, qué se probó, evidencia real, qué queda pendiente.
- **Si vas a tocar un archivo intocable**: para, notifica al usuario y espera instrucción explícita.
- **Si encuentras una vulnerabilidad de seguridad** mientras trabajas en otra cosa: repórtala inmediatamente antes de continuar con la tarea original.

---

## 8. Mantenimiento de este Archivo

- Trátalo como código: se actualiza cuando cambia una convención, no después.
- Agrega una regla nueva solo cuando un error concreto la justifique.
- Elimina reglas que ya no apliquen.
- Mantenlo corto y accionable — procedimientos extensos van en `/docs`, no aquí.

---

*Última actualización: Septiembre 2026 — Empleabilidad Wiener v3.0*
