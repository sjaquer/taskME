'use client';

import { motion } from 'framer-motion';
import { format, parseISO } from 'date-fns';
import { Edit3, Trash2, MapPin, Clock } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { Task } from '@/types/task';

interface CalendarEventProps {
  task: Task;
  index: number;
  onEdit: (task: Task) => void;
  onDelete: (taskId: string) => void;
}

export function CalendarEvent({ task, index, onEdit, onDelete }: CalendarEventProps) {
  return (
    <motion.div
      key={task.id}
      initial={{ opacity: 0, x: 10 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.05 }}
      className="glass-card p-4 md:p-6 hover:border-primary/30 transition-all group relative overflow-hidden"
    >
      <div
        className={cn(
          'absolute top-0 left-0 w-1 h-full',
          task.priority === 'alta' ? 'bg-red-500' : task.priority === 'media' ? 'bg-primary' : 'bg-white/10'
        )}
      />
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <span
              className={cn(
                'text-[10px] font-black px-2 py-0.5 rounded-full uppercase border font-mono',
                task.priority === 'alta'
                  ? 'bg-red-500/10 text-red-500 border-red-500/20'
                  : 'bg-white/[0.03] text-muted-foreground border-white/[0.06]'
              )}
            >
              {task.priority}
            </span>
            {task.category && (
              <Badge className="bg-white/[0.03] text-white/40 border-white/[0.06] text-[10px] px-1.5">
                {task.category}
              </Badge>
            )}
            {task.dueDate && (
              <span className="text-[10px] text-white/30 font-data">
                {format(parseISO(task.dueDate), 'HH:mm')}
              </span>
            )}
          </div>
          <h4 className="font-black text-lg md:text-xl leading-tight pr-10">
            {task.title}
          </h4>
          {task.location && (
            <p className="text-[11px] font-black text-muted-foreground uppercase flex items-center gap-2">
              <MapPin className="w-3 h-3" /> {task.location}
            </p>
          )}
        </div>
        <div className="flex items-center gap-2 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-all">
          <Button variant="ghost" size="icon" onClick={() => onEdit(task)} className="h-9 w-9 rounded-lg bg-[#050505]/60">
            <Edit3 className="w-4 h-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => onDelete(task.id)}
            className="h-9 w-9 rounded-lg hover:text-red-500 bg-[#050505]/60"
          >
            <Trash2 className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </motion.div>
  );
}
