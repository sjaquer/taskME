import { getApps, initializeApp, cert, applicationDefault } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';

function getPrivateKey() {
  const raw = process.env.FIREBASE_PRIVATE_KEY;
  return raw ? raw.replace(/\\n/g, '\n') : undefined;
}

function buildFirebaseAdminOptions() {
  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = getPrivateKey();

  if (projectId && clientEmail && privateKey) {
    return {
      credential: cert({
        projectId,
        clientEmail,
        privateKey,
      }),
    };
  }

  return {
    credential: applicationDefault(),
    projectId,
  };
}

const app = getApps().length ? getApps()[0] : initializeApp(buildFirebaseAdminOptions());

export const adminAuth = getAuth(app);
export const adminDb = getFirestore(app);
