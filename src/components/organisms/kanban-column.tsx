'use client';

import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { AlertCircle } from 'lucide-react';
import { TaskCard } from '@/components/molecules/task-card';
import { cn } from '@/lib/utils';
import type { Task } from '@/types/task';

interface KanbanColumnProps {
  status: string;
  tasks: Task[];
  onDelete: (id: string) => void;
  onEdit: (task: Task) => void;
}

export function KanbanColumn({ status, tasks, onDelete, onEdit }: KanbanColumnProps) {
  return (
    <div className="flex-shrink-0 w-[80vw] sm:w-80 md:w-96 flex flex-col gap-4" id={status}>
      <div className="flex items-center gap-3 px-2">
        <div className={cn('w-1.5 h-1.5 rounded-full', status === 'Hecho' ? 'bg-primary neon-glow' : 'bg-white/20')} />
        <h3 className="font-black uppercase tracking-[0.2em] text-[9px] text-white/60">{status}</h3>
        <span className="text-[11px] font-black bg-white/[0.03] px-2 py-0.5 rounded-full border border-white/[0.06] text-muted-foreground/50 font-data">
          {tasks.length}
        </span>
      </div>

      <div className="flex-1 glass-card p-3 md:p-5 border-dashed min-h-[400px] relative">
        <SortableContext items={tasks.map((t) => t.id)} strategy={verticalListSortingStrategy}>
          <div className="space-y-4 relative z-10">
            {tasks.map((task) => (
              <TaskCard key={task.id} task={task} onDelete={onDelete} onEdit={onEdit} />
            ))}
          </div>
        </SortableContext>
        {tasks.length === 0 && (
          <div className="flex flex-col items-center justify-center py-32 opacity-[0.04]">
            <AlertCircle className="w-12 h-12 mb-2" />
            <p className="text-[9px] font-black uppercase tracking-[0.5em]">Vacío</p>
          </div>
        )}
      </div>
    </div>
  );
}
