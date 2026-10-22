'use client';

import { motion } from 'framer-motion';
import { differenceInMinutes, isAfter, isBefore, setHours, setMinutes, isSameDay } from 'date-fns';
import { Clock, Edit3, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { cn, formatTime } from '@/lib/utils';
import { useAppContextStore } from '@/lib/store';
import type { Routine } from '@/types/task';

interface ScheduleItemProps {
  routine: Routine;
  selectedDate: Date;
  currentTime: Date;
  index: number;
  onEdit: (routine: Routine) => void;
  onDelete: (routineId: string) => void;
}

function getActivityProgress(routine: Routine, selectedDate: Date, currentTime: Date): number | null {
  if (!routine.startTime || !routine.endTime || !isSameDay(selectedDate, new Date())) return null;
  const [startH, startM] = routine.startTime.split(':').map(Number);
  const [endH, endM] = routine.endTime.split(':').map(Number);
  const start = setMinutes(setHours(currentTime, startH), startM);
  const end = setMinutes(setHours(currentTime, endH), endM);

  if (isAfter(currentTime, start) && isBefore(currentTime, end)) {
    const total = differenceInMinutes(end, start);
    const elapsed = differenceInMinutes(currentTime, start);
    return Math.round((elapsed / total) * 100);
  }
  return null;
}

const PRIORITY_DOT: Record<string, string> = { alta: 'bg-red-500', media: 'bg-amber-500', baja: 'bg-blue-500' };

export function ScheduleItem({ routine, selectedDate, currentTime, onEdit, onDelete }: ScheduleItemProps) {
  const progress = getActivityProgress(routine, selectedDate, currentTime);
  const isActive = progress !== null;
  const { hourFormat } = useAppContextStore();
  const color = routine.color || 'hsl(var(--primary))';

  return (
    <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="w-full">
      <div
        className={cn(
          'flex items-stretch gap-3 rounded-2xl border p-3 transition-colors',
          isActive ? 'border-primary/40 bg-primary/[0.04]' : 'border-border'
        )}
      >
        <span className="w-1 shrink-0 rounded-full" style={{ backgroundColor: color }} />
        <button type="button" onClick={() => onEdit(routine)} className="min-w-0 flex-1 text-left">
          <p className="truncate font-semibold">{routine.title}</p>
          <p className="mt-0.5 flex items-center gap-2 text-xs text-muted-foreground">
            <Clock className="h-3 w-3" />
            <span className="font-data">
              {formatTime(routine.startTime, hourFormat)} – {formatTime(routine.endTime, hourFormat)}
            </span>
            <span className={cn('h-1.5 w-1.5 rounded-full', PRIORITY_DOT[routine.priority] ?? PRIORITY_DOT.media)} />
            {routine.priority || 'media'}
            {isActive && <span className="font-semibold text-primary">· en curso {progress}%</span>}
          </p>
          {isActive && <Progress value={progress} className="mt-2 h-1" />}
        </button>
        <div className="flex shrink-0 items-start gap-0.5">
          <Button variant="ghost" size="icon" aria-label={`Editar "${routine.title}"`} onClick={() => onEdit(routine)} className="h-8 w-8 rounded-lg text-muted-foreground">
            <Edit3 className="h-3.5 w-3.5" />
          </Button>
          <Button variant="ghost" size="icon" aria-label={`Eliminar "${routine.title}"`} onClick={() => onDelete(routine.id)} className="h-8 w-8 rounded-lg text-muted-foreground hover:text-red-400">
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>
    </motion.div>
  );
}
