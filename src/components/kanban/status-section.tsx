"use client";

import Link from "next/link";
import { CalendarDays, ChevronDown, Pencil, Plus, Ticket, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { TASK_STATUSES, getDueMeta, getPriorityMeta } from "@/lib/tasks";
import type { Project, Task } from "@/types/task";

// Vista "Lista": tareas agrupadas por estado en secciones plegables.

function TaskRow({
  task,
  project,
  onEdit,
  onDelete,
  onMove,
}: {
  task: Task;
  project?: Project;
  onEdit: (task: Task) => void;
  onDelete: (taskId: string) => void;
  onMove: (taskId: string, status: string) => void;
}) {
  const dueMeta = getDueMeta(task.dueDate);
  const priorityMeta = getPriorityMeta(task.priority);

  return (
    <div
      className={cn(
        "rounded-2xl border border-border bg-card/70 p-4 shadow-[0_1px_0_rgba(255,255,255,0.02)] transition-all",
        dueMeta?.isOverdue && "border-red-500/25 bg-red-500/[0.04]",
        dueMeta?.isUrgent && !dueMeta?.isOverdue && "border-amber-500/25 bg-amber-500/[0.04]"
      )}
    >
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0 space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline" className={cn("rounded-full text-[10px] font-black uppercase tracking-widest", priorityMeta.className)}>
              {priorityMeta.label}
            </Badge>
            {task.isTicket && (
              <Badge variant="outline" className="rounded-full text-[10px] font-black uppercase tracking-widest border-primary/30 bg-primary/10 text-primary">
                <Ticket className="mr-1 h-3 w-3" />
                Ticket
              </Badge>
            )}
            {project && (
              <Badge variant="outline" className="rounded-full text-[10px] font-black uppercase tracking-widest border-border bg-muted/30 text-muted-foreground">
                <span className="mr-1.5 h-2 w-2 rounded-full inline-block" style={{ backgroundColor: project.color }} />
                {project.name}
              </Badge>
            )}
            {dueMeta && (
              <Badge
                variant="outline"
                className={cn(
                  "rounded-full text-[10px] font-black uppercase tracking-widest",
                  dueMeta.isOverdue
                    ? "border-red-500/30 bg-red-500/10 text-red-300"
                    : dueMeta.isUrgent
                      ? "border-amber-500/30 bg-amber-500/10 text-amber-300"
                      : "border-border bg-muted/40 text-muted-foreground"
                )}
              >
                <CalendarDays className="mr-1 h-3 w-3" />
                {dueMeta.label}
              </Badge>
            )}
          </div>

          <div className="space-y-1">
            <h4 className="text-[15px] font-black leading-tight tracking-tight text-foreground">{task.title}</h4>
            {task.description && <p className="text-sm leading-relaxed text-muted-foreground">{task.description}</p>}
            {task.isTicket && task.requesterName && (
              <p className="text-xs font-bold text-primary/70">Solicitado por {task.requesterName}</p>
            )}
          </div>

          {task.tags && task.tags.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {task.tags.slice(0, 4).map((tag) => (
                <span
                  key={`${task.id}-${tag}`}
                  className="rounded-full border border-border bg-muted/40 px-2.5 py-1 text-[10px] font-black uppercase tracking-widest text-muted-foreground"
                >
                  {tag}
                </span>
              ))}
              {task.tags.length > 4 && (
                <span className="pt-1 text-[10px] font-black text-muted-foreground/50">+{task.tags.length - 4}</span>
              )}
            </div>
          )}
        </div>

        <div className="flex flex-col gap-2 lg:min-w-[200px] lg:items-end">
          <Select value={task.status} onValueChange={(value) => onMove(task.id, value)}>
            <SelectTrigger className="h-9 w-full rounded-xl border-border bg-muted/30 text-[10px] font-black uppercase tracking-widest lg:w-[200px]">
              <SelectValue placeholder="Estado" />
            </SelectTrigger>
            <SelectContent className="border-border bg-card">
              {TASK_STATUSES.map((status) => (
                <SelectItem key={`${task.id}-${status}`} value={status}>
                  {status}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <div className="flex items-center gap-2">
            {task.isTicket ? (
              <Link
                href={`/tickets?edit=${task.id}`}
                className="flex h-9 w-9 items-center justify-center rounded-xl border border-border bg-muted/20 text-muted-foreground hover:text-primary"
              >
                <Pencil className="h-4 w-4" />
              </Link>
            ) : (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => onEdit(task)}
                className="h-9 w-9 rounded-xl border border-border bg-muted/20 text-muted-foreground hover:text-primary"
              >
                <Pencil className="h-4 w-4" />
              </Button>
            )}
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => onDelete(task.id)}
              className="h-9 w-9 rounded-xl border border-border bg-muted/20 text-muted-foreground hover:text-red-400"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>

          <p className="text-[10px] font-black uppercase tracking-[0.25em] text-muted-foreground/50">{task.status}</p>
        </div>
      </div>
    </div>
  );
}

export function StatusSection({
  status,
  tasks,
  projectsById,
  onAdd,
  onEdit,
  onDelete,
  onMove,
}: {
  status: string;
  tasks: Task[];
  projectsById: Map<string, Project>;
  onAdd: (status: string) => void;
  onEdit: (task: Task) => void;
  onDelete: (taskId: string) => void;
  onMove: (taskId: string, status: string) => void;
}) {
  return (
    <details open={status !== "Hecho"} className="group rounded-[28px] border border-border bg-card/50 shadow-sm">
      <summary className="flex cursor-pointer list-none items-center gap-3 px-4 py-4 md:px-5">
        <ChevronDown className="h-4 w-4 text-muted-foreground transition-transform group-open:rotate-180" />
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-black uppercase tracking-[0.35em] text-muted-foreground/60">Estado</p>
          <div className="mt-1 flex flex-wrap items-center gap-2">
            <h3 className="text-lg font-black tracking-tight text-foreground">{status}</h3>
            <Badge variant="outline" className="rounded-full border-border bg-muted/40 text-[10px] font-black uppercase tracking-widest text-muted-foreground">
              {tasks.length}
            </Badge>
          </div>
        </div>
        <Button
          type="button"
          size="sm"
          onClick={(event) => {
            event.preventDefault();
            event.stopPropagation();
            onAdd(status);
          }}
          className="h-8 rounded-xl bg-primary/10 px-3 text-[10px] font-black uppercase tracking-widest text-primary hover:bg-primary/20"
        >
          <Plus className="mr-1 h-3.5 w-3.5" />
          Nueva
        </Button>
      </summary>

      <div className="space-y-3 px-4 pb-4 md:px-5">
        {tasks.length > 0 ? (
          tasks.map((task) => (
            <TaskRow
              key={task.id}
              task={task}
              project={task.projectId ? projectsById.get(task.projectId) : undefined}
              onEdit={onEdit}
              onDelete={onDelete}
              onMove={onMove}
            />
          ))
        ) : (
          <div className="rounded-2xl border border-dashed border-border bg-muted/20 px-4 py-8 text-center">
            <p className="text-sm font-semibold text-muted-foreground">No hay tareas aquí.</p>
            <p className="mt-1 text-xs text-muted-foreground/70">Agrega una tarea o mueve una desde otro estado.</p>
          </div>
        )}
      </div>
    </details>
  );
}
