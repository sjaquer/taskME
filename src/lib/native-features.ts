'use client';

// Funciones del dispositivo usando lo que la APK actual ya expone
// (window.AndroidNative) y, como respaldo, las APIs del navegador.

import { useAppContextStore } from '@/lib/store';

/** Vibración corta de confirmación (respeta el ajuste "Vibración"). */
export function haptic(durationMs = 15) {
  if (typeof window === 'undefined' || !useAppContextStore.getState().haptics) return;
  try {
    if (typeof window.AndroidNative?.vibrate === 'function') {
      window.AndroidNative.vibrate(durationMs);
    } else if (typeof navigator.vibrate === 'function') {
      navigator.vibrate(durationMs);
    }
  } catch (error) {
    console.warn('No se pudo vibrar:', error);
  }
}

// Tipos mínimos de la Web Speech API (no están en lib.dom de TypeScript).
interface SpeechRecognitionLike {
  lang: string;
  interimResults: boolean;
  maxAlternatives: number;
  onresult: ((event: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  abort: () => void;
}
type SpeechRecognitionCtor = new () => SpeechRecognitionLike;

function getSpeechRecognition(): SpeechRecognitionCtor | null {
  if (typeof window === 'undefined') return null;
  const w = window as unknown as { SpeechRecognition?: SpeechRecognitionCtor; webkitSpeechRecognition?: SpeechRecognitionCtor };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

export type VoiceSource = 'native' | 'web' | null;

export function getVoiceSource(): VoiceSource {
  if (typeof window === 'undefined') return null;
  if (typeof window.AndroidNative?.startVoiceRecognition === 'function') return 'native';
  return getSpeechRecognition() ? 'web' : null;
}

/**
 * Inicia un dictado y entrega el texto reconocido una vez.
 * Devuelve una función para cancelarlo.
 */
export function startVoiceInput(onText: (text: string) => void, onEnd: (error?: string) => void): () => void {
  const source = getVoiceSource();

  if (source === 'native') {
    // La APK responde llamando a window.onVoiceResult, que NativeBridgeProvider
    // reenvía como evento "nativeVoiceResult".
    const handler = (event: Event) => {
      const text = (event as CustomEvent<string>).detail;
      if (typeof text === 'string' && text.trim()) onText(text.trim());
      cleanup();
      onEnd();
    };
    const timeoutId = setTimeout(() => {
      cleanup();
      onEnd('timeout');
    }, 30_000);
    const cleanup = () => {
      clearTimeout(timeoutId);
      window.removeEventListener('nativeVoiceResult', handler);
    };
    window.addEventListener('nativeVoiceResult', handler);
    window.AndroidNative!.startVoiceRecognition();
    return () => {
      cleanup();
      onEnd();
    };
  }

  const Recognition = getSpeechRecognition();
  if (!Recognition) {
    onEnd('unsupported');
    return () => {};
  }
  const recognition = new Recognition();
  recognition.lang = navigator.language || 'es-ES';
  recognition.interimResults = false;
  recognition.maxAlternatives = 1;
  recognition.onresult = (event) => {
    const text = event.results[0]?.[0]?.transcript;
    if (text?.trim()) onText(text.trim());
  };
  recognition.onerror = (event) => onEnd(event.error);
  recognition.onend = () => onEnd();
  recognition.start();
  return () => recognition.abort();
}
