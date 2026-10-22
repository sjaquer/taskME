"use client";

import { LayoutGrid, List } from "lucide-react";
import { cn, pluralize } from "@/lib/utils";

export type KanbanViewMode = "flow" | "board";

interface KanbanSummaryProps {
  contextName: string;
  total: number;
  pending: number;
  inProgress: number;
  critical: number;
  completed: number;
  viewMode: KanbanViewMode;
  onViewModeChange: (mode: KanbanViewMode) => void;
}

/** Encabezado compacto: título, una línea de resumen, progreso y cambio de vista. */
export function KanbanSummary({
  contextName,
  total,
  pending,
  inProgress,
  critical,
  completed,
  viewMode,
  onViewModeChange,
}: KanbanSummaryProps) {
  const progress = total > 0 ? Math.round((completed / total) * 100) : 0;

  return (
    <div className="space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="truncate text-2xl font-black tracking-tight">{contextName}</h1>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {total === 0 ? (
              "Sin tareas todavía"
            ) : (
              <>
                {pluralize(pending, "pendiente")} · {inProgress} en curso
                {critical > 0 && <span className="text-red-400"> · {pluralize(critical, "crítica")}</span>}
              </>
            )}
          </p>
        </div>
        <div role="radiogroup" aria-label="Vista" className="flex shrink-0 rounded-xl border border-border bg-muted/30 p-0.5">
          {(
            [
              { value: "flow", icon: List, label: "Lista" },
              { value: "board", icon: LayoutGrid, label: "Columnas" },
            ] as const
          ).map(({ value, icon: Icon, label }) => (
            <button
              key={value}
              type="button"
              role="radio"
              aria-checked={viewMode === value}
              aria-label={label}
              title={label}
              onClick={() => onViewModeChange(value)}
              className={cn(
                "flex h-8 w-9 items-center justify-center rounded-lg transition-colors",
                viewMode === value ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
              )}
            >
              <Icon className="h-4 w-4" />
            </button>
          ))}
        </div>
      </div>
      {total > 0 && (
        <div className="flex items-center gap-3" aria-label={`Progreso: ${progress}% completado`}>
          <div className="h-1 flex-1 overflow-hidden rounded-full bg-muted/40">
            <div className="h-full rounded-full bg-primary transition-all duration-500" style={{ width: `${progress}%` }} />
          </div>
          <span className="font-data text-[11px] text-muted-foreground">{progress}%</span>
        </div>
      )}
    </div>
  );
}
