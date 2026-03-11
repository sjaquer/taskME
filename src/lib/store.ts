
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

type AppContext = 'Trabajo' | 'Estudio';

interface AppState {
  context: AppContext;
  setContext: (context: AppContext) => void;
}

export const useAppContextStore = create<AppState>()(
  persist(
    (set) => ({
      context: 'Trabajo',
      setContext: (context) => set({ context }),
    }),
    {
      name: 'taskme-app-state',
    }
  )
);
