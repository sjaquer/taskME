import { Clock, Home, LayoutGrid, NotebookText, Settings, Ticket, type LucideIcon } from 'lucide-react';

export type NavModule = 'dashboard' | 'kanban' | 'schedule' | 'tickets' | 'notes';

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
  tickets: { key: 'tickets', icon: Ticket, label: 'Tickets', href: '/tickets' },
  notes: { key: 'notes', icon: NotebookText, label: 'Notas', href: '/notes' },
};

export const DEFAULT_NAV_ORDER: NavModule[] = ['dashboard', 'kanban', 'schedule', 'tickets', 'notes'];

// Ajustes siempre queda al final y no se puede ocultar.
const SETTINGS_ITEM: NavItem = { key: 'settings', icon: Settings, label: 'Ajustes', href: '/settings' };

/** Orden guardado, completado con módulos nuevos que aún no estén en la lista. */
export function normalizeNavOrder(order: NavModule[] | undefined): NavModule[] {
  const known = (order ?? []).filter((key) => key in NAV_MODULES);
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
