"use client";

import { useState, type ReactNode } from "react";
import { Filter, Search, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { useBackDismiss } from "@/hooks/use-back-dismiss";
import type { Priority, Project } from "@/types/task";

const PRIORITY_FILTERS: { value: Priority | "all"; label: string }[] = [
  { value: "all", label: "Todas" },
  { value: "alta", label: "Alta" },
  { value: "media", label: "Media" },
  { value: "baja", label: "Baja" },
];

interface KanbanToolbarProps {
  searchQuery: string;
  onSearchChange: (value: string) => void;
  priorityFilter: Priority | "all";
  onPriorityFilterChange: (value: Priority | "all") => void;
  projectFilter: string;
  onProjectFilterChange: (value: string) => void;
  projects: Project[];
  /** Contenido extra del panel de filtros (gestión de proyectos, limpieza, etc.). */
  panelExtras?: ReactNode;
}

/** Buscador siempre visible; filtros y herramientas secundarias en un panel plegable. */
export function KanbanToolbar({
  searchQuery,
  onSearchChange,
  priorityFilter,
  onPriorityFilterChange,
  projectFilter,
  onProjectFilterChange,
  projects,
  panelExtras,
}: KanbanToolbarProps) {
  const [panelOpen, setPanelOpen] = useState(false);
  useBackDismiss(panelOpen, () => setPanelOpen(false));
  const activeFilters = (priorityFilter !== "all" ? 1 : 0) + (projectFilter !== "all" ? 1 : 0);

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground/60" />
          <input
            value={searchQuery}
            onChange={(event) => onSearchChange(event.target.value)}
            placeholder="Buscar"
            aria-label="Buscar tareas"
            className="h-10 w-full rounded-xl border border-border bg-transparent pl-9 pr-8 text-sm outline-none placeholder:text-muted-foreground/70 focus:border-primary/50"
          />
          {searchQuery && (
            <button
              type="button"
              aria-label="Borrar búsqueda"
              onClick={() => onSearchChange("")}
              className="absolute right-2 top-1/2 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground hover:text-foreground"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
        <button
          type="button"
          onClick={() => setPanelOpen((open) => !open)}
          aria-expanded={panelOpen}
          aria-label={activeFilters > 0 ? `Filtros (${activeFilters} activos)` : "Filtros"}
          className={cn(
            "flex h-10 shrink-0 items-center gap-1.5 rounded-xl border px-3 text-xs font-semibold transition-colors",
            panelOpen || activeFilters > 0 ? "border-primary/40 text-primary" : "border-border text-muted-foreground hover:text-foreground"
          )}
        >
          <Filter className="h-4 w-4" />
          <span className="hidden sm:inline">Filtros</span>
          {activeFilters > 0 && (
            <span className="flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] text-primary-foreground">
              {activeFilters}
            </span>
          )}
        </button>
      </div>

      {panelOpen && (
        <div className="space-y-4 rounded-2xl border border-border bg-muted/10 p-3">
          <ChipGroup label="Prioridad">
            {PRIORITY_FILTERS.map((filter) => (
              <Chip key={filter.value} active={priorityFilter === filter.value} onClick={() => onPriorityFilterChange(filter.value)}>
                {filter.label}
              </Chip>
            ))}
          </ChipGroup>

          {projects.length > 0 && (
            <ChipGroup label="Proyecto">
              <Chip active={projectFilter === "all"} onClick={() => onProjectFilterChange("all")}>
                Todos
              </Chip>
              {projects.map((project) => (
                <Chip key={project.id} active={projectFilter === project.id} onClick={() => onProjectFilterChange(project.id)}>
                  <span className="h-2 w-2 rounded-full" style={{ backgroundColor: project.color }} />
                  {project.name}
                </Chip>
              ))}
            </ChipGroup>
          )}

          {panelExtras}
        </div>
      )}
    </div>
  );
}

function ChipGroup({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="space-y-1.5">
      <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">{label}</p>
      <div className="flex flex-wrap gap-1.5">{children}</div>
    </div>
  );
}

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        "flex h-8 items-center gap-1.5 rounded-full border px-3 text-xs font-medium transition-colors",
        active ? "border-primary/40 bg-primary/10 text-primary" : "border-border text-muted-foreground hover:text-foreground"
      )}
    >
      {children}
    </button>
  );
}
