# ⚡ TaskMe v2.0 - High-Performance Productivity System

TaskMe es un ecosistema de productividad de grado profesional diseñado bajo una estética "Cyber-Focus". Optimizado para el rendimiento y la seguridad, permite a los usuarios orquestar sus flujos de trabajo, rutinas académicas y eventos personales en una interfaz unificada y persistente en la nube.

## 🚀 Tecnologías Core
- **Framework**: Next.js 15 (App Router)
- **Base de Datos**: Firebase Firestore (Estructura Normalizada)
- **Autenticación**: Firebase Auth (Email/Pass & Anonymous)
- **Estilos**: Tailwind CSS con componentes Shadcn UI
- **Animaciones**: Framer Motion para física de UI fluida
- **Estado Global**: Zustand con persistencia híbrida (Local + Cloud)

## 🛠️ Funcionalidades Principales

### 1. Orquestación de Procesos (Kanban)
- **Tablero Dinámico**: Gestión de estados personalizada.
- **Drag & Drop**: Movimiento fluido de nodos entre columnas.
- **Gestión CRUD Total**: Creación, edición técnica y depuración de tareas.
- **Priorización Visual**: Etiquetas de prioridad con efectos de brillo neón.

### 2. Monitor de Rutinas (Schedule)
- **Bloques Recurrentes**: Configuración de horarios semanales (ideal para estudiantes).
- **Seguimiento en Vivo**: Barra de progreso en tiempo real para la actividad actual.
- **Línea de Tiempo Adaptativa**: Visualización clara de la carga horaria diaria.

### 3. Control de Eventos (Calendar)
- **Recurrencia Avanzada**: Eventos semanales y mensuales.
- **Categorización**: Etiquetas por color para eventos Académicos, Laborales y Personales.
- **Indicadores de Actividad**: Puntos neón en el calendario para identificar días ocupados.
- **Metadatos Enriquecidos**: Registro de lugar, hora y notas técnicas.

### 4. Terminal de Comando (Dashboard)
- **Métricas de Eficiencia**: Cálculo dinámico del progreso del ciclo actual.
- **Pipeline de Prioridades**: Acceso instantáneo a los 3 nodos más críticos del día.
- **Monitor de Sistema**: Indicadores de carga y alertas de enfoque.

## 🔒 Seguridad y Optimización
- **Defensa en Profundidad**: Reglas de Firestore que validan identidad e integridad de esquema.
- **Validación con Zod**: Limpieza y sanitización de datos en el cliente.
- **Arquitectura No-Bloqueante**: Mutaciones de datos optimistas para una UI instantánea.
- **Consultas de Precisión**: Filtrado en servidor para minimizar costos de lectura en Firebase.

## ⚙️ Personalización
- **Feature Flags**: Activa o desactiva módulos enteros desde la configuración.
- **Cloud Settings**: Tus preferencias te siguen a cualquier dispositivo.
- **OLED UI**: Interfaz optimizada para negros puros y alto contraste.

---
*Desarrollado para operadores de alto rendimiento.*
