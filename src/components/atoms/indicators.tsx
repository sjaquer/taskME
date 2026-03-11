'use client';

import { cn } from '@/lib/utils';
import type { Priority } from '@/types/task';

interface PriorityBadgeProps {
  priority: Priority;
  className?: string;
}

const priorityStyles: Record<Priority, string> = {
  alta: 'border-red-500/30 text-red-500 bg-red-500/5',
  media: 'border-primary/30 text-primary bg-primary/5',
  baja: 'border-white/10 text-muted-foreground bg-white/[0.03]',
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
            ? 'bg-primary animate-pulse shadow-[0_0_6px_rgba(57,255,20,0.6)]'
            : 'bg-white/20'
        )}
      />
      {label && (
        <span className="text-[11px] font-black text-white/40 uppercase tracking-widest">
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
    <span className={cn('text-[10px] font-black text-white/10 tracking-widest uppercase font-mono', className)}>
      NODE_{id.slice(0, 4)}
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
    <h3 className={cn('text-[9px] font-black uppercase tracking-[0.4em] text-white/40 flex items-center gap-3', className)}>
      {icon}
      {children}
    </h3>
  );
}
