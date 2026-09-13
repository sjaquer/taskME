import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { AppContext, Task } from '@/types/task';

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
  theme: AppTheme;
  setTheme: (theme: AppTheme) => void;
  colorMode: ColorMode;
  setColorMode: (mode: ColorMode) => void;
  activeModules: ModuleFlags;
  toggleModule: (module: keyof ModuleFlags) => void;
  highPerformanceMode: boolean;
  setHighPerformanceMode: (enabled: boolean) => void;
  hourFormat: HourFormat;
  setHourFormat: (format: HourFormat) => void;
  defaultPage: string;
  setDefaultPage: (page: string) => void;
  taskRetentionPeriod: TaskRetentionPeriod;
  setTaskRetentionPeriod: (period: TaskRetentionPeriod) => void;
  visualConfig: VisualConfig;
  updateVisualConfig: (config: Partial<VisualConfig>) => void;

  // Data Cache (Expert Optimization)
  cachedTasks: Record<string, Task[]>; // Key: context
  setCachedTasks: (context: string, tasks: Task[]) => void;
  cachedRoutines: Record<string, any[]>;
  setCachedRoutines: (context: string, routines: any[]) => void;
  cachedProjects: Record<string, any[]>;
  setCachedProjects: (context: string, projects: any[]) => void;
  cachedNotes: Record<string, any[]>;
  setCachedNotes: (context: string, notes: any[]) => void;
}

export const useAppContextStore = create<AppState>()(
  persist(
    (set) => ({
      context: 'Trabajo',
      setContext: (context) => set({ context }),
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
      highPerformanceMode: false,
      setHighPerformanceMode: (enabled) => set({ highPerformanceMode: enabled }),
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

      // Cache Initial State
      cachedTasks: {},
      setCachedTasks: (context, tasks) => set((state) => ({
        cachedTasks: { ...state.cachedTasks, [context]: tasks }
      })),
      cachedRoutines: {},
      setCachedRoutines: (context, routines) => set((state) => ({
        cachedRoutines: { ...state.cachedRoutines, [context]: routines }
      })),
      cachedProjects: {},
      setCachedProjects: (context, projects) => set((state) => ({
        cachedProjects: { ...state.cachedProjects, [context]: projects }
      })),
      cachedNotes: {},
      setCachedNotes: (context, notes) => set((state) => ({
        cachedNotes: { ...state.cachedNotes, [context]: notes }
      })),
    }),
    {
      name: 'taskme-app-state-v5',
    }
  )
);
