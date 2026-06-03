'use client';
import {
  Auth, // Import Auth type for type hinting
  signInAnonymously,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  GoogleAuthProvider,
  signInWithPopup,
  sendEmailVerification,
  // Assume getAuth and app are initialized elsewhere
} from 'firebase/auth';

/** Initiate anonymous sign-in (returns Promise). */
export function initiateAnonymousSignIn(authInstance: Auth): Promise<void> {
  return signInAnonymously(authInstance)
    .then(() => {})
    .catch((error) => {
      console.error('Anonymous sign-in failed:', error);
      throw error;
    });
}

/** Initiate email/password sign-up and send verification email. */
export function initiateEmailSignUp(authInstance: Auth, email: string, password: string): Promise<void> {
  return createUserWithEmailAndPassword(authInstance, email, password)
    .then((userCredential) => {
      return sendEmailVerification(userCredential.user);
    })
    .catch((error) => {
      console.error('Email sign-up failed:', error);
      throw error;
    });
}

/** Initiate email/password sign-in. */
export function initiateEmailSignIn(authInstance: Auth, email: string, password: string): Promise<void> {
  return signInWithEmailAndPassword(authInstance, email, password)
    .then(() => {})
    .catch((error) => {
      console.error('Email sign-in failed:', error);
      throw error;
    });
}

/** Initiate Google Sign-In. */
export function initiateGoogleSignIn(authInstance: Auth): Promise<void> {
  const provider = new GoogleAuthProvider();
  return signInWithPopup(authInstance, provider)
    .then(() => {})
    .catch((error) => {
      console.error('Google sign-in failed:', error);
      throw error;
    });
}

/** Resend verification email. */
export function resendVerificationEmail(authInstance: Auth): Promise<void> {
  if (authInstance.currentUser) {
    return sendEmailVerification(authInstance.currentUser)
      .catch((error) => {
        console.error('Failed to resend verification email:', error);
        throw error;
      });
  }
  return Promise.reject(new Error("No user is currently signed in."));
}
