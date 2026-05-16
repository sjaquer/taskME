import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { AppContext, Task } from '@/types/task';

export type AppTheme = 'neon' | 'cyan' | 'amber' | 'rose' | 'violet' | 'emerald' | 'indigo' | 'crimson' | 'slate';
export type HourFormat = '24h' | '12h';

interface ModuleFlags {
  dashboard: boolean;
  kanban: boolean;
  schedule: boolean;
  calendar: boolean;
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
  kanbanColumns: string[];
  setKanbanColumns: (columns: string[]) => void;
  hourFormat: HourFormat;
  setHourFormat: (format: HourFormat) => void;
  defaultPage: string;
  setDefaultPage: (page: string) => void;
  autoDeleteDoneDays: string;
  setAutoDeleteDoneDays: (days: string) => void;
  visualConfig: VisualConfig;
  updateVisualConfig: (config: Partial<VisualConfig>) => void;
  
  // Data Cache (Expert Optimization)
  cachedTasks: Record<string, Task[]>; // Key: context
  setCachedTasks: (context: string, tasks: Task[]) => void;
  cachedRoutines: Record<string, any[]>;
  setCachedRoutines: (context: string, routines: any[]) => void;
  cachedEvents: Record<string, any[]>;
  setCachedEvents: (context: string, events: any[]) => void;
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
        calendar: true,
      },
      toggleModule: (module) => set((state) => ({
        activeModules: {
          ...state.activeModules,
          [module]: !state.activeModules[module]
        }
      })),
      highPerformanceMode: false,
      setHighPerformanceMode: (enabled) => set({ highPerformanceMode: enabled }),
      kanbanColumns: ['Pendiente', 'Haciendo', 'Hecho'],
      setKanbanColumns: (columns) => set({ kanbanColumns: columns }),
      hourFormat: '24h',
      setHourFormat: (format) => set({ hourFormat: format }),
      defaultPage: '/',
      setDefaultPage: (page) => set({ defaultPage: page }),
      autoDeleteDoneDays: '15',
      setAutoDeleteDoneDays: (days) => set({ autoDeleteDoneDays: days }),
      visualConfig: {
        glassIntensity: 0.8,
        glowEnabled: true,
        showGrid: true,
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
      cachedEvents: {},
      setCachedEvents: (context, events) => set((state) => ({
        cachedEvents: { ...state.cachedEvents, [context]: events }
      })),
    }),
    {
      name: 'taskme-app-state-v4',
    }
  )
);
