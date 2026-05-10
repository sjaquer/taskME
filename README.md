# ⚡ TaskMe v2.0 - High-Performance Productivity System

<p align="center">
  <img src="https://raw.githubusercontent.com/sjaquer/taskME/main/public/banner.png" alt="TaskMe Banner" width="100%">
</p>

TaskMe is a professional-grade productivity ecosystem designed with a "Cyber-Focus" aesthetic. Optimized for performance and security, it allows users to orchestrate workflows, academic routines, and personal events in a unified, persistent cloud-based interface.

---

## 🇪🇸 Resumen (Español)

TaskMe es un ecosistema de productividad diseñado bajo una estética "Cyber-Focus". Permite gestionar flujos de trabajo, rutinas académicas y eventos personales en una interfaz unificada y persistente en la nube.

### Tecnologías Core
- **Framework**: Next.js 15 (App Router)
- **Base de Datos**: Firebase Firestore
- **Autenticación**: Firebase Auth
- **Estilos**: Tailwind CSS & Shadcn UI
- **Estado**: Zustand (Persistencia híbrida)

---

## 🚀 Key Features / Funcionalidades Principales

### 1. Process Orchestration (Kanban) / Orquestación de Procesos
- **Dynamic Board**: Personalized state management. / Gestión de estados personalizada.
- **Drag & Drop**: Fluid node movement between columns. / Movimiento fluido entre columnas.
- **Visual Prioritization**: Neon glow effects for priority labels. / Etiquetas de prioridad con efectos neón.

### 2. Routine Monitor (Schedule) / Monitor de Rutinas
- **Recurring Blocks**: Weekly schedule configuration. / Configuración de horarios semanales.
- **Live Tracking**: Real-time progress bar for current activity. / Seguimiento en vivo de la actividad actual.

### 3. Event Control (Calendar) / Control de Eventos
- **Google Calendar Integration**: Sync events from/to your Google account. / Integración bidireccional con Google Calendar.
- **Activity Indicators**: Neon markers for busy days. / Indicadores neón para días ocupados.

### 4. Command Terminal (Dashboard) / Terminal de Comando
- **Efficiency Metrics**: Dynamic progress calculation. / Cálculo dinámico de progreso.
- **Priority Pipeline**: Instant access to critical nodes. / Acceso instantáneo a nodos críticos.

---

## 🛠️ Setup & Installation / Instalación

### Prerequisites
- Node.js 20+
- Firebase Project
- Google Cloud Console Project (for Calendar API)

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
Copy `.env.example` to `.env.local` and fill in your credentials:
```bash
cp .env.example .env.local
```

### 4. Run development server
```bash
npm run dev
```

---

## 🔒 Security & Optimization / Seguridad y Optimización

- **Defense in Depth**: Firestore rules for identity and schema validation.
- **Zod Validation**: Client-side data sanitization.
- **Non-Blocking Architecture**: Optimistic UI mutations for instant feedback.
- **Precision Queries**: Server-side filtering to minimize Firebase costs.

---

## 📜 License / Licencia

This project is licensed under the **MIT License**. See the [LICENSE](LICENSE) file for details.

---
*Developed for high-performance operators.*
