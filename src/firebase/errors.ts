'use client';
import { getAuth, type User } from 'firebase/auth';

type SecurityRuleContext = {
  path: string;
  operation: 'get' | 'list' | 'create' | 'update' | 'delete' | 'write';
  requestResourceData?: Record<string, unknown>;
};

interface FirebaseAuthToken {
  name: string | null;
  email: string | null;
  email_verified: boolean;
  phone_number: string | null;
  sub: string;
  firebase: {
    identities: Record<string, string[]>;
    sign_in_provider: string;
    tenant: string | null;
  };
}

interface FirebaseAuthObject {
  uid: string;
  token: FirebaseAuthToken;
}

interface SecurityRuleRequest {
  auth: FirebaseAuthObject | null;
  method: string;
  path: string;
  resource?: {
    data: any;
  };
}

/**
 * Builds a security-rule-compliant auth object from the Firebase User.
 * @param currentUser The currently authenticated Firebase user.
 * @returns An object that mirrors request.auth in security rules, or null.
 */
function buildAuthObject(currentUser: User | null): FirebaseAuthObject | null {
  if (!currentUser) {
    return null;
  }

  const token: FirebaseAuthToken = {
    name: currentUser.displayName,
    email: currentUser.email,
    email_verified: currentUser.emailVerified,
    phone_number: currentUser.phoneNumber,
    sub: currentUser.uid,
    firebase: {
      identities: currentUser.providerData.reduce((acc, p) => {
        if (p.providerId) {
          acc[p.providerId] = [p.uid];
        }
        return acc;
      }, {} as Record<string, string[]>),
      sign_in_provider: currentUser.providerData[0]?.providerId || 'custom',
      tenant: currentUser.tenantId,
    },
  };

  return {
    uid: currentUser.uid,
    token: token,
  };
}

/**
 * Builds the complete, simulated request object for the error message.
 * It safely tries to get the current authenticated user.
 * @param context The context of the failed Firestore operation.
 * @returns A structured request object.
 */
function buildRequestObject(context: SecurityRuleContext): SecurityRuleRequest {
  let authObject: FirebaseAuthObject | null = null;
  try {
    // Safely attempt to get the current user.
    const firebaseAuth = getAuth();
    const currentUser = firebaseAuth.currentUser;
    if (currentUser) {
      authObject = buildAuthObject(currentUser);
    }
  } catch {
    // This will catch errors if the Firebase app is not yet initialized.
    // In this case, we'll proceed without auth information.
  }

  return {
    auth: authObject,
    method: context.operation,
    path: `/databases/(default)/documents/${context.path}`,
    resource: context.requestResourceData ? { data: context.requestResourceData } : undefined,
  };
}

/**
 * Builds the final, formatted error message for the LLM.
 * @param requestObject The simulated request object.
 * @returns A string containing the error message and the JSON payload.
 */
function buildErrorMessage(requestObject: SecurityRuleRequest): string {
  return `Missing or insufficient permissions: The following request was denied by Firestore Security Rules:
${JSON.stringify(requestObject, null, 2)}`;
}

/**
 * A custom error class designed to be consumed by an LLM for debugging.
 * It structures the error information to mimic the request object
 * available in Firestore Security Rules.
 */
export class FirestorePermissionError extends Error {
  public readonly request: SecurityRuleRequest;

  constructor(context: SecurityRuleContext) {
    const requestObject = buildRequestObject(context);
    super(buildErrorMessage(requestObject));
    this.name = 'FirebaseError';
    this.request = requestObject;
  }
}

/**
 * Maps a Firebase Auth error to a user-friendly Spanish message.
 * It also catches infrastructure configuration issues such as blocked API keys.
 */
export function mapAuthError(error: any): string {
  if (!error) return "Ocurrió un error inesperado.";

  const code = error.code || "";
  const message = error.message || "";

  // 1. Check for specific known error codes
  switch (code) {
    case 'auth/invalid-email':
      return 'El formato del correo electrónico no es válido.';
    case 'auth/user-disabled':
      return 'Esta cuenta de usuario ha sido deshabilitada.';
    case 'auth/user-not-found':
      return 'No existe ningún usuario registrado con este correo electrónico.';
    case 'auth/wrong-password':
      return 'La contraseña es incorrecta.';
    case 'auth/invalid-credential':
      return 'Las credenciales de acceso no son válidas o han expirado.';
    case 'auth/email-already-in-use':
      return 'Este correo electrónico ya está registrado por otro usuario.';
    case 'auth/weak-password':
      return 'La contraseña debe tener al menos 6 caracteres.';
    case 'auth/operation-not-allowed':
      return 'El método de inicio de sesión con correo y contraseña no está habilitado en Firebase Console.';
    case 'auth/popup-closed-by-user':
      return 'La ventana de inicio de sesión fue cerrada antes de completar el proceso.';
    case 'auth/too-many-requests':
      return 'Demasiados intentos de acceso fallidos. La cuenta ha sido bloqueada temporalmente por seguridad. Inténtalo más tarde.';
    case 'auth/requires-recent-login':
      return 'Esta acción requiere re-autenticación. Por favor, cierra sesión e ingresa nuevamente.';
  }

  // 2. Check for infrastructure API blocking or method blocking in error message
  if (message.includes('signinwithpassword-are-blocked') || message.includes('authenticationservice.signinwithpassword-are-blocked')) {
    return 'Las solicitudes de inicio de sesión están bloqueadas debido a restricciones de clave de API en Google Cloud Console. El administrador debe editar la clave de API y permitir el acceso a "Identity Toolkit API" y "Token Service API".';
  }

  if (message.includes('requests-to-this-api') && message.includes('are-blocked')) {
    return 'Esta operación está bloqueada por restricciones de la API en Google Cloud Console. Habilite el servicio y configure los accesos de la clave de API.';
  }

  // Fallback to error message or a generic message
  return error.message || "Ocurrió un error de autenticación.";
}

