'use client';

import { motion } from 'framer-motion';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical, Edit3, Trash2, CheckCircle2, Tags, AlertCircle, Calendar } from 'lucide-react';
import { differenceInDays, isAfter, parseISO } from 'date-fns';
import { PriorityBadge, NodeId } from '@/components/atoms';
import type { Task } from '@/types/task';

interface TaskCardProps {
  task: Task;
  onDelete: (id: string) => void;
  onEdit: (task: Task) => void;
  isOverlay?: boolean;
}

interface DueStatus {
  isOverdue: boolean;
  isUrgent: boolean;
  daysLeft: number | null;
  formattedDate: string;
}

function getDueStatus(dueDate: string | Date | undefined): DueStatus | null {
  if (!dueDate) return null;

  try {
    const date = typeof dueDate === 'string' ? parseISO(dueDate) : dueDate as Date;
    const now = new Date();
    const daysLeft = differenceInDays(date, now);
    const isOverdue = isAfter(now, date);
    const isUrgent = daysLeft <= 3 && daysLeft > 0;

    const formattedDate = new Intl.DateTimeFormat('es-ES', {
      month: 'short',
      day: 'numeric',
    }).format(date);

    return {
      isOverdue,
      isUrgent,
      daysLeft: isOverdue ? null : daysLeft,
      formattedDate,
    };
  } catch {
    return null;
  }
}

export function TaskCard({ task, onDelete, onEdit, isOverlay }: TaskCardProps) {
  const dueStatus = getDueStatus(task.dueDate);
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
      {...attributes}
      {...listeners}
      style={style}
      layoutId={task.id}
      whileHover={{ y: -2, scale: 1.01 }}
      className="group relative glass-card p-4 md:p-5 hover:border-primary/50 hover:shadow-[0_0_15px_rgba(var(--primary-rgb),0.1)] transition-all duration-300 cursor-grab active:cursor-grabbing"
    >
      <div className="absolute top-0 right-0 p-3 opacity-100 md:opacity-0 group-hover:opacity-100 transition-opacity z-10 flex gap-1.5">
        <button
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => { e.stopPropagation(); onEdit(task); }}
          className="p-1.5 hover:bg-primary/20 rounded-lg text-primary/40 bg-[#050505]/60"
        >
          <Edit3 className="w-3 h-3" />
        </button>
        <button
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => { e.stopPropagation(); onDelete(task.id); }}
          className="p-1.5 hover:bg-red-500/20 rounded-lg text-red-500/40 bg-[#050505]/60"
        >
          <Trash2 className="w-3 h-3" />
        </button>
      </div>

      <div className="space-y-3.5">
        <div className="flex items-center gap-2">
          <PriorityBadge priority={task.priority} />
          <div
            className="p-1.5 hover:bg-white/[0.03] rounded-lg ml-auto opacity-20 group-hover:opacity-100"
          >
            <GripVertical className="w-3 h-3" />
          </div>
        </div>

        <div onClick={() => onEdit(task)} className="space-y-1 cursor-pointer">
          <h4 className="text-[12px] md:text-sm font-black leading-tight tracking-tight group-hover:text-primary transition-colors pr-8">
            {task.title}
          </h4>
          {task.description && (
            <p className="text-[10px] text-muted-foreground/70 line-clamp-2 font-medium leading-relaxed">
              {task.description}
            </p>
          )}
        </div>

        {task.tags && task.tags.length > 0 && (
          <div className="flex items-center gap-1.5 flex-wrap">
            <Tags className="w-3 h-3 text-white/25" />
            {task.tags.slice(0, 2).map((tag) => (
              <span key={tag} className="text-[9px] px-1.5 py-0.5 rounded-md border border-white/[0.08] bg-white/[0.02] text-white/50 uppercase tracking-wider font-black">
                {tag}
              </span>
            ))}
            {task.tags.length > 2 && (
              <span className="text-[9px] text-white/30 font-black">+{task.tags.length - 2}</span>
            )}
          </div>
        )}

        <div className="pt-3 flex items-center justify-between border-t border-white/[0.06]">
          <div className="flex items-center gap-2">
            <NodeId id={task.id} />
            {dueStatus && (
              <div className={`flex items-center gap-1 text-[9px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded-md border ${
                dueStatus.isOverdue
                  ? 'bg-red-500/10 border-red-500/30 text-red-400'
                  : dueStatus.isUrgent
                  ? 'bg-yellow-500/10 border-yellow-500/30 text-yellow-400'
                  : 'bg-white/[0.02] border-white/[0.08] text-white/50'
              }`}>
                <Calendar className="w-2.5 h-2.5" />
                {dueStatus.isOverdue ? 'Vencido' : `${dueStatus.daysLeft}d`}
              </div>
            )}
          </div>
          <div className="flex items-center gap-2">
            {dueStatus?.isOverdue && <AlertCircle className="w-3 h-3 text-red-400" />}
            {task.status === 'Hecho' && <CheckCircle2 className="w-3 h-3 text-primary" />}
          </div>
        </div>
      </div>
    </motion.div>
  );
}
