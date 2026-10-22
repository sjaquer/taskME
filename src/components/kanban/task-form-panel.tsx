'use client';

import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Field, FormPanel, PrioritySelect, ProjectSelect, SubmitButton, fieldInputClassName } from '@/components/forms/form-fields';
import { ChecklistEditor } from '@/components/forms/checklist-editor';
import { RECURRENCE_LABELS } from '@/lib/tasks';
import type { ChecklistItem, Priority, Project, Recurrence } from '@/types/task';

export interface TaskFormState {
  title: string;
  description: string;
  priority: Priority;
  status: string;
  tags: string;
  dueDate: string;
  dueTime: string;
  recurrence: Recurrence | '';
  checklist: ChecklistItem[];
  projectId: string;
}

const NO_RECURRENCE = 'no-repite';

interface TaskFormPanelProps {
  isEditing: boolean;
  value: TaskFormState;
  onChange: (patch: Partial<TaskFormState>) => void;
  onSubmit: () => void;
  onCancel: () => void;
  isSaving: boolean;
  statusOptions: readonly string[];
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
    <FormPanel title={isEditing ? 'Editar tarea' : 'Nueva tarea'} onClose={onCancel}>
      <Field label="Título">
        <Input
          value={value.title}
          onChange={(event) => onChange({ title: event.target.value })}
          className={fieldInputClassName}
        />
      </Field>

      <Field label="Descripción">
        <Textarea
          value={value.description}
          onChange={(event) => onChange({ description: event.target.value })}
          className="min-h-[100px] rounded-2xl border-border bg-muted/20"
        />
      </Field>

      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Estado">
          <Select value={value.status} onValueChange={(v) => onChange({ status: v })}>
            <SelectTrigger className={fieldInputClassName}>
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
        </Field>

        <Field label="Prioridad">
          <PrioritySelect value={value.priority} onChange={(priority) => onChange({ priority })} />
        </Field>
      </div>

      <Field label="Proyecto">
        <ProjectSelect value={value.projectId} onChange={(projectId) => onChange({ projectId })} projects={projects} />
      </Field>

      <Field label="Etiquetas">
        <Input
          value={value.tags}
          onChange={(event) => onChange({ tags: event.target.value })}
          placeholder="cliente, urgente, backend"
          className={fieldInputClassName}
        />
        <p className="text-[11px] text-muted-foreground">Máximo {maxTags} etiquetas separadas por coma.</p>
      </Field>

      <div className="grid grid-cols-2 gap-3">
        <Field label="Fecha límite">
          <Input
            type="date"
            value={value.dueDate}
            onChange={(event) => onChange({ dueDate: event.target.value })}
            className={fieldInputClassName}
          />
        </Field>
        <Field label="Hora (opcional)">
          <Input
            type="time"
            value={value.dueTime}
            onChange={(event) => onChange({ dueTime: event.target.value })}
            disabled={!value.dueDate}
            className={fieldInputClassName}
          />
        </Field>
      </div>

      <Field label="Repetir">
        <Select
          value={value.recurrence || NO_RECURRENCE}
          onValueChange={(v) => onChange({ recurrence: v === NO_RECURRENCE ? '' : (v as Recurrence) })}
          disabled={!value.dueDate}
        >
          <SelectTrigger className={fieldInputClassName}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="border-border bg-card">
            <SelectItem value={NO_RECURRENCE}>No se repite</SelectItem>
            {(Object.keys(RECURRENCE_LABELS) as Recurrence[]).map((key) => (
              <SelectItem key={key} value={key}>
                {RECURRENCE_LABELS[key]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {!value.dueDate && <p className="text-[11px] text-muted-foreground">Elige una fecha para poder repetirla.</p>}
      </Field>

      <Field label="Subtareas">
        <ChecklistEditor value={value.checklist} onChange={(checklist) => onChange({ checklist })} />
      </Field>

      <SubmitButton onClick={onSubmit} isSaving={isSaving}>
        {isEditing ? 'Guardar cambios' : 'Crear tarea'}
      </SubmitButton>
    </FormPanel>
  );
}
