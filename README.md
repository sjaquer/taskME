# ⚡ TaskMe v2.0 - High-Performance Productivity System

TaskMe is a professional-grade productivity ecosystem designed with a "Cyber-Focus" aesthetic. Optimized for performance and security, it allows users to orchestrate workflows, academic routines, and personal events in a unified, persistent cloud-based interface.

---

## 🇪🇸 Resumen (Español)

TaskMe es un ecosistema de productividad diseñado bajo una estética "Cyber-Focus". Permite gestionar flujos de trabajo, rutinas académicas y eventos personales en una interfaz unificada y persistente en la nube.

### Tecnologías Core
- **Framework**: Next.js 15.5 (App Router, Turbopack)
- **Runtime**: React 19
- **Base de Datos**: Firebase Firestore + Admin SDK
- **Autenticación**: Firebase Auth
- **Estilos**: Tailwind CSS + Radix UI
- **Estado**: Zustand
- **IA**: Google Genkit + Generative AI
- **Formularios**: React Hook Form + Zod
- **Drag & Drop**: dnd-kit
- **Animaciones**: Framer Motion

---

## 🚀 Key Features / Funcionalidades Principales

### 1. Process Orchestration (Kanban) / Orquestación de Procesos
- **Dynamic Board**: Personalized state management with drag & drop. / Gestión de estados con arrastre fluido.
- **Drag & Drop**: Built with dnd-kit for smooth interactions. / Construido con dnd-kit para interacciones fluidas.
- **Visual Prioritization**: Dynamic task sorting and filtering. / Ordenamiento dinámico y filtrado visual.

### 2. Routine Monitor (Schedule) / Monitor de Rutinas
- **Recurring Blocks**: Weekly schedule configuration. / Configuración de horarios semanales.
- **Live Tracking**: Real-time progress visualization. / Seguimiento en vivo con visualización en tiempo real.

### 3. Event Control (Calendar) / Control de Eventos
- **Google Calendar Integration**: Two-way sync with Google Calendar. / Integración bidireccional con Google Calendar.
- **React Day Picker**: Advanced calendar interactions. / Interacciones avanzadas con calendario.

### 4. Intelligence Layer / Capa de Inteligencia
- **Google Genkit**: AI-powered task suggestions and automation. / Sugerencias de tareas impulsadas por IA.
- **Generative AI**: Contextual assistance within the app. / Asistencia contextual dentro de la aplicación.

### 5. Mobile Integration / Integración Móvil
- **Native Bridge**: Seamless webview communication. / Comunicación bidireccional con aplicaciones nativas.
- **Notification System**: Push notifications and in-app alerts. / Notificaciones push y alertas en la aplicación.

---

## 🛠️ Setup & Installation / Instalación

### Prerequisites
- Node.js 20+
- Firebase Project with Firestore enabled
- Google Cloud Console Project (for Calendar API & Generative AI)

### 1. Clone the repository
```bash
git clone https://github.com/your-username/taskme.git
cd taskme
```

### 2. Install dependencies
```bash
npm install
```

### 3. Environment Variables
Create `.env.local` with your configuration:
```env
# Firebase
NEXT_PUBLIC_FIREBASE_API_KEY=your_api_key
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your_auth_domain
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your_project_id
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your_storage_bucket
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
NEXT_PUBLIC_FIREBASE_APP_ID=your_app_id

# Firebase Admin (Server-side)
FIREBASE_SERVICE_ACCOUNT_KEY=your_service_account_key_json
# OR
FIREBASE_PROJECT_ID=your_project_id
FIREBASE_CLIENT_EMAIL=your_client_email
FIREBASE_PRIVATE_KEY=your_private_key

# Google Calendar
NEXT_PUBLIC_GOOGLE_CLIENT_ID=your_google_client_id

# Google Generative AI
GOOGLE_GENERATIVE_AI_API_KEY=your_genai_api_key
```

### 4. Run development server
```bash
npm run dev
```

The application will start at `http://localhost:9002` (configured port).

### 5. Optional: Run Genkit AI Development
```bash
npm run genkit:dev      # Start Genkit development server
npm run genkit:watch    # Watch mode for AI features
```

---

## 🏗️ Project Structure

```
src/
├── app/                 # Next.js pages (Kanban, Calendar, Schedule, etc.)
├── components/          # React components (Atomic design: atoms, molecules, organisms)
├── services/           # Business logic (tasks, users, notifications)
├── hooks/              # Custom hooks (Google Calendar, Mobile Bridge, Notifications)
├── firebase/           # Firebase configuration and setup
├── server/             # Server-side code (Firebase Admin, Auth)
├── ai/                 # AI/Genkit features (Development)
├── lib/                # Utilities and helpers
└── types/              # TypeScript definitions
```

---

## 🔒 Security & Optimization / Seguridad y Optimización

- **Defense in Depth**: Firestore rules for identity and schema validation.
- **Zod Validation**: Client-side data sanitization with React Hook Form.
- **Non-Blocking Architecture**: Optimistic UI mutations for instant feedback.
- **Precision Queries**: Server-side filtering to minimize Firebase costs.
- **TypeScript Strict**: Full type safety across the codebase.
- **ESLint Configuration**: Strict linting rules enforced at build time.

---

## 📊 Available Scripts

```bash
npm run dev              # Start Next.js dev server (Turbopack) on port 9002
npm run genkit:dev     # Start Genkit AI development server
npm run genkit:watch   # Watch mode for AI features
npm run build          # Production build
npm run start          # Start production server
npm run typecheck      # TypeScript type checking only
npm run lint           # Run ESLint
```

---

## 🔌 API Routes

The application exposes API endpoints at `/api/v1/` for server-side operations:
- Task management
- User data synchronization
- Webhook integrations
- Authentication flows

---

## 📜 License / Licencia

This project is licensed under the **MIT License**. See the [LICENSE](LICENSE) file for details.

---
*Developed for high-performance operators.*
