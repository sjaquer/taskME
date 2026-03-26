'use client';

import { useState, useEffect } from 'react';
import { Bell, BellOff, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { NotificationService } from '@/services/notification-service';
import { cn } from '@/lib/utils';

interface NotificationSetupProps {
  onPermissionChanged?: (enabled: boolean) => void;
}

/**
 * Componente para solicitar y gestionar permisos de notificación
 */
export function NotificationSetup({ onPermissionChanged }: NotificationSetupProps) {
  const [isEnabled, setIsEnabled] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isSupported, setIsSupported] = useState(false);

  useEffect(() => {
    // Verificar si el navegador soporta notificaciones
    const supported = typeof window !== 'undefined' && 'Notification' in window;
    setIsSupported(supported);
    if (supported) {
      setIsEnabled(NotificationService.isEnabled());
    }
  }, []);

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

  if (!isSupported) {
    return (
      <div className="text-[10px] text-muted-foreground">
        Tu navegador no soporta notificaciones
      </div>
    );
  }

  if (isEnabled) {
    return (
      <div className="flex items-center gap-2 text-[10px] text-emerald-400 font-black">
        <Check className="w-3 h-3" />
        Notificaciones Activas
      </div>
    );
  }

  return (
    <Button
      onClick={handleRequestPermission}
      disabled={isLoading}
      variant="outline"
      size="sm"
      className="text-[9px] font-black uppercase tracking-widest gap-2 h-9 rounded-lg border-white/[0.08] bg-white/[0.03] hover:bg-white/[0.08]"
    >
      {isLoading ? (
        <div className="w-3 h-3 animate-spin rounded-full border border-primary border-t-transparent" />
      ) : (
        <Bell className="w-3.5 h-3.5" />
      )}
      Activar Notificaciones
    </Button>
  );
}
