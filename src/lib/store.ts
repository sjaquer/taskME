
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

type AppContext = 'Trabajo' | 'Estudio';

interface AppState {
  context: AppContext;
  setContext: (context: AppContext) => void;
  // Feature Flags para módulos
  activeModules: {
    dashboard: boolean;
    kanban: boolean;
    schedule: boolean;
    calendar: boolean;
  };
  toggleModule: (module: keyof AppState['activeModules']) => void;
  // Preferencias de UI
  highPerformanceMode: boolean;
  setHighPerformanceMode: (enabled: boolean) => void;
}

export const useAppContextStore = create<AppState>()(
  persist(
    (set) => ({
      context: 'Trabajo',
      setContext: (context) => set({ context }),
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
    }),
    {
      name: 'taskme-app-state-v2',
    }
  )
);
