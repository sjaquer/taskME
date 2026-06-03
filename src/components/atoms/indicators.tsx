'use client';

import { cn } from '@/lib/utils';
import type { Priority } from '@/types/task';

interface PriorityBadgeProps {
  priority: Priority;
  className?: string;
}

const priorityStyles: Record<Priority, string> = {
  alta: 'border-red-500/40 text-red-500 bg-red-500/10 shadow-[0_0_8px_rgba(239,68,68,0.15)]',
  media: 'border-amber-500/40 text-amber-500 bg-amber-500/10 shadow-[0_0_8px_rgba(245,158,11,0.15)]',
  baja: 'border-blue-500/40 text-blue-400 bg-blue-500/10 shadow-[0_0_8px_rgba(59,130,246,0.15)]',
};

export function PriorityBadge({ priority, className }: PriorityBadgeProps) {
  return (
    <span
      className={cn(
        'text-[10px] font-black px-2 py-0.5 rounded-full uppercase border tracking-widest font-mono',
        priorityStyles[priority],
        className
      )}
    >
      {priority}
    </span>
  );
}

interface StatusIndicatorProps {
  active?: boolean;
  label?: string;
}

export function StatusIndicator({ active = false, label }: StatusIndicatorProps) {
  return (
    <div className="flex items-center gap-1.5">
      <div
        className={cn(
          'w-1.5 h-1.5 rounded-full transition-colors',
          active
            ? 'bg-primary animate-pulse'
            : 'bg-muted-foreground/30'
        )}
      />
      {label && (
        <span className="text-[11px] font-black text-muted-foreground uppercase tracking-widest">
          {label}
        </span>
      )}
    </div>
  );
}

interface NodeIdProps {
  id: string;
  className?: string;
}

export function NodeId({ id, className }: NodeIdProps) {
  return (
    <span className={cn('text-[9px] font-black text-muted-foreground/40 tracking-widest uppercase font-data flex items-center gap-1.5', className)}>
      <span className="w-1.5 h-[1px] bg-border" />
      NODE_{id.slice(0, 4).toUpperCase()}
    </span>
  );
}

interface SectionLabelProps {
  icon?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}

export function SectionLabel({ icon, children, className }: SectionLabelProps) {
  return (
    <h3 className={cn('text-[9px] font-black uppercase tracking-[0.4em] text-muted-foreground/60 flex items-center gap-3', className)}>
      {icon}
      {children}
    </h3>
  );
}
