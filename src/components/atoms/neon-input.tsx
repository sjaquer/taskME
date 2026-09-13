'use client';

import { forwardRef, type InputHTMLAttributes } from 'react';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

interface NeonInputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  accent?: boolean;
}

export const NeonInput = forwardRef<HTMLInputElement, NeonInputProps>(
  ({ className, label, accent, ...props }, ref) => (
    <div className="space-y-1.5">
      {label && (
        <label className={cn(
          'text-[9px] uppercase font-black tracking-widest block',
          accent ? 'text-primary' : 'text-muted-foreground/60'
        )}>
          {label}
        </label>
      )}
      <Input
        ref={ref}
        className={cn(
          'bg-muted/30 border-border h-11 rounded-lg focus:border-primary/40 transition-colors',
          className
        )}
        {...props}
      />
    </div>
  )
);
NeonInput.displayName = 'NeonInput';
