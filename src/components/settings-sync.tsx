'use client';

import { useEffect } from 'react';
import { onSnapshot } from 'firebase/firestore';
import { z } from 'zod';
import { useFirestore, useUser } from '@/firebase/provider';
import { useAppContextStore } from '@/lib/store';
import { getUserSettingsRef, saveSettingsToCloud } from '@/services/user-service';

// Preferencias que se sincronizan entre dispositivos. El contexto activo queda
// por dispositivo a propósito (el teléfono puede estar en otro que el PC).
const syncedSettingsSchema = z.object({
  theme: z.enum(['neon', 'cyan', 'amber', 'rose', 'violet', 'emerald', 'indigo', 'crimson', 'slate', 'custom']),
  colorMode: z.enum(['dark', 'light', 'system']),
  customAccent: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  accentFromContext: z.boolean(),
  pureBlack: z.boolean(),
  fontScale: z.number().min(0.8).max(1.4),
  reduceMotion: z.boolean(),
  haptics: z.boolean(),
  visualConfig: z.object({
    glassIntensity: z.number(),
    glowEnabled: z.boolean(),
    showGrid: z.boolean(),
    compactMode: z.boolean(),
  }),
  hourFormat: z.enum(['24h', '12h']),
  defaultPage: z.string().max(40),
  activeModules: z.object({
    dashboard: z.boolean(),
    kanban: z.boolean(),
    schedule: z.boolean(),
    tickets: z.boolean(),
    notes: z.boolean(),
  }),
  navOrder: z.array(z.enum(['dashboard', 'kanban', 'schedule', 'tickets', 'notes'])).max(10),
  taskRetentionPeriod: z.enum(['weekly', 'monthly', 'quarterly', 'yearly']),
  ticketsContext: z.string().min(1).max(64),
});

type SyncedSettings = z.infer<typeof syncedSettingsSchema>;
const SYNCED_KEYS = Object.keys(syncedSettingsSchema.shape) as (keyof SyncedSettings)[];
const WRITE_DEBOUNCE_MS = 600;

function pickSynced(state: SyncedSettings): SyncedSettings {
  return Object.fromEntries(SYNCED_KEYS.map((key) => [key, state[key]])) as SyncedSettings;
}

/**
 * Lee del documento remoto solo los campos válidos (un campo corrupto o de una
 * versión vieja no invalida el resto). Los objetos anidados se mezclan con los
 * valores locales para no perder opciones nuevas.
 */
function parseRemote(data: Record<string, unknown>, local: SyncedSettings): Partial<SyncedSettings> {
  const result: Partial<SyncedSettings> = {};
  for (const key of SYNCED_KEYS) {
    if (!(key in data)) continue;
    const candidate =
      key === 'activeModules' || key === 'visualConfig'
        ? { ...local[key], ...(data[key] as object) }
        : data[key];
    const parsed = syncedSettingsSchema.shape[key].safeParse(candidate);
    if (parsed.success) (result as Record<string, unknown>)[key] = parsed.data;
  }
  return result;
}

/** Mantiene las preferencias del store en users/{uid}/settings/app (ida y vuelta). */
export function SettingsSync() {
  const firestore = useFirestore();
  const { user } = useUser();
  const uid = user?.uid;

  useEffect(() => {
    if (!uid) return;
    const settingsRef = getUserSettingsRef(firestore, uid);
    let lastSynced: string | null = null;
    let timeoutId: ReturnType<typeof setTimeout> | undefined;

    const write = (settings: SyncedSettings) => {
      lastSynced = JSON.stringify(settings);
      saveSettingsToCloud(firestore, uid, settings);
    };

    const unsubscribeRemote = onSnapshot(
      settingsRef,
      (snapshot) => {
        // Eco local de una escritura propia: ya está aplicado.
        if (snapshot.metadata.hasPendingWrites) return;
        const local = pickSynced(useAppContextStore.getState());

        if (!snapshot.exists()) {
          // Sin conexión, "no existe" puede significar solo que no está en caché.
          if (snapshot.metadata.fromCache) return;
          // Primera vez en la nube: se suben las preferencias de este dispositivo.
          write(local);
          return;
        }

        const remote = parseRemote(snapshot.data(), local);
        const merged = pickSynced({ ...local, ...remote });
        lastSynced = JSON.stringify(merged);
        if (JSON.stringify(local) !== lastSynced) {
          useAppContextStore.setState(remote);
        }
      },
      (error) => console.warn('No se pudieron leer los ajustes de la nube:', error)
    );

    const unsubscribeStore = useAppContextStore.subscribe((state) => {
      // Hasta recibir la versión remota no se escribe, para no pisarla.
      if (lastSynced === null) return;
      const current = pickSynced(state);
      if (JSON.stringify(current) === lastSynced) return;
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => write(current), WRITE_DEBOUNCE_MS);
    });

    return () => {
      unsubscribeRemote();
      unsubscribeStore();
      clearTimeout(timeoutId);
    };
  }, [firestore, uid]);

  return null;
}
