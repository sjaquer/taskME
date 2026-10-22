'use client';

import { forwardRef, type ReactNode } from 'react';
import { Loader2, Plus, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { PRIORITIES, getPriorityMeta } from '@/lib/tasks';
import { useBackDismiss } from '@/hooks/use-back-dismiss';
import type { Priority, Project } from '@/types/task';

const NO_PROJECT_VALUE = 'sin-proyecto';

/** Contenedor de los formularios embebidos (la app evita modales en el WebView). */
export const FormPanel = forwardRef<
  HTMLDivElement,
  { title: string; onClose: () => void; children: ReactNode; className?: string }
>(({ title, onClose, children, className }, ref) => {
  // El botón atrás de Android cierra el formulario en lugar de salir de la página.
  useBackDismiss(true, onClose);
  return (
  <div ref={ref} className={cn('glass-card-elevated border border-border rounded-3xl p-5 sm:p-6 space-y-4 w-full', className)}>
    <div className="flex items-center justify-between border-b border-border/40 pb-3">
      <h3 className="text-lg font-black uppercase tracking-tighter text-foreground">{title}</h3>
      <button
        type="button"
        onClick={onClose}
        aria-label="Cerrar formulario"
        className="h-8 w-8 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted/40 transition-colors"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
    {children}
  </div>
  );
});
FormPanel.displayName = 'FormPanel';

export function FieldLabel({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <Label className={cn('text-[10px] font-black uppercase tracking-[0.3em] text-muted-foreground', className)}>
      {children}
    </Label>
  );
}

/** Campo con etiqueta y espaciado estándar. */
export function Field({ label, children, className }: { label: ReactNode; children: ReactNode; className?: string }) {
  return (
    <div className={cn('space-y-2', className)}>
      <FieldLabel>{label}</FieldLabel>
      {children}
    </div>
  );
}

export const fieldInputClassName = 'h-11 rounded-2xl border-border bg-muted/20';

export function PrioritySelect({
  value,
  onChange,
  className,
}: {
  value: Priority;
  onChange: (priority: Priority) => void;
  className?: string;
}) {
  return (
    <Select value={value} onValueChange={(v) => onChange(v as Priority)}>
      <SelectTrigger className={cn(fieldInputClassName, className)}>
        <SelectValue placeholder="Prioridad" />
      </SelectTrigger>
      <SelectContent className="border-border bg-card">
        {PRIORITIES.map((priority) => (
          <SelectItem key={priority} value={priority}>
            {getPriorityMeta(priority).label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

export function ProjectSelect({
  value,
  onChange,
  projects,
  className,
}: {
  value: string;
  onChange: (projectId: string) => void;
  projects: Project[];
  className?: string;
}) {
  return (
    <Select value={value || NO_PROJECT_VALUE} onValueChange={(v) => onChange(v === NO_PROJECT_VALUE ? '' : v)}>
      <SelectTrigger className={cn(fieldInputClassName, className)}>
        <SelectValue placeholder="Sin proyecto" />
      </SelectTrigger>
      <SelectContent className="border-border bg-card">
        <SelectItem value={NO_PROJECT_VALUE}>Sin proyecto</SelectItem>
        {projects.map((project) => (
          <SelectItem key={project.id} value={project.id}>
            {project.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

export function SubmitButton({
  onClick,
  isSaving = false,
  children,
}: {
  onClick: () => void;
  isSaving?: boolean;
  children: ReactNode;
}) {
  return (
    <div className="pt-2 border-t border-border/40">
      <Button
        type="button"
        onClick={onClick}
        disabled={isSaving}
        className="h-11 w-full rounded-2xl bg-primary text-[10px] font-black uppercase tracking-[0.3em] text-primary-foreground"
      >
        {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />}
        {children}
      </Button>
    </div>
  );
}
