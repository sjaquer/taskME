'use client';

import {
  doc,
  setDoc,
  serverTimestamp,
  Firestore,
} from 'firebase/firestore';
import { signOut, Auth } from 'firebase/auth';

export function getUserSettingsRef(firestore: Firestore, userId: string) {
  return doc(firestore, 'users', userId, 'settings', 'app');
}

export async function logoutUser(auth: Auth) {
  await signOut(auth);
}

export function saveSettingsToCloud(
  firestore: Firestore,
  userId: string,
  updates: Record<string, unknown>
) {
  const settingsRef = getUserSettingsRef(firestore, userId);
  setDoc(settingsRef, { ...updates, updatedAt: serverTimestamp() }, { merge: true }).catch(
    (error) => console.error('Error saving settings:', error)
  );
}
