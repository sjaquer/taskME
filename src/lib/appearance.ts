// Aplicación del tema al documento. La misma lógica corre antes del primer pintado
// (APPEARANCE_BOOT_SCRIPT, en layout.tsx) y luego en el shell cuando cambian los ajustes.

export const APP_STATE_STORAGE_KEY = 'taskme-app-state-v5';

export type ColorModePreference = 'dark' | 'light' | 'system';

export interface AppearanceSettings {
  theme: string;
  colorMode: ColorModePreference;
  customAccent: string;
  accentFromContext: boolean;
  pureBlack: boolean;
  fontScale: number;
  reduceMotion: boolean;
}

/** "#3dbd7d" → "152 51% 49%" (formato de las variables CSS de Tailwind). */
export function hexToHslTriplet(hex: string): string | null {
  const match = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!match) return null;
  const value = parseInt(match[1], 16);
  const r = ((value >> 16) & 255) / 255;
  const g = ((value >> 8) & 255) / 255;
  const b = (value & 255) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  let h = 0;
  let s = 0;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    if (max === r) h = (g - b) / d + (g < b ? 6 : 0);
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h *= 60;
  }
  return `${Math.round(h)} ${Math.round(s * 100)}% ${Math.round(l * 100)}%`;
}

/** Texto legible sobre el color de acento: oscuro sobre colores claros y viceversa. */
export function foregroundForHex(hex: string): string {
  const value = parseInt(hex.replace('#', ''), 16);
  const channel = (shift: number) => {
    const c = ((value >> shift) & 255) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  const luminance = 0.2126 * channel(16) + 0.7152 * channel(8) + 0.0722 * channel(0);
  return luminance > 0.4 ? '220 15% 6%' : '0 0% 100%';
}

export function resolveColorMode(mode: ColorModePreference): 'dark' | 'light' {
  if (mode !== 'system') return mode;
  return window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
}

/**
 * Aplica el tema al <html>. `contextColor` es el color del contexto activo
 * (solo se usa si accentFromContext está activo).
 */
export function applyAppearance(settings: AppearanceSettings, contextColor?: string) {
  const root = document.documentElement;
  const mode = resolveColorMode(settings.colorMode);

  root.dataset.theme = settings.theme;
  root.dataset.mode = mode;
  root.classList.toggle('dark', mode === 'dark');
  root.classList.toggle('light', mode === 'light');
  root.dataset.black = String(settings.pureBlack);
  root.dataset.motion = settings.reduceMotion ? 'reduced' : 'full';
  root.style.fontSize = `${Math.round(settings.fontScale * 100)}%`;

  const accentHex = settings.accentFromContext && contextColor
    ? contextColor
    : settings.theme === 'custom'
      ? settings.customAccent
      : null;
  const accent = accentHex ? hexToHslTriplet(accentHex) : null;

  if (accentHex && accent) {
    root.style.setProperty('--primary', accent);
    root.style.setProperty('--accent', accent);
    root.style.setProperty('--ring', accent);
    root.style.setProperty('--primary-foreground', foregroundForHex(accentHex));
    root.style.setProperty('--accent-foreground', foregroundForHex(accentHex));
  } else {
    ['--primary', '--accent', '--ring', '--primary-foreground', '--accent-foreground'].forEach((prop) =>
      root.style.removeProperty(prop)
    );
  }

  const themeColor = document.querySelector('meta[name="theme-color"]');
  if (themeColor) {
    themeColor.setAttribute('content', mode === 'dark' ? (settings.pureBlack ? '#000000' : '#0d0f12') : '#f8f9fb');
  }
}

/**
 * Script inline para <head>: lee los ajustes guardados por Zustand y aplica el
 * tema antes del primer pintado (evita el destello de modo oscuro en modo claro).
 * Es JS autocontenido a propósito (no se puede reutilizar applyAppearance porque
 * el minificador renombra sus dependencias); mantenerlo alineado con esa función.
 * El acento por contexto se aplica después, cuando cargan los contextos.
 */
export const APPEARANCE_BOOT_SCRIPT = `(function(){try{
var raw=localStorage.getItem(${JSON.stringify(APP_STATE_STORAGE_KEY)});
var s=raw?(JSON.parse(raw).state||{}):{};
var root=document.documentElement;
var pref=s.colorMode||'dark';
var mode=pref==='system'?(matchMedia('(prefers-color-scheme: light)').matches?'light':'dark'):pref;
root.dataset.theme=s.theme||'neon';
root.dataset.mode=mode;
root.classList.toggle('dark',mode==='dark');
root.classList.toggle('light',mode==='light');
root.dataset.black=String(!!s.pureBlack);
root.dataset.motion=s.reduceMotion?'reduced':'full';
root.style.fontSize=Math.round((s.fontScale||1)*100)+'%';
var hex=s.theme==='custom'&&/^#[0-9a-f]{6}$/i.test(s.customAccent||'')?s.customAccent:null;
if(hex){
var v=parseInt(hex.slice(1),16),r=(v>>16&255)/255,g=(v>>8&255)/255,b=(v&255)/255;
var mx=Math.max(r,g,b),mn=Math.min(r,g,b),l=(mx+mn)/2,h=0,sat=0;
if(mx!==mn){var d=mx-mn;sat=l>0.5?d/(2-mx-mn):d/(mx+mn);
h=mx===r?(g-b)/d+(g<b?6:0):mx===g?(b-r)/d+2:(r-g)/d+4;h*=60;}
var hsl=Math.round(h)+' '+Math.round(sat*100)+'% '+Math.round(l*100)+'%';
['--primary','--accent','--ring'].forEach(function(p){root.style.setProperty(p,hsl);});
}
}catch(e){}})();`;
