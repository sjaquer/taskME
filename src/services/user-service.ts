'use client';

import {
  doc,
  setDoc,
  getDocs,
  collection,
  serverTimestamp,
  Firestore,
  deleteDoc,
  writeBatch,
} from 'firebase/firestore';
import {
  updateProfile,
  updatePassword,
  updateEmail,
  signOut,
  deleteUser,
  reauthenticateWithCredential,
  EmailAuthProvider,
  Auth,
  User,
} from 'firebase/auth';

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

export async function updateUserEmail(
  user: User,
  firestore: Firestore,
  newEmail: string,
  currentPassword: string
) {
  if (!user.email) throw new Error('Solo usuarios con email pueden cambiar email.');
  const credential = EmailAuthProvider.credential(user.email, currentPassword);
  await reauthenticateWithCredential(user, credential);
  await updateEmail(user, newEmail);
  await setDoc(
    doc(firestore, 'users', user.uid),
    { email: newEmail, updatedAt: serverTimestamp() },
    { merge: true }
  );
}

export async function changeUserPassword(
  user: User,
  newPassword: string,
  currentPassword?: string
) {
  if (currentPassword && user.email) {
    const credential = EmailAuthProvider.credential(user.email, currentPassword);
    await reauthenticateWithCredential(user, credential);
  }
  await updatePassword(user, newPassword);
}

export async function logoutUser(auth: Auth) {
  await signOut(auth);
}

export async function deleteUserAccount(
  user: User,
  firestore: Firestore,
  currentPassword?: string
) {
  if (currentPassword && user.email) {
    const credential = EmailAuthProvider.credential(user.email, currentPassword);
    await reauthenticateWithCredential(user, credential);
  }

  const userId = user.uid;

  // Eliminar tareas del usuario
  const tasksSnap = await getDocs(collection(firestore, 'users', userId, 'tasks'));
  const settingsSnap = await getDocs(collection(firestore, 'users', userId, 'settings'));

  const batch = writeBatch(firestore);
  tasksSnap.forEach((d) => batch.delete(d.ref));
  settingsSnap.forEach((d) => batch.delete(d.ref));
  batch.delete(doc(firestore, 'users', userId));
  await batch.commit();

  await deleteUser(user);
}

export async function exportUserData(firestore: Firestore, userId: string) {
  const tasksSnap = await getDocs(collection(firestore, 'users', userId, 'tasks'));
  const tasks = tasksSnap.docs.map((d) => ({ id: d.id, ...d.data() }));

  const settingsSnap = await getDocs(collection(firestore, 'users', userId, 'settings'));
  const settings = settingsSnap.docs.map((d) => ({ id: d.id, ...d.data() }));

  return { tasks, settings, exportedAt: new Date().toISOString() };
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
