import {
  BookOpen,
  Briefcase,
  Code2,
  Dumbbell,
  GraduationCap,
  Heart,
  Home,
  Palette,
  Rocket,
  Sparkles,
  Users,
  Wallet,
  type LucideIcon,
} from 'lucide-react';
import type { ContextDef } from '@/types/task';

export const CONTEXT_ICONS: Record<string, LucideIcon> = {
  briefcase: Briefcase,
  graduation: GraduationCap,
  home: Home,
  heart: Heart,
  dumbbell: Dumbbell,
  book: BookOpen,
  code: Code2,
  palette: Palette,
  rocket: Rocket,
  users: Users,
  wallet: Wallet,
  sparkles: Sparkles,
};

export const CONTEXT_COLORS = ['#3dbd7d', '#3b82f6', '#a855f7', '#f97316', '#ef4444', '#ec4899', '#eab308', '#14b8a6', '#64748b'];

export const MAX_CONTEXTS = 12;

/** Contextos con los que nace la app. Sus ids coinciden con el valor guardado en los datos antiguos. */
export const DEFAULT_CONTEXTS: ContextDef[] = [
  { id: 'Trabajo', name: 'Trabajo', color: '#3dbd7d', icon: 'briefcase', order: 0 },
  { id: 'Estudio', name: 'Estudio', color: '#3b82f6', icon: 'graduation', order: 1 },
];

export const DEFAULT_TICKETS_CONTEXT = 'Trabajo';

export function getContextIcon(icon: string | undefined): LucideIcon {
  return (icon && CONTEXT_ICONS[icon]) || Sparkles;
}

export function sortContexts(contexts: ContextDef[]): ContextDef[] {
  return [...contexts].sort((a, b) => a.order - b.order || a.name.localeCompare(b.name));
}
