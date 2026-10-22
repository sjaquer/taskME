"use client";

import { useState } from "react";
import { Plus, SlidersHorizontal, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

interface QuickAddBarProps {
  /** Devuelve true si la tarea se creó (para limpiar el campo). */
  onCreate: (title: string) => Promise<boolean> | boolean;
  onOpenDetails: (title: string) => void;
  aiOpen: boolean;
  onToggleAi: () => void;
}

/** Campo único para agregar tareas: Enter crea, "Detalles" abre el formulario completo. */
export function QuickAddBar({ onCreate, onOpenDetails, aiOpen, onToggleAi }: QuickAddBarProps) {
  const [title, setTitle] = useState("");

  const create = async () => {
    if (!title.trim()) return;
    if (await onCreate(title)) setTitle("");
  };

  return (
    <div className="flex items-center gap-1.5 rounded-2xl border border-border bg-muted/20 p-1.5 focus-within:border-primary/50">
      <Plus className="ml-2 h-4 w-4 shrink-0 text-muted-foreground" />
      <input
        value={title}
        onChange={(event) => setTitle(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter") create();
        }}
        placeholder="Añadir tarea…"
        aria-label="Título de la nueva tarea"
        enterKeyHint="done"
        className="h-9 min-w-0 flex-1 bg-transparent px-1 text-sm outline-none placeholder:text-muted-foreground/70"
      />
      <button
        type="button"
        onClick={() => {
          onOpenDetails(title);
          setTitle("");
        }}
        aria-label="Añadir con detalles"
        title="Añadir con detalles"
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-muted-foreground hover:bg-muted/40 hover:text-foreground"
      >
        <SlidersHorizontal className="h-4 w-4" />
      </button>
      <button
        type="button"
        onClick={onToggleAi}
        aria-pressed={aiOpen}
        aria-label="Planificar con IA"
        title="Planificar con IA"
        className={cn(
          "flex h-9 w-9 shrink-0 items-center justify-center rounded-xl transition-colors",
          aiOpen ? "bg-primary/15 text-primary" : "text-muted-foreground hover:bg-muted/40 hover:text-foreground"
        )}
      >
        <Sparkles className="h-4 w-4" />
      </button>
    </div>
  );
}
