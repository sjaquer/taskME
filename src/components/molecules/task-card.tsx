'use client';

import { motion } from 'framer-motion';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical, Edit3, Trash2, CheckCircle2, Tags, AlertCircle, Calendar } from 'lucide-react';
import { differenceInDays, isAfter, parseISO } from 'date-fns';
import { PriorityBadge, NodeId } from '@/components/atoms';
import { cn } from '@/lib/utils';
import { useAppContextStore } from '@/lib/store';
import type { Task } from '@/types/task';

interface TaskCardProps {
  task: Task;
  onDelete: (id: string) => void;
  onEdit: (task: Task) => void;
  isOverlay?: boolean;
  selectable?: boolean;
  selected?: boolean;
  onToggleSelect?: (taskId: string) => void;
  dragDisabled?: boolean;
  pendingSync?: boolean;
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

export function TaskCard({ task, onDelete, onEdit, isOverlay, selectable, selected, onToggleSelect, dragDisabled, pendingSync }: TaskCardProps) {
  const dueStatus = getDueStatus(task.dueDate);
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({
    id: isOverlay ? `${task.id}-overlay` : task.id,
    data: { type: 'Task', task },
    disabled: Boolean(isOverlay || dragDisabled),
  });

  const style = {
    transform: CSS.Translate.toString(transform),
    transition,
    opacity: isDragging && !isOverlay ? 0 : 1,
  };

  const priorityColors = {
    alta: 'rgba(239, 68, 68, 0.2)',
    media: 'rgba(245, 158, 11, 0.2)',
    baja: 'rgba(59, 130, 246, 0.2)',
  };

  const { visualConfig } = useAppContextStore();

  return (
    <motion.div
      ref={setNodeRef}
      style={style}
      layoutId={task.id}
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      whileHover={{ y: -4, scale: 1.01 }}
      transition={{ duration: 0.2 }}
      className={cn(
        'group relative glass-card p-4 transition-all duration-500 overflow-hidden',
        visualConfig.glowEnabled && 'hover:border-primary/40 hover:shadow-[0_20px_40px_rgba(0,0,0,0.4),0_0_20px_rgba(var(--primary-rgb),0.1)]',
        selected && 'border-primary/60 bg-primary/[0.06]'
      )}
    >
      {/* Priority Glow */}
      {visualConfig.glowEnabled && (
        <div 
          className="absolute -top-12 -right-12 w-24 h-24 blur-[40px] opacity-20 group-hover:opacity-40 transition-opacity pointer-events-none"
          style={{ backgroundColor: priorityColors[task.priority] }}
        />
      )}

      <div className="relative flex gap-4">
        {/* Left Control Lane (Selection) */}
        {!isOverlay && selectable && onToggleSelect && (
          <div className="flex-shrink-0 pt-1">
            <button
              type="button"
              onPointerDown={(e) => e.stopPropagation()}
              onClick={(e) => {
                e.stopPropagation();
                onToggleSelect(task.id);
              }}
              className={cn(
                'h-6 w-6 rounded-lg border-2 flex items-center justify-center transition-all duration-300',
                selected
                  ? 'border-primary bg-primary shadow-[0_0_15px_rgba(var(--primary-rgb),0.4)] scale-110'
                  : 'border-border bg-muted/30 hover:border-primary/40'
              )}
            >
              {selected && <CheckCircle2 className="w-4 h-4 text-black stroke-[3px]" />}
            </button>
          </div>
        )}

        {/* Main Content Area */}
        <div className="flex-1 min-w-0 space-y-4">
          {/* Header Area */}
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 min-w-0">
              <PriorityBadge priority={task.priority} className="py-1 px-3 flex-shrink-0" />
              {pendingSync && (
                <span className="flex items-center gap-1 text-[8px] px-2 py-0.5 rounded-lg border border-yellow-500/30 bg-yellow-500/10 text-yellow-300 uppercase tracking-widest font-black animate-pulse flex-shrink-0">
                  <span className="w-1 h-1 rounded-full bg-yellow-300" />
                  Sync
                </span>
              )}
            </div>

            <div className="flex items-center gap-1.5 flex-shrink-0">
              {/* Desktop Actions (Appear on Hover) */}
              <div className="hidden md:flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-all duration-300 translate-x-2 group-hover:translate-x-0">
                <button
                  onPointerDown={(e) => e.stopPropagation()}
                  onClick={(e) => { e.stopPropagation(); onEdit(task); }}
                  className="p-1.5 hover:bg-muted rounded-lg text-muted-foreground hover:text-primary transition-all border border-transparent hover:border-border"
                >
                  <Edit3 className="w-3.5 h-3.5" />
                </button>
                <button
                  onPointerDown={(e) => e.stopPropagation()}
                  onClick={(e) => { e.stopPropagation(); onDelete(task.id); }}
                  className="p-1.5 hover:bg-red-500/10 rounded-lg text-muted-foreground hover:text-red-500 transition-all border border-transparent hover:border-red-500/20"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>

              {!isOverlay && (
                <button
                  type="button"
                  ref={setActivatorNodeRef}
                  {...attributes}
                  {...listeners}
                  disabled={Boolean(dragDisabled)}
                  className={cn(
                    'p-2 hover:bg-white/[0.05] rounded-xl opacity-20 group-hover:opacity-100 transition-all touch-none',
                    dragDisabled ? 'cursor-not-allowed' : 'cursor-grab active:cursor-grabbing'
                  )}
                >
                  <GripVertical className="w-3.5 h-3.5 text-muted-foreground/60" />
                </button>
              )}
            </div>
          </div>

          {/* Title and Description */}
          <div onClick={() => onEdit(task)} className="space-y-2 cursor-pointer group/content">
            <h4 className="text-[14px] md:text-[15px] font-black leading-tight tracking-tight group-hover/content:text-primary transition-colors pr-2">
              {task.title}
            </h4>
            {task.description && (
              <p className="text-[11px] text-muted-foreground line-clamp-3 font-medium leading-relaxed group-hover/content:text-foreground transition-colors">
                {task.description}
              </p>
            )}
          </div>

          {/* Tags Section */}
          {task.tags && task.tags.length > 0 && (
            <div className="flex items-center gap-2 flex-wrap pt-1">
              <Tags className="w-3.5 h-3.5 text-primary/40 flex-shrink-0" />
              <div className="flex gap-1.5 flex-wrap">
                {task.tags.slice(0, 3).map((tag) => (
                  <span 
                    key={tag} 
                    className="text-[9px] px-2.5 py-1 rounded-lg border border-border bg-muted/40 text-muted-foreground uppercase tracking-wider font-black hover:border-primary/20 hover:text-primary/70 transition-colors"
                  >
                    {tag}
                  </span>
                ))}
                {task.tags.length > 3 && (
                  <span className="text-[9px] text-muted-foreground/30 font-black pt-1">+{task.tags.length - 3}</span>
                )}
              </div>
            </div>
          )}

          {/* Footer Area */}
          <div className="pt-4 flex flex-wrap items-center justify-between gap-3 border-t border-border">
            <div className="flex items-center gap-3">
              <NodeId id={task.id} />
              {dueStatus && (
                <div className={cn(
                  'flex items-center gap-1.5 text-[9px] font-black uppercase tracking-widest px-2 py-1 rounded-lg border transition-all',
                  dueStatus.isOverdue
                    ? 'bg-red-500/10 border-red-500/30 text-red-400 shadow-[0_0_10px_rgba(239,68,68,0.1)]'
                    : dueStatus.isUrgent
                    ? 'bg-amber-500/10 border-amber-500/30 text-amber-400'
                    : 'bg-muted/30 border-border text-muted-foreground/60'
                )}>
                  <Calendar className="w-3 h-3" />
                  {dueStatus.isOverdue ? 'CRITICAL' : dueStatus.formattedDate}
                </div>
              )}
            </div>
            
            <div className="flex items-center gap-2">
              {task.status === 'Hecho' && (
                <div className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-primary/10 border border-primary/20">
                  <CheckCircle2 className="w-3 h-3 text-primary" />
                  <span className="text-[8px] font-black text-primary uppercase tracking-tighter">Completado</span>
                </div>
              )}
              {dueStatus?.isOverdue && task.status !== 'Hecho' && (
                <AlertCircle className="w-4 h-4 text-red-500 animate-pulse" />
              )}
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
