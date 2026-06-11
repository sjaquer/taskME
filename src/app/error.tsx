'use client';

import { useEffect } from 'react';
import { OutlineButton } from '@/components/atoms';
import { AlertTriangle } from 'lucide-react';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('Runtime crash captured by root boundary:', error);
  }, [error]);

  return (
    <div className="min-h-[70vh] flex flex-col items-center justify-center p-6 text-center space-y-6">
      <div className="w-16 h-16 rounded-2xl bg-red-500/10 border border-red-500/20 flex items-center justify-center text-red-500 shadow-sm">
        <AlertTriangle className="w-8 h-8" />
      </div>
      <div className="space-y-2 max-w-md">
        <h2 className="text-2xl font-black tracking-tighter uppercase text-foreground">
          Error de Ejecución
        </h2>
        <p className="text-xs text-muted-foreground uppercase tracking-widest text-[9px] font-black">
          Ocurrió una interrupción inesperada en la interfaz de usuario.
        </p>
      </div>
      <OutlineButton onClick={() => reset()} className="px-6 h-11">
        Reintentar Módulo
      </OutlineButton>
    </div>
  );
}
