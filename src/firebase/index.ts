'use client';

import { firebaseConfig } from '@/firebase/config';
import { initializeApp, getApps, getApp, FirebaseApp } from 'firebase/app';
import { connectAuthEmulator, getAuth } from 'firebase/auth';
import { connectFirestoreEmulator, getFirestore, initializeFirestore, persistentLocalCache, persistentMultipleTabManager } from 'firebase/firestore'

// IMPORTANT: DO NOT MODIFY THIS FUNCTION
export function initializeFirebase() {
  if (!getApps().length) {
    // Important! initializeApp() is called without any arguments because Firebase App Hosting
    // integrates with the initializeApp() function to provide the environment variables needed to
    // populate the FirebaseOptions in production. It is critical that we attempt to call initializeApp()
    // without arguments.
    let firebaseApp;
    try {
      // Attempt to initialize via Firebase App Hosting environment variables
      firebaseApp = initializeApp();
    } catch (e) {
      // Only warn in production if the fallback configuration is incomplete
      if (process.env.NODE_ENV === "production" && !firebaseConfig.apiKey) {
        console.warn('Automatic initialization failed and firebaseConfig is incomplete.', e);
      }
      firebaseApp = initializeApp(firebaseConfig);
    }

    return getSdks(firebaseApp);
  }

  // If already initialized, return the SDKs with the already initialized App
  return getSdks(getApp());
}

export function getSdks(firebaseApp: FirebaseApp) {
  let firestore;
  try {
    firestore = initializeFirestore(firebaseApp, {
      localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
      ignoreUndefinedProperties: true,
    });
  } catch {
    // Already initialized (HMR or getApp() path)
    firestore = getFirestore(firebaseApp);
  }

  const auth = getAuth(firebaseApp);
  connectEmulatorsOnce(auth, firestore);

  return {
    firebaseApp,
    auth,
    firestore
  };
}

let emulatorsConnected = false;

// Solo desarrollo/pruebas: NEXT_PUBLIC_FIREBASE_EMULATORS=true usa los emuladores
// locales de Auth y Firestore (ver "emulators" en firebase.json) en lugar del proyecto real.
function connectEmulatorsOnce(auth: ReturnType<typeof getAuth>, firestore: ReturnType<typeof getFirestore>) {
  if (emulatorsConnected || process.env.NEXT_PUBLIC_FIREBASE_EMULATORS !== 'true') return;
  emulatorsConnected = true;
  connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true });
  connectFirestoreEmulator(firestore, '127.0.0.1', 8080);
}

export {
  FirebaseProvider,
  useFirebase,
  useAuth,
  useFirestore,
  useFirebaseApp,
  useMemoFirebase,
  useUser,
} from './provider';
export { FirebaseClientProvider } from './client-provider';
export { UserDataProvider, useTasks, useProjects, useNotes, useRoutines, useContexts, useActiveContext } from './user-data';
export { setDocumentNonBlocking, addDocumentNonBlocking, updateDocumentNonBlocking, deleteDocumentNonBlocking } from './non-blocking-updates';
export { FirestorePermissionError } from './errors';
export { errorEmitter } from './error-emitter';

