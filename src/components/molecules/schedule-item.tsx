'use client';

import { motion } from 'framer-motion';
import { differenceInMinutes, isAfter, isBefore, setHours, setMinutes, isSameDay } from 'date-fns';
import { Clock, Edit3, Trash2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
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

export function ScheduleItem({ routine, selectedDate, currentTime, index, onEdit, onDelete }: ScheduleItemProps) {
  const progress = getActivityProgress(routine, selectedDate, currentTime);
  const isActive = progress !== null;
  const { hourFormat } = useAppContextStore();

  return (
    <motion.div
      key={routine.id}
      initial={{ opacity: 0, x: 10 }}
      animate={{ opacity: 1, x: 0 }}
      className="relative"
    >
      <div
        className={cn(
          'absolute left-[-16px] md:left-[-44px] top-4 w-2.5 h-2.5 rounded-full border transition-all z-20',
          isActive
            ? 'bg-primary border-primary animate-pulse shadow-[0_0_6px_rgba(57,255,20,0.5)]'
            : 'bg-muted/30 border-border'
        )}
      />
      <div className="flex flex-col md:flex-row md:items-start gap-3 md:gap-12">
        <div className="w-16 pt-3">
          <span className={cn('text-xs md:text-sm font-black tracking-widest font-data', isActive ? 'text-primary' : 'text-muted-foreground/30')}>
            {formatTime(routine.startTime, hourFormat)}
          </span>
        </div>
        <div
          className={cn(
            'flex-1 glass-card p-4 md:p-6 flex flex-col gap-4 border-l-4 transition-all relative overflow-hidden group',
            routine.priority === 'alta' ? 'border-l-red-500' : isActive ? 'border-l-primary' : 'border-l-border'
          )}
          style={routine.color ? { borderLeftColor: routine.color } : undefined}
        >
          <div className="absolute top-0 right-0 p-3 opacity-100 md:opacity-0 group-hover:opacity-100 transition-opacity z-10 flex gap-1.5">
            <Button variant="ghost" size="icon" onClick={() => onEdit(routine)} className="h-8 w-8 rounded-lg bg-card/60 backdrop-blur-md border border-border">
              <Edit3 className="w-3.5 h-3.5" />
            </Button>
            <Button variant="ghost" size="icon" onClick={() => onDelete(routine.id)} className="h-8 w-8 rounded-lg bg-card/60 backdrop-blur-md border border-border">
              <Trash2 className="w-3.5 h-3.5" />
            </Button>
          </div>
          <div className="space-y-1.5">
            <h4 className="text-base md:text-xl font-black tracking-tighter text-foreground pr-12">{routine.title}</h4>
            <div className="flex gap-2">
              <Badge className="bg-primary/10 text-primary border-primary/20 text-[10px] font-black px-1.5 py-0.5">
                RUTINA
              </Badge>
              <Badge variant="outline" className="text-[10px] font-black uppercase px-1.5 py-0.5 font-mono">
                {routine.priority || 'media'}
              </Badge>
            </div>
          </div>
          {isActive && (
            <div className="space-y-1.5 bg-muted/20 p-3 rounded-lg border border-border">
              <div className="flex justify-between text-[10px] font-black text-primary uppercase font-data">
                <span>En curso</span>
                <span>{progress}%</span>
              </div>
              <Progress value={progress} className="h-1" />
            </div>
          )}
          <div className="flex items-center gap-4 text-[11px] text-muted-foreground/60 uppercase font-black tracking-widest font-data">
            <Clock className="w-3 h-3 text-primary" />
            {formatTime(routine.startTime, hourFormat)} - {formatTime(routine.endTime, hourFormat)}
          </div>
        </div>
      </div>
    </motion.div>
  );
}
