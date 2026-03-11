# **App Name**: TaskMe

## Core Features:

- Kanban Task Board: An interactive task board with 'Pending', 'Doing', and 'Done' columns, supporting drag-and-drop functionality using a library like dnd-kit or react-beautiful-dnd for task management, with data stored in Firestore and filtered by context.
- Context Switcher: A header-based switch allowing users to effortlessly alternate between 'Work' and 'Study' contexts, globally filtering data throughout the application using Zustand.
- Smart Scheduling View: A weekly schedule view enabling visualization and management of time blocks and tasks, with data stored in Firestore.
- Firebase Integration with Offline Persistence: Firestore configured with offline persistence enabled, ensuring all tasks are saved with a 'context' field (e.g., 'Work', 'Study') for proper filtering and data resilience.
- User Authentication: Secure user registration and login functionality via Firebase Auth to manage personal task data within Firestore.
- Reminders & Notifications: Logic for triggering timely notifications based on task due dates, retrieved and synchronized from Firestore.

## Style Guidelines:

- Background color: A matte dark gray/black (#0D0D0D) for a sophisticated, cyber-glassmorphism base.
- Accent color: Vibrant neon green (#39FF14) for high-priority elements, interactive components, and visual highlights.
- Body and headline font: 'Inter' (sans-serif) for a clean, modern, and highly legible presentation, complementing the tech aesthetic.
- Utilize icons from 'Lucide-React' to ensure a consistent, sharp, and modern visual language across all interface elements.
- Strict Cyber-Glassmorphism aesthetic with cards featuring a backdrop-blur of approximately 20px and subtle, semi-transparent borders for depth and modernity.
- Mobile-First design ensuring impeccable display on all screen sizes, including 'Safe Area Insets' for modern mobile devices to prevent UI clipping.
- A fixed Bottom Navigation Bar for primary navigation (Home, Calendar, Kanban, Schedule, Settings), with no sidebars, optimizing screen real estate for mobile devices.
- A 'Context Switcher' integrated into the header for easy switching between 'Work' and 'Study' views.
- Fluid, native-like page transitions (e.g., slide-in/out effects) powered by Framer Motion, enhancing the overall user experience.