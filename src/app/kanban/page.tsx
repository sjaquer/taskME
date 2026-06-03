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
  Flame,
  Loader2,
  Pencil,
  Plus,
  Search,
  Trash2,
  Cpu,
  Brain,
  List,
  LayoutGrid,
  SlidersHorizontal,
  CheckCircle,
  FolderDot,
} from "lucide-react";
import {
  DndContext,
  DragEndEvent,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  closestCorners,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import { sortableKeyboardCoordinates } from "@dnd-kit/sortable";
import { KanbanColumn } from "@/components/organisms/kanban-column";

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
  const { context, setContext, kanbanColumns: columns, setKanbanColumns, cachedTasks, setCachedTasks } = useAppContextStore();
  const { user, isUserLoading } = useUser();
  const firestore = useFirestore();
  const router = useRouter();

  // Dual View Configuration
  const [viewMode, setViewMode] = useState<"flow" | "board">("flow");

  // Filtering Configuration
  const [priorityFilter, setPriorityFilter] = useState<string>("all");

  // Inline Custom Status State
  const [newColumnName, setNewColumnName] = useState("");
  const [showAddColumn, setShowAddColumn] = useState(false);

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

  // Drag and Drop Activation Sensors
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(TouchSensor, {
      activationConstraint: {
        delay: 200,
        tolerance: 5,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

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
    let list = tasks;

    // Filter by Priority
    if (priorityFilter !== "all") {
      list = list.filter((task) => task.priority === priorityFilter);
    }

    // Filter by search query
    const query = searchQuery.trim().toLowerCase();
    if (query) {
      list = list.filter((task) => {
        const titleMatch = task.title.toLowerCase().includes(query);
        const descriptionMatch = (task.description || "").toLowerCase().includes(query);
        const tagMatch = (task.tags || []).some((tag) => normalizeTag(tag).includes(query));
        return titleMatch || descriptionMatch || tagMatch;
      });
    }

    return list;
  }, [priorityFilter, searchQuery, tasks]);

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

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over) return;

    const taskId = active.id as string;
    const overId = over.id as string;

    let targetStatus = overId;

    const targetTask = tasks.find((t) => t.id === overId);
    if (targetTask) {
      targetStatus = targetTask.status;
    }

    const currentTask = tasks.find((t) => t.id === taskId);
    if (currentTask && currentTask.status !== targetStatus) {
      handleMoveTask(taskId, targetStatus);
    }
  };

  const handleAddColumn = () => {
    const trimmed = newColumnName.trim();
    if (!trimmed) return;
    if (statusOrder.includes(trimmed)) {
      toast({ variant: "destructive", title: "Estado duplicado", description: "Este estado ya existe en el tablero." });
      return;
    }
    const updatedColumns = [...columns, trimmed];
    setKanbanColumns(updatedColumns);
    setNewColumnName("");
    setShowAddColumn(false);
    toast({ variant: "success", title: "Estado creado", description: `Se agregó la columna "${trimmed}".` });
  };

  const handleClearCompleted = async () => {
    if (!user || !firestore) return;
    const completedList = tasks.filter((task) => task.status === "Hecho");
    if (completedList.length === 0) {
      toast({ variant: "warning", title: "Sin tareas hechas", description: "No hay tareas completadas para limpiar." });
      return;
    }

    setTasks((previous) => previous.filter((task) => task.status !== "Hecho"));

    for (const task of completedList) {
      await deleteTask(firestore, user.uid, task.id);
    }

    toast({ variant: "success", title: "Tablero Limpio", description: `Se archivaron ${completedList.length} tareas.` });
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

  const completionPercentage = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

  return (
    <div className="space-y-6 pb-24 max-w-[1400px] mx-auto px-4 sm:px-6">
      {/* Header Premium Section */}
      <section className="rounded-[28px] border border-border bg-gradient-to-br from-background via-card/40 to-background p-6 shadow-md md:p-8">
        <div className="flex flex-col gap-6">
          <div className="flex items-center justify-between gap-4 border-b border-border/60 pb-5">
            <div className="space-y-1">
              <h1 className="text-3xl font-black tracking-tight md:text-4xl text-foreground">
                Organizador Kanban
              </h1>
              <p className="text-sm text-muted-foreground">
                Planifica tu jornada, gestiona prioridades y orquesta tus actividades.
              </p>
            </div>
          </div>

          {/* Progress Tracker */}
          <div className="space-y-2 bg-muted/10 p-4 rounded-2xl border border-border">
            <div className="flex justify-between items-center text-[10px] font-black uppercase tracking-widest text-muted-foreground">
              <span>Rendimiento del Flujo</span>
              <span className="font-data text-primary text-xs">
                {completionPercentage}% ({completedTasks} de {totalTasks} Hechas)
              </span>
            </div>
            <div className="h-2 w-full bg-muted/30 rounded-full overflow-hidden border border-border">
              <div
                className="h-full bg-primary neon-glow transition-all duration-500 rounded-full"
                style={{ width: `${completionPercentage}%` }}
              />
            </div>
          </div>

          {/* Metrics Grid */}
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {[
              { label: "Totales", value: totalTasks, icon: FolderDot, tone: "text-sky-400" },
              { label: "En Progreso", value: inProgressTasks, icon: Clock3, tone: "text-primary" },
              { label: "Críticas", value: criticalTasks, icon: Flame, tone: "text-red-500" },
              { label: "Finalizadas", value: completedTasks, icon: CircleCheckBig, tone: "text-emerald-400" },
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

          {/* Search, View Toggle, and Filters Toolbelt */}
          <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center border-t border-border/40 pt-5">
            <div className="flex flex-col sm:flex-row gap-3 flex-1">
              <div className="relative flex-1">
                <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground/50" />
                <Input
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.target.value)}
                  placeholder="Buscar por palabra clave o etiqueta..."
                  className="h-12 rounded-2xl border-border bg-muted/20 pl-11 text-sm focus-visible:ring-primary"
                />
              </div>

              {/* Priority Toggle Filters */}
              <div className="flex items-center gap-1 bg-muted/30 p-1 rounded-2xl border border-border overflow-x-auto scrollbar-hide">
                {[
                  { value: "all", label: "Todas" },
                  { value: "alta", label: "Alta" },
                  { value: "media", label: "Media" },
                  { value: "baja", label: "Baja" },
                ].map((p) => (
                  <Button
                    key={p.value}
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setPriorityFilter(p.value)}
                    className={cn(
                      "h-11 md:h-9 rounded-xl text-xs md:text-[10px] font-black uppercase tracking-wider px-4 md:px-3 shrink-0 transition-all active:scale-95",
                      priorityFilter === p.value
                        ? p.value === "alta"
                          ? "bg-red-500/20 text-red-300 border border-red-500/30"
                          : p.value === "media"
                            ? "bg-amber-500/20 text-amber-300 border border-amber-500/30"
                            : p.value === "baja"
                              ? "bg-blue-500/20 text-blue-300 border border-blue-500/30"
                              : "bg-primary/20 text-primary border border-primary/30"
                        : "text-muted-foreground hover:text-foreground"
                    )}
                  >
                    {p.label}
                  </Button>
                ))}
              </div>
            </div>

            {/* View Switcher and Clean Buttons */}
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex bg-muted/40 p-1 rounded-2xl border border-border">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setViewMode("flow")}
                  className={cn(
                    "h-11 md:h-10 rounded-xl text-xs md:text-[10px] font-black uppercase tracking-widest px-5 md:px-4 transition-all gap-1.5 active:scale-95",
                    viewMode === "flow" ? "bg-primary text-primary-foreground shadow" : "text-muted-foreground"
                  )}
                >
                  <List className="w-3.5 h-3.5" />
                  Lista
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setViewMode("board")}
                  className={cn(
                    "h-11 md:h-10 rounded-xl text-xs md:text-[10px] font-black uppercase tracking-widest px-5 md:px-4 transition-all gap-1.5 active:scale-95",
                    viewMode === "board" ? "bg-primary text-primary-foreground shadow" : "text-muted-foreground"
                  )}
                >
                  <LayoutGrid className="w-3.5 h-3.5" />
                  Tablero
                </Button>
              </div>

              <Button
                type="button"
                variant="outline"
                onClick={() => openTaskDialog()}
                className="h-12 w-full sm:w-auto rounded-2xl border-border bg-muted/10 px-5 text-xs md:text-[10px] font-black uppercase tracking-widest hover:bg-muted/20 active:scale-95 transition-all"
              >
                <Plus className="mr-2 h-4 w-4" />
                Nueva Tarea
              </Button>

              <Button
                type="button"
                variant="outline"
                onClick={handleClearCompleted}
                className="h-12 w-full sm:w-auto rounded-2xl border-red-500/20 hover:border-red-500/40 bg-red-500/5 px-5 text-xs md:text-[10px] font-black uppercase tracking-widest text-red-400 hover:bg-red-500/10 active:scale-95 transition-all"
              >
                Limpiar Hechos
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* Creation Tools Grid */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Quick Task Creator */}
        <Card className="border-border bg-card/40 rounded-3xl shadow-sm overflow-hidden">
          <CardHeader className="space-y-1.5 border-b border-border/30 bg-muted/5 p-6">
            <CardTitle className="text-base font-black tracking-tight uppercase tracking-wider text-foreground">Captura Rápida</CardTitle>
            <CardDescription className="text-xs">Crea una tarea al instante seleccionando sus propiedades base.</CardDescription>
          </CardHeader>
          <CardContent className="p-6 space-y-4">
            <div className="space-y-2">
              <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Título de la Actividad</Label>
              <Input
                value={quickTitle}
                onChange={(event) => setQuickTitle(event.target.value)}
                placeholder="Ej. enviar informe de fin de mes, revisar PR de backend..."
                className="h-12 rounded-2xl border-border bg-muted/20 focus-visible:ring-primary"
              />
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Estado Inicial</Label>
                <Select value={quickStatus} onValueChange={setQuickStatus}>
                  <SelectTrigger className="h-12 rounded-2xl border-border bg-muted/20">
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
                <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Prioridad</Label>
                <Select value={quickPriority} onValueChange={(value) => setQuickPriority(value as Priority)}>
                  <SelectTrigger className="h-12 rounded-2xl border-border bg-muted/20">
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

            <div className="flex flex-wrap gap-2 pt-2 text-xs md:text-[10px]">
              <Button
                type="button"
                onClick={handleQuickCreate}
                disabled={isSaving}
                className="h-12 w-full sm:w-auto rounded-2xl bg-primary px-6 text-xs md:text-[10px] font-black uppercase tracking-widest text-primary-foreground hover:bg-primary/95 shadow-lg active:scale-95 transition-all"
              >
                {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />}
                Crear Tarea
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => openTaskDialog({ title: quickTitle, priority: quickPriority, status: quickStatus })}
                className="h-12 w-full sm:w-auto rounded-2xl border-border bg-muted/10 px-5 text-xs md:text-[10px] font-black uppercase tracking-widest active:scale-95 transition-all"
              >
                Añadir Detalles
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* AI Task Orchestrator */}
        <Card className="border-border bg-card/40 rounded-3xl shadow-sm overflow-hidden">
          <CardHeader className="space-y-1.5 border-b border-border/30 bg-muted/5 p-6">
            <CardTitle className="text-base font-black tracking-tight uppercase tracking-wider text-foreground">Orquestador de Tareas</CardTitle>
            <CardDescription className="text-xs">Describe tus objetivos y la IA estructurará y priorizará tu jornada.</CardDescription>
          </CardHeader>
          <CardContent className="p-6 space-y-4">
            <div className="space-y-2">
              <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground flex items-center">
                <Cpu className="mr-1.5 inline h-3.5 w-3.5 text-primary" />
                Instrucciones de Planificación
              </Label>
              <Textarea
                value={aiPrompt}
                onChange={(event) => setAiPrompt(event.target.value)}
                placeholder="Ej: Necesito analizar el informe financiero por la mañana, responder los correos del cliente y programar la reunión técnica del próximo viernes..."
                className="min-h-[148px] rounded-2xl border-border bg-muted/20 text-sm focus-visible:ring-primary leading-relaxed"
              />
            </div>

            <div className="flex flex-wrap items-center gap-3 pt-2">
              <Button
                type="button"
                onClick={handleGenerateTasks}
                disabled={isGenerating || !aiPrompt.trim()}
                className="h-12 w-full sm:w-auto rounded-2xl bg-primary px-6 text-xs md:text-[10px] font-black uppercase tracking-widest text-primary-foreground hover:bg-primary/95 shadow-lg active:scale-95 transition-all"
              >
                {isGenerating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Brain className="mr-2 h-4 w-4" />}
                Procesar Plan
              </Button>
              <Button
                type="button"
                variant="ghost"
                onClick={() => setAiPrompt("")}
                className="h-12 w-full sm:w-auto rounded-2xl border border-border bg-muted/10 px-5 text-xs md:text-[10px] font-black uppercase tracking-widest text-muted-foreground hover:text-foreground active:scale-95 transition-all"
              >
                Limpiar
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Task List / Board Section */}
      <div className="border-t border-border/40 pt-6">
        {isTasksLoading && visibleTasks.length === 0 ? (
          <div className="space-y-4">
            {[0, 1, 2].map((index) => (
              <div key={index} className="h-28 animate-pulse rounded-3xl border border-border bg-muted/15" />
            ))}
          </div>
        ) : visibleTasks.length === 0 ? (
          <div className="rounded-[28px] border border-dashed border-border bg-muted/10 px-6 py-16 text-center">
            <CheckCircle className="mx-auto w-12 h-12 text-muted-foreground/30 stroke-[1]" />
            <p className="mt-4 text-sm font-bold text-foreground">
              {hasSearch ? "No se encontraron tareas coincidentes." : "No hay tareas en esta categoría."}
            </p>
            <p className="mt-1.5 text-xs text-muted-foreground">
              {hasSearch ? "Intenta con otra palabra clave." : "Crea una tarea arriba para comenzar."}
            </p>
          </div>
        ) : viewMode === "flow" ? (
          /* View Mode: FLOW (COLLAPSIBLE VERTICAL LIST) */
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
        ) : (
          /* View Mode: BOARD (HORIZONTAL KANBAN COLUMNS) */
          <DndContext sensors={sensors} collisionDetection={closestCorners} onDragEnd={handleDragEnd}>
            <div className="flex gap-6 overflow-x-auto pb-6 snap-x scrollbar-hide">
              {displayStatusOrder.map((status) => (
                <KanbanColumn
                  key={status}
                  status={status}
                  tasks={groupedTasks.get(status) || []}
                  onDelete={handleDeleteTask}
                  onEdit={handleEditTask}
                  selectedTaskIds={new Set()}
                  onToggleTaskSelection={() => {}}
                  pendingTaskIds={new Set()}
                />
              ))}

              {/* Inline Column Adder Block */}
              <div className="flex-shrink-0 w-80 sm:w-96 flex flex-col snap-center h-[420px]">
                {showAddColumn ? (
                  <div className="glass-card-elevated p-5 space-y-4 border border-border flex flex-col justify-between h-[180px]">
                    <div className="space-y-2">
                      <h3 className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Añadir Nuevo Estado</h3>
                      <Input
                        value={newColumnName}
                        onChange={(e) => setNewColumnName(e.target.value)}
                        placeholder="Nombre (ej. Bloqueado, Pruebas)"
                        className="h-11 rounded-2xl border-border bg-muted/20 text-sm focus-visible:ring-primary"
                      />
                    </div>
                    <div className="flex gap-2">
                      <Button
                        type="button"
                        onClick={handleAddColumn}
                        className="h-11 w-full rounded-2xl bg-primary text-primary-foreground text-[10px] font-black uppercase tracking-widest hover:bg-primary/95"
                      >
                        Añadir
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => {
                          setShowAddColumn(false);
                          setNewColumnName("");
                        }}
                        className="h-11 w-full rounded-2xl border-border bg-muted/10 text-[10px] font-black uppercase tracking-widest text-muted-foreground"
                      >
                        Cancelar
                      </Button>
                    </div>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setShowAddColumn(true)}
                    className="flex-1 rounded-[28px] border-2 border-dashed border-border/60 hover:border-primary/40 hover:bg-primary/[0.02] transition-all duration-300 flex flex-col items-center justify-center gap-3 text-muted-foreground hover:text-primary p-6"
                  >
                    <div className="w-12 h-12 rounded-full border-2 border-dashed border-border/80 flex items-center justify-center bg-muted/10 group-hover:border-primary/30">
                      <Plus className="w-5 h-5" />
                    </div>
                    <span className="text-[10px] font-black uppercase tracking-[0.25em]">Añadir Columna</span>
                  </button>
                )}
              </div>
            </div>
          </DndContext>
        )}
      </div>

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
