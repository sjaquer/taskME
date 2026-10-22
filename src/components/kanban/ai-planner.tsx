"use client";

import { useState } from "react";
import { ArrowLeft, CalendarDays, Check, Loader2, Sparkles, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useBackDismiss } from "@/hooks/use-back-dismiss";
import { VoiceButton } from "@/components/forms/voice-button";
import { getDueMeta } from "@/lib/tasks";
import { cn } from "@/lib/utils";
import type { Priority } from "@/types/task";

/** Tarea propuesta por la IA, ya validada, pendiente de confirmación. */
export interface AiTaskDraft {
  title: string;
  description?: string;
  priority: Priority;
  tags: string[];
  dueDate?: string;
}

const PRIORITY_DOT: Record<Priority, string> = { alta: "bg-red-500", media: "bg-amber-500", baja: "bg-blue-500" };

interface AiPlannerProps {
  isGenerating: boolean;
  /** Pide propuestas a la IA; devuelve null si falló (el error ya se avisó). */
  onGenerate: (prompt: string) => Promise<AiTaskDraft[] | null>;
  onConfirm: (drafts: AiTaskDraft[]) => void;
  onClose: () => void;
}

/** Convierte texto libre en tareas: primero muestra la propuesta y luego crea las elegidas. */
export function AiPlanner({ isGenerating, onGenerate, onConfirm, onClose }: AiPlannerProps) {
  const [prompt, setPrompt] = useState("");
  const [drafts, setDrafts] = useState<AiTaskDraft[] | null>(null);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  useBackDismiss(true, onClose);

  const handleGenerate = async () => {
    const result = await onGenerate(prompt);
    if (!result) return;
    setDrafts(result);
    setSelected(new Set(result.map((_, index) => index)));
  };

  const toggle = (index: number) =>
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });

  const handleConfirm = () => {
    if (!drafts) return;
    onConfirm(drafts.filter((_, index) => selected.has(index)));
    onClose();
  };

  return (
    <div className="space-y-3 rounded-2xl border border-primary/30 bg-primary/[0.03] p-3">
      <div className="flex items-center justify-between">
        <p className="flex items-center gap-1.5 text-sm font-semibold">
          <Sparkles className="h-4 w-4 text-primary" /> {drafts ? "Revisa la propuesta" : "Planificar con IA"}
        </p>
        <button
          type="button"
          onClick={onClose}
          aria-label="Cerrar planificador"
          className="flex h-7 w-7 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted/40 hover:text-foreground"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {drafts ? (
        <>
          <ul className="space-y-1">
            {drafts.map((draft, index) => {
              const due = getDueMeta(draft.dueDate);
              const isSelected = selected.has(index);
              return (
                <li key={index}>
                  <button
                    type="button"
                    onClick={() => toggle(index)}
                    aria-pressed={isSelected}
                    className="flex w-full items-start gap-2.5 rounded-xl px-1.5 py-2 text-left hover:bg-muted/20"
                  >
                    <span
                      className={cn(
                        "mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md border-2",
                        isSelected ? "border-primary bg-primary text-primary-foreground" : "border-muted-foreground/40"
                      )}
                    >
                      {isSelected && <Check className="h-3 w-3" strokeWidth={3} />}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className={cn("block text-sm font-semibold", !isSelected && "text-muted-foreground line-through")}>
                        {draft.title}
                      </span>
                      <span className="mt-0.5 flex flex-wrap items-center gap-x-2.5 text-[11px] text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <span className={cn("h-1.5 w-1.5 rounded-full", PRIORITY_DOT[draft.priority])} />
                          {draft.priority}
                        </span>
                        {due && (
                          <span className="flex items-center gap-1">
                            <CalendarDays className="h-3 w-3" />
                            {due.label}
                          </span>
                        )}
                        {draft.tags.slice(0, 2).map((tag) => (
                          <span key={tag}>#{tag}</span>
                        ))}
                      </span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
          <div className="flex gap-2">
            <Button type="button" variant="ghost" onClick={() => setDrafts(null)} className="h-10 rounded-xl text-xs font-bold">
              <ArrowLeft className="mr-1.5 h-4 w-4" /> Editar texto
            </Button>
            <Button
              type="button"
              onClick={handleConfirm}
              disabled={selected.size === 0}
              className="h-10 flex-1 rounded-xl bg-primary text-xs font-bold text-primary-foreground"
            >
              Crear {selected.size} {selected.size === 1 ? "tarea" : "tareas"}
            </Button>
          </div>
        </>
      ) : (
        <>
          <Textarea
            value={prompt}
            onChange={(event) => setPrompt(event.target.value)}
            placeholder="Describe lo que tienes que hacer y la IA lo separa en tareas con prioridad y fecha. Ej: el viernes entregar el informe, mañana llamar al cliente…"
            className="min-h-[110px] rounded-xl border-border bg-background/50 text-base sm:text-sm leading-relaxed"
            autoFocus
          />
          <div className="flex items-center gap-2">
            <VoiceButton onText={(text) => setPrompt((current) => (current ? `${current} ${text}` : text))} />
            <Button
              type="button"
              onClick={handleGenerate}
              disabled={isGenerating || !prompt.trim()}
              className="h-10 flex-1 rounded-xl bg-primary text-xs font-bold text-primary-foreground"
            >
              {isGenerating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
              Proponer tareas
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
