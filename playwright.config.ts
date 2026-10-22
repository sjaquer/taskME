import { defineConfig, devices } from '@playwright/test';

// Tests de punta a punta contra los emuladores de Firebase (proyecto "demo-",
// nunca toca datos reales). `npm run test:e2e` levanta los emuladores y un
// servidor Next aislado (carpeta .next-e2e) en el puerto 9137.
const PORT = 9137;
const PROJECT_ID = 'demo-taskme';

export default defineConfig({
  testDir: 'tests/e2e',
  timeout: 60_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  workers: 1,
  reporter: [['list']],
  use: {
    baseURL: `http://localhost:${PORT}`,
    ...devices['Pixel 7'],
    trace: 'retain-on-failure',
  },
  webServer: [
    {
      command: `firebase emulators:start --only auth,firestore --project ${PROJECT_ID}`,
      // Se espera al emulador de Auth (necesario para desbloquear con el PIN); si
      // solo respondiera Firestore, quedaría un emulador a medias de otra corrida.
      url: 'http://127.0.0.1:9099',
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
      // SIGINT permite al CLI de Firebase apagar sus emuladores; si se lo mata de
      // golpe, el proceso Java de Firestore queda vivo ocupando el puerto 8080.
      gracefulShutdown: { signal: 'SIGINT', timeout: 20_000 },
    },
    {
      command: `npx next dev -p ${PORT}`,
      url: `http://localhost:${PORT}/login`,
      reuseExistingServer: !process.env.CI,
      timeout: 180_000,
      env: {
        NEXT_DIST_DIR: '.next-e2e',
        NEXT_PUBLIC_FIREBASE_EMULATORS: 'true',
        NEXT_PUBLIC_FIREBASE_PROJECT_ID: PROJECT_ID,
        NEXT_PUBLIC_FIREBASE_API_KEY: 'demo-api-key',
        NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN: `${PROJECT_ID}.firebaseapp.com`,
        NEXT_PUBLIC_FIREBASE_APP_ID: 'demo-app',
        NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID: '0',
        FIREBASE_PROJECT_ID: PROJECT_ID,
        FIRESTORE_EMULATOR_HOST: '127.0.0.1:8080',
        FIREBASE_AUTH_EMULATOR_HOST: '127.0.0.1:9099',
        OWNER_UID: 'e2e-owner',
        APP_PIN: '2468',
      },
    },
  ],
});
