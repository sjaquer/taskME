export {};

declare global {
  interface Window {
    // Interfaz que inyecta la APK Android
    AndroidNative?: {
      googleLogin: () => void;
      saveFcmToken: (token: string) => void;
      vibrate: (ms: number) => void;
      showToast: (message: string) => void;
      startVoiceRecognition: () => void;
    };

    // Legacy Bridge (Compatibilidad)
    AndroidBridge?: {
      postMessage: (message: string) => void;
    };
    
    // Callbacks que la APK llama en la Web
    onNativeTokenReceived?: (token: string) => void;
    onGoogleLoginSuccess?: (idToken: string) => void;
    onVoiceResult?: (text: string) => void;
    onNativeMessage?: (raw: string) => void;
  }
}
