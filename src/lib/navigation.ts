import { Clock, Home, LayoutGrid, NotebookText, Settings, type LucideIcon } from 'lucide-react';

// Tickets no va en la navegación: /tickets es el formulario público y la
// gestión se abre desde ahí (botón "Administrar") o desde el Tablero.
export type NavModule = 'dashboard' | 'kanban' | 'schedule' | 'notes';

export interface NavItem {
  key: NavModule | 'settings';
  icon: LucideIcon;
  label: string;
  href: string;
}

export const NAV_MODULES: Record<NavModule, NavItem> = {
  dashboard: { key: 'dashboard', icon: Home, label: 'Inicio', href: '/' },
  kanban: { key: 'kanban', icon: LayoutGrid, label: 'Tablero', href: '/kanban' },
  schedule: { key: 'schedule', icon: Clock, label: 'Horario', href: '/schedule' },
  notes: { key: 'notes', icon: NotebookText, label: 'Notas', href: '/notes' },
};

export const DEFAULT_NAV_ORDER: NavModule[] = ['dashboard', 'kanban', 'schedule', 'notes'];

// Ajustes siempre queda al final y no se puede ocultar.
const SETTINGS_ITEM: NavItem = { key: 'settings', icon: Settings, label: 'Ajustes', href: '/settings' };

/**
 * Orden guardado, sin módulos que ya no existen (p. ej. 'tickets' de versiones
 * anteriores) y completado con los nuevos que aún no estén en la lista.
 */
export function normalizeNavOrder(order: readonly string[] | undefined): NavModule[] {
  const known = (order ?? []).filter((key): key is NavModule => key in NAV_MODULES);
  return [...new Set([...known, ...DEFAULT_NAV_ORDER])];
}

export function getVisibleNavItems(order: NavModule[], activeModules: Record<NavModule, boolean>): NavItem[] {
  return [
    ...normalizeNavOrder(order)
      .filter((key) => activeModules[key])
      .map((key) => NAV_MODULES[key]),
    SETTINGS_ITEM,
  ];
}
