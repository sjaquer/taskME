export {};

declare global {
  interface Window {
    AndroidBridge?: {
      postMessage: (message: string) => void;
    };
    onNativeMessage?: (raw: string) => void;
  }
}
