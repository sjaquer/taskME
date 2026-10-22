"use client";

import { LayoutGrid, List, Plus, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import type { Priority, Project } from "@/types/task";

export type KanbanViewMode = "flow" | "board";

const PRIORITY_FILTERS: { value: Priority | "all"; label: string; activeClassName: string }[] = [
  { value: "all", label: "Todas", activeClassName: "bg-primary/20 text-primary border border-primary/30" },
  { value: "alta", label: "Alta", activeClassName: "bg-red-500/20 text-red-300 border border-red-500/30" },
  { value: "media", label: "Media", activeClassName: "bg-amber-500/20 text-amber-300 border border-amber-500/30" },
  { value: "baja", label: "Baja", activeClassName: "bg-blue-500/20 text-blue-300 border border-blue-500/30" },
];

interface KanbanToolbarProps {
  searchQuery: string;
  onSearchChange: (value: string) => void;
  priorityFilter: Priority | "all";
  onPriorityFilterChange: (value: Priority | "all") => void;
  projectFilter: string;
  onProjectFilterChange: (value: string) => void;
  projects: Project[];
  viewMode: KanbanViewMode;
  onViewModeChange: (mode: KanbanViewMode) => void;
  onNewTask: () => void;
  onClearCompleted: () => void;
  /** Cantidad de tareas hechas cuando se está pidiendo confirmar la limpieza. */
  confirmClearCount: number | null;
}

/** Búsqueda, filtros, cambio de vista y acciones generales del tablero. */
export function KanbanToolbar({
  searchQuery,
  onSearchChange,
  priorityFilter,
  onPriorityFilterChange,
  projectFilter,
  onProjectFilterChange,
  projects,
  viewMode,
  onViewModeChange,
  onNewTask,
  onClearCompleted,
  confirmClearCount,
}: KanbanToolbarProps) {
  const viewButtonClassName =
    "flex-1 sm:flex-none justify-center h-11 md:h-10 rounded-xl text-xs md:text-[10px] font-black uppercase tracking-widest px-5 md:px-4 transition-all gap-1.5 active:scale-95";

  return (
    <>
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center border-t border-border/40 pt-5">
        <div className="flex flex-col sm:flex-row gap-3 flex-1">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground/50" />
            <Input
              value={searchQuery}
              onChange={(event) => onSearchChange(event.target.value)}
              placeholder="Buscar por palabra clave o etiqueta..."
              className="h-12 rounded-2xl border-border bg-muted/20 pl-11 text-base sm:text-sm focus-visible:ring-primary"
            />
          </div>

          <div className="flex items-center gap-1 bg-muted/30 p-1 rounded-2xl border border-border overflow-x-auto scrollbar-hide">
            {PRIORITY_FILTERS.map((filter) => (
              <Button
                key={filter.value}
                type="button"
                variant="ghost"
                size="sm"
                aria-pressed={priorityFilter === filter.value}
                onClick={() => onPriorityFilterChange(filter.value)}
                className={cn(
                  "h-11 md:h-9 rounded-xl text-xs md:text-[10px] font-black uppercase tracking-wider px-4 md:px-3 shrink-0 transition-all active:scale-95",
                  priorityFilter === filter.value ? filter.activeClassName : "text-muted-foreground hover:text-foreground"
                )}
              >
                {filter.label}
              </Button>
            ))}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
          <div className="flex w-full sm:w-auto bg-muted/40 p-1 rounded-2xl border border-border">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              aria-pressed={viewMode === "flow"}
              onClick={() => onViewModeChange("flow")}
              className={cn(viewButtonClassName, viewMode === "flow" ? "bg-primary text-primary-foreground shadow" : "text-muted-foreground")}
            >
              <List className="w-3.5 h-3.5" />
              Lista
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              aria-pressed={viewMode === "board"}
              onClick={() => onViewModeChange("board")}
              className={cn(viewButtonClassName, viewMode === "board" ? "bg-primary text-primary-foreground shadow" : "text-muted-foreground")}
            >
              <LayoutGrid className="w-3.5 h-3.5" />
              Tablero
            </Button>
          </div>

          <Button
            type="button"
            variant="outline"
            onClick={onNewTask}
            className="h-12 w-full sm:w-auto rounded-2xl border-border bg-muted/10 px-5 text-xs md:text-[10px] font-black uppercase tracking-widest hover:bg-muted/20 active:scale-95 transition-all"
          >
            <Plus className="mr-2 h-4 w-4" />
            Nueva Tarea
          </Button>

          <Button
            type="button"
            variant="outline"
            onClick={onClearCompleted}
            className="h-12 w-full sm:w-auto rounded-2xl border-red-500/20 hover:border-red-500/40 bg-red-500/5 px-5 text-xs md:text-[10px] font-black uppercase tracking-widest text-red-400 hover:bg-red-500/10 active:scale-95 transition-all"
          >
            {confirmClearCount !== null ? `¿Borrar ${confirmClearCount} hechas? Toca otra vez` : "Limpiar Hechos"}
          </Button>
        </div>
      </div>

      {projects.length > 0 && (
        <div className="flex items-center gap-1 flex-wrap bg-muted/30 p-1 rounded-2xl border border-border">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            aria-pressed={projectFilter === "all"}
            onClick={() => onProjectFilterChange("all")}
            className={cn(
              "h-9 rounded-xl text-[10px] font-black uppercase tracking-wider px-3 transition-all",
              projectFilter === "all" ? "bg-primary/20 text-primary border border-primary/30" : "text-muted-foreground hover:text-foreground"
            )}
          >
            Todos los proyectos
          </Button>
          {projects.map((project) => (
            <Button
              key={project.id}
              type="button"
              variant="ghost"
              size="sm"
              aria-pressed={projectFilter === project.id}
              onClick={() => onProjectFilterChange(project.id)}
              className={cn(
                "h-9 rounded-xl text-[10px] font-black uppercase tracking-wider px-3 transition-all gap-1.5",
                projectFilter === project.id ? "bg-muted/60 border border-border text-foreground" : "text-muted-foreground hover:text-foreground"
              )}
            >
              <span className="h-2 w-2 rounded-full" style={{ backgroundColor: project.color }} />
              {project.name}
            </Button>
          ))}
        </div>
      )}
    </>
  );
}
