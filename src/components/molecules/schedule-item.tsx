'use client';

import { motion } from 'framer-motion';
import { format, parseISO, differenceInMinutes, isAfter, isBefore, setHours, setMinutes, isSameDay } from 'date-fns';
import { Clock, Edit3, Trash2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';
import type { Task } from '@/types/task';

interface ScheduleItemProps {
  task: Task;
  selectedDate: Date;
  currentTime: Date;
  index: number;
  onEdit: (task: Task) => void;
  onDelete: (taskId: string) => void;
}

function getActivityProgress(task: Task, selectedDate: Date, currentTime: Date): number | null {
  if (!task.scheduledStartTime || !task.scheduledEndTime || !isSameDay(selectedDate, new Date())) return null;
  const start = parseISO(task.scheduledStartTime);
  const end = parseISO(task.scheduledEndTime);
  const currentStart = setMinutes(setHours(currentTime, start.getHours()), start.getMinutes());
  const currentEnd = setMinutes(setHours(currentTime, end.getHours()), end.getMinutes());

  if (isAfter(currentTime, currentStart) && isBefore(currentTime, currentEnd)) {
    const total = differenceInMinutes(currentEnd, currentStart);
    const elapsed = differenceInMinutes(currentTime, currentStart);
    return Math.round((elapsed / total) * 100);
  }
  return null;
}

export function ScheduleItem({ task, selectedDate, currentTime, index, onEdit, onDelete }: ScheduleItemProps) {
  const progress = getActivityProgress(task, selectedDate, currentTime);
  const isActive = progress !== null;

  return (
    <motion.div
      key={task.id}
      initial={{ opacity: 0, x: 10 }}
      animate={{ opacity: 1, x: 0 }}
      className="relative"
    >
      <div
        className={cn(
          'absolute left-[-16px] md:left-[-44px] top-4 w-2.5 h-2.5 rounded-full border transition-all z-20',
          isActive
            ? 'bg-primary border-primary animate-pulse shadow-[0_0_6px_rgba(57,255,20,0.5)]'
            : 'bg-white/10 border-white/20'
        )}
      />
      <div className="flex flex-col md:flex-row md:items-start gap-3 md:gap-12">
        <div className="w-16 pt-3">
          <span className={cn('text-xs md:text-sm font-black tracking-widest font-data', isActive ? 'text-primary' : 'text-white/20')}>
            {task.scheduledStartTime ? format(parseISO(task.scheduledStartTime), 'HH:mm') : '--:--'}
          </span>
        </div>
        <div
          className={cn(
            'flex-1 glass-card p-4 md:p-6 flex flex-col gap-4 border-l-4 transition-all relative overflow-hidden group',
            task.priority === 'alta' ? 'border-l-red-500' : isActive ? 'border-l-primary' : 'border-l-white/10'
          )}
        >
          <div className="absolute top-0 right-0 p-3 opacity-100 md:opacity-0 group-hover:opacity-100 transition-opacity z-10 flex gap-1.5">
            <Button variant="ghost" size="icon" onClick={() => onEdit(task)} className="h-8 w-8 rounded-lg bg-[#050505]/60">
              <Edit3 className="w-3.5 h-3.5" />
            </Button>
            <Button variant="ghost" size="icon" onClick={() => onDelete(task.id)} className="h-8 w-8 rounded-lg bg-[#050505]/60">
              <Trash2 className="w-3.5 h-3.5" />
            </Button>
          </div>
          <div className="space-y-1.5">
            <h4 className="text-base md:text-xl font-black tracking-tighter text-white pr-12">{task.title}</h4>
            <div className="flex gap-2">
              {task.isRecurring && (
                <Badge className="bg-primary/10 text-primary border-primary/20 text-[10px] font-black px-1.5 py-0.5">
                  RUTINA
                </Badge>
              )}
              <Badge variant="outline" className="text-[10px] font-black uppercase px-1.5 py-0.5 font-mono">
                {task.priority || 'media'}
              </Badge>
            </div>
          </div>
          {isActive && (
            <div className="space-y-1.5 bg-white/[0.03] p-3 rounded-lg border border-white/[0.06]">
              <div className="flex justify-between text-[10px] font-black text-primary uppercase font-data">
                <span>Sistema Activo</span>
                <span>{progress}%</span>
              </div>
              <Progress value={progress} className="h-1" />
            </div>
          )}
          <div className="flex items-center gap-4 text-[11px] text-white/20 uppercase font-black tracking-widest font-data">
            <Clock className="w-3 h-3 text-primary" />
            {task.scheduledStartTime ? format(parseISO(task.scheduledStartTime), 'HH:mm') : '--:--'} -{' '}
            {task.scheduledEndTime ? format(parseISO(task.scheduledEndTime), 'HH:mm') : '...'}
          </div>
        </div>
      </div>
    </motion.div>
  );
}
