import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { AppContext } from '@/types/task';

export type AppTheme = 'neon' | 'cyan' | 'amber' | 'rose' | 'violet';

interface ModuleFlags {
  dashboard: boolean;
  kanban: boolean;
  schedule: boolean;
  calendar: boolean;
}

interface AppState {
  context: AppContext;
  setContext: (context: AppContext) => void;
  theme: AppTheme;
  setTheme: (theme: AppTheme) => void;
  activeModules: ModuleFlags;
  toggleModule: (module: keyof ModuleFlags) => void;
  highPerformanceMode: boolean;
  setHighPerformanceMode: (enabled: boolean) => void;
  kanbanColumns: string[];
  setKanbanColumns: (columns: string[]) => void;
}

export const useAppContextStore = create<AppState>()(
  persist(
    (set) => ({
      context: 'Trabajo',
      setContext: (context) => set({ context }),
      theme: 'neon',
      setTheme: (theme) => set({ theme }),
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
    }),
    {
      name: 'taskme-app-state-v2',
    }
  )
);
