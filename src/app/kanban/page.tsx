"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { differenceInCalendarDays, format, isValid, parseISO } from "date-fns";
import { z } from "zod";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useAppContextStore } from "@/lib/store";
import { cn } from "@/lib/utils";
import { toast } from "@/hooks/use-toast";
import { useFirestore, useMemoFirebase, useUser } from "@/firebase/provider";
import { useCollection } from "@/firebase/firestore/use-collection";
import { buildTasksQuery, createTask, deleteTask, updateTask } from "@/services/task-service";
import { buildProjectsQuery, createProject, updateProject, archiveProject } from "@/services/project-service";
import { TaskFormPanel, type TaskFormState } from "@/components/kanban/task-form-panel";
import { ProjectManager } from "@/components/kanban/project-manager";
import type { AppContext, Priority, Project, ProjectFormData, Task } from "@/types/task";
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
  CheckCircle,
  FolderDot,
  Ticket,
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

// Estados fijos: el Kanban nunca admite estados personalizados adicionales.
const STATUSES = ["Pendiente", "Haciendo", "Hecho"] as const;
const MAX_TAGS_PER_TASK = 5;

const TaskSchema = z.object({
  title: z.string().trim().min(1, "El título es requerido").max(120),
  description: z.string().trim().optional(),
  priority: z.enum(["baja", "media", "alta"]),
  status: z.enum(["Pendiente", "Haciendo", "Hecho"]),
  tags: z.array(z.string()),
  dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Fecha inválida").optional(),
  context: z.enum(["Trabajo", "Estudio"]),
  userId: z.string(),
  projectId: z.string().optional(),
});

function getInitialTaskForm(status: string): TaskFormState {
  return {
    title: "",
    description: "",
    priority: "media",
    status,
    tags: "",
    dueDate: "",
    projectId: "",
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
              {STATUSES.map((status) => (
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

function StatusSection({
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

export default function KanbanPage() {
  const { context, cachedTasks, setCachedTasks, cachedProjects, setCachedProjects } = useAppContextStore();
  const { user, isUserLoading } = useUser();
  const firestore = useFirestore();
  const router = useRouter();
  const formPanelRef = useRef<HTMLDivElement>(null);

  // Dual View Configuration
  const [viewMode, setViewMode] = useState<"flow" | "board">("flow");

  // Filtering Configuration
  const [priorityFilter, setPriorityFilter] = useState<string>("all");
  const [projectFilter, setProjectFilter] = useState<string>("all");

  const [tasks, setTasks] = useState<Task[]>(cachedTasks[context] || []);
  const [projects, setProjects] = useState<Project[]>(cachedProjects[context] || []);
  const [searchQuery, setSearchQuery] = useState("");
  const [aiPrompt, setAiPrompt] = useState("");
  const [quickTitle, setQuickTitle] = useState("");
  const [quickPriority, setQuickPriority] = useState<Priority>("media");
  const [quickStatus, setQuickStatus] = useState<string>(STATUSES[0]);
  const [taskForm, setTaskForm] = useState<TaskFormState>(getInitialTaskForm(STATUSES[0]));
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isSavingProject, setIsSavingProject] = useState(false);
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

  const { data: firestoreTasks, isLoading: isTasksLoading } = useCollection<Task>(tasksQuery);

  const projectsQuery = useMemoFirebase(() => {
    if (!firestore || !user) return null;
    return buildProjectsQuery(firestore, user.uid, context);
  }, [firestore, user, context]);

  const { data: firestoreProjects } = useCollection<Project>(projectsQuery);

  useEffect(() => {
    if (firestoreTasks) {
      setTasks(firestoreTasks);
      setCachedTasks(context, firestoreTasks);
    }
  }, [context, firestoreTasks, setCachedTasks]);

  useEffect(() => {
    if (firestoreProjects) {
      setProjects(firestoreProjects);
      setCachedProjects(context, firestoreProjects);
    }
  }, [context, firestoreProjects, setCachedProjects]);

  useEffect(() => {
    if (!isUserLoading && !user) {
      router.push("/login");
    }
  }, [user, isUserLoading, router]);

  const projectsById = useMemo(() => new Map(projects.map((p) => [p.id, p])), [projects]);
  const activeProjects = useMemo(() => projects.filter((p) => !p.archived), [projects]);

  const visibleTasks = useMemo(() => {
    let list = tasks;

    if (priorityFilter !== "all") {
      list = list.filter((task) => task.priority === priorityFilter);
    }

    if (projectFilter !== "all") {
      list = list.filter((task) => task.projectId === projectFilter);
    }

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
  }, [priorityFilter, projectFilter, searchQuery, tasks]);

  const groupedTasks = useMemo(() => {
    const grouped = new Map<string, Task[]>();
    STATUSES.forEach((status) => grouped.set(status, []));

    visibleTasks.forEach((task) => {
      if (!grouped.has(task.status)) {
        grouped.set(task.status, []);
      }
      grouped.get(task.status)?.push(task);
    });

    return grouped;
  }, [visibleTasks]);

  const totalTasks = tasks.length;
  const completedTasks = tasks.filter((task) => task.status === "Hecho").length;
  const inProgressTasks = tasks.filter((task) => task.status === "Haciendo").length;
  const criticalTasks = tasks.filter((task) => task.priority === "alta" && task.status !== "Hecho").length;
  const hasSearch = searchQuery.trim().length > 0;

  const scrollToForm = () => {
    requestAnimationFrame(() => {
      formPanelRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  };

  const openTaskForm = (seed?: Partial<TaskFormState>, task?: Task) => {
    if (task) {
      setEditingTask(task);
      setTaskForm({
        title: task.title,
        description: task.description || "",
        priority: task.priority,
        status: task.status,
        tags: task.tags?.join(", ") || "",
        dueDate: toInputDateValue(task.dueDate),
        projectId: task.projectId || "",
      });
    } else {
      setEditingTask(null);
      setTaskForm({
        ...getInitialTaskForm(STATUSES[0]),
        ...seed,
        status: seed?.status || STATUSES[0],
      });
    }

    setFormOpen(true);
    scrollToForm();
  };

  const closeTaskForm = () => {
    setFormOpen(false);
    setEditingTask(null);
    setTaskForm(getInitialTaskForm(STATUSES[0]));
  };

  const saveTask = async (draft: TaskFormState) => {
    if (!user || !firestore) return;

    const payload = {
      title: draft.title.trim(),
      description: draft.description.trim(),
      priority: draft.priority,
      status: draft.status || STATUSES[0],
      tags: parseTagInput(draft.tags),
      ...(draft.dueDate ? { dueDate: draft.dueDate } : {}),
      context: context as AppContext,
      userId: user.uid,
      ...(draft.projectId ? { projectId: draft.projectId } : {}),
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
        status: quickStatus || STATUSES[0],
        tags: "",
        dueDate: "",
        projectId: "",
      });
      setQuickTitle("");
      setQuickPriority("media");
      setQuickStatus(STATUSES[0]);
    } finally {
      setIsSaving(false);
    }
  };

  const handleEditTask = (task: Task) => {
    openTaskForm(undefined, task);
  };

  const handleDeleteTask = (taskId: string) => {
    if (!user || !firestore) return;

    setTasks((previous) => previous.filter((task) => task.id !== taskId));
    deleteTask(firestore, user.uid, taskId);
    toast({ variant: "warning", title: "Tarea eliminada" });
  };

  const handleMoveTask = (taskId: string, status: string) => {
    if (!user || !firestore) return;

    setTasks((previous) => previous.map((task) => (task.id === taskId ? { ...task, status: status as Task["status"] } : task)));
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

      const targetStatus = STATUSES[0];
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

  const handleSubmitForm = async () => {
    setIsSaving(true);
    try {
      await saveTask(taskForm);
      closeTaskForm();
    } finally {
      setIsSaving(false);
    }
  };

  const handleCreateProject = (data: ProjectFormData) => {
    if (!user || !firestore) return;
    setIsSavingProject(true);
    createProject(firestore, user.uid, { ...data, context: context as AppContext });
    toast({ variant: "success", title: "Proyecto creado" });
    setIsSavingProject(false);
  };

  const handleUpdateProject = (projectId: string, data: ProjectFormData) => {
    if (!user || !firestore) return;
    setIsSavingProject(true);
    updateProject(firestore, user.uid, projectId, { ...data });
    toast({ variant: "success", title: "Proyecto actualizado" });
    setIsSavingProject(false);
  };

  const handleArchiveProject = (projectId: string) => {
    if (!user || !firestore) return;
    archiveProject(firestore, user.uid, projectId);
    if (projectFilter === projectId) setProjectFilter("all");
    toast({ variant: "warning", title: "Proyecto archivado" });
  };

  if (isUserLoading || !user) {
    return null;
  }

  const completionPercentage = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

  return (
    <div className="space-y-6 pb-12 max-w-[1400px] mx-auto px-0">
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
                  className="h-12 rounded-2xl border-border bg-muted/20 pl-11 text-base sm:text-sm focus-visible:ring-primary"
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
            <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
              <div className="flex w-full sm:w-auto bg-muted/40 p-1 rounded-2xl border border-border">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setViewMode("flow")}
                  className={cn(
                    "flex-1 sm:flex-none justify-center h-11 md:h-10 rounded-xl text-xs md:text-[10px] font-black uppercase tracking-widest px-5 md:px-4 transition-all gap-1.5 active:scale-95",
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
                    "flex-1 sm:flex-none justify-center h-11 md:h-10 rounded-xl text-xs md:text-[10px] font-black uppercase tracking-widest px-5 md:px-4 transition-all gap-1.5 active:scale-95",
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
                onClick={() => openTaskForm()}
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

          {/* Project Filter */}
          {activeProjects.length > 0 && (
            <div className="flex items-center gap-1 flex-wrap bg-muted/30 p-1 rounded-2xl border border-border">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setProjectFilter("all")}
                className={cn(
                  "h-9 rounded-xl text-[10px] font-black uppercase tracking-wider px-3 transition-all",
                  projectFilter === "all" ? "bg-primary/20 text-primary border border-primary/30" : "text-muted-foreground hover:text-foreground"
                )}
              >
                Todos los proyectos
              </Button>
              {activeProjects.map((project) => (
                <Button
                  key={project.id}
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setProjectFilter(project.id)}
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
        </div>
      </section>

      {/* Gestión de Proyectos */}
      <ProjectManager
        projects={projects}
        onCreate={handleCreateProject}
        onUpdate={handleUpdateProject}
        onArchive={handleArchiveProject}
        isSaving={isSavingProject}
      />

      {/* Formulario embebido de tarea (crear/editar) — sin modal */}
      {formOpen && (
        <div ref={formPanelRef}>
          <TaskFormPanel
            isEditing={Boolean(editingTask)}
            value={taskForm}
            onChange={(patch) => setTaskForm((previous) => ({ ...previous, ...patch }))}
            onSubmit={handleSubmitForm}
            onCancel={closeTaskForm}
            isSaving={isSaving}
            statusOptions={[...STATUSES]}
            projects={activeProjects}
            maxTags={MAX_TAGS_PER_TASK}
          />
        </div>
      )}

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
                    {STATUSES.map((status) => (
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
                onClick={() => openTaskForm({ title: quickTitle, priority: quickPriority, status: quickStatus })}
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
                className="min-h-[148px] rounded-2xl border-border bg-muted/20 text-base sm:text-sm focus-visible:ring-primary leading-relaxed"
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
            {STATUSES.map((status) => (
              <StatusSection
                key={status}
                status={status}
                tasks={groupedTasks.get(status) || []}
                projectsById={projectsById}
                onAdd={(presetStatus) => openTaskForm({ status: presetStatus })}
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
              {STATUSES.map((status) => (
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
            </div>
          </DndContext>
        )}
      </div>
    </div>
  );
}
