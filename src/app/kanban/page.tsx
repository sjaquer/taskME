"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useAppContextStore } from "@/lib/store";
import { Plus, Settings2, X, Loader2, Layers, Database, CircleCheckBig, Clock3, Flame, Sparkles, Trash2, RefreshCcw, Mic } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useFirestore, useUser, useMemoFirebase } from "@/firebase/provider";
import { useCollection } from "@/firebase/firestore/use-collection";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ToastAction } from "@/components/ui/toast";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { z } from "zod";
import { differenceInCalendarDays, format, isToday, isValid, parseISO } from "date-fns";
import { doc, serverTimestamp, updateDoc } from "firebase/firestore";
import { toast } from "@/hooks/use-toast";
import { TacticalButton, OutlineButton } from "@/components/atoms";
import { TaskCard } from "@/components/molecules";
import { KanbanColumn } from "@/components/organisms";
import { buildTasksQuery, createTask, deleteTask } from "@/services/task-service";
import type { Task, Priority, AppContext } from "@/types/task";

import {
  DndContext,
  pointerWithin,
  rectIntersection,
  type CollisionDetection,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  DragOverlay,
  DragStartEvent,
  DragOverEvent,
  DragEndEvent,
} from "@dnd-kit/core";
import { sortableKeyboardCoordinates } from "@dnd-kit/sortable";

const TaskSchema = z.object({
  title: z.string().min(1, "El título es requerido").max(100),
  description: z.string().optional(),
  priority: z.enum(["baja", "media", "alta"]),
  status: z.string().min(1),
  tags: z.array(z.string()),
  dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Fecha inválida").optional(),
  context: z.string(),
  userId: z.string(),
});

const MAX_TAGS_PER_TASK = 5;
const KANBAN_FILTERS_STORAGE_KEY = "taskme:kanban:filters";
const KANBAN_CLEANUP_STORAGE_KEY = "taskme:kanban:cleanup";
const BULK_UNDO_WINDOW_MS = 8000;

interface BulkUndoState {
  beforeById: Map<string, Task>;
  afterById: Map<string, Task>;
}

interface PendingTaskUpdate {
  taskId: string;
  data: Record<string, unknown>;
  queuedAt: number;
}

function normalizeTag(tag: string) {
  return tag.trim().toLowerCase().replace(/\s+/g, " ");
}

function parseTagInput(input: string) {
  const uniqueTags = new Set<string>();

  input
    .split(",")
    .map(normalizeTag)
    .filter((tag) => tag.length > 0)
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

function toDateFromUnknown(value: unknown): Date | null {
  if (!value) return null;

  if (value instanceof Date) {
    return isValid(value) ? value : null;
  }

  if (typeof value === "string") {
    const parsed = parseISO(value);
    return isValid(parsed) ? parsed : null;
  }

  if (typeof value === "object" && value !== null) {
    const candidate = value as { toDate?: () => Date; seconds?: number; nanoseconds?: number };

    if (typeof candidate.toDate === "function") {
      const asDate = candidate.toDate();
      return isValid(asDate) ? asDate : null;
    }

    if (typeof candidate.seconds === "number") {
      const ms = candidate.seconds * 1000 + (candidate.nanoseconds ? Math.floor(candidate.nanoseconds / 1_000_000) : 0);
      const asDate = new Date(ms);
      return isValid(asDate) ? asDate : null;
    }
  }

  return null;
}

function toTaskUpdatePayload(task: Task) {
  return {
    title: task.title,
    description: task.description,
    priority: task.priority,
    status: task.status,
    tags: task.tags || [],
    dueDate: task.dueDate ?? null,
    context: task.context,
    userId: task.userId,
  };
}

function sanitizeUpdateData(data: Record<string, unknown>) {
  return Object.fromEntries(Object.entries(data).filter(([, value]) => value !== undefined));
}

function getPendingQueueStorageKey(userId: string) {
  return `taskme:kanban:pending-updates:${userId}`;
}

function getCleanupStorageKey(userId: string, context: AppContext) {
  return `${KANBAN_CLEANUP_STORAGE_KEY}:${userId}:${context}`;
}

export default function KanbanPage() {
  const { 
    context, 
    kanbanColumns: columns, 
    setKanbanColumns: setColumns, 
    autoDeleteDoneDays, 
    setAutoDeleteDoneDays,
    cachedTasks,
    setCachedTasks
  } = useAppContextStore();
  
  const { user, isUserLoading } = useUser();
  const firestore = useFirestore();
  const router = useRouter();

  const boardRef = useRef<HTMLDivElement>(null);
  const topScrollRef = useRef<HTMLDivElement>(null);
  const dragOriginStatusRef = useRef<string | null>(null);
  const dragActiveTaskIdRef = useRef<string | null>(null);
  const bulkUndoRef = useRef<BulkUndoState | null>(null);
  const bulkUndoTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingRetryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingRetryAttemptRef = useRef(0);
  const isSyncingTop = useRef(false);
  const isSyncingBoard = useRef(false);
  const [boardScrollWidth, setBoardScrollWidth] = useState(0);

  const [newColumnName, setNewColumnName] = useState("");
  const [isManagingColumns, setIsManagingColumns] = useState(false);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [taskForm, setTaskForm] = useState({
    title: "",
    description: "",
    priority: "media" as Priority,
    status: "",
    tags: "",
    dueDate: "",
  });
  const [activeTask, setActiveTask] = useState<Task | null>(null);
  const [aiPrompt, setAiPrompt] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [selectedTaskIds, setSelectedTaskIds] = useState<Set<string>>(new Set());
  const [bulkTagInput, setBulkTagInput] = useState("");
  const [pendingSyncCount, setPendingSyncCount] = useState(0);
  const [pendingTaskIds, setPendingTaskIds] = useState<Set<string>>(new Set());
  const [isSyncingPending, setIsSyncingPending] = useState(false);
  const [lastSyncAttemptAt, setLastSyncAttemptAt] = useState<number | null>(null);
  const [lastCleanupAt, setLastCleanupAt] = useState<number | null>(null);
  const [isRunningCleanup, setIsRunningCleanup] = useState(false);
  const [isDataFromCache, setIsDataFromCache] = useState(true);
  const [filters, setFilters] = useState({
    query: "",
    priority: "all",
    status: "all",
    tag: "all",
    due: "all",
  });

  useEffect(() => {
    if (typeof window === "undefined") return;

    try {
      const raw = window.localStorage.getItem(KANBAN_FILTERS_STORAGE_KEY);
      if (!raw) return;

      const allFilters = JSON.parse(raw) as Record<string, typeof filters>;
      const stored = allFilters[context];
      if (!stored) return;

      setFilters({
        query: typeof stored.query === "string" ? stored.query : "",
        priority: typeof stored.priority === "string" ? stored.priority : "all",
        status: typeof stored.status === "string" ? stored.status : "all",
        tag: typeof stored.tag === "string" ? stored.tag : "all",
        due: typeof stored.due === "string" ? stored.due : "all",
      });
    } catch {
      // Ignore malformed local data and keep defaults.
    }
  }, [context]);

  useEffect(() => {
    if (typeof window === "undefined") return;

    try {
      const raw = window.localStorage.getItem(KANBAN_FILTERS_STORAGE_KEY);
      const allFilters = raw ? (JSON.parse(raw) as Record<string, typeof filters>) : {};
      allFilters[context] = filters;
      window.localStorage.setItem(KANBAN_FILTERS_STORAGE_KEY, JSON.stringify(allFilters));
    } catch {
      // Ignore storage failures.
    }
  }, [context, filters]);

  useEffect(() => {
    if (typeof window === "undefined" || !user) return;

    try {
      const raw = window.localStorage.getItem(getCleanupStorageKey(user.uid, context));
      if (!raw) {
        setLastCleanupAt(null);
        return;
      }

      const parsed = JSON.parse(raw) as { lastCleanupAt?: number | null };
      setLastCleanupAt(typeof parsed.lastCleanupAt === "number" ? parsed.lastCleanupAt : null);
    } catch {
      setLastCleanupAt(null);
    }
  }, [context, user]);

  useEffect(() => {
    if (typeof window === "undefined" || !user) return;

    try {
      window.localStorage.setItem(
        getCleanupStorageKey(user.uid, context),
        JSON.stringify({ lastCleanupAt })
      );
    } catch {
      // Ignore storage failures.
    }
  }, [context, lastCleanupAt, user]);

  const tasksQuery = useMemoFirebase(() => {
    if (!firestore || !user) return null;
    return buildTasksQuery(firestore, user.uid, context);
  }, [firestore, user, context]);

  // Expert Read Optimization: Use local Zustand cache as the primary source
  // while Firestore is syncing in the background.
  const { data: firestoreTasks, isLoading: isTasksLoading, fromCache } = useCollection<Task>(tasksQuery);
  const [tasks, setTasks] = useState<Task[]>(cachedTasks[context] || []);

  useEffect(() => {
    if (firestoreTasks) {
      setTasks(firestoreTasks);
      setCachedTasks(context, firestoreTasks);
      setIsDataFromCache(fromCache || false);
    }
  }, [firestoreTasks, context, setCachedTasks, fromCache]);

  const readPendingQueue = (userId: string): PendingTaskUpdate[] => {
    if (typeof window === "undefined") return [];

    try {
      const raw = window.localStorage.getItem(getPendingQueueStorageKey(userId));
      if (!raw) return [];
      const parsed = JSON.parse(raw) as PendingTaskUpdate[];
      if (!Array.isArray(parsed)) return [];
      return parsed;
    } catch {
      return [];
    }
  };

  const setPendingSyncState = (queue: PendingTaskUpdate[]) => {
    setPendingSyncCount(queue.length);
    setPendingTaskIds(new Set(queue.map((entry) => entry.taskId)));
  };

  const writePendingQueue = (userId: string, queue: PendingTaskUpdate[]) => {
    if (typeof window === "undefined") return;
    try {
      window.localStorage.setItem(getPendingQueueStorageKey(userId), JSON.stringify(queue));
    } catch {
      // Ignore storage failures.
    }
    setPendingSyncState(queue);
  };

  const enqueuePendingTaskUpdate = (userId: string, taskId: string, data: Record<string, unknown>) => {
    const sanitized = sanitizeUpdateData(data);
    const queue = readPendingQueue(userId);
    const existingIndex = queue.findIndex((entry) => entry.taskId === taskId);

    if (existingIndex >= 0) {
      queue[existingIndex] = {
        ...queue[existingIndex],
        data: { ...queue[existingIndex].data, ...sanitized },
        queuedAt: Date.now(),
      };
    } else {
      queue.push({ taskId, data: sanitized, queuedAt: Date.now() });
    }

    writePendingQueue(userId, queue);
  };

  const clearPendingRetry = () => {
    if (pendingRetryTimerRef.current) {
      clearTimeout(pendingRetryTimerRef.current);
      pendingRetryTimerRef.current = null;
    }
  };

  const schedulePendingRetry = () => {
    if (!user || pendingSyncCount === 0 || !navigator.onLine) return;

    clearPendingRetry();

    const attempt = pendingRetryAttemptRef.current;
    const delayMs = Math.min(30000, 1000 * (2 ** attempt));
    pendingRetryAttemptRef.current = Math.min(attempt + 1, 5);

    pendingRetryTimerRef.current = setTimeout(() => {
      void flushPendingTaskUpdates({ silent: true });
    }, delayMs);
  };

  const persistTaskUpdate = async (
    taskId: string,
    data: Record<string, unknown>,
    options?: { notifyOnQueue?: boolean }
  ) => {
    if (!user || !firestore) return;

    const sanitized = sanitizeUpdateData(data);
    const notifyOnQueue = options?.notifyOnQueue ?? true;

    if (!navigator.onLine) {
      enqueuePendingTaskUpdate(user.uid, taskId, sanitized);
      if (notifyOnQueue) {
        toast({ variant: "warning", title: "Sin conexión", description: "Cambio en cola para sincronizar." });
      }
      return;
    }

    try {
      const taskRef = doc(firestore, "users", user.uid, "tasks", taskId);
      await updateDoc(taskRef, {
        ...sanitized,
        updatedAt: serverTimestamp(),
      });
    } catch {
      enqueuePendingTaskUpdate(user.uid, taskId, sanitized);
      if (notifyOnQueue) {
        toast({ variant: "warning", title: "Sincronización pendiente", description: "Cambio guardado para reintentar." });
      }
    }
  };

  const flushPendingTaskUpdates = async (options?: { silent?: boolean }) => {
    if (!user || !firestore || !navigator.onLine) return;

    setLastSyncAttemptAt(Date.now());
    setIsSyncingPending(true);

    const queue = readPendingQueue(user.uid);
    if (queue.length === 0) {
      pendingRetryAttemptRef.current = 0;
      clearPendingRetry();
      setIsSyncingPending(false);
      if (!options?.silent) {
        toast({ variant: "info", title: "Sin pendientes", description: "Todo está sincronizado." });
      }
      return;
    }

    const remaining: PendingTaskUpdate[] = [];

    for (const entry of queue) {
      try {
        const taskRef = doc(firestore, "users", user.uid, "tasks", entry.taskId);
        await updateDoc(taskRef, {
          ...sanitizeUpdateData(entry.data),
          updatedAt: serverTimestamp(),
        });
      } catch {
        remaining.push(entry);
      }
    }

    writePendingQueue(user.uid, remaining);

    if (remaining.length === 0) {
      pendingRetryAttemptRef.current = 0;
      clearPendingRetry();
    } else {
      schedulePendingRetry();
    }

    setIsSyncingPending(false);

    if (!options?.silent) {
      if (remaining.length === 0) {
        toast({ variant: "success", title: "Sincronización completada", description: "Todos los cambios pendientes fueron enviados." });
      } else {
        toast({ variant: "warning", title: "Sincronización parcial", description: `${remaining.length} cambios siguen pendientes.` });
      }
    }
  };

  useEffect(() => {
    if (firestoreTasks) {
      setTasks(firestoreTasks);
    }
  }, [firestoreTasks]);

  useEffect(() => {
    if (!user) {
      setPendingSyncCount(0);
      setPendingTaskIds(new Set());
      setIsSyncingPending(false);
      setLastSyncAttemptAt(null);
      pendingRetryAttemptRef.current = 0;
      clearPendingRetry();
      return;
    }

    const queue = readPendingQueue(user.uid);
    setPendingSyncState(queue);

    void flushPendingTaskUpdates({ silent: true });
  }, [user, firestore]);

  useEffect(() => {
    const handleOnline = () => {
      pendingRetryAttemptRef.current = 0;
      void flushPendingTaskUpdates({ silent: false });
    };

    window.addEventListener("online", handleOnline);
    return () => window.removeEventListener("online", handleOnline);
  }, [user, firestore]);

  useEffect(() => {
    if (!user) return;

    if (pendingSyncCount > 0 && navigator.onLine) {
      schedulePendingRetry();
      return;
    }

    if (pendingSyncCount === 0) {
      pendingRetryAttemptRef.current = 0;
      clearPendingRetry();
    }
  }, [pendingSyncCount, user]);

  useEffect(() => {
    setSelectedTaskIds((prev) => {
      const existingIds = new Set(tasks.map((task) => task.id));
      const next = new Set<string>();
      prev.forEach((id) => {
        if (existingIds.has(id)) {
          next.add(id);
        }
      });
      return next;
    });
  }, [tasks]);

  const totalTasks = tasks?.length || 0;
  const completedTasks = tasks?.filter((t) => t.status === "Hecho").length || 0;
  const inProgressTasks = tasks?.filter((t) => t.status === "Haciendo").length || 0;
  const criticalTasks = tasks?.filter((t) => t.priority === "alta" && t.status !== "Hecho").length || 0;
  const doneTasks = useMemo(() => tasks.filter((task) => task.status === "Hecho"), [tasks]);

  const cleanupEligibleCount = useMemo(() => {
    if (autoDeleteDoneDays === "disabled") return 0;

    const days = Number.parseInt(autoDeleteDoneDays, 10);
    if (!Number.isFinite(days) || days <= 0) return 0;

    return doneTasks.filter((task) => {
      const referenceDate = toDateFromUnknown(task.updatedAt) || toDateFromUnknown(task.createdAt);
      if (!referenceDate) return false;
      const age = differenceInCalendarDays(new Date(), referenceDate);
      return age >= days;
    }).length;
  }, [autoDeleteDoneDays, doneTasks]);

  const filteredTasks = useMemo(() => {
    const query = filters.query.trim().toLowerCase();

    return tasks.filter((task) => {
      if (filters.priority !== "all" && task.priority !== filters.priority) {
        return false;
      }

      if (filters.status !== "all" && task.status !== filters.status) {
        return false;
      }

      if (filters.tag !== "all") {
        const normalizedTaskTags = (task.tags || []).map(normalizeTag);
        if (!normalizedTaskTags.includes(filters.tag)) {
          return false;
        }
      }

      if (query) {
        const titleMatch = task.title.toLowerCase().includes(query);
        const descriptionMatch = (task.description || "").toLowerCase().includes(query);
        const tagsMatch = (task.tags || []).some((tag) => normalizeTag(tag).includes(query));

        if (!titleMatch && !descriptionMatch && !tagsMatch) {
          return false;
        }
      }

      if (filters.due !== "all") {
        const dueDate = toTaskDate(task.dueDate);

        if (filters.due === "none") {
          return dueDate === null;
        }

        if (!dueDate) {
          return false;
        }

        const dayDelta = differenceInCalendarDays(dueDate, new Date());

        if (filters.due === "overdue" && dayDelta >= 0) {
          return false;
        }

        if (filters.due === "today" && !isToday(dueDate)) {
          return false;
        }

        if (filters.due === "next7" && (dayDelta < 0 || dayDelta > 7)) {
          return false;
        }
      }

      return true;
    });
  }, [filters, tasks]);

  const tasksByStatus = useMemo(() => {
    const grouped = new Map<string, Task[]>();
    columns.forEach((column) => grouped.set(column, []));

    filteredTasks.forEach((task) => {
      if (!grouped.has(task.status)) {
        grouped.set(task.status, []);
      }
      grouped.get(task.status)?.push(task);
    });

    return grouped;
  }, [columns, filteredTasks]);

  const hasActiveFilters =
    filters.query.trim().length > 0 ||
    filters.priority !== "all" ||
    filters.status !== "all" ||
    filters.tag !== "all" ||
    filters.due !== "all";
  const hasSelection = selectedTaskIds.size > 0;

  const suggestedTags = useMemo(() => {
    const frequency = new Map<string, number>();

    tasks.forEach((task) => {
      (task.tags || []).forEach((tag) => {
        const normalized = normalizeTag(tag);
        if (!normalized) return;
        frequency.set(normalized, (frequency.get(normalized) || 0) + 1);
      });
    });

    return Array.from(frequency.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 12)
      .map(([tag]) => tag);
  }, [tasks]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const collisionDetectionStrategy: CollisionDetection = (args) => {
    const pointerCollisions = pointerWithin(args);
    if (pointerCollisions.length > 0) {
      return pointerCollisions;
    }
    return rectIntersection(args);
  };

  useEffect(() => {
    if (columns.length > 0 && !taskForm.status) {
      setTaskForm((prev) => ({ ...prev, status: columns[0] }));
    }
  }, [columns, taskForm.status]);

  useEffect(() => {
    setTaskForm({ title: "", description: "", priority: "media", status: columns[0], tags: "", dueDate: "" });
    setEditingTask(null);
    setIsDialogOpen(false);
  }, [context, columns]);

  useEffect(() => {
    const board = boardRef.current;
    if (!board) return;

    const updateWidth = () => {
      if (board) {
        setBoardScrollWidth(board.scrollWidth);
      }
    };

    updateWidth();

    const observer = new ResizeObserver(() => {
      updateWidth();
    });
    
    observer.observe(board);

    const children = board.querySelectorAll('.flex-shrink-0');
    children.forEach(child => observer.observe(child));

    return () => observer.disconnect();
  }, [columns, tasks]);

  useEffect(() => {
    if (!isUserLoading && !user) router.push("/login");
  }, [user, isUserLoading, router]);

  const clearBulkUndo = () => {
    bulkUndoRef.current = null;
    if (bulkUndoTimeoutRef.current) {
      clearTimeout(bulkUndoTimeoutRef.current);
      bulkUndoTimeoutRef.current = null;
    }
  };

  const runCompletedTasksCleanup = (options?: { mode?: "auto" | "manual"; force?: boolean }) => {
    if (!user || !firestore) return;

    const mode = options?.mode || "auto";
    const force = options?.force ?? false;

    if (mode === "auto" && autoDeleteDoneDays === "disabled") {
      return;
    }

    if (mode === "auto" && !force && lastCleanupAt) {
      const hoursSinceLastRun = (Date.now() - lastCleanupAt) / (1000 * 60 * 60);
      if (hoursSinceLastRun < 24) {
        return;
      }
    }

    const doneTaskIds = doneTasks.map((task) => task.id);
    let targetIds: string[] = [];

    if (mode === "manual") {
      targetIds = doneTaskIds;
    } else {
      const days = Number.parseInt(autoDeleteDoneDays, 10);
      if (!Number.isFinite(days) || days <= 0) return;

      targetIds = doneTasks
        .filter((task) => {
          const referenceDate = toDateFromUnknown(task.updatedAt) || toDateFromUnknown(task.createdAt);
          if (!referenceDate) return false;
          const age = differenceInCalendarDays(new Date(), referenceDate);
          return age >= days;
        })
        .map((task) => task.id);
    }

    if (targetIds.length === 0) {
      if (mode === "manual") {
        toast({ variant: "info", title: "Sin tareas hechas", description: "No hay tareas completadas para borrar." });
      }
      setLastCleanupAt(Date.now());
      return;
    }

    setIsRunningCleanup(true);
    setTasks((prev) => prev.filter((task) => !targetIds.includes(task.id)));
    targetIds.forEach((taskId) => deleteTask(firestore, user.uid, taskId));
    setLastCleanupAt(Date.now());
    setIsRunningCleanup(false);

    toast({
      variant: "success",
      title: mode === "manual" ? "Tareas hechas eliminadas" : "Limpieza automática aplicada",
      description: `${targetIds.length} tareas completadas fueron eliminadas.`,
    });
  };

  useEffect(() => {
    return () => {
      clearBulkUndo();
      clearPendingRetry();
    };
  }, []);

  useEffect(() => {
    if (!user || !firestore || doneTasks.length === 0) return;
    runCompletedTasksCleanup({ mode: "auto" });
  }, [autoDeleteDoneDays, context, doneTasks, firestore, user]);

  if (isUserLoading || !user) return null;

  const handleSaveTask = () => {
    setIsSaving(true);
    const rawData = {
      title: taskForm.title,
      description: taskForm.description,
      priority: taskForm.priority,
      status: taskForm.status || columns[0],
      tags: parseTagInput(taskForm.tags),
      ...(taskForm.dueDate && { dueDate: taskForm.dueDate }),
      context: context as AppContext,
      userId: user.uid,
    };

    const result = TaskSchema.safeParse(rawData);
    if (!result.success) {
      toast({ variant: "destructive", title: "Error", description: result.error.errors[0].message });
      setIsSaving(false);
      return;
    }

    const taskData = {
      ...result.data,
      priority: result.data.priority as Priority,
      context: result.data.context as AppContext,
    };

    if (editingTask) {
      // Optimistic Update
      setTasks(prev => prev.map(t => t.id === editingTask.id ? { ...t, ...taskData } : t));
      void persistTaskUpdate(editingTask.id, taskData);
      toast({ variant: "success", title: "Actualizado" });
    } else {
      // Optimistic Update (Temporary ID)
      const tempId = `temp-${Date.now()}`;
      const newTask = { ...taskData, id: tempId } as Task;
      setTasks(prev => [newTask, ...prev]);
      createTask(firestore, user.uid, taskData);
      toast({ variant: "success", title: "Inyectado" });
    }

    resetForm();
    setIsDialogOpen(false);
    setIsSaving(false);
  };

  const handleGenerateTasks = async () => {
    if (!aiPrompt.trim() || !user || !firestore) return;
    setIsGenerating(true);
    try {
      const response = await fetch('/api/v1/ai/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: aiPrompt })
      });

      if (!response.ok) {
        const errorPayload = await response.json().catch(() => null);
        throw new Error(errorPayload?.error || 'Error al generar tareas desde la API');
      }

      const { tasks: generatedTasks } = await response.json();
      if (!Array.isArray(generatedTasks)) {
        throw new Error('La API no devolvio una lista de tareas valida');
      }
      
      let createdCount = 0;
      for (const task of generatedTasks) {
        const taskData = {
          title: task.title,
          description: task.description || "",
          priority: task.priority as Priority,
          status: columns[0],
          tags: task.tags || [],
          dueDate: task.dueDate || null,
          context: task.context as AppContext,
          userId: user.uid,
        };
        await createTask(firestore, user.uid, taskData);
        createdCount++;
      }

      toast({ variant: "success", title: "Inyección Cuántica", description: `${createdCount} tareas generadas con éxito.` });
      setAiPrompt("");
      setIsDialogOpen(false);
    } catch (error: any) {
      toast({ variant: "destructive", title: "Error Cuántico", description: error.message });
    } finally {
      setIsGenerating(false);
    }
  };

  const handleStartListening = () => {
    if (typeof window === "undefined") return;

    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    
    if (!SpeechRecognition) {
      toast({ 
        variant: "destructive", 
        title: "No soportado", 
        description: "Tu navegador no soporta el reconocimiento de voz nativo." 
      });
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = 'es-ES';
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    recognition.onstart = () => {
      setIsListening(true);
    };

    recognition.onresult = (event: any) => {
      const transcript = event.results[0][0].transcript;
      if (transcript) {
        setAiPrompt((prev) => (prev ? `${prev} ${transcript}` : transcript));
      }
    };

    recognition.onerror = (event: any) => {
      console.error('Speech recognition error:', event.error);
      setIsListening(false);
      if (event.error !== 'no-speech') {
        toast({ 
          variant: "destructive", 
          title: "Error de Audio", 
          description: "Hubo un problema al capturar tu voz." 
        });
      }
    };

    recognition.onend = () => {
      setIsListening(false);
    };

    try {
      recognition.start();
    } catch (err) {
      console.error('Failed to start recognition:', err);
      setIsListening(false);
    }
  };

  const resetForm = () => {
    setTaskForm({ title: "", description: "", priority: "media", status: columns[0], tags: "", dueDate: "" });
    setEditingTask(null);
  };

  const openEditDialog = (task: Task) => {
    setEditingTask(task);
    setTaskForm({
      title: task.title,
      description: task.description || "",
      priority: task.priority,
      status: task.status,
      tags: task.tags?.join(", ") || "",
      dueDate: toInputDateValue(task.dueDate),
    });
    setIsDialogOpen(true);
  };

  const handleDeleteTask = (taskId: string) => {
    // Optimistic Delete
    setTasks(prev => prev.filter(t => t.id !== taskId));
    deleteTask(firestore, user.uid, taskId);
    toast({ title: "Nodo Purgado", variant: "warning" });
  };

  const handleAddColumn = () => {
    if (newColumnName.trim() && !columns.includes(newColumnName.trim())) {
      setColumns([...columns, newColumnName.trim()]);
      setNewColumnName("");
    }
  };

  const handleRemoveColumn = (col: string) => {
    if (tasks?.some((t) => t.status === col)) {
      toast({ variant: "warning", title: "Ocupado", description: "Estado con tareas activas." });
      return;
    }
    setColumns(columns.filter((c) => c !== col));
  };

  const toggleTaskSelection = (taskId: string) => {
    setSelectedTaskIds((prev) => {
      const next = new Set(prev);
      if (next.has(taskId)) {
        next.delete(taskId);
      } else {
        next.add(taskId);
      }
      return next;
    });
  };

  const selectAllVisibleTasks = () => {
    setSelectedTaskIds(new Set(filteredTasks.map((task) => task.id)));
  };

  const clearSelectedTasks = () => {
    setSelectedTaskIds(new Set());
  };



  const undoLastBulkChange = () => {
    if (!user || !firestore) return;
    const snapshot = bulkUndoRef.current;
    if (!snapshot) return;

    const beforeById = snapshot.beforeById;

    setTasks((prev) =>
      prev.map((task) => {
        const restored = beforeById.get(task.id);
        return restored ? restored : task;
      })
    );

    beforeById.forEach((task, taskId) => {
      void persistTaskUpdate(taskId, toTaskUpdatePayload(task), { notifyOnQueue: false });
    });

    clearBulkUndo();
    toast({ variant: "success", title: "Cambios revertidos", description: "Se restauró la selección masiva." });
  };

  const registerBulkUndo = (beforeById: Map<string, Task>, afterById: Map<string, Task>, label: string) => {
    clearBulkUndo();
    bulkUndoRef.current = { beforeById, afterById };
    bulkUndoTimeoutRef.current = setTimeout(() => {
      bulkUndoRef.current = null;
      bulkUndoTimeoutRef.current = null;
    }, BULK_UNDO_WINDOW_MS);

    toast({
      variant: "info",
      title: label,
      description: `Puedes deshacer durante ${BULK_UNDO_WINDOW_MS / 1000}s.`,
      action: (
        <ToastAction altText="Deshacer cambios masivos" onClick={undoLastBulkChange}>
          Deshacer
        </ToastAction>
      ),
    });
  };



  const applyBulkTransform = (successLabel: string, transform: (task: Task) => Task) => {
    if (!user || !firestore || selectedTaskIds.size === 0) return;

    const selectedIds = new Set(selectedTaskIds);
    const beforeById = new Map<string, Task>();
    const afterById = new Map<string, Task>();

    setTasks((prev) =>
      prev.map((task) => {
        if (!selectedIds.has(task.id)) return task;
        const before = { ...task };
        const after = transform(task);
        beforeById.set(task.id, before);
        afterById.set(task.id, after);
        return after;
      })
    );

    afterById.forEach((task, taskId) => {
      void persistTaskUpdate(taskId, toTaskUpdatePayload(task), { notifyOnQueue: false });
    });

    registerBulkUndo(beforeById, afterById, successLabel);
    setSelectedTaskIds(new Set());
  };

  const updateSelectedTasks = (data: Record<string, unknown>, successLabel: string) => {
    applyBulkTransform(successLabel, (task) => ({ ...task, ...data }));
  };



  const updateSelectedTaskPriority = (priority: Priority) => {
    applyBulkTransform(`Prioridad cambiada a ${priority}`, (task) => ({ ...task, priority }));
  };

  const updateSelectedTaskStatus = (status: string) => {
    applyBulkTransform(`Estado cambiado a ${status}`, (task) => ({ ...task, status }));
  };

  const updateSelectedTaskTags = (mode: "add" | "remove") => {
    if (!user || !firestore || selectedTaskIds.size === 0) return;

    const requestedTags = parseTagInput(bulkTagInput);
    if (requestedTags.length === 0) {
      toast({ variant: "warning", title: "Sin etiquetas", description: "Ingresa una o más etiquetas separadas por coma." });
      return;
    }

    const selectedIds = new Set(selectedTaskIds);
    const nextTagsById = new Map<string, string[]>();

    tasks.forEach((task) => {
      if (!selectedIds.has(task.id)) return;

      const currentTags = new Set((task.tags || []).map(normalizeTag));

      if (mode === "add") {
        requestedTags.forEach((tag) => {
          if (currentTags.size < MAX_TAGS_PER_TASK) {
            currentTags.add(tag);
          }
        });
      } else {
        requestedTags.forEach((tag) => currentTags.delete(tag));
      }

      nextTagsById.set(task.id, Array.from(currentTags));
    });

    applyBulkTransform(mode === "add" ? "Etiquetas agregadas" : "Etiquetas eliminadas", (task) => {
      const nextTags = nextTagsById.get(task.id);
      return nextTags ? { ...task, tags: nextTags } : task;
    });

    setBulkTagInput("");
  };

  function handleDragStart(event: DragStartEvent) {
    const task = tasks?.find((t) => t.id === event.active.id);
    if (task) {
      dragOriginStatusRef.current = task.status;
      dragActiveTaskIdRef.current = task.id;
      setActiveTask(task);
    }
  }



  function handleDragOver(event: DragOverEvent) {
    const { active, over } = event;
    if (!over) return;

    const activeId = active.id;
    const overId = over.id;

    // Encontrar la tarea activa en el estado local
    const activeTaskIndex = tasks.findIndex((t) => t.id === activeId);
    if (activeTaskIndex === -1) return;

    // Obtener el estado destino de forma robusta
    const overData = over.data.current;
    let overStatus: string | undefined;

    if (overData?.type === 'Column') {
      overStatus = overData.status;
    } else if (overData?.type === 'Task') {
      overStatus = overData.task.status;
    } else if (columns.includes(overId as string)) {
      overStatus = overId as string;
    }

    if (overStatus && tasks[activeTaskIndex].status !== overStatus) {
      setTasks((prev) => {
        const newTasks = [...prev];
        newTasks[activeTaskIndex] = { ...newTasks[activeTaskIndex], status: overStatus };
        return newTasks;
      });
    }
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    const originalStatus = dragOriginStatusRef.current;
    dragOriginStatusRef.current = null;
    dragActiveTaskIdRef.current = null;
    setActiveTask(null);

    if (!over) {
      if (originalStatus) {
        setTasks((prev) => prev.map((task) => (task.id === active.id ? { ...task, status: originalStatus } : task)));
      }
      return;
    }

    const overId = over.id;
    const overData = over.data.current as
      | {
          type?: string;
          status?: string;
          task?: Task;
          sortable?: { containerId?: string };
        }
      | undefined;
    let overStatus: string | undefined;

    if (overData?.type === 'Column') {
      overStatus = overData.status;
    } else if (overData?.type === 'Task') {
      overStatus = overData.task?.status;
    } else if (columns.includes(overId as string)) {
      overStatus = overId as string;
    } else if (overData?.sortable?.containerId && columns.includes(overData.sortable.containerId)) {
      overStatus = overData.sortable.containerId;
    }

    if (!overStatus) {
      if (originalStatus) {
        setTasks((prev) => prev.map((task) => (task.id === active.id ? { ...task, status: originalStatus } : task)));
      }
      return;
    }

    if (originalStatus && overStatus !== originalStatus && user && firestore) {
      void persistTaskUpdate(active.id as string, { status: overStatus });
      toast({ 
        title: "Nodo Sincronizado", 
        description: `Estado ${overStatus} persistido.`,
        variant: "success" 
      });
      return;
    }

    if (originalStatus) {
      setTasks((prev) => prev.map((task) => (task.id === active.id ? { ...task, status: originalStatus } : task)));
    }
  }

  return (
    <div className="space-y-6 pb-24">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <h2 className="text-2xl md:text-4xl font-black tracking-tighter uppercase">
              Kanban <span className="text-primary italic glow-text">{context}</span>
            </h2>
            <Badge variant="outline" className="rounded-full border-primary/20 text-primary bg-primary/5 px-2 h-5 font-black text-[11px] font-data">
              {totalTasks} TAREAS
            </Badge>
            <div className={cn(
              "flex items-center gap-1.5 px-2 h-5 rounded-full border text-[8px] font-black tracking-widest transition-all duration-500",
              isDataFromCache 
                ? "bg-amber-500/10 border-amber-500/20 text-amber-500/70"
                : "bg-primary/10 border-primary/20 text-primary animate-pulse"
            )}>
              <span className={cn("w-1 h-1 rounded-full", isDataFromCache ? "bg-amber-500" : "bg-primary")} />
              {isDataFromCache ? "CACHED" : "LIVE"}
            </div>
            {pendingSyncCount > 0 && (
              <Badge variant="outline" className="rounded-full border-yellow-500/30 text-yellow-300 bg-yellow-500/10 px-2 h-5 font-black text-[10px] font-data">
                {pendingSyncCount} PENDIENTES
              </Badge>
            )}
          </div>
          <p className="text-[9px] text-muted-foreground uppercase font-black tracking-[0.4em] flex items-center gap-3">
            <Database className="w-3 h-3 text-primary/40" /> {columns.length} ESTADOS • {totalTasks} NODOS ACTIVOS
            {lastSyncAttemptAt && (
              <span className="text-[9px] font-data tracking-normal normal-case text-muted-foreground/70">
                Ult. sync: {format(new Date(lastSyncAttemptAt), "HH:mm:ss")}
              </span>
            )}
            {isSyncingPending && (
              <span className="text-[9px] font-data tracking-normal normal-case text-amber-500 animate-pulse">
                sincronizando...
              </span>
            )}
          </p>
        </div>

        <div className="flex items-center gap-2 w-full md:w-auto">
          {/* Mobile Column Navigator */}
          <div className="flex md:hidden overflow-x-auto scrollbar-hide gap-1 bg-muted/30 p-1 rounded-xl border border-border w-full">
            {columns.map((col) => {
              const count = tasksByStatus.get(col)?.length || 0;
              return (
                <button
                  key={col}
                  onClick={() => {
                    const el = document.getElementById(col);
                    el?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
                  }}
                  className="flex-shrink-0 px-4 py-2 rounded-lg text-[9px] font-black uppercase tracking-widest whitespace-nowrap bg-muted/40 border border-border active:bg-primary/20 active:text-primary transition-all"
                >
                  {col} <span className="opacity-40 ml-1">({count})</span>
                </button>
              );
            })}
          </div>

          <OutlineButton onClick={() => setIsManagingColumns(!isManagingColumns)} className="hidden md:flex">
            <Settings2 className="w-4 h-4 mr-2 text-primary/40" />
            <span className="text-[9px] font-black uppercase tracking-widest">Config</span>
          </OutlineButton>

          {pendingSyncCount > 0 && (
            <Button
              variant="outline"
              disabled={isSyncingPending}
              onClick={() => void flushPendingTaskUpdates({ silent: false })}
              className="h-10 rounded-lg border-yellow-500/30 bg-yellow-500/10 text-[10px] font-black uppercase tracking-widest text-yellow-300 hover:bg-yellow-500/20"
            >
              {isSyncingPending ? "Sincronizando" : "Sincronizar"}
            </Button>
          )}

          <Dialog open={isDialogOpen} onOpenChange={(open) => { if (!open) resetForm(); setIsDialogOpen(open); }}>
            <DialogTrigger asChild>
              <TacticalButton className="flex-1 md:flex-none">
                <Plus className="w-4 h-4 mr-2" /> Inyectar
              </TacticalButton>
            </DialogTrigger>
            <DialogContent className="glass-card-elevated border-border bg-card/95 sm:max-w-[500px] sm:max-h-[92dvh] overflow-y-auto p-6 sm:p-5 md:p-8">
              <datalist id="task-tag-suggestions">
                {suggestedTags.map((tag) => (
                  <option key={tag} value={tag} />
                ))}
              </datalist>
              <DialogHeader>
                <DialogTitle className="text-2xl font-black tracking-tighter uppercase flex items-center gap-3">
                  <Layers className="w-6 h-6 text-primary" />
                  {editingTask ? "Modificar Nodo" : "Inyectar Nodo"}
                </DialogTitle>
              </DialogHeader>

              {editingTask ? (
                <>
                  <div className="space-y-4 py-4">
                    <div className="space-y-1.5">
                      <Label className="text-[9px] uppercase font-black text-primary tracking-widest">Nombre del Nodo</Label>
                      <Input value={taskForm.title} onChange={(e) => setTaskForm({ ...taskForm, title: e.target.value })} className="bg-white/[0.03] border-white/[0.08] h-11 rounded-lg" />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-[9px] uppercase font-black text-white/40 tracking-widest">Descripción</Label>
                      <Textarea value={taskForm.description} onChange={(e) => setTaskForm({ ...taskForm, description: e.target.value })} className="bg-white/[0.03] border-white/[0.08] min-h-[80px] rounded-lg" />
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div className="space-y-1.5">
                        <Label className="text-[9px] uppercase font-black tracking-widest">Prioridad</Label>
                        <Select value={taskForm.priority} onValueChange={(v: Priority) => setTaskForm({ ...taskForm, priority: v })}>
                          <SelectTrigger className="bg-muted/30 border-border h-11 rounded-lg"><SelectValue /></SelectTrigger>
                          <SelectContent className="bg-card border-border">
                            <SelectItem value="baja">BAJA</SelectItem>
                            <SelectItem value="media">MEDIA</SelectItem>
                            <SelectItem value="alta">ALTA</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-[9px] uppercase font-black tracking-widest">Estado</Label>
                        <Select value={taskForm.status} onValueChange={(v) => setTaskForm({ ...taskForm, status: v })}>
                          <SelectTrigger className="bg-white/[0.03] border-white/[0.08] h-11 rounded-lg"><SelectValue /></SelectTrigger>
                          <SelectContent className="bg-[#0a0a0a] border-white/[0.08]">
                            {columns.map((col) => (
                              <SelectItem key={col} value={col}>{col}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <div className="space-y-1.5 rounded-lg border border-white/[0.08] bg-white/[0.02] p-3">
                      <Label className="text-[9px] uppercase font-black tracking-widest text-primary">Etiquetas (Opcional)</Label>
                      <Input
                        value={taskForm.tags}
                        list="task-tag-suggestions"
                        onChange={(e) => setTaskForm({ ...taskForm, tags: e.target.value })}
                        placeholder="cliente, urgente, backend"
                        className="bg-white/[0.03] border-white/[0.08] h-11 rounded-lg"
                      />
                      <p className="text-[10px] text-white/45">Separa por comas. Máximo {MAX_TAGS_PER_TASK} etiquetas por tarea.</p>
                    </div>
                    <div className="space-y-1.5 rounded-lg border border-white/[0.08] bg-white/[0.02] p-3">
                      <Label className="text-[9px] uppercase font-black tracking-widest text-primary">Vencimiento (Opcional)</Label>
                      <Input
                        type="date"
                        value={taskForm.dueDate}
                        onChange={(e) => setTaskForm({ ...taskForm, dueDate: e.target.value })}
                        className="bg-white/[0.03] border-white/[0.08] h-11 rounded-lg text-white [color-scheme:dark]"
                      />
                      <p className="text-[10px] text-white/45">Si no eliges fecha, el nodo se crea sin vencimiento.</p>
                    </div>
                  </div>
                  <DialogFooter>
                    <TacticalButton onClick={handleSaveTask} disabled={isSaving} className="w-full">
                      {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : "Confirmar Operación"}
                    </TacticalButton>
                  </DialogFooter>
                </>
              ) : (
                <Tabs defaultValue="manual" className="w-full mt-2">
                  <TabsList className="grid w-full grid-cols-2 bg-muted/30 border border-border p-1 h-auto rounded-lg mb-4">
                    <TabsTrigger value="manual" className="data-[state=active]:bg-primary/20 data-[state=active]:text-primary rounded-md py-2 text-[10px] uppercase font-black tracking-widest transition-all">Manual</TabsTrigger>
                    <TabsTrigger value="ai" className="data-[state=active]:bg-purple-500/20 data-[state=active]:text-purple-400 rounded-md py-2 text-[10px] uppercase font-black tracking-widest transition-all flex items-center gap-2 justify-center">
                      <Sparkles className="w-3 h-3" /> Asistente IA
                    </TabsTrigger>
                  </TabsList>

                  <TabsContent value="manual" className="space-y-4 outline-none mt-0">
                    <div className="space-y-4">
                      <div className="space-y-1.5">
                        <Label className="text-[9px] uppercase font-black text-primary tracking-widest">Nombre del Nodo</Label>
                        <Input value={taskForm.title} onChange={(e) => setTaskForm({ ...taskForm, title: e.target.value })} className="bg-white/[0.03] border-white/[0.08] h-11 rounded-lg" />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-[9px] uppercase font-black text-white/40 tracking-widest">Descripción</Label>
                        <Textarea value={taskForm.description} onChange={(e) => setTaskForm({ ...taskForm, description: e.target.value })} className="bg-white/[0.03] border-white/[0.08] min-h-[80px] rounded-lg" />
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div className="space-y-1.5">
                          <Label className="text-[9px] uppercase font-black tracking-widest">Prioridad</Label>
                          <Select value={taskForm.priority} onValueChange={(v: Priority) => setTaskForm({ ...taskForm, priority: v })}>
                            <SelectTrigger className="bg-white/[0.03] border-white/[0.08] h-11 rounded-lg"><SelectValue /></SelectTrigger>
                            <SelectContent className="bg-[#0a0a0a] border-white/[0.08]">
                              <SelectItem value="baja">BAJA</SelectItem>
                              <SelectItem value="media">MEDIA</SelectItem>
                              <SelectItem value="alta">ALTA</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-1.5">
                          <Label className="text-[9px] uppercase font-black tracking-widest">Estado</Label>
                          <Select value={taskForm.status} onValueChange={(v) => setTaskForm({ ...taskForm, status: v })}>
                            <SelectTrigger className="bg-white/[0.03] border-white/[0.08] h-11 rounded-lg"><SelectValue /></SelectTrigger>
                            <SelectContent className="bg-[#0a0a0a] border-white/[0.08]">
                              {columns.map((col) => (
                                <SelectItem key={col} value={col}>{col}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                      <div className="space-y-1.5 rounded-lg border border-white/[0.08] bg-white/[0.02] p-3">
                        <Label className="text-[9px] uppercase font-black tracking-widest text-primary">Etiquetas (Opcional)</Label>
                        <Input
                          value={taskForm.tags}
                          list="task-tag-suggestions"
                          onChange={(e) => setTaskForm({ ...taskForm, tags: e.target.value })}
                          placeholder="cliente, urgente, backend"
                          className="bg-white/[0.03] border-white/[0.08] h-11 rounded-lg"
                        />
                        <p className="text-[10px] text-white/45">Separa por comas. Máximo {MAX_TAGS_PER_TASK} etiquetas por tarea.</p>
                      </div>
                      <div className="space-y-1.5 rounded-lg border border-white/[0.08] bg-white/[0.02] p-3">
                        <Label className="text-[9px] uppercase font-black tracking-widest text-primary">Vencimiento (Opcional)</Label>
                        <Input
                          type="date"
                          value={taskForm.dueDate}
                          onChange={(e) => setTaskForm({ ...taskForm, dueDate: e.target.value })}
                          className="bg-white/[0.03] border-white/[0.08] h-11 rounded-lg text-white [color-scheme:dark]"
                        />
                        <p className="text-[10px] text-white/45">Si no eliges fecha, el nodo se crea sin vencimiento.</p>
                      </div>
                    </div>
                    <DialogFooter className="mt-6">
                      <TacticalButton onClick={handleSaveTask} disabled={isSaving} className="w-full">
                        {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : "Confirmar Operación"}
                      </TacticalButton>
                    </DialogFooter>
                  </TabsContent>

                  <TabsContent value="ai" className="space-y-4 outline-none mt-0">
                    <div className="space-y-3">
                      <Label className="text-[9px] uppercase font-black text-purple-400 tracking-widest flex items-center gap-2">
                        <Sparkles className="w-3 h-3" /> Instrucciones Cuánticas
                      </Label>
                      <div className="relative">
                        <Textarea 
                          placeholder="Ej: Mañana tengo que enviar el reporte mensual y también ir a comprar el pan..."
                          value={aiPrompt}
                          onChange={(e) => setAiPrompt(e.target.value)}
                          className="bg-white/[0.03] border-white/[0.08] min-h-[160px] rounded-lg text-sm resize-none focus-visible:ring-purple-500/50 pr-12"
                        />
                        <button
                          onClick={handleStartListening}
                          className={cn(
                            "absolute right-3 bottom-3 p-2.5 rounded-full transition-all duration-300",
                            isListening 
                              ? "bg-red-500 text-white animate-pulse shadow-[0_0_15px_rgba(239,68,68,0.5)]" 
                              : "bg-purple-500/10 text-purple-400 hover:bg-purple-500/20"
                          )}
                        >
                          <Mic className={cn("w-4 h-4", isListening && "animate-bounce")} />
                        </button>
                      </div>
                      <p className="text-[10px] text-white/40 leading-relaxed">
                        Escribe tus ideas libremente. La IA analizará el texto, separará las tareas, priorizará y asignará etiquetas automáticamente, inyectándolas en la columna <span className="text-white font-bold">{columns[0]}</span>.
                      </p>
                    </div>
                    <DialogFooter className="mt-6">
                      <TacticalButton onClick={handleGenerateTasks} disabled={isGenerating || !aiPrompt.trim()} className="w-full bg-purple-500/10 text-purple-400 border-purple-500/30 hover:bg-purple-500/20 hover:text-purple-300">
                        {isGenerating ? (
                          <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Procesando con IA...</>
                        ) : (
                          <><Sparkles className="w-4 h-4 mr-2" /> Extraer e Inyectar</>
                        )}
                      </TacticalButton>
                    </DialogFooter>
                  </TabsContent>
                </Tabs>
              )}
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Metrics Overhaul */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: "Total", value: totalTasks, icon: Layers, color: "from-blue-500/20 to-transparent", textColor: "text-blue-400" },
          { label: "En Progreso", value: inProgressTasks, icon: Clock3, color: "from-primary/20 to-transparent", textColor: "text-primary" },
          { label: "Críticas", value: criticalTasks, icon: Flame, color: "from-red-500/20 to-transparent", textColor: "text-red-400" },
          { label: "Completadas", value: completedTasks, icon: CircleCheckBig, color: "from-emerald-500/20 to-transparent", textColor: "text-emerald-400" },
        ].map(({ label, value, icon: Icon, color, textColor }, i) => (
          <div key={i} className={cn("relative overflow-hidden glass-card p-5 group transition-all duration-500 hover:scale-[1.02] border-white/[0.05]")}>
            <div className={cn("absolute inset-0 bg-gradient-to-br opacity-30", color)} />
            <div className="relative flex items-center justify-between">
              <div className="space-y-1">
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground/50">{label}</p>
                <p className={cn("text-3xl font-black font-data tracking-tight", textColor)}>{value}</p>
              </div>
              <Icon className={cn("w-8 h-8 opacity-20 group-hover:opacity-40 transition-opacity", textColor)} />
            </div>
          </div>
        ))}
      </div>

      {/* Quantum Control Bar */}
      <div className="glass-card overflow-hidden border-border bg-card/5">
        <Tabs defaultValue="filters" className="w-full">
          <div className="flex flex-col md:flex-row md:items-center justify-between border-b border-border bg-card/10 px-4">
            <TabsList className="bg-transparent h-12 gap-6 p-0 border-none">
              <TabsTrigger value="filters" className="data-[state=active]:bg-transparent data-[state=active]:text-primary data-[state=active]:shadow-[0_2px_0_0_#39FF14] rounded-none px-0 text-[10px] uppercase font-black tracking-widest transition-all gap-2 h-full">
                <Settings2 className="w-3.5 h-3.5" /> Filtros
              </TabsTrigger>
              <TabsTrigger value="bulk" className="data-[state=active]:bg-transparent data-[state=active]:text-primary data-[state=active]:shadow-[0_2px_0_0_#39FF14] rounded-none px-0 text-[10px] uppercase font-black tracking-widest transition-all gap-2 h-full">
                <Layers className="w-3.5 h-3.5" /> Acciones {selectedTaskIds.size > 0 && <Badge className="h-4 px-1.5 min-w-[1.2rem] bg-primary text-black text-[9px] font-black">{selectedTaskIds.size}</Badge>}
              </TabsTrigger>
              <TabsTrigger value="maintenance" className="data-[state=active]:bg-transparent data-[state=active]:text-primary data-[state=active]:shadow-[0_2px_0_0_#39FF14] rounded-none px-0 text-[10px] uppercase font-black tracking-widest transition-all gap-2 h-full">
                <RefreshCcw className="w-3.5 h-3.5" /> Limpieza
              </TabsTrigger>
            </TabsList>
            
            <div className="flex items-center gap-4 h-12 md:h-auto py-2 md:py-0">
              {hasActiveFilters && (
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={() => setFilters({ query: "", priority: "all", status: "all", tag: "all", due: "all" })}
                  className="h-8 text-[9px] font-black uppercase tracking-widest text-red-400/70 hover:text-red-400 hover:bg-red-400/10"
                >
                  Limpiar Filtros
                </Button>
              )}
              <Badge variant="outline" className="rounded-full border-border text-muted-foreground/60 bg-muted/30 px-3 h-6 font-black text-[10px] font-data">
                {filteredTasks.length}/{totalTasks} NODOS
              </Badge>
            </div>
          </div>

          <div className="p-5">
            <TabsContent value="filters" className="mt-0 outline-none">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
                <div className="relative col-span-1 sm:col-span-2">
                  <Input
                    value={filters.query}
                    onChange={(e) => setFilters((prev) => ({ ...prev, query: e.target.value }))}
                    placeholder="Filtrar por título, descripción o etiqueta..."
                    className="bg-muted/30 border-border h-11 rounded-xl pl-4 text-sm"
                  />
                </div>
                <Select value={filters.priority} onValueChange={(value) => setFilters((prev) => ({ ...prev, priority: value }))}>
                  <SelectTrigger className="bg-muted/30 border-border h-11 rounded-xl text-[10px] uppercase font-black tracking-wider">
                    <SelectValue placeholder="Prioridad" />
                  </SelectTrigger>
                  <SelectContent className="bg-card border-border">
                    <SelectItem value="all">Toda prioridad</SelectItem>
                    <SelectItem value="alta">Alta</SelectItem>
                    <SelectItem value="media">Media</SelectItem>
                    <SelectItem value="baja">Baja</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={filters.tag} onValueChange={(value) => setFilters((prev) => ({ ...prev, tag: value }))}>
                  <SelectTrigger className="bg-white/[0.03] border-white/[0.08] h-11 rounded-xl text-[10px] uppercase font-black tracking-wider">
                    <SelectValue placeholder="Etiqueta" />
                  </SelectTrigger>
                  <SelectContent className="bg-[#0a0a0a] border-white/[0.08]">
                    <SelectItem value="all">Todas las etiquetas</SelectItem>
                    {suggestedTags.map((tag) => (
                      <SelectItem key={`filter-tag-${tag}`} value={tag}>{tag}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={filters.due} onValueChange={(value) => setFilters((prev) => ({ ...prev, due: value }))}>
                  <SelectTrigger className="bg-muted/30 border-border h-11 rounded-xl text-[10px] uppercase font-black tracking-wider">
                    <SelectValue placeholder="Vencimiento" />
                  </SelectTrigger>
                  <SelectContent className="bg-card border-border">
                    <SelectItem value="all">Todos</SelectItem>
                    <SelectItem value="today">Hoy</SelectItem>
                    <SelectItem value="next7">Próximos 7 días</SelectItem>
                    <SelectItem value="overdue">Vencidas</SelectItem>
                    <SelectItem value="none">Sin fecha</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </TabsContent>

            <TabsContent value="bulk" className="mt-0 outline-none">
              <div className="flex flex-col lg:flex-row gap-6">
                <div className="flex-1 space-y-4">
                  <div className="flex items-center justify-between">
                    <p className="text-[10px] uppercase font-black tracking-widest text-muted-foreground">Modificadores de Lote</p>
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" onClick={selectAllVisibleTasks} className="h-7 text-[9px] font-black uppercase rounded-lg border-border hover:bg-primary/10 hover:text-primary">Visibles</Button>
                      <Button variant="outline" size="sm" onClick={clearSelectedTasks} disabled={!hasSelection} className="h-7 text-[9px] font-black uppercase rounded-lg border-border hover:bg-red-400/10 hover:text-red-400">Limpiar</Button>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label className="text-[9px] uppercase font-black text-muted-foreground/30">Estado</Label>
                      <div className="flex flex-wrap gap-1.5">
                        {columns.map((status) => (
                          <Button
                            key={`bulk-status-${status}`}
                            variant="outline"
                            disabled={!hasSelection}
                            onClick={() => updateSelectedTasks({ status }, `Estado masivo: ${status}`)}
                            className="h-8 px-3 rounded-lg border-white/[0.08] bg-white/[0.02] text-[9px] font-black uppercase tracking-widest hover:border-primary/40 hover:text-primary"
                          >
                            {status}
                          </Button>
                        ))}
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label className="text-[9px] uppercase font-black text-white/25">Prioridad</Label>
                      <div className="flex flex-wrap gap-1.5">
                        {(["alta", "media", "baja"] as Priority[]).map((p) => (
                          <Button
                            key={`bulk-p-${p}`}
                            variant="outline"
                            disabled={!hasSelection}
                            onClick={() => updateSelectedTasks({ priority: p }, `Prioridad masiva: ${p}`)}
                            className="h-8 px-3 rounded-lg border-border bg-muted/40 text-[9px] font-black uppercase tracking-widest hover:border-primary/40 hover:text-primary"
                          >
                            {p}
                          </Button>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="w-full lg:w-80 space-y-4 border-t lg:border-t-0 lg:border-l border-border pt-4 lg:pt-0 lg:pl-6">
                  <p className="text-[10px] uppercase font-black tracking-widest text-muted-foreground/40">Etiquetas en Lote</p>
                  <div className="space-y-3">
                    <Input
                      value={bulkTagInput}
                      onChange={(e) => setBulkTagInput(e.target.value)}
                      placeholder="tag1, tag2..."
                      className="bg-muted/40 border-border h-10 rounded-xl text-sm"
                    />
                    <div className="flex gap-2">
                      <Button 
                        onClick={() => updateSelectedTaskTags("add")} 
                        disabled={!hasSelection || !bulkTagInput.trim()}
                        className="flex-1 h-9 rounded-xl bg-primary/10 text-primary border border-primary/20 text-[10px] font-black uppercase"
                      >
                        Agregar
                      </Button>
                      <Button 
                        onClick={() => updateSelectedTaskTags("remove")} 
                        disabled={!hasSelection || !bulkTagInput.trim()}
                        className="flex-1 h-9 rounded-xl bg-red-400/10 text-red-400 border border-red-400/20 text-[10px] font-black uppercase"
                      >
                        Quitar
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="maintenance" className="mt-0 outline-none">
              <div className="flex flex-col md:flex-row items-center justify-between gap-6 py-2">
                <div className="flex-1 space-y-2">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-red-500/10 flex items-center justify-center border border-red-500/20">
                      <Trash2 className="w-5 h-5 text-red-400" />
                    </div>
                    <div>
                      <p className="text-sm font-black uppercase tracking-tight">Purgar Tareas Completadas</p>
                      <p className="text-[11px] text-muted-foreground">Elimina instantáneamente todos los nodos en la columna "Hecho".</p>
                    </div>
                  </div>
                </div>
                
                <div className="flex flex-col sm:flex-row items-center gap-4 w-full md:w-auto">
                  <div className="text-center md:text-right">
                    <p className="text-[10px] font-black uppercase text-white/30 tracking-widest">Para limpieza</p>
                    <p className="text-lg font-black font-data text-yellow-400">{cleanupEligibleCount} NODOS</p>
                  </div>
                  <Button
                    variant="destructive"
                    disabled={isRunningCleanup || completedTasks === 0}
                    onClick={() => runCompletedTasksCleanup({ mode: "manual", force: true })}
                    className="w-full sm:w-auto h-12 px-8 rounded-2xl bg-red-500/10 text-red-400 border border-red-500/20 hover:bg-red-500 hover:text-white transition-all duration-300 font-black uppercase tracking-widest text-[10px]"
                  >
                    {isRunningCleanup ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Trash2 className="w-4 h-4 mr-2" />}
                    Ejecutar Purga Manual
                  </Button>
                </div>
              </div>
              <div className="mt-6 pt-4 border-t border-border flex items-center justify-between">
                <div className="flex items-center gap-4 text-[10px] font-black uppercase text-muted-foreground tracking-widest">
                  <span>Auto-limpieza: <span className="text-primary">{autoDeleteDoneDays === "disabled" ? "OFF" : `${autoDeleteDoneDays} DÍAS`}</span></span>
                  {lastCleanupAt && <span>Última: {format(new Date(lastCleanupAt), "dd/MM HH:mm")}</span>}
                </div>
                <Link href="/settings" className="text-[9px] font-black uppercase text-muted-foreground hover:text-primary transition-colors">Configurar Frecuencia →</Link>
              </div>
            </TabsContent>
          </div>
        </Tabs>
      </div>

      {hasActiveFilters && filteredTasks.length === 0 && (
        <div className="glass-card p-4 border-white/[0.08] flex flex-col md:flex-row md:items-center justify-between gap-3">
          <p className="text-[11px] text-white/65">
            No se encontraron tareas con los filtros actuales. Ajusta criterios o limpia filtros para volver a ver todo el tablero.
          </p>
          <Button
            variant="outline"
            onClick={() => setFilters({ query: "", priority: "all", status: "all", tag: "all", due: "all" })}
            className="h-9 rounded-lg border-border bg-muted/30 text-[10px] font-black uppercase tracking-widest"
          >
            Limpiar filtros
          </Button>
        </div>
      )}

      {/* Column Management */}
      <AnimatePresence>
        {isManagingColumns && (
          <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="glass-card p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-[9px] font-black uppercase tracking-[0.4em] text-primary">Estados de Red</h3>
              <Button variant="ghost" size="icon" onClick={() => setIsManagingColumns(false)} className="rounded-lg h-8 w-8"><X className="w-4 h-4" /></Button>
            </div>
            <div className="flex flex-wrap gap-2">
              {columns.map((col) => (
                <Badge key={col} variant="secondary" className="pl-3 pr-1 py-1 rounded-lg bg-muted/30 border-border gap-2">
                  <span className="font-black uppercase tracking-widest text-[11px]">{col}</span>
                  <button onClick={() => handleRemoveColumn(col)} className="text-muted-foreground hover:text-red-500"><X className="w-3 h-3" /></button>
                </Badge>
              ))}
              <div className="flex items-center gap-2">
                <Input placeholder="Nuevo..." value={newColumnName} onChange={(e) => setNewColumnName(e.target.value)} className="bg-muted/30 border-border h-8 w-32 rounded-lg text-[11px] font-black uppercase" />
                <Button size="icon" onClick={handleAddColumn} className="h-8 w-8 rounded-lg bg-primary text-black"><Plus className="w-3 h-3" /></Button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Kanban Board Container */}
      <div className="space-y-4">
        {/* Top Scrollbar (Desktop Only) */}
        <div 
          ref={topScrollRef}
          className="hidden md:block overflow-x-auto h-2 bg-muted/20 border-y border-border rounded-full mx-auto max-w-[80%] transition-all hover:bg-muted/40"
          onScroll={() => {
            if (isSyncingTop.current) {
              isSyncingTop.current = false;
              return;
            }
            if (boardRef.current && topScrollRef.current) {
              const topMax = topScrollRef.current.scrollWidth - topScrollRef.current.clientWidth;
              const boardMax = boardRef.current.scrollWidth - boardRef.current.clientWidth;
              
              if (topMax > 0 && boardMax > 0) {
                const percentage = topScrollRef.current.scrollLeft / topMax;
                isSyncingBoard.current = true;
                boardRef.current.scrollLeft = percentage * boardMax;
              }
            }
          }}
        >
          <div style={{ width: `${boardScrollWidth || (columns.length * 400)}px` }} className="h-full" />
        </div>

        <DndContext
          sensors={sensors}
          collisionDetection={collisionDetectionStrategy}
          onDragStart={handleDragStart}
          onDragOver={handleDragOver}
          onDragCancel={() => {
            const originalStatus = dragOriginStatusRef.current;
            const activeTaskId = dragActiveTaskIdRef.current;
            dragOriginStatusRef.current = null;
            dragActiveTaskIdRef.current = null;
            setActiveTask(null);
            if (!originalStatus || !activeTaskId) return;
            setTasks((prev) => prev.map((task) => (task.id === activeTaskId ? { ...task, status: originalStatus } : task)));
          }}
          onDragEnd={handleDragEnd}
        >
          <div className="glass-card-elevated p-3 md:p-6 border-border relative">
            <div 
              ref={boardRef}
              id="kanban-board"
              className="flex gap-6 md:gap-10 overflow-x-auto pb-4 scrollbar-hide min-h-[65vh] -mx-2 px-2 md:mx-0 snap-x snap-mandatory md:snap-none cursor-grab active:cursor-grabbing"
              onScroll={() => {
                if (isSyncingBoard.current) {
                  isSyncingBoard.current = false;
                  return;
                }
                if (boardRef.current && topScrollRef.current) {
                  const topMax = topScrollRef.current.scrollWidth - topScrollRef.current.clientWidth;
                  const boardMax = boardRef.current.scrollWidth - boardRef.current.clientWidth;
                  
                  if (topMax > 0 && boardMax > 0) {
                    const percentage = boardRef.current.scrollLeft / boardMax;
                    isSyncingTop.current = true;
                    topScrollRef.current.scrollLeft = percentage * topMax;
                  }
                }
              }}
            >
              <div className="flex gap-6 md:gap-10 min-w-full">
                {isTasksLoading ? (
                  [...Array(3)].map((_, i) => (
                    <div key={i} className="flex-shrink-0 w-[85vw] sm:w-80 md:w-96 space-y-4">
                      <Skeleton className="h-6 w-24 bg-muted/30" />
                      <Skeleton className="h-[400px] w-full rounded-2xl bg-muted/30" />
                    </div>
                  ))
                ) : (
                  columns.map((status) => (
                    <KanbanColumn
                      key={status}
                      status={status}
                      tasks={tasksByStatus.get(status) || []}
                      onDelete={handleDeleteTask}
                      onEdit={openEditDialog}
                      selectedTaskIds={selectedTaskIds}
                      onToggleTaskSelection={toggleTaskSelection}
                      disableDrag={hasSelection}
                      pendingTaskIds={pendingTaskIds}
                    />
                  ))
                )}
              </div>
            </div>

            {/* Mobile Navigation Arrows (Visual hint) */}
            <div className="md:hidden absolute inset-y-0 left-0 w-8 pointer-events-none bg-gradient-to-r from-background/40 to-transparent" />
            <div className="md:hidden absolute inset-y-0 right-0 w-8 pointer-events-none bg-gradient-to-l from-background/40 to-transparent" />
          </div>

          <DragOverlay>
            {activeTask ? (
              <div className="w-[300px] rotate-3 scale-105 pointer-events-none opacity-90">
                <TaskCard task={activeTask} onDelete={() => {}} onEdit={() => {}} isOverlay />
              </div>
            ) : null}
          </DragOverlay>
        </DndContext>
      </div>

      {/* Floating Action Button (Mobile) */}
      <div className="fixed bottom-24 right-6 z-40 md:hidden flex flex-col gap-3">
        <button
          onClick={() => setIsManagingColumns(!isManagingColumns)}
          className="w-12 h-12 rounded-2xl flex items-center justify-center bg-[#0a0a0a]/80 backdrop-blur-xl border border-white/10 shadow-2xl active:scale-90 transition-transform"
        >
          <Settings2 className="w-5 h-5 text-primary/60" />
        </button>
        <button
          onClick={() => setIsDialogOpen(true)}
          className="w-14 h-14 rounded-2xl flex items-center justify-center bg-primary text-black shadow-[0_0_20px_rgba(57,255,20,0.3)] active:scale-90 transition-transform"
        >
          <Plus className="w-7 h-7" />
        </button>
      </div>
    </div>
  );
}
