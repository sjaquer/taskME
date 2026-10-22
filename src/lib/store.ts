import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { AppContext } from '@/types/task';
import { DEFAULT_TICKETS_CONTEXT } from '@/lib/contexts';
import { APP_STATE_STORAGE_KEY, type ColorModePreference } from '@/lib/appearance';
import { DEFAULT_NAV_ORDER, type NavModule } from '@/lib/navigation';
import type { TaskSort } from '@/lib/tasks';

export type AppTheme = 'neon' | 'cyan' | 'amber' | 'rose' | 'violet' | 'emerald' | 'indigo' | 'crimson' | 'slate' | 'custom';
export type HourFormat = '24h' | '12h';
export type TaskRetentionPeriod = 'weekly' | 'monthly' | 'quarterly' | 'yearly';

type ModuleFlags = Record<NavModule, boolean>;

export type ColorMode = ColorModePreference;

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
  /** Color de acento cuando theme === 'custom' (hex). */
  customAccent: string;
  /** Usa el color del contexto activo como acento. */
  accentFromContext: boolean;
  /** Fondo negro puro en modo oscuro (pantallas AMOLED). */
  pureBlack: boolean;
  /** Escala del texto: 0.9, 1, 1.1 o 1.2. */
  fontScale: number;
  reduceMotion: boolean;
  /** Vibración corta al completar o borrar. */
  haptics: boolean;
  updateAppearance: (patch: Partial<Pick<AppState, 'customAccent' | 'accentFromContext' | 'pureBlack' | 'fontScale' | 'reduceMotion' | 'haptics'>>) => void;
  activeModules: ModuleFlags;
  toggleModule: (module: keyof ModuleFlags) => void;
  /** Orden de los módulos en la barra de navegación. */
  navOrder: NavModule[];
  setNavOrder: (order: NavModule[]) => void;
  /** Orden del Tablero (por dispositivo). */
  kanbanSort: TaskSort;
  setKanbanSort: (sort: TaskSort) => void;
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
      customAccent: '#3dbd7d',
      accentFromContext: false,
      pureBlack: false,
      fontScale: 1,
      reduceMotion: false,
      haptics: true,
      updateAppearance: (patch) => set(patch),
      activeModules: {
        dashboard: true,
        kanban: true,
        schedule: true,
        notes: true,
      },
      navOrder: DEFAULT_NAV_ORDER,
      setNavOrder: (navOrder) => set({ navOrder }),
      kanbanSort: 'smart',
      setKanbanSort: (kanbanSort) => set({ kanbanSort }),
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
      name: APP_STATE_STORAGE_KEY,
      // Mezcla profunda de los objetos anidados: así las opciones nuevas
      // (p. ej. módulos tickets/notas) toman su valor por defecto en usuarios existentes.
      merge: (persisted, current) => {
        const saved = (persisted ?? {}) as Partial<AppState>;
        return {
          ...current,
          ...saved,
          activeModules: { ...current.activeModules, ...saved.activeModules },
          visualConfig: { ...current.visualConfig, ...saved.visualConfig },
        };
      },
    }
  )
);
