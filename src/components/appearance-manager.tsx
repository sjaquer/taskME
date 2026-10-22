'use client';

import { useEffect, useRef } from 'react';
import { useActiveContext } from '@/firebase/user-data';
import { applyAppearance } from '@/lib/appearance';
import { isNativeAndroidContainer } from '@/lib/native-bridge';
import { useAppContextStore } from '@/lib/store';

/** Aplica tema, modo, acento y preferencias visuales al documento. */
export function AppearanceManager() {
  const theme = useAppContextStore((state) => state.theme);
  const colorMode = useAppContextStore((state) => state.colorMode);
  const customAccent = useAppContextStore((state) => state.customAccent);
  const accentFromContext = useAppContextStore((state) => state.accentFromContext);
  const pureBlack = useAppContextStore((state) => state.pureBlack);
  const fontScale = useAppContextStore((state) => state.fontScale);
  const reduceMotion = useAppContextStore((state) => state.reduceMotion);
  const visualConfig = useAppContextStore((state) => state.visualConfig);
  const contextColor = useActiveContext().color;

  // Transición de colores solo durante un cambio de tema/modo (no al cargar).
  const isFirstRender = useRef(true);
  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    if (reduceMotion) return;
    const root = document.documentElement;
    root.classList.add('theme-transition');
    const timeoutId = setTimeout(() => root.classList.remove('theme-transition'), 400);
    return () => clearTimeout(timeoutId);
  }, [theme, colorMode, customAccent, accentFromContext, pureBlack, reduceMotion]);

  useEffect(() => {
    const apply = () =>
      applyAppearance(
        { theme, colorMode, customAccent, accentFromContext, pureBlack, fontScale, reduceMotion },
        contextColor
      );
    apply();

    if (colorMode !== 'system') return;
    // En modo Sistema, seguir los cambios del teléfono/navegador en vivo.
    const media = window.matchMedia('(prefers-color-scheme: light)');
    media.addEventListener('change', apply);
    return () => media.removeEventListener('change', apply);
  }, [theme, colorMode, customAccent, accentFromContext, pureBlack, fontScale, reduceMotion, contextColor]);

  useEffect(() => {
    const root = document.documentElement;
    root.dataset.grid = String(visualConfig.showGrid);
    root.dataset.glow = String(visualConfig.glowEnabled);
    root.dataset.compact = String(visualConfig.compactMode);
    root.style.setProperty('--glass-intensity', String(visualConfig.glassIntensity));
  }, [visualConfig]);

  useEffect(() => {
    if (isNativeAndroidContainer()) {
      document.documentElement.dataset.shell = 'android-webview';
    } else {
      delete document.documentElement.dataset.shell;
    }
  }, []);

  return null;
}
