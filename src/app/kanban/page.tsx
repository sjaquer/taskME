"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { differenceInCalendarDays, format, isValid, parseISO } from "date-fns";
import { z } from "zod";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { useAppContextStore } from "@/lib/store";
import { cn } from "@/lib/utils";
import { toast } from "@/hooks/use-toast";
import { useFirestore, useMemoFirebase, useUser } from "@/firebase/provider";
import { useCollection } from "@/firebase/firestore/use-collection";
import { buildTasksQuery, createTask, deleteTask, updateTask } from "@/services/task-service";
import type { AppContext, Priority, Task } from "@/types/task";
import {
  CalendarDays,
  ChevronDown,
  CircleCheckBig,
  Clock3,
  Database,
  Flame,
  Loader2,
  Pencil,
  Plus,
  Search,
  Sparkles,
  Trash2,
} from "lucide-react";

const DEFAULT_STATUSES = ["Pendiente", "Haciendo", "Hecho"];
const MAX_TAGS_PER_TASK = 5;

const TaskSchema = z.object({
  title: z.string().trim().min(1, "El título es requerido").max(120),
  description: z.string().trim().optional(),
  priority: z.enum(["baja", "media", "alta"]),
  status: z.string().trim().min(1),
  tags: z.array(z.string()),
  dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Fecha inválida").optional(),
  context: z.enum(["Trabajo", "Estudio"]),
  userId: z.string(),
});

type TaskFormState = {
  title: string;
  description: string;
  priority: Priority;
  status: string;
  tags: string;
  dueDate: string;
};

function getInitialTaskForm(status: string): TaskFormState {
  return {
    title: "",
    description: "",
    priority: "media",
    status,
    tags: "",
    dueDate: "",
  };
}

function normalizeTag(tag: string) {
  return tag.trim().toLowerCase().replace(/\s+/g, " ");
}

function parseTagInput(input: string) {
  const uniqueTags = new Set<string>();

  input
    .split(",")
    .map(normalizeTag)
    .filter(Boolean)
    .forEach((tag) => {
      if (uniqueTags.size < MAX_TAGS_PER_TASK) {
        uniqueTags.add(tag);
      }
    });

  return Array.from(uniqueTags);
}

function toInputDateValue(value: string | Date | undefined) {
  if (!value) return "";
  const parsed = typeof value === "string" ? parseISO(value) : value;
  return isValid(parsed) ? format(parsed, "yyyy-MM-dd") : "";
}

function toTaskDate(value: string | Date | undefined) {
  if (!value) return null;
  const parsed = typeof value === "string" ? parseISO(value) : value;
  return isValid(parsed) ? parsed : null;
}

function formatShortDate(value: Date) {
  return new Intl.DateTimeFormat("es-ES", {
    day: "2-digit",
    month: "short",
  }).format(value);
}

function getDueMeta(dueDate: string | Date | undefined) {
  const parsed = toTaskDate(dueDate);
  if (!parsed) return null;

  const daysLeft = differenceInCalendarDays(parsed, new Date());
  const isOverdue = daysLeft < 0;
  const isUrgent = daysLeft >= 0 && daysLeft <= 3;

  return {
    isOverdue,
    isUrgent,
    label: isOverdue ? "Vencida" : formatShortDate(parsed),
  };
}

function getPriorityMeta(priority: Priority) {
  if (priority === "alta") {
    return { label: "Alta", className: "border-red-500/30 bg-red-500/10 text-red-300" };
  }

  if (priority === "media") {
    return { label: "Media", className: "border-amber-500/30 bg-amber-500/10 text-amber-300" };
  }

  return { label: "Baja", className: "border-blue-500/30 bg-blue-500/10 text-blue-300" };
}

function buildStatusOrder(columns: string[], tasks: Task[]) {
  const base = columns.length > 0 ? columns : DEFAULT_STATUSES;
  const extraStatuses = Array.from(new Set(tasks.map((task) => task.status))).filter((status) => !base.includes(status));
  return [...base, ...extraStatuses];
}

function TaskRow({
  task,
  statusOptions,
  onEdit,
  onDelete,
  onMove,
}: {
  task: Task;
  statusOptions: string[];
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
              {statusOptions.map((status) => (
                <SelectItem key={`${task.id}-${status}`} value={status}>
                  {status}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => onEdit(task)}
              className="h-9 w-9 rounded-xl border border-border bg-muted/20 text-muted-foreground hover:text-primary"
            >
              <Pencil className="h-4 w-4" />
            </Button>
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

function StatusSection({
  status,
  tasks,
  statusOptions,
  onAdd,
  onEdit,
  onDelete,
  onMove,
}: {
  status: string;
  tasks: Task[];
  statusOptions: string[];
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
            <TaskRow key={task.id} task={task} statusOptions={statusOptions} onEdit={onEdit} onDelete={onDelete} onMove={onMove} />
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

export default function KanbanPage() {
  const { context, kanbanColumns: columns, cachedTasks, setCachedTasks } = useAppContextStore();
  const { user, isUserLoading } = useUser();
  const firestore = useFirestore();
  const router = useRouter();

  const [tasks, setTasks] = useState<Task[]>(cachedTasks[context] || []);
  const [searchQuery, setSearchQuery] = useState("");
  const [aiPrompt, setAiPrompt] = useState("");
  const [quickTitle, setQuickTitle] = useState("");
  const [quickPriority, setQuickPriority] = useState<Priority>("media");
  const [quickStatus, setQuickStatus] = useState<string>(columns[0] ?? DEFAULT_STATUSES[0]);
  const [taskForm, setTaskForm] = useState<TaskFormState>(getInitialTaskForm(columns[0] ?? DEFAULT_STATUSES[0]));
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);

  const tasksQuery = useMemoFirebase(() => {
    if (!firestore || !user) return null;
    return buildTasksQuery(firestore, user.uid, context);
  }, [firestore, user, context]);

  const { data: firestoreTasks, isLoading: isTasksLoading, fromCache } = useCollection<Task>(tasksQuery);

  useEffect(() => {
    if (firestoreTasks) {
      setTasks(firestoreTasks);
      setCachedTasks(context, firestoreTasks);
    }
  }, [context, firestoreTasks, setCachedTasks]);

  useEffect(() => {
    if (!isUserLoading && !user) {
      router.push("/login");
    }
  }, [user, isUserLoading, router]);

  const statusOrder = useMemo(() => buildStatusOrder(columns, tasks), [columns, tasks]);

  useEffect(() => {
    const defaultStatus = statusOrder[0] ?? DEFAULT_STATUSES[0];
    setQuickStatus((current) => (statusOrder.includes(current) ? current : defaultStatus));
    setTaskForm((current) => ({
      ...current,
      status: current.status && statusOrder.includes(current.status) ? current.status : defaultStatus,
    }));
  }, [statusOrder]);

  const visibleTasks = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return tasks;

    return tasks.filter((task) => {
      const titleMatch = task.title.toLowerCase().includes(query);
      const descriptionMatch = (task.description || "").toLowerCase().includes(query);
      const tagMatch = (task.tags || []).some((tag) => normalizeTag(tag).includes(query));
      return titleMatch || descriptionMatch || tagMatch;
    });
  }, [searchQuery, tasks]);

  const groupedTasks = useMemo(() => {
    const grouped = new Map<string, Task[]>();
    statusOrder.forEach((status) => grouped.set(status, []));

    visibleTasks.forEach((task) => {
      if (!grouped.has(task.status)) {
        grouped.set(task.status, []);
      }

      grouped.get(task.status)?.push(task);
    });

    return grouped;
  }, [statusOrder, visibleTasks]);

  const totalTasks = tasks.length;
  const completedTasks = tasks.filter((task) => task.status === "Hecho").length;
  const inProgressTasks = tasks.filter((task) => task.status === "Haciendo").length;
  const criticalTasks = tasks.filter((task) => task.priority === "alta" && task.status !== "Hecho").length;
  const hasSearch = searchQuery.trim().length > 0;
  const displayStatusOrder = statusOrder.length > 0 ? statusOrder : DEFAULT_STATUSES;

  const openTaskDialog = (seed?: Partial<TaskFormState>, task?: Task) => {
    const defaultStatus = statusOrder[0] ?? DEFAULT_STATUSES[0];

    if (task) {
      setEditingTask(task);
      setTaskForm({
        title: task.title,
        description: task.description || "",
        priority: task.priority,
        status: task.status,
        tags: task.tags?.join(", ") || "",
        dueDate: toInputDateValue(task.dueDate),
      });
    } else {
      setEditingTask(null);
      setTaskForm({
        ...getInitialTaskForm(defaultStatus),
        ...seed,
        status: seed?.status || defaultStatus,
      });
    }

    setDialogOpen(true);
  };

  const saveTask = async (draft: TaskFormState) => {
    if (!user || !firestore) return;

    const payload = {
      title: draft.title.trim(),
      description: draft.description.trim(),
      priority: draft.priority,
      status: draft.status || statusOrder[0] || DEFAULT_STATUSES[0],
      tags: parseTagInput(draft.tags),
      ...(draft.dueDate ? { dueDate: draft.dueDate } : {}),
      context: context as AppContext,
      userId: user.uid,
    };

    const result = TaskSchema.safeParse(payload);
    if (!result.success) {
      toast({ variant: "destructive", title: "Error", description: result.error.errors[0].message });
      return;
    }

    const normalizedTask = {
      ...result.data,
      priority: result.data.priority as Priority,
      context: result.data.context as AppContext,
    };

    if (editingTask) {
      const taskId = editingTask.id;
      setTasks((previous) => previous.map((task) => (task.id === taskId ? { ...task, ...normalizedTask } : task)));
      updateTask(firestore, user.uid, taskId, normalizedTask);
      toast({ variant: "success", title: "Tarea actualizada" });
    } else {
      const tempId = `temp-${Date.now()}`;
      setTasks((previous) => [{ ...normalizedTask, id: tempId } as Task, ...previous]);
      createTask(firestore, user.uid, normalizedTask);
      toast({ variant: "success", title: "Tarea creada" });
    }
  };

  const handleQuickCreate = async () => {
    if (!quickTitle.trim()) {
      toast({ variant: "destructive", title: "Falta el título", description: "Escribe una tarea corta para crearla rápido." });
      return;
    }

    setIsSaving(true);
    try {
      await saveTask({
        title: quickTitle,
        description: "",
        priority: quickPriority,
        status: quickStatus || statusOrder[0] || DEFAULT_STATUSES[0],
        tags: "",
        dueDate: "",
      });
      setQuickTitle("");
      setQuickPriority("media");
      setQuickStatus(statusOrder[0] || DEFAULT_STATUSES[0]);
    } finally {
      setIsSaving(false);
    }
  };

  const handleEditTask = (task: Task) => {
    openTaskDialog(undefined, task);
  };

  const handleDeleteTask = (taskId: string) => {
    if (!user || !firestore) return;

    setTasks((previous) => previous.filter((task) => task.id !== taskId));
    deleteTask(firestore, user.uid, taskId);
    toast({ variant: "warning", title: "Tarea eliminada" });
  };

  const handleMoveTask = (taskId: string, status: string) => {
    if (!user || !firestore) return;

    setTasks((previous) => previous.map((task) => (task.id === taskId ? { ...task, status } : task)));
    updateTask(firestore, user.uid, taskId, { status });
    toast({ variant: "success", title: "Estado actualizado", description: `Ahora está en ${status}.` });
  };

  const handleGenerateTasks = async () => {
    if (!aiPrompt.trim() || !user || !firestore) return;

    setIsGenerating(true);
    try {
      const idToken = await user.getIdToken();
      const response = await fetch("/api/v1/ai/tasks", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify({ prompt: aiPrompt }),
      });

      const errorPayload = await response.json().catch(() => null);
      if (!response.ok) {
        const rawMessage = typeof errorPayload?.error === "string" ? errorPayload.error : "Error al generar tareas desde la IA";
        if (response.status === 401 || rawMessage.toLowerCase().includes("bearer token")) {
          throw new Error("Sesión no autenticada. Vuelve a iniciar sesión y prueba otra vez.");
        }
        throw new Error(rawMessage);
      }

      const generatedTasks = errorPayload?.tasks;
      if (!Array.isArray(generatedTasks)) {
        throw new Error("La IA no devolvió una lista válida de tareas.");
      }

      const targetStatus = statusOrder[0] || DEFAULT_STATUSES[0];
      let createdCount = 0;

      for (const item of generatedTasks) {
        const normalized = TaskSchema.safeParse({
          title: String(item?.title || "").trim(),
          description: String(item?.description || "").trim(),
          priority: item?.priority,
          status: targetStatus,
          tags: Array.isArray(item?.tags) ? item.tags.map((tag: unknown) => String(tag)) : [],
          dueDate: typeof item?.dueDate === "string" && item.dueDate.trim() ? item.dueDate : undefined,
          context: context as AppContext,
          userId: user.uid,
        });

        if (!normalized.success) {
          continue;
        }

        createTask(firestore, user.uid, normalized.data);
        createdCount += 1;
      }

      if (createdCount === 0) {
        throw new Error("La IA no generó tareas aprovechables.");
      }

      setAiPrompt("");
      toast({ variant: "success", title: "Tareas creadas con IA", description: `${createdCount} tareas agregadas a ${targetStatus}.` });
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Error en IA",
        description: error instanceof Error ? error.message : "No se pudo procesar la solicitud.",
      });
    } finally {
      setIsGenerating(false);
    }
  };

  const handleSaveDialog = async () => {
    setIsSaving(true);
    try {
      await saveTask(taskForm);
      setDialogOpen(false);
      setEditingTask(null);
      setTaskForm(getInitialTaskForm(statusOrder[0] || DEFAULT_STATUSES[0]));
    } finally {
      setIsSaving(false);
    }
  };

  if (isUserLoading || !user) {
    return null;
  }

  return (
    <div className="space-y-6 pb-24">
      <section className="rounded-[32px] border border-border bg-gradient-to-br from-background via-card/60 to-background p-5 shadow-sm md:p-7">
        <div className="flex flex-col gap-5">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline" className="rounded-full border-primary/20 bg-primary/10 text-[10px] font-black uppercase tracking-[0.35em] text-primary">
              Vista vertical
            </Badge>
            <Badge variant="outline" className="rounded-full border-border bg-muted/40 text-[10px] font-black uppercase tracking-[0.35em] text-muted-foreground">
              {context}
            </Badge>
            <Badge
              variant="outline"
              className={cn(
                "rounded-full text-[10px] font-black uppercase tracking-[0.35em]",
                fromCache ? "border-amber-500/20 bg-amber-500/10 text-amber-300" : "border-primary/20 bg-primary/10 text-primary"
              )}
            >
              <Database className="mr-1 h-3 w-3" />
              {fromCache ? "Cache" : "Live"}
            </Badge>
          </div>

          <div className="space-y-2">
            <h1 className="text-3xl font-black tracking-tight md:text-5xl">Tareas en una sola columna</h1>
            <p className="max-w-3xl text-sm leading-relaxed text-muted-foreground md:text-base">
              Una interfaz más rápida para móvil y escritorio: crear arriba, cambiar estados en la tarjeta y evitar el tablero horizontal.
            </p>
          </div>

          <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
            {[
              { label: "Total", value: totalTasks, icon: Database, tone: "text-sky-400" },
              { label: "En progreso", value: inProgressTasks, icon: Clock3, tone: "text-primary" },
              { label: "Críticas", value: criticalTasks, icon: Flame, tone: "text-red-400" },
              { label: "Hechas", value: completedTasks, icon: CircleCheckBig, tone: "text-emerald-400" },
            ].map(({ label, value, icon: Icon, tone }) => (
              <div key={label} className="flex items-center justify-between rounded-2xl border border-border bg-muted/20 px-4 py-3">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[0.3em] text-muted-foreground/60">{label}</p>
                  <p className={cn("mt-1 text-2xl font-black tracking-tight", tone)}>{value}</p>
                </div>
                <Icon className={cn("h-6 w-6 opacity-30", tone)} />
              </div>
            ))}
          </div>

          <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
            <div className="relative">
              <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground/50" />
              <Input
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder="Buscar por título, descripción o etiqueta"
                className="h-12 rounded-2xl border-border bg-muted/20 pl-11 text-sm"
              />
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => openTaskDialog()}
                className="h-12 rounded-2xl border-border bg-muted/10 px-5 text-[10px] font-black uppercase tracking-[0.28em]"
              >
                <Plus className="mr-2 h-4 w-4" />
                Nueva tarea
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => setAiPrompt("")}
                className="h-12 rounded-2xl border-border bg-muted/10 px-5 text-[10px] font-black uppercase tracking-[0.28em] text-muted-foreground"
              >
                Limpiar IA
              </Button>
            </div>
          </div>
        </div>
      </section>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <Card className="border-border bg-card/60">
          <CardHeader className="space-y-2">
            <CardTitle className="text-lg font-black tracking-tight">Crear rápido</CardTitle>
            <CardDescription>Una sola línea para capturar una tarea sin abrir el formulario completo.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label className="text-[10px] font-black uppercase tracking-[0.3em] text-muted-foreground">Título</Label>
              <Input
                value={quickTitle}
                onChange={(event) => setQuickTitle(event.target.value)}
                placeholder="Ej. enviar informe, revisar código, estudiar física"
                className="h-11 rounded-2xl border-border bg-muted/20"
              />
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase tracking-[0.3em] text-muted-foreground">Estado</Label>
                <Select value={quickStatus} onValueChange={setQuickStatus}>
                  <SelectTrigger className="h-11 rounded-2xl border-border bg-muted/20">
                    <SelectValue placeholder="Estado" />
                  </SelectTrigger>
                  <SelectContent className="border-border bg-card">
                    {displayStatusOrder.map((status) => (
                      <SelectItem key={`quick-${status}`} value={status}>
                        {status}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase tracking-[0.3em] text-muted-foreground">Prioridad</Label>
                <Select value={quickPriority} onValueChange={(value) => setQuickPriority(value as Priority)}>
                  <SelectTrigger className="h-11 rounded-2xl border-border bg-muted/20">
                    <SelectValue placeholder="Prioridad" />
                  </SelectTrigger>
                  <SelectContent className="border-border bg-card">
                    <SelectItem value="alta">Alta</SelectItem>
                    <SelectItem value="media">Media</SelectItem>
                    <SelectItem value="baja">Baja</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                onClick={handleQuickCreate}
                disabled={isSaving}
                className="h-11 rounded-2xl bg-primary px-5 text-[10px] font-black uppercase tracking-[0.3em] text-primary-foreground"
              >
                {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />}
                Crear
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => openTaskDialog({ title: quickTitle, priority: quickPriority, status: quickStatus })}
                className="h-11 rounded-2xl border-border bg-muted/10 px-5 text-[10px] font-black uppercase tracking-[0.3em]"
              >
                Más campos
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border bg-card/60">
          <CardHeader className="space-y-2">
            <CardTitle className="text-lg font-black tracking-tight">Crear con IA</CardTitle>
            <CardDescription>Describe lo que necesitas y se generan tareas ya listas para el estado inicial.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label className="text-[10px] font-black uppercase tracking-[0.3em] text-muted-foreground">
                <Sparkles className="mr-1 inline h-3.5 w-3.5" />
                Prompt
              </Label>
              <Textarea
                value={aiPrompt}
                onChange={(event) => setAiPrompt(event.target.value)}
                placeholder="Ej. mañana entregar el informe, responder correos y preparar la reunión del viernes"
                className="min-h-[148px] rounded-2xl border-border bg-muted/20 text-sm"
              />
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Button
                type="button"
                onClick={handleGenerateTasks}
                disabled={isGenerating || !aiPrompt.trim()}
                className="h-11 rounded-2xl bg-primary px-5 text-[10px] font-black uppercase tracking-[0.3em] text-primary-foreground"
              >
                {isGenerating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
                Generar
              </Button>
              <p className="text-xs text-muted-foreground">Si la sesión no está lista, verás un aviso claro en lugar del error técnico crudo.</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="border-border bg-card/40">
        <CardHeader className="space-y-2">
          <CardTitle className="text-lg font-black tracking-tight">Estados</CardTitle>
          <CardDescription>
            Todo se organiza verticalmente por estado. Cambia el estado de cada tarea desde su propia tarjeta.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {isTasksLoading && visibleTasks.length === 0 ? (
            <div className="space-y-3">
              {[0, 1, 2].map((index) => (
                <div key={index} className="h-28 animate-pulse rounded-[28px] border border-border bg-muted/20" />
              ))}
            </div>
          ) : visibleTasks.length === 0 ? (
            <div className="rounded-[28px] border border-dashed border-border bg-muted/20 px-5 py-10 text-center">
              <p className="text-sm font-semibold text-muted-foreground">
                {hasSearch ? "No hay tareas que coincidan con tu búsqueda." : "Todavía no hay tareas en este contexto."}
              </p>
              <p className="mt-2 text-xs text-muted-foreground/70">Crea una tarea rápida o usa IA para llenar la lista en segundos.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {displayStatusOrder.map((status) => (
                <StatusSection
                  key={status}
                  status={status}
                  tasks={groupedTasks.get(status) || []}
                  statusOptions={displayStatusOrder}
                  onAdd={(presetStatus) => openTaskDialog({ status: presetStatus })}
                  onEdit={handleEditTask}
                  onDelete={handleDeleteTask}
                  onMove={handleMoveTask}
                />
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog
        open={dialogOpen}
        onOpenChange={(open) => {
          setDialogOpen(open);
          if (!open) {
            setEditingTask(null);
            setTaskForm(getInitialTaskForm(statusOrder[0] || DEFAULT_STATUSES[0]));
          }
        }}
      >
        <DialogContent className="max-h-[92dvh] overflow-y-auto border-border bg-card sm:max-w-[560px]">
          <DialogHeader>
            <DialogTitle className="text-xl font-black tracking-tight">{editingTask ? "Editar tarea" : "Nueva tarea"}</DialogTitle>
            <DialogDescription>Formulario completo para cuando necesitas más detalle que la creación rápida.</DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label className="text-[10px] font-black uppercase tracking-[0.3em] text-muted-foreground">Título</Label>
              <Input
                value={taskForm.title}
                onChange={(event) => setTaskForm((previous) => ({ ...previous, title: event.target.value }))}
                className="h-11 rounded-2xl border-border bg-muted/20"
              />
            </div>

            <div className="space-y-2">
              <Label className="text-[10px] font-black uppercase tracking-[0.3em] text-muted-foreground">Descripción</Label>
              <Textarea
                value={taskForm.description}
                onChange={(event) => setTaskForm((previous) => ({ ...previous, description: event.target.value }))}
                className="min-h-[110px] rounded-2xl border-border bg-muted/20"
              />
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase tracking-[0.3em] text-muted-foreground">Estado</Label>
                <Select value={taskForm.status} onValueChange={(value) => setTaskForm((previous) => ({ ...previous, status: value }))}>
                  <SelectTrigger className="h-11 rounded-2xl border-border bg-muted/20">
                    <SelectValue placeholder="Estado" />
                  </SelectTrigger>
                  <SelectContent className="border-border bg-card">
                    {displayStatusOrder.map((status) => (
                      <SelectItem key={`dialog-${status}`} value={status}>
                        {status}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase tracking-[0.3em] text-muted-foreground">Prioridad</Label>
                <Select value={taskForm.priority} onValueChange={(value) => setTaskForm((previous) => ({ ...previous, priority: value as Priority }))}>
                  <SelectTrigger className="h-11 rounded-2xl border-border bg-muted/20">
                    <SelectValue placeholder="Prioridad" />
                  </SelectTrigger>
                  <SelectContent className="border-border bg-card">
                    <SelectItem value="alta">Alta</SelectItem>
                    <SelectItem value="media">Media</SelectItem>
                    <SelectItem value="baja">Baja</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-[10px] font-black uppercase tracking-[0.3em] text-muted-foreground">Etiquetas</Label>
              <Input
                value={taskForm.tags}
                onChange={(event) => setTaskForm((previous) => ({ ...previous, tags: event.target.value }))}
                placeholder="cliente, urgente, backend"
                className="h-11 rounded-2xl border-border bg-muted/20"
              />
              <p className="text-[11px] text-muted-foreground">Máximo {MAX_TAGS_PER_TASK} etiquetas separadas por coma.</p>
            </div>

            <div className="space-y-2">
              <Label className="text-[10px] font-black uppercase tracking-[0.3em] text-muted-foreground">Fecha límite</Label>
              <Input
                type="date"
                value={taskForm.dueDate}
                onChange={(event) => setTaskForm((previous) => ({ ...previous, dueDate: event.target.value }))}
                className="h-11 rounded-2xl border-border bg-muted/20 [color-scheme:dark]"
              />
            </div>
          </div>

          <Separator />

          <DialogFooter>
            <Button
              type="button"
              onClick={handleSaveDialog}
              disabled={isSaving}
              className="h-11 rounded-2xl bg-primary px-5 text-[10px] font-black uppercase tracking-[0.3em] text-primary-foreground"
            >
              {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />}
              {editingTask ? "Guardar cambios" : "Crear tarea"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
