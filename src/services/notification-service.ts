/**
 * Servicio para manejar notificaciones del navegador
 * Utiliza la Notification API para enviar avisos de tareas y eventos próximos
 */

export class NotificationService {
  /**
   * Solicita permiso al usuario para enviar notificaciones
   */
  static async requestPermission(): Promise<boolean> {
    if (typeof window === 'undefined') return false;

    // Verificar si el navegador soporta notificaciones
    if (!('Notification' in window)) {
      console.warn('Este navegador no soporta notificaciones');
      return false;
    }

    // Si ya tiene permiso, retornar true
    if (Notification.permission === 'granted') {
      return true;
    }

    // Si fue denegado antes, no pedir de nuevo
    if (Notification.permission === 'denied') {
      return false;
    }

    // Solicitar permiso
    try {
      const permission = await Notification.requestPermission();
      return permission === 'granted';
    } catch (error) {
      console.error('Error al solicitar permiso de notificaciones:', error);
      return false;
    }
  }

  /**
   * Verifica si las notificaciones están habilitadas
   */
  static isEnabled(): boolean {
    if (typeof window === 'undefined') return false;
    return 'Notification' in window && Notification.permission === 'granted';
  }

  /**
   * Envía una notificación al usuario
   */
  static send(
    title: string,
    options?: {
      body?: string;
      icon?: string;
      badge?: string;
      tag?: string;
      requireInteraction?: boolean;
      onClick?: () => void;
    }
  ): Notification | null {
    if (!this.isEnabled()) return null;

    try {
      const notification = new Notification(title, {
        icon: '/web-app-manifest-192x192.png',
        badge: '/favicon-96x96.png',
        ...options,
      });

      if (options?.onClick) {
        notification.onclick = () => {
          options.onClick?.();
          notification.close();
          // Traer la ventana al frente
          if (window.parent) {
            window.parent.focus();
          }
        };
      }

      return notification;
    } catch (error) {
      console.error('Error al enviar notificación:', error);
      return null;
    }
  }

  /**
   * Envía notificación de tarea con hora que vence pronto
   */
  static taskDueNotification(taskId: string, taskTitle: string, minutesLeft: number): Notification | null {
    const hoursLeft = Math.floor(minutesLeft / 60);
    const timeText = hoursLeft > 0 ? `en ${hoursLeft}h` : `en ${minutesLeft}m`;

    return this.send(`⏰ Tarea próxima: ${taskTitle}`, {
      body: `Vence ${timeText}`,
      tag: `task-${taskId}`,
      requireInteraction: minutesLeft < 15, // Mayor interacción si es muy pronto
      onClick: () => {
        window.location.href = '/kanban';
      },
    });
  }

  /**
   * Envía notificación de tarea que vence hoy (fecha sin hora)
   */
  static taskDueTodayNotification(taskId: string, taskTitle: string): Notification | null {
    return this.send(`📅 Vence hoy: ${taskTitle}`, {
      body: 'Esta tarea tiene como fecha límite el día de hoy.',
      tag: `task-${taskId}`,
      onClick: () => {
        window.location.href = '/kanban';
      },
    });
  }

  /**
   * Envía notificación de rutina por comenzar
   */
  static routineStartsNotification(routineId: string, routineTitle: string): Notification | null {
    return this.send(`🚀 Rutina por comenzar: ${routineTitle}`, {
      body: 'Empieza en unos minutos',
      tag: `routine-${routineId}`,
      onClick: () => {
        window.location.href = '/schedule';
      },
    });
  }
}
