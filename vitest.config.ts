import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

// Tests unitarios de lógica pura (src/**/*.test.ts). Las reglas de Firestore
// tienen su propia configuración (vitest.rules.config.ts) porque necesitan el emulador.
export default defineConfig({
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});
