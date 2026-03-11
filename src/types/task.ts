export type Priority = 'baja' | 'media' | 'alta';

export type RecurrenceType = 'none' | 'weekly' | 'monthly';

export interface Task {
  id: string;
  title: string;
  description?: string;
  status: string;
  priority?: Priority;
  context: string;
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
