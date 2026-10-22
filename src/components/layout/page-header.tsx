"use client";

import type { ReactNode } from "react";
import { Plus } from "lucide-react";

/** Encabezado estándar de página: título, una línea de resumen y acción opcional. */
export function PageHeader({
  title,
  summary,
  actionLabel,
  onAction,
}: {
  title: string;
  summary?: ReactNode;
  actionLabel?: string;
  onAction?: () => void;
}) {
  return (
    <div className="flex items-start justify-between gap-3">
      <div className="min-w-0">
        <h1 className="truncate text-2xl font-black tracking-tight">{title}</h1>
        {summary && <p className="mt-0.5 text-xs text-muted-foreground">{summary}</p>}
      </div>
      {actionLabel && onAction && (
        <button
          type="button"
          onClick={onAction}
          className="flex h-9 shrink-0 items-center gap-1.5 rounded-xl border border-border px-3 text-xs font-semibold text-foreground transition-colors hover:border-primary/40 hover:text-primary"
        >
          <Plus className="h-4 w-4" />
          {actionLabel}
        </button>
      )}
    </div>
  );
}
