'use client';

import { Loader2, Plus, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import type { Priority, Project } from '@/types/task';

export interface TaskFormState {
  title: string;
  description: string;
  priority: Priority;
  status: string;
  tags: string;
  dueDate: string;
  projectId: string;
}

export const NO_PROJECT_VALUE = 'sin-proyecto';

interface TaskFormPanelProps {
  isEditing: boolean;
  value: TaskFormState;
  onChange: (patch: Partial<TaskFormState>) => void;
  onSubmit: () => void;
  onCancel: () => void;
  isSaving: boolean;
  statusOptions: string[];
  projects: Project[];
  maxTags: number;
}

export function TaskFormPanel({
  isEditing,
  value,
  onChange,
  onSubmit,
  onCancel,
  isSaving,
  statusOptions,
  projects,
  maxTags,
}: TaskFormPanelProps) {
  return (
    <div className="glass-card-elevated border border-border rounded-3xl p-5 sm:p-6 space-y-4 w-full">
      <div className="flex items-center justify-between border-b border-border/40 pb-3">
        <h3 className="text-lg font-black uppercase tracking-tighter text-foreground">
          {isEditing ? 'Editar tarea' : 'Nueva tarea'}
        </h3>
        <button
          type="button"
          onClick={onCancel}
          className="h-8 w-8 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted/40 transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="space-y-2">
        <Label className="text-[10px] font-black uppercase tracking-[0.3em] text-muted-foreground">Título</Label>
        <Input
          value={value.title}
          onChange={(event) => onChange({ title: event.target.value })}
          className="h-11 rounded-2xl border-border bg-muted/20"
        />
      </div>

      <div className="space-y-2">
        <Label className="text-[10px] font-black uppercase tracking-[0.3em] text-muted-foreground">Descripción</Label>
        <Textarea
          value={value.description}
          onChange={(event) => onChange({ description: event.target.value })}
          className="min-h-[100px] rounded-2xl border-border bg-muted/20"
        />
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-2">
          <Label className="text-[10px] font-black uppercase tracking-[0.3em] text-muted-foreground">Estado</Label>
          <Select value={value.status} onValueChange={(v) => onChange({ status: v })}>
            <SelectTrigger className="h-11 rounded-2xl border-border bg-muted/20">
              <SelectValue placeholder="Estado" />
            </SelectTrigger>
            <SelectContent className="border-border bg-card">
              {statusOptions.map((status) => (
                <SelectItem key={`form-status-${status}`} value={status}>
                  {status}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label className="text-[10px] font-black uppercase tracking-[0.3em] text-muted-foreground">Prioridad</Label>
          <Select value={value.priority} onValueChange={(v) => onChange({ priority: v as Priority })}>
            <SelectTrigger className="h-11 rounded-2xl border-border bg-muted/20">
              <SelectValue placeholder="Prioridad" />
            </SelectTrigger>
            <SelectContent className="border-border bg-card">
              <SelectItem value="alta">Alta</SelectItem>
              <SelectItem value="media">Media</SelectItem>
              <SelectItem value="baja">Baja</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="space-y-2">
        <Label className="text-[10px] font-black uppercase tracking-[0.3em] text-muted-foreground">Proyecto</Label>
        <Select value={value.projectId || NO_PROJECT_VALUE} onValueChange={(v) => onChange({ projectId: v === NO_PROJECT_VALUE ? '' : v })}>
          <SelectTrigger className="h-11 rounded-2xl border-border bg-muted/20">
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
      </div>

      <div className="space-y-2">
        <Label className="text-[10px] font-black uppercase tracking-[0.3em] text-muted-foreground">Etiquetas</Label>
        <Input
          value={value.tags}
          onChange={(event) => onChange({ tags: event.target.value })}
          placeholder="cliente, urgente, backend"
          className="h-11 rounded-2xl border-border bg-muted/20"
        />
        <p className="text-[11px] text-muted-foreground">Máximo {maxTags} etiquetas separadas por coma.</p>
      </div>

      <div className="space-y-2">
        <Label className="text-[10px] font-black uppercase tracking-[0.3em] text-muted-foreground">Fecha límite</Label>
        <Input
          type="date"
          value={value.dueDate}
          onChange={(event) => onChange({ dueDate: event.target.value })}
          className="h-11 rounded-2xl border-border bg-muted/20 [color-scheme:dark]"
        />
      </div>

      <div className="pt-2 border-t border-border/40">
        <Button
          type="button"
          onClick={onSubmit}
          disabled={isSaving}
          className="h-11 w-full rounded-2xl bg-primary text-[10px] font-black uppercase tracking-[0.3em] text-primary-foreground"
        >
          {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />}
          {isEditing ? 'Guardar cambios' : 'Crear tarea'}
        </Button>
      </div>
    </div>
  );
}
