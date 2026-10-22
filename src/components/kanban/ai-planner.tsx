"use client";

import { useState } from "react";
import { Brain, Cpu, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { FieldLabel } from "@/components/forms/form-fields";

interface AiPlannerProps {
  isGenerating: boolean;
  /** Devuelve true si se crearon tareas (para limpiar el texto). */
  onGenerate: (prompt: string) => Promise<boolean>;
}

/** Convierte texto libre en tareas usando /api/v1/ai/tasks. */
export function AiPlanner({ isGenerating, onGenerate }: AiPlannerProps) {
  const [prompt, setPrompt] = useState("");

  const handleGenerate = async () => {
    if (await onGenerate(prompt)) setPrompt("");
  };

  return (
    <Card className="border-border bg-card/40 rounded-3xl shadow-sm overflow-hidden">
      <CardHeader className="space-y-1.5 border-b border-border/30 bg-muted/5 p-6">
        <CardTitle className="text-base font-black uppercase tracking-wider text-foreground">Orquestador de Tareas</CardTitle>
        <CardDescription className="text-xs">Describe tus objetivos y la IA estructurará y priorizará tu jornada.</CardDescription>
      </CardHeader>
      <CardContent className="p-6 space-y-4">
        <div className="space-y-2">
          <FieldLabel className="tracking-widest flex items-center">
            <Cpu className="mr-1.5 inline h-3.5 w-3.5 text-primary" />
            Instrucciones de Planificación
          </FieldLabel>
          <Textarea
            value={prompt}
            onChange={(event) => setPrompt(event.target.value)}
            placeholder="Ej: Necesito analizar el informe financiero por la mañana, responder los correos del cliente y programar la reunión técnica del próximo viernes..."
            className="min-h-[148px] rounded-2xl border-border bg-muted/20 text-base sm:text-sm focus-visible:ring-primary leading-relaxed"
          />
        </div>

        <div className="flex flex-wrap items-center gap-3 pt-2">
          <Button
            type="button"
            onClick={handleGenerate}
            disabled={isGenerating || !prompt.trim()}
            className="h-12 w-full sm:w-auto rounded-2xl bg-primary px-6 text-xs md:text-[10px] font-black uppercase tracking-widest text-primary-foreground hover:bg-primary/95 shadow-lg active:scale-95 transition-all"
          >
            {isGenerating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Brain className="mr-2 h-4 w-4" />}
            Procesar Plan
          </Button>
          <Button
            type="button"
            variant="ghost"
            onClick={() => setPrompt("")}
            className="h-12 w-full sm:w-auto rounded-2xl border border-border bg-muted/10 px-5 text-xs md:text-[10px] font-black uppercase tracking-widest text-muted-foreground hover:text-foreground active:scale-95 transition-all"
          >
            Limpiar
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
