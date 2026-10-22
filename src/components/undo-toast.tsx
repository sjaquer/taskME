'use client';

import { toast } from '@/hooks/use-toast';
import { ToastAction } from '@/components/ui/toast';

const UNDO_TOAST_DURATION_MS = 6000;

/**
 * Aviso tras una acción destructiva con botón "Deshacer".
 * Reemplaza a los diálogos de confirmación, que la app evita en el WebView.
 */
export function toastWithUndo({
  title,
  description,
  onUndo,
}: {
  title: string;
  description?: string;
  onUndo: () => void;
}) {
  const { dismiss } = toast({
    variant: 'warning',
    title,
    description,
    duration: UNDO_TOAST_DURATION_MS,
    action: (
      <ToastAction
        altText="Deshacer"
        onClick={() => {
          onUndo();
          dismiss();
        }}
        className="border-primary/30 text-primary hover:bg-primary/10 hover:text-primary"
      >
        Deshacer
      </ToastAction>
    ),
  });
}
