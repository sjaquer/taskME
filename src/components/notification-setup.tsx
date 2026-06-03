'use client';

import { useState, useEffect } from 'react';
import { Bell } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { NotificationService } from '@/services/notification-service';
import { cn } from '@/lib/utils';

interface NotificationSetupProps {
  onPermissionChanged?: (enabled: boolean) => void;
  className?: string;
}

/**
 * Componente para solicitar y gestionar permisos de notificación
 */
export function NotificationSetup({ onPermissionChanged, className }: NotificationSetupProps) {
  const [isEnabled, setIsEnabled] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isSupported, setIsSupported] = useState(false);

  useEffect(() => {
    // Verificar si el navegador soporta notificaciones
    const supported = typeof window !== 'undefined' && 'Notification' in window;
    setIsSupported(supported);
    if (supported) {
      const enabled = NotificationService.isEnabled();
      setIsEnabled(enabled);
      onPermissionChanged?.(enabled);
    } else {
      onPermissionChanged?.(false);
    }
  }, [onPermissionChanged]);

  const handleRequestPermission = async () => {
    setIsLoading(true);
    try {
      const granted = await NotificationService.requestPermission();
      setIsEnabled(granted);
      onPermissionChanged?.(granted);

      if (granted) {
        // Enviar notificación de prueba
        NotificationService.send('✅ Notificaciones Habilitadas', {
          body: 'Recibiras alertas de tareas y eventos proximos',
        });
      }
    } catch (error) {
      console.error('Error al solicitar permisos:', error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Button
      onClick={isSupported ? handleRequestPermission : undefined}
      disabled={isLoading || !isSupported}
      variant="outline"
      size="sm"
      className={cn(
        "text-[9px] font-black uppercase tracking-widest gap-2 h-9 rounded-lg border-white/[0.08] bg-white/[0.03] hover:bg-white/[0.08]",
        className
      )}
    >
      {isLoading ? (
        <div className="w-3 h-3 animate-spin rounded-full border border-primary border-t-transparent" />
      ) : (
        <Bell className="w-3.5 h-3.5" />
      )}
      {isSupported ? (isEnabled ? 'Gestionar Permisos' : 'Activar Notificaciones') : 'Permisos No Disponibles'}
    </Button>
  );
}
