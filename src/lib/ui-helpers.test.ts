import { describe, expect, it } from 'vitest';
import { APPEARANCE_BOOT_SCRIPT, foregroundForHex, hexToHslTriplet } from './appearance';
import { DEFAULT_CONTEXTS, getContextIcon, sortContexts } from './contexts';
import { getVisibleNavItems, normalizeNavOrder } from './navigation';
import { formatTime, pluralize } from './utils';

describe('apariencia', () => {
  it('convierte hex a HSL para las variables CSS', () => {
    expect(hexToHslTriplet('#ff0000')).toBe('0 100% 50%');
    expect(hexToHslTriplet('#3dbd7d')).toBe('150 51% 49%');
    expect(hexToHslTriplet('verde')).toBeNull();
  });

  it('elige texto legible sobre el acento', () => {
    expect(foregroundForHex('#ffffff')).toBe('220 15% 6%');
    expect(foregroundForHex('#1e1e1e')).toBe('0 0% 100%');
  });

  it('el script de arranque es JavaScript válido', () => {
    expect(() => new Function(APPEARANCE_BOOT_SCRIPT)).not.toThrow();
  });
});

describe('contextos', () => {
  it('ordena por orden y luego por nombre', () => {
    const sorted = sortContexts([
      { id: 'b', name: 'B', color: '#000000', icon: 'home', order: 1 },
      { id: 'z', name: 'Z', color: '#000000', icon: 'home', order: 0 },
      { id: 'a', name: 'A', color: '#000000', icon: 'home', order: 1 },
    ]);
    expect(sorted.map((c) => c.id)).toEqual(['z', 'a', 'b']);
  });

  it('los de fábrica usan los ids antiguos y hay icono por defecto', () => {
    expect(DEFAULT_CONTEXTS.map((c) => c.id)).toEqual(['Trabajo', 'Estudio']);
    expect(getContextIcon('no-existe')).toBe(getContextIcon(undefined));
  });
});

describe('navegación', () => {
  it('descarta módulos que ya no existen (tickets) y agrega los faltantes', () => {
    expect(normalizeNavOrder(['notes', 'tickets', 'kanban'])).toEqual(['notes', 'kanban', 'dashboard', 'schedule']);
  });

  it('respeta los módulos ocultos y deja Ajustes al final', () => {
    const items = getVisibleNavItems(['kanban', 'dashboard'], { dashboard: true, kanban: true, schedule: false, notes: true });
    expect(items.map((i) => i.key)).toEqual(['kanban', 'dashboard', 'notes', 'settings']);
  });
});

describe('textos', () => {
  it('singular y plural', () => {
    expect(pluralize(1, 'pendiente')).toBe('1 pendiente');
    expect(pluralize(3, 'pendiente')).toBe('3 pendientes');
    expect(pluralize(0, 'tarea')).toBe('0 tareas');
  });

  it('formato de hora 24 h y 12 h', () => {
    expect(formatTime('18:05', '24h')).toBe('18:05');
    expect(formatTime('18:05', '12h')).toBe('06:05 PM');
    expect(formatTime('00:30', '12h')).toBe('12:30 AM');
    expect(formatTime(undefined, '24h')).toBe('--:--');
  });
});
