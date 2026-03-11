'use client';

import { doc, updateDoc, setDoc, serverTimestamp, Firestore } from 'firebase/firestore';
import { updateProfile, updatePassword, signOut, Auth, User } from 'firebase/auth';

export function getUserSettingsRef(firestore: Firestore, userId: string) {
  return doc(firestore, 'users', userId, 'settings', 'app');
}

export async function updateUserProfile(
  user: User,
  firestore: Firestore,
  displayName: string
) {
  await updateProfile(user, { displayName });
  await setDoc(
    doc(firestore, 'users', user.uid),
    { displayName, updatedAt: serverTimestamp() },
    { merge: true }
  );
}

export async function changeUserPassword(user: User, newPassword: string) {
  await updatePassword(user, newPassword);
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
  updateDoc(settingsRef, { ...updates, updatedAt: serverTimestamp() }).catch(() => {
    setDoc(settingsRef, { ...updates, updatedAt: serverTimestamp() }, { merge: true });
  });
}
