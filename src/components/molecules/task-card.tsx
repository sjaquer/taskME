'use client';

import { motion } from 'framer-motion';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical, Edit3, Trash2, Tag, CheckCircle2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { PriorityBadge, NodeId } from '@/components/atoms';
import { cn } from '@/lib/utils';
import type { Task } from '@/types/task';

interface TaskCardProps {
  task: Task;
  onDelete: (id: string) => void;
  onEdit: (task: Task) => void;
  isOverlay?: boolean;
}

export function TaskCard({ task, onDelete, onEdit, isOverlay }: TaskCardProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: task.id,
    data: { type: 'Task', task },
  });

  const style = {
    transform: CSS.Translate.toString(transform),
    transition,
    opacity: isDragging && !isOverlay ? 0.3 : 1,
  };

  return (
    <motion.div
      ref={setNodeRef}
      style={style}
      layoutId={task.id}
      whileHover={{ y: -2 }}
      className="group relative glass-card p-5 hover:border-primary/30 transition-all shadow-lg"
    >
      <div className="absolute top-0 right-0 p-3 opacity-100 md:opacity-0 group-hover:opacity-100 transition-opacity z-10 flex gap-1.5">
        <button
          onClick={(e) => { e.stopPropagation(); onEdit(task); }}
          className="p-1.5 hover:bg-primary/20 rounded-lg text-primary/40 bg-[#050505]/60"
        >
          <Edit3 className="w-3 h-3" />
        </button>
        <button
          onClick={(e) => { e.stopPropagation(); onDelete(task.id); }}
          className="p-1.5 hover:bg-red-500/20 rounded-lg text-red-500/40 bg-[#050505]/60"
        >
          <Trash2 className="w-3 h-3" />
        </button>
      </div>

      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <PriorityBadge priority={task.priority} />
          <div
            {...attributes}
            {...listeners}
            className="p-1.5 hover:bg-white/[0.03] rounded-lg cursor-grab active:cursor-grabbing ml-auto opacity-20 group-hover:opacity-100 touch-none"
            style={{ touchAction: 'none' }}
          >
            <GripVertical className="w-3 h-3" />
          </div>
        </div>

        <div onClick={() => onEdit(task)} className="space-y-1 cursor-pointer">
          <h4 className="text-[11px] md:text-sm font-black leading-tight tracking-tight group-hover:text-primary transition-colors pr-8">
            {task.title}
          </h4>
          {task.description && (
            <p className="text-[9px] text-muted-foreground/60 line-clamp-2 font-medium">
              {task.description}
            </p>
          )}
        </div>

        <div className="pt-3 flex items-center justify-between border-t border-white/[0.06]">
          <NodeId id={task.id} />
          {task.status === 'Hecho' && <CheckCircle2 className="w-3 h-3 text-primary" />}
        </div>
      </div>
    </motion.div>
  );
}
