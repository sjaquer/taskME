'use client';

import { forwardRef } from 'react';
import { Button, ButtonProps } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export const TacticalButton = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, children, ...props }, ref) => (
    <Button
      ref={ref}
      className={cn(
        'rounded-xl h-12 px-8 font-black uppercase tracking-widest text-[10px] neon-glow',
        className
      )}
      {...props}
    >
      {children}
    </Button>
  )
);
TacticalButton.displayName = 'TacticalButton';

export const GhostButton = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, children, ...props }, ref) => (
    <Button
      ref={ref}
      variant="ghost"
      className={cn(
        'text-[9px] font-black uppercase tracking-widest text-primary/60 hover:text-primary hover:bg-primary/5 h-9 px-3 rounded-lg',
        className
      )}
      {...props}
    >
      {children}
    </Button>
  )
);
GhostButton.displayName = 'GhostButton';

export const OutlineButton = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, children, ...props }, ref) => (
    <Button
      ref={ref}
      variant="outline"
      className={cn(
        'rounded-xl h-12 px-4 border-border bg-muted/30 hover:bg-muted/50 transition-colors',
        className
      )}
      {...props}
    >
      {children}
    </Button>
  )
);
OutlineButton.displayName = 'OutlineButton';
