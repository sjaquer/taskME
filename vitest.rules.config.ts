import { defineConfig } from 'vitest/config';

// Tests de firestore.rules contra el emulador. Ejecutar con `npm run test:rules`
// (levanta el emulador con firebase emulators:exec).
export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/rules/**/*.test.ts'],
    testTimeout: 20_000,
    hookTimeout: 30_000,
    fileParallelism: false,
  },
});
