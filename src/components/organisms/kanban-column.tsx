'use client';

import { useDroppable } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { AlertCircle } from 'lucide-react';
import { TaskCard } from '@/components/molecules/task-card';
import { cn } from '@/lib/utils';
import { useAppContextStore } from '@/lib/store';
import type { Task } from '@/types/task';

interface KanbanColumnProps {
  status: string;
  tasks: Task[];
  onDelete: (id: string) => void;
  onEdit: (task: Task) => void;
  selectedTaskIds: Set<string>;
  onToggleTaskSelection: (taskId: string) => void;
  disableDrag?: boolean;
  pendingTaskIds?: Set<string>;
}

export function KanbanColumn({ status, tasks, onDelete, onEdit, selectedTaskIds, onToggleTaskSelection, disableDrag, pendingTaskIds }: KanbanColumnProps) {
  const { setNodeRef, isOver } = useDroppable({
    id: status,
    data: { type: 'Column', status },
  });

  const { visualConfig } = useAppContextStore();

  return (
    <div className={cn(
      "flex-shrink-0 w-[85vw] sm:w-80 md:w-96 flex flex-col snap-center",
      visualConfig.compactMode ? "gap-2" : "gap-3"
    )} id={status}>
      <div className="flex items-center gap-3 px-2 py-1 rounded-xl bg-muted/20 border border-border">
        <div className={cn(
          'w-2 h-2 rounded-full', 
          status === 'Hecho' ? (visualConfig.glowEnabled ? 'bg-primary neon-glow' : 'bg-primary') : 'bg-muted-foreground/30'
        )} />
        <h3 className="font-black uppercase tracking-[0.2em] text-[10px] text-muted-foreground">{status}</h3>
        <span className="ml-auto text-[11px] font-black bg-muted/40 px-2 py-0.5 rounded-full border border-border text-muted-foreground font-data">
          {tasks.length}
        </span>
      </div>

      <div
        ref={setNodeRef}
        className={cn(
          'flex-1 glass-card border-dashed min-h-[420px] relative transition-colors',
          visualConfig.compactMode ? "p-2" : "p-3 md:p-4",
          isOver && 'border-primary/60 bg-primary/[0.06]'
        )}
      >
        <SortableContext items={tasks.map((t) => t.id)} strategy={verticalListSortingStrategy}>
          <div className={cn("relative z-10", visualConfig.compactMode ? "space-y-2" : "space-y-4")}>
            {tasks.map((task) => (
              <TaskCard
                key={task.id}
                task={task}
                onDelete={onDelete}
                onEdit={onEdit}
                selectable
                selected={selectedTaskIds.has(task.id)}
                onToggleSelect={onToggleTaskSelection}
                dragDisabled={disableDrag}
                pendingSync={pendingTaskIds?.has(task.id)}
              />
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
                  <span className="text-[9px] font-black uppercase tracking-[0.3em] text-primary/60">Mover a esta columna</span>
                  <span className="text-[8px] font-medium uppercase tracking-widest text-primary/40 mt-1">Soltar para organizar</span>
                </div>
              </div>
            )}
          </div>
        </SortableContext>
        {tasks.length === 0 && !isOver && (
          <div className="flex flex-col items-center justify-center py-24 opacity-60 text-center">
            <AlertCircle className="w-8 h-8 mb-3 text-muted-foreground/20" />
            <p className="text-[9px] font-black uppercase tracking-[0.35em] text-muted-foreground/30">Sin tareas</p>
            <p className="text-[10px] text-muted-foreground/25 mt-1">Arrastra una tarjeta aquí</p>
          </div>
        )}
      </div>
    </div>
  );
}
