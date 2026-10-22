'use client';

import { useEffect, useRef, useState } from 'react';
import { Mic, MicOff } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { getVoiceSource, startVoiceInput } from '@/lib/native-features';
import { cn } from '@/lib/utils';

/** Botón de dictado: solo se muestra si el dispositivo lo soporta. */
export function VoiceButton({ onText, className }: { onText: (text: string) => void; className?: string }) {
  const [supported, setSupported] = useState(false);
  const [listening, setListening] = useState(false);
  const cancelRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    setSupported(getVoiceSource() !== null);
    return () => cancelRef.current?.();
  }, []);

  if (!supported) return null;

  const toggle = () => {
    if (listening) {
      cancelRef.current?.();
      return;
    }
    setListening(true);
    cancelRef.current = startVoiceInput(onText, (error) => {
      setListening(false);
      cancelRef.current = null;
      if (error && error !== 'aborted' && error !== 'no-speech') {
        toast({
          variant: 'warning',
          title: 'Dictado no disponible',
          description: error === 'not-allowed' ? 'Permite el acceso al micrófono para dictar.' : 'No se pudo reconocer la voz.',
        });
      }
    });
  };

  return (
    <button
      type="button"
      onClick={toggle}
      aria-pressed={listening}
      aria-label={listening ? 'Detener dictado' : 'Dictar por voz'}
      title={listening ? 'Detener dictado' : 'Dictar por voz'}
      className={cn(
        'flex h-9 w-9 shrink-0 items-center justify-center rounded-xl transition-colors',
        listening ? 'animate-pulse bg-red-500/15 text-red-400' : 'text-muted-foreground hover:bg-muted/40 hover:text-foreground',
        className
      )}
    >
      {listening ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
    </button>
  );
}
