"use client";

import { useState } from "react";
import { Loader2, Sparkles, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useBackDismiss } from "@/hooks/use-back-dismiss";
import { VoiceButton } from "@/components/forms/voice-button";

interface AiPlannerProps {
  isGenerating: boolean;
  /** Devuelve true si se crearon tareas (para limpiar el texto). */
  onGenerate: (prompt: string) => Promise<boolean>;
  onClose: () => void;
}

/** Convierte texto libre en tareas usando /api/v1/ai/tasks. */
export function AiPlanner({ isGenerating, onGenerate, onClose }: AiPlannerProps) {
  const [prompt, setPrompt] = useState("");
  useBackDismiss(true, onClose);

  const handleGenerate = async () => {
    if (await onGenerate(prompt)) {
      setPrompt("");
      onClose();
    }
  };

  return (
    <div className="space-y-3 rounded-2xl border border-primary/30 bg-primary/[0.03] p-3">
      <div className="flex items-center justify-between">
        <p className="flex items-center gap-1.5 text-sm font-semibold">
          <Sparkles className="h-4 w-4 text-primary" /> Planificar con IA
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
      <Textarea
        value={prompt}
        onChange={(event) => setPrompt(event.target.value)}
        placeholder="Describe lo que tienes que hacer y la IA lo separa en tareas con prioridad y fecha. Ej: el viernes entregar el informe, mañana llamar al cliente…"
        className="min-h-[110px] rounded-xl border-border bg-background/50 text-base sm:text-sm leading-relaxed"
        autoFocus
      />
      <div className="flex justify-end">
        <VoiceButton onText={(text) => setPrompt((current) => (current ? `${current} ${text}` : text))} />
      </div>
      <Button
        type="button"
        onClick={handleGenerate}
        disabled={isGenerating || !prompt.trim()}
        className="h-10 w-full rounded-xl bg-primary text-xs font-bold text-primary-foreground"
      >
        {isGenerating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
        Crear tareas
      </Button>
    </div>
  );
}
