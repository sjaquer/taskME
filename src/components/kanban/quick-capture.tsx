"use client";

import { useState } from "react";
import { Loader2, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FieldLabel, PrioritySelect } from "@/components/forms/form-fields";
import { TASK_STATUSES } from "@/lib/tasks";
import type { Priority, TaskStatus } from "@/types/task";

export interface QuickCaptureDraft {
  title: string;
  priority: Priority;
  status: TaskStatus;
}

interface QuickCaptureProps {
  isSaving: boolean;
  /** Devuelve true si la tarea se creó (para limpiar el formulario). */
  onCreate: (draft: QuickCaptureDraft) => Promise<boolean>;
  onAddDetails: (draft: QuickCaptureDraft) => void;
}

const INITIAL_DRAFT: QuickCaptureDraft = { title: "", priority: "media", status: TASK_STATUSES[0] };

/** Crear una tarea con solo título, estado y prioridad. */
export function QuickCapture({ isSaving, onCreate, onAddDetails }: QuickCaptureProps) {
  const [draft, setDraft] = useState<QuickCaptureDraft>(INITIAL_DRAFT);

  const handleCreate = async () => {
    if (await onCreate(draft)) setDraft(INITIAL_DRAFT);
  };

  return (
    <Card className="border-border bg-card/40 rounded-3xl shadow-sm overflow-hidden">
      <CardHeader className="space-y-1.5 border-b border-border/30 bg-muted/5 p-6">
        <CardTitle className="text-base font-black uppercase tracking-wider text-foreground">Captura Rápida</CardTitle>
        <CardDescription className="text-xs">Crea una tarea al instante seleccionando sus propiedades base.</CardDescription>
      </CardHeader>
      <CardContent className="p-6 space-y-4">
        <div className="space-y-2">
          <FieldLabel className="tracking-widest">Título de la Actividad</FieldLabel>
          <Input
            value={draft.title}
            onChange={(event) => setDraft({ ...draft, title: event.target.value })}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !isSaving) handleCreate();
            }}
            placeholder="Ej. enviar informe de fin de mes, revisar PR de backend..."
            className="h-12 rounded-2xl border-border bg-muted/20 focus-visible:ring-primary"
          />
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-2">
            <FieldLabel className="tracking-widest">Estado Inicial</FieldLabel>
            <Select value={draft.status} onValueChange={(status) => setDraft({ ...draft, status: status as TaskStatus })}>
              <SelectTrigger className="h-12 rounded-2xl border-border bg-muted/20">
                <SelectValue placeholder="Estado" />
              </SelectTrigger>
              <SelectContent className="border-border bg-card">
                {TASK_STATUSES.map((status) => (
                  <SelectItem key={`quick-${status}`} value={status}>
                    {status}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <FieldLabel className="tracking-widest">Prioridad</FieldLabel>
            <PrioritySelect value={draft.priority} onChange={(priority) => setDraft({ ...draft, priority })} className="h-12" />
          </div>
        </div>

        <div className="flex flex-wrap gap-2 pt-2 text-xs md:text-[10px]">
          <Button
            type="button"
            onClick={handleCreate}
            disabled={isSaving}
            className="h-12 w-full sm:w-auto rounded-2xl bg-primary px-6 text-xs md:text-[10px] font-black uppercase tracking-widest text-primary-foreground hover:bg-primary/95 shadow-lg active:scale-95 transition-all"
          >
            {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />}
            Crear Tarea
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => onAddDetails(draft)}
            className="h-12 w-full sm:w-auto rounded-2xl border-border bg-muted/10 px-5 text-xs md:text-[10px] font-black uppercase tracking-widest active:scale-95 transition-all"
          >
            Añadir Detalles
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
