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
        icon: '/site.webmanifest',
        badge: '/favicon.ico',
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
   * Envía notificación de tarea próxima a vencer
   */
  static taskDueNotification(taskTitle: string, minutesLeft: number): Notification | null {
    const hoursLeft = Math.floor(minutesLeft / 60);

    let timeText = '';
    if (hoursLeft > 0) {
      timeText = `en ${hoursLeft}h`;
    } else {
      timeText = `en ${minutesLeft}m`;
    }

    return this.send(`⏰ Tarea próxima: ${taskTitle}`, {
      body: `Vence ${timeText}`,
      tag: `task-${taskTitle}`,
      requireInteraction: minutesLeft < 15, // Mayor interacción si es muy pronto
      onClick: () => {
        window.location.href = '/kanban';
      },
    });
  }

  /**
   * Envía notificación de evento próximo
   */
  static eventUpcomingNotification(eventTitle: string, minutesLeft: number): Notification | null {
    const hoursLeft = Math.floor(minutesLeft / 60);

    let timeText = '';
    if (hoursLeft > 0) {
      timeText = `en ${hoursLeft}h`;
    } else {
      timeText = `en ${minutesLeft}m`;
    }

    return this.send(`📅 Evento próximo: ${eventTitle}`, {
      body: `Comienza ${timeText}`,
      tag: `event-${eventTitle}`,
      requireInteraction: minutesLeft < 15,
      onClick: () => {
        window.location.href = '/calendar';
      },
    });
  }

  /**
   * Envía notificación de rutina en progreso
   */
  static routineStartsNotification(routineTitle: string): Notification | null {
    return this.send(`🚀 Rutina iniciada: ${routineTitle}`, {
      body: 'Es hora de comenzar esta actividad',
      tag: `routine-${routineTitle}`,
      onClick: () => {
        window.location.href = '/schedule';
      },
    });
  }
}
