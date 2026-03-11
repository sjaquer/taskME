
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

type AppContext = 'Work' | 'Study';

interface AppState {
  context: AppContext;
  setContext: (context: AppContext) => void;
}

export const useAppContextStore = create<AppState>()(
  persist(
    (set) => ({
      context: 'Work',
      setContext: (context) => set({ context }),
    }),
    {
      name: 'taskme-app-state',
    }
  )
);
