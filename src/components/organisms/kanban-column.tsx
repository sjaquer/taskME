'use client';

import { useDroppable } from '@dnd-kit/core';
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
  const { setNodeRef, isOver } = useDroppable({
    id: status,
    data: { type: 'Column', status },
  });

  return (
    <div className="flex-shrink-0 w-[85vw] sm:w-80 md:w-96 flex flex-col gap-3 snap-center" id={status}>
      <div className="flex items-center gap-3 px-2 py-1 rounded-xl bg-white/[0.02] border border-white/[0.06]">
        <div className={cn('w-2 h-2 rounded-full', status === 'Hecho' ? 'bg-primary neon-glow' : 'bg-white/20')} />
        <h3 className="font-black uppercase tracking-[0.2em] text-[10px] text-white/70">{status}</h3>
        <span className="ml-auto text-[11px] font-black bg-white/[0.03] px-2 py-0.5 rounded-full border border-white/[0.06] text-muted-foreground/70 font-data">
          {tasks.length}
        </span>
      </div>

      <div
        ref={setNodeRef}
        className={cn(
          'flex-1 glass-card p-3 md:p-4 border-dashed min-h-[420px] relative transition-colors',
          isOver && 'border-primary/60 bg-primary/[0.06]'
        )}
      >
        <SortableContext items={tasks.map((t) => t.id)} strategy={verticalListSortingStrategy}>
          <div className="space-y-4 relative z-10">
            {tasks.map((task) => (
              <TaskCard key={task.id} task={task} onDelete={onDelete} onEdit={onEdit} />
            ))}
            
            {/* Ghost Card Preview */}
            {isOver && (
              <div
                className="border-2 border-dashed border-primary/30 rounded-2xl h-32 bg-primary/[0.03] flex flex-col items-center justify-center gap-3 animate-pulse overflow-hidden relative"
              >
                <div className="absolute inset-0 bg-gradient-to-b from-primary/5 to-transparent" />
                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center border border-primary/20">
                  <AlertCircle className="w-5 h-5 text-primary" />
                </div>
                <div className="flex flex-col items-center">
                  <span className="text-[9px] font-black uppercase tracking-[0.3em] text-primary/60">Detectando Secuencia</span>
                  <span className="text-[8px] font-medium uppercase tracking-widest text-primary/40 mt-1">Listo para inyectar nodo</span>
                </div>
              </div>
            )}
          </div>
        </SortableContext>
        {tasks.length === 0 && !isOver && (
          <div className="flex flex-col items-center justify-center py-24 opacity-60 text-center">
            <AlertCircle className="w-8 h-8 mb-3 text-white/20" />
            <p className="text-[9px] font-black uppercase tracking-[0.35em] text-white/30">Sin tareas</p>
            <p className="text-[10px] text-white/25 mt-1">Arrastra una tarjeta aquí</p>
          </div>
        )}
      </div>
    </div>
  );
}
