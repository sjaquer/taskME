export type Priority = 'baja' | 'media' | 'alta';

export type RecurrenceType = 'none' | 'weekly' | 'monthly';

export type AppContext = 'Trabajo' | 'Estudio';

export type TaskStatus = 'Pendiente' | 'Haciendo' | 'Hecho' | string;

export interface Task {
  id: string;
  title: string;
  description?: string;
  status: TaskStatus;
  priority: Priority;
  context: AppContext;
  userId: string;
  dueDate?: string;
  tags?: string[];
  scheduledStartTime?: string;
  scheduledEndTime?: string;
  isRecurring?: boolean;
  recurringDays?: number[];
  recurrenceType?: RecurrenceType;
  location?: string;
  category?: string;
}

export interface TaskFormData {
  title: string;
  description: string;
  priority: Priority;
  status: string;
  tags: string;
}

export interface CalendarFormData {
  title: string;
  time: string;
  priority: Priority;
  status: string;
  location: string;
  category: string;
  recurrenceType: RecurrenceType;
}

export interface ScheduleFormData {
  title: string;
  startTime: string;
  endTime: string;
  priority: Priority;
  isRecurring: boolean;
  recurringDays: number[];
}
