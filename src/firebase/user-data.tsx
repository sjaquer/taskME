'use client';

import { createContext, useContext, useEffect, useMemo, type ReactNode } from 'react';
import { useFirestore, useMemoFirebase, useUser } from '@/firebase/provider';
import { useCollection } from '@/firebase/firestore/use-collection';
import { getUserTasksRef } from '@/services/task-service';
import { getUserProjectsRef } from '@/services/project-service';
import { getUserNotesRef } from '@/services/note-service';
import { getUserRoutinesRef } from '@/services/routine-service';
import type { AppContext, Note, Project, Routine, Task } from '@/types/task';

interface CollectionState<T> {
  data: T[];
  isLoading: boolean;
}

interface UserDataState {
  tasks: CollectionState<Task>;
  projects: CollectionState<Project>;
  notes: CollectionState<Note>;
  routines: CollectionState<Routine>;
}

const EMPTY_STATE: CollectionState<never> = { data: [], isLoading: false };

const UserDataContext = createContext<UserDataState | undefined>(undefined);

// Prefijo del caché manual en localStorage que se usaba antes; Firestore ya
// mantiene su propio caché persistente (IndexedDB).
const LEGACY_CACHE_PREFIX = 'taskme:cache:';

function clearLegacyCollectionCache() {
  try {
    Object.keys(window.localStorage)
      .filter((key) => key.startsWith(LEGACY_CACHE_PREFIX))
      .forEach((key) => window.localStorage.removeItem(key));
  } catch (error) {
    console.warn('No se pudo limpiar el caché antiguo:', error);
  }
}

function toState<T>(result: { data: T[] | null; isLoading: boolean }): CollectionState<T> {
  return { data: result.data ?? [], isLoading: result.isLoading };
}

/**
 * Mantiene una sola suscripción en tiempo real por colección del usuario
 * (todas las tareas, proyectos, notas y rutinas, de todos los contextos).
 * Las páginas filtran en memoria: cambiar de contexto no vuelve a consultar.
 */
export function UserDataProvider({ children }: { children: ReactNode }) {
  const firestore = useFirestore();
  const { user } = useUser();
  const uid = user?.uid;

  useEffect(() => {
    clearLegacyCollectionCache();
  }, []);

  const tasksRef = useMemoFirebase(() => (uid ? getUserTasksRef(firestore, uid) : null), [firestore, uid]);
  const projectsRef = useMemoFirebase(() => (uid ? getUserProjectsRef(firestore, uid) : null), [firestore, uid]);
  const notesRef = useMemoFirebase(() => (uid ? getUserNotesRef(firestore, uid) : null), [firestore, uid]);
  const routinesRef = useMemoFirebase(() => (uid ? getUserRoutinesRef(firestore, uid) : null), [firestore, uid]);

  const tasks = useCollection<Task>(tasksRef);
  const projects = useCollection<Project>(projectsRef);
  const notes = useCollection<Note>(notesRef);
  const routines = useCollection<Routine>(routinesRef);

  const value = useMemo<UserDataState>(
    () => ({
      tasks: toState(tasks),
      projects: toState(projects),
      notes: toState(notes),
      routines: toState(routines),
    }),
    [tasks.data, tasks.isLoading, projects.data, projects.isLoading, notes.data, notes.isLoading, routines.data, routines.isLoading]
  );

  return <UserDataContext.Provider value={uid ? value : EMPTY_VALUE}>{children}</UserDataContext.Provider>;
}

const EMPTY_VALUE: UserDataState = {
  tasks: EMPTY_STATE,
  projects: EMPTY_STATE,
  notes: EMPTY_STATE,
  routines: EMPTY_STATE,
};

function useUserData(): UserDataState {
  const context = useContext(UserDataContext);
  if (!context) throw new Error('useUserData debe usarse dentro de UserDataProvider.');
  return context;
}

function useFilteredByContext<T extends { context: AppContext }>(
  state: CollectionState<T>,
  context: AppContext | undefined
): CollectionState<T> {
  return useMemo(
    () => (context ? { ...state, data: state.data.filter((item) => item.context === context) } : state),
    [state, context]
  );
}

/** Tareas (incluye tickets). Sin contexto devuelve las de todos los contextos. */
export function useTasks(context?: AppContext) {
  return useFilteredByContext(useUserData().tasks, context);
}

export function useProjects(context?: AppContext) {
  return useFilteredByContext(useUserData().projects, context);
}

export function useNotes(context?: AppContext) {
  return useFilteredByContext(useUserData().notes, context);
}

export function useRoutines(context?: AppContext) {
  return useFilteredByContext(useUserData().routines, context);
}
