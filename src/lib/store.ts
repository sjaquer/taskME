import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { AppContext } from '@/types/task';
import { DEFAULT_TICKETS_CONTEXT } from '@/lib/contexts';

export type AppTheme = 'neon' | 'cyan' | 'amber' | 'rose' | 'violet' | 'emerald' | 'indigo' | 'crimson' | 'slate';
export type HourFormat = '24h' | '12h';
export type TaskRetentionPeriod = 'weekly' | 'monthly' | 'quarterly' | 'yearly';

interface ModuleFlags {
  dashboard: boolean;
  kanban: boolean;
  schedule: boolean;
}

export type ColorMode = 'dark' | 'light';

interface VisualConfig {
  glassIntensity: number;
  glowEnabled: boolean;
  showGrid: boolean;
  compactMode: boolean;
}

interface AppState {
  context: AppContext;
  setContext: (context: AppContext) => void;
  /** Contexto donde se guardan los tickets (también los del formulario público). */
  ticketsContext: AppContext;
  setTicketsContext: (context: AppContext) => void;
  theme: AppTheme;
  setTheme: (theme: AppTheme) => void;
  colorMode: ColorMode;
  setColorMode: (mode: ColorMode) => void;
  activeModules: ModuleFlags;
  toggleModule: (module: keyof ModuleFlags) => void;
  hourFormat: HourFormat;
  setHourFormat: (format: HourFormat) => void;
  defaultPage: string;
  setDefaultPage: (page: string) => void;
  taskRetentionPeriod: TaskRetentionPeriod;
  setTaskRetentionPeriod: (period: TaskRetentionPeriod) => void;
  visualConfig: VisualConfig;
  updateVisualConfig: (config: Partial<VisualConfig>) => void;

}

export const useAppContextStore = create<AppState>()(
  persist(
    (set) => ({
      context: 'Trabajo',
      setContext: (context) => set({ context }),
      ticketsContext: DEFAULT_TICKETS_CONTEXT,
      setTicketsContext: (ticketsContext) => set({ ticketsContext }),
      theme: 'neon',
      setTheme: (theme) => set({ theme }),
      colorMode: 'dark',
      setColorMode: (colorMode) => set({ colorMode }),
      activeModules: {
        dashboard: true,
        kanban: true,
        schedule: true,
      },
      toggleModule: (module) => set((state) => ({
        activeModules: {
          ...state.activeModules,
          [module]: !state.activeModules[module]
        }
      })),
      hourFormat: '24h',
      setHourFormat: (format) => set({ hourFormat: format }),
      defaultPage: '/',
      setDefaultPage: (page) => set({ defaultPage: page }),
      taskRetentionPeriod: 'monthly',
      setTaskRetentionPeriod: (period) => set({ taskRetentionPeriod: period }),
      visualConfig: {
        glassIntensity: 0.8,
        glowEnabled: false,
        showGrid: false,
        compactMode: false,
      },
      updateVisualConfig: (config) => set((state) => ({
        visualConfig: { ...state.visualConfig, ...config }
      })),

    }),
    {
      name: 'taskme-app-state-v5',
    }
  )
);
