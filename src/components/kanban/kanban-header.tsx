"use client";

import { CircleCheckBig, Clock3, Flame, FolderDot } from "lucide-react";
import { cn } from "@/lib/utils";

interface KanbanHeaderProps {
  total: number;
  inProgress: number;
  critical: number;
  completed: number;
}

/** Título, barra de progreso y métricas del tablero. */
export function KanbanHeader({ total, inProgress, critical, completed }: KanbanHeaderProps) {
  const completionPercentage = total > 0 ? Math.round((completed / total) * 100) : 0;

  return (
    <>
      <div className="flex items-center justify-between gap-4 border-b border-border/60 pb-5">
        <div className="space-y-1">
          <h1 className="text-3xl font-black tracking-tight md:text-4xl text-foreground">Organizador Kanban</h1>
          <p className="text-sm text-muted-foreground">
            Planifica tu jornada, gestiona prioridades y orquesta tus actividades.
          </p>
        </div>
      </div>

      <div className="space-y-2 bg-muted/10 p-4 rounded-2xl border border-border">
        <div className="flex justify-between items-center text-[10px] font-black uppercase tracking-widest text-muted-foreground">
          <span>Rendimiento del Flujo</span>
          <span className="font-data text-primary text-xs">
            {completionPercentage}% ({completed} de {total} Hechas)
          </span>
        </div>
        <div className="h-2 w-full bg-muted/30 rounded-full overflow-hidden border border-border">
          <div
            className="h-full bg-primary neon-glow transition-all duration-500 rounded-full"
            style={{ width: `${completionPercentage}%` }}
          />
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { label: "Totales", value: total, icon: FolderDot, tone: "text-sky-400" },
          { label: "En Progreso", value: inProgress, icon: Clock3, tone: "text-primary" },
          { label: "Críticas", value: critical, icon: Flame, tone: "text-red-500" },
          { label: "Finalizadas", value: completed, icon: CircleCheckBig, tone: "text-emerald-400" },
        ].map(({ label, value, icon: Icon, tone }) => (
          <div key={label} className="flex items-center justify-between rounded-2xl border border-border bg-muted/20 px-5 py-4">
            <div>
              <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60">{label}</p>
              <p className={cn("mt-1 text-2xl font-black tracking-tight", tone)}>{value}</p>
            </div>
            <Icon className={cn("h-6 w-6 opacity-30", tone)} />
          </div>
        ))}
      </div>
    </>
  );
}
