"use client";

import { useState } from "react";
import Link from "next/link";
import { CalendarDays, Check, ChevronDown, ListChecks, MoreHorizontal, Paperclip, Pencil, Plus, Repeat, Ticket, Trash2 } from "lucide-react";
import { AttachmentGallery } from "@/components/attachments/attachment-gallery";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { RECURRENCE_LABELS, TASK_STATUSES, getChecklistProgress, getDueMeta } from "@/lib/tasks";
import type { Priority, Project, Task, TaskStatus } from "@/types/task";

const PRIORITY_DOT: Record<Priority, string> = {
  alta: "bg-red-500",
  media: "bg-amber-500",
  baja: "bg-blue-500",
};

interface TaskRowProps {
  task: Task;
  project?: Project;
  onEdit: (task: Task) => void;
  onDelete: (taskId: string) => void;
  onMove: (taskId: string, status: TaskStatus) => void;
  onToggleChecklistItem: (task: Task, itemId: string) => void;
}

/** Fila compacta: círculo para completar, título, metadatos y menú de acciones. */
function TaskRow({ task, project, onEdit, onDelete, onMove, onToggleChecklistItem }: TaskRowProps) {
  const dueMeta = task.status === "Hecho" ? null : getDueMeta(task.dueDate, task.dueTime);
  const isDone = task.status === "Hecho";
  const progress = getChecklistProgress(task.checklist);
  const [checklistOpen, setChecklistOpen] = useState(false);
  const [imagesOpen, setImagesOpen] = useState(false);
  const imageCount = task.attachments?.length ?? 0;

  return (
    <div className="group flex items-start gap-3 rounded-2xl px-2 py-2.5 transition-colors hover:bg-muted/20">
      <button
        type="button"
        onClick={() => onMove(task.id, isDone ? "Pendiente" : "Hecho")}
        aria-label={isDone ? `Marcar "${task.title}" como pendiente` : `Completar "${task.title}"`}
        className={cn(
          "mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 transition-colors",
          isDone ? "border-primary bg-primary text-primary-foreground" : "border-muted-foreground/40 hover:border-primary"
        )}
      >
        {isDone && <Check className="h-3 w-3" strokeWidth={3} />}
      </button>

      <div className="min-w-0 flex-1">
      <button type="button" onClick={() => onEdit(task)} className="w-full text-left">
        <p className={cn("text-sm font-semibold leading-snug", isDone && "text-muted-foreground line-through")}>{task.title}</p>
        {task.description && !isDone && (
          <p className="mt-0.5 line-clamp-1 text-xs text-muted-foreground">{task.description}</p>
        )}
        <div className="mt-1 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[11px] text-muted-foreground">
          <span className="flex items-center gap-1">
            <span className={cn("h-1.5 w-1.5 rounded-full", PRIORITY_DOT[task.priority])} />
            {task.priority}
          </span>
          {dueMeta && (
            <span
              className={cn(
                "flex items-center gap-1",
                dueMeta.isOverdue ? "font-semibold text-red-400" : dueMeta.isUrgent && "text-amber-400"
              )}
            >
              <CalendarDays className="h-3 w-3" />
              {dueMeta.label}
            </span>
          )}
          {project && (
            <span className="flex items-center gap-1">
              <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: project.color }} />
              {project.name}
            </span>
          )}
          {task.isTicket && (
            <span className="flex items-center gap-1 text-primary/80">
              <Ticket className="h-3 w-3" />
              {task.requesterName || "Ticket"}
            </span>
          )}
          {task.recurrence && (
            <span className="flex items-center gap-1" title={RECURRENCE_LABELS[task.recurrence]}>
              <Repeat className="h-3 w-3" />
              <span className="sr-only">{RECURRENCE_LABELS[task.recurrence]}</span>
            </span>
          )}
          {task.tags?.slice(0, 2).map((tag) => (
            <span key={tag}>#{tag}</span>
          ))}
        </div>
      </button>
      {imageCount > 0 && (
        <div className="mt-1">
          <button
            type="button"
            onClick={() => setImagesOpen((open) => !open)}
            aria-expanded={imagesOpen}
            className="flex items-center gap-1 rounded-md text-[11px] text-muted-foreground hover:text-foreground"
          >
            <Paperclip className="h-3 w-3" />
            {imageCount === 1 ? "1 imagen" : `${imageCount} imágenes`}
          </button>
          {imagesOpen && <AttachmentGallery attachments={task.attachments!} className="mt-1.5" />}
        </div>
      )}
      {progress && (
        <div className="mt-1">
          <button
            type="button"
            onClick={() => setChecklistOpen((open) => !open)}
            aria-expanded={checklistOpen}
            className={cn(
              "flex items-center gap-1 rounded-md text-[11px] hover:text-foreground",
              progress.done === progress.total ? "text-primary" : "text-muted-foreground"
            )}
          >
            <ListChecks className="h-3 w-3" />
            {progress.done}/{progress.total} subtareas
          </button>
          {checklistOpen && (
            <ul className="mt-1.5 space-y-1">
              {task.checklist!.map((item) => (
                <li key={item.id}>
                  <button
                    type="button"
                    onClick={() => onToggleChecklistItem(task, item.id)}
                    className="flex w-full items-center gap-2 py-0.5 text-left text-xs"
                  >
                    <span
                      className={cn(
                        "flex h-4 w-4 shrink-0 items-center justify-center rounded border",
                        item.done ? "border-primary bg-primary text-primary-foreground" : "border-muted-foreground/40"
                      )}
                    >
                      {item.done && <Check className="h-2.5 w-2.5" strokeWidth={3} />}
                    </span>
                    <span className={cn(item.done && "text-muted-foreground line-through")}>{item.text}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
      </div>

      <DropdownMenu>
        <DropdownMenuTrigger
          aria-label={`Acciones de "${task.title}"`}
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted/40 hover:text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <MoreHorizontal className="h-4 w-4" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-48 rounded-2xl border-border bg-card p-1.5">
          {task.isTicket ? (
            <DropdownMenuItem asChild className="rounded-xl">
              <Link href={`/tickets/admin?edit=${task.id}`}>
                <Pencil className="mr-2 h-4 w-4" /> Editar ticket
              </Link>
            </DropdownMenuItem>
          ) : (
            <DropdownMenuItem onSelect={() => onEdit(task)} className="rounded-xl">
              <Pencil className="mr-2 h-4 w-4" /> Editar
            </DropdownMenuItem>
          )}
          <DropdownMenuSeparator />
          <DropdownMenuLabel className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Mover a</DropdownMenuLabel>
          {TASK_STATUSES.filter((status) => status !== task.status).map((status) => (
            <DropdownMenuItem key={status} onSelect={() => onMove(task.id, status)} className="rounded-xl">
              {status}
            </DropdownMenuItem>
          ))}
          <DropdownMenuSeparator />
          <DropdownMenuItem onSelect={() => onDelete(task.id)} className="rounded-xl text-red-400 focus:text-red-400">
            <Trash2 className="mr-2 h-4 w-4" /> Eliminar
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

interface StatusSectionProps {
  status: TaskStatus;
  tasks: Task[];
  projectsById: Map<string, Project>;
  onAdd: (status: TaskStatus) => void;
  onEdit: (task: Task) => void;
  onDelete: (taskId: string) => void;
  onMove: (taskId: string, status: TaskStatus) => void;
  onToggleChecklistItem: (task: Task, itemId: string) => void;
  /** Acción extra en el encabezado (p. ej. "Limpiar" en Hecho). */
  headerAction?: React.ReactNode;
}

/** Vista "Lista": tareas de un estado en una sección plegable. */
export function StatusSection({
  status,
  tasks,
  projectsById,
  onAdd,
  onEdit,
  onDelete,
  onMove,
  onToggleChecklistItem,
  headerAction,
}: StatusSectionProps) {
  return (
    <details open={status !== "Hecho"} className="group">
      <summary className="flex cursor-pointer list-none items-center gap-2 px-2 py-2">
        <ChevronDown className="h-4 w-4 text-muted-foreground transition-transform group-open:rotate-0 -rotate-90" />
        <h3 className="text-sm font-bold text-foreground">{status}</h3>
        <span className="text-xs text-muted-foreground">{tasks.length}</span>
        <div className="ml-auto flex items-center gap-1">
          {headerAction}
          <button
            type="button"
            aria-label={`Nueva tarea en ${status}`}
            onClick={(event) => {
              event.preventDefault();
              onAdd(status);
            }}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted/40 hover:text-primary"
          >
            <Plus className="h-4 w-4" />
          </button>
        </div>
      </summary>

      <div className="pb-2">
        {tasks.length > 0 ? (
          tasks.map((task) => (
            <TaskRow
              key={task.id}
              task={task}
              project={task.projectId ? projectsById.get(task.projectId) : undefined}
              onEdit={onEdit}
              onDelete={onDelete}
              onMove={onMove}
              onToggleChecklistItem={onToggleChecklistItem}
            />
          ))
        ) : (
          <p className="px-2 py-3 text-xs text-muted-foreground/70">Nada por aquí.</p>
        )}
      </div>
    </details>
  );
}
