"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useAppContextStore } from "@/lib/store";
import { Plus, Settings2, X, Loader2, Layers, Database, CircleCheckBig, Clock3, Flame } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useFirestore, useUser, useMemoFirebase } from "@/firebase/provider";
import { useCollection } from "@/firebase/firestore/use-collection";
import { useRouter } from "next/navigation";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { z } from "zod";
import { format, isValid, parseISO } from "date-fns";
import { toast } from "@/hooks/use-toast";
import { TacticalButton, OutlineButton } from "@/components/atoms";
import { TaskCard } from "@/components/molecules";
import { KanbanColumn } from "@/components/organisms";
import { buildTasksQuery, createTask, updateTask, deleteTask } from "@/services/task-service";
import type { Task, Priority, AppContext } from "@/types/task";

import {
  DndContext,
  closestCorners,
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

function getTodayInputDate() {
  return format(new Date(), "yyyy-MM-dd");
}

function toInputDateValue(value: string | Date | undefined) {
  if (!value) return "";
  const parsed = typeof value === "string" ? parseISO(value) : value;
  return isValid(parsed) ? format(parsed, "yyyy-MM-dd") : "";
}

export default function KanbanPage() {
  const { context, kanbanColumns: columns, setKanbanColumns: setColumns } = useAppContextStore();
  const { user, isUserLoading } = useUser();
  const firestore = useFirestore();
  const router = useRouter();

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

  const tasksQuery = useMemoFirebase(() => {
    if (!firestore || !user) return null;
    return buildTasksQuery(firestore, user.uid, context);
  }, [firestore, user, context]);

  const { data: tasks, isLoading: isTasksLoading } = useCollection<Task>(tasksQuery);
  const totalTasks = tasks?.length || 0;
  const completedTasks = tasks?.filter((t) => t.status === "Hecho").length || 0;
  const inProgressTasks = tasks?.filter((t) => t.status === "Haciendo").length || 0;
  const criticalTasks = tasks?.filter((t) => t.priority === "alta" && t.status !== "Hecho").length || 0;

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

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
    if (!isUserLoading && !user) router.push("/login");
  }, [user, isUserLoading, router]);

  if (isUserLoading || !user) return null;

  const handleSaveTask = () => {
    setIsSaving(true);
    const rawData = {
      title: taskForm.title,
      description: taskForm.description,
      priority: taskForm.priority,
      status: taskForm.status || columns[0],
      tags: taskForm.tags
        .split(",")
        .map((t) => t.trim())
        .filter((t) => t !== ""),
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
      updateTask(firestore, user.uid, editingTask.id, taskData);
      toast({ variant: "success", title: "Actualizado" });
    } else {
      createTask(firestore, user.uid, taskData);
      toast({ variant: "success", title: "Inyectado" });
    }

    resetForm();
    setIsDialogOpen(false);
    setIsSaving(false);
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

  function handleDragStart(event: DragStartEvent) {
    const task = tasks?.find((t) => t.id === event.active.id);
    if (task) setActiveTask(task);
  }

  function handleDragOver(_event: DragOverEvent) {}

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    setActiveTask(null);
    if (!over) return;

    const overStatus = columns.includes(over.id as string)
      ? (over.id as string)
      : tasks?.find((t) => t.id === over.id)?.status;

    if (overStatus && active.data.current?.task.status !== overStatus && user) {
      updateTask(firestore, user.uid, active.id as string, { status: overStatus });
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
          </div>
          <p className="text-[9px] text-muted-foreground uppercase font-black tracking-[0.4em] flex items-center gap-3">
            <Database className="w-3 h-3 text-primary/40" /> Arrastra tareas entre estados para avanzar el flujo
          </p>
        </div>

        <div className="flex items-center gap-2 w-full md:w-auto">
          <OutlineButton onClick={() => setIsManagingColumns(!isManagingColumns)}>
            <Settings2 className="w-4 h-4 mr-2 text-primary/40" />
            <span className="text-[9px] font-black uppercase tracking-widest">Config</span>
          </OutlineButton>

          <Dialog open={isDialogOpen} onOpenChange={(open) => { if (!open) resetForm(); setIsDialogOpen(open); }}>
            <DialogTrigger asChild>
              <TacticalButton className="flex-1 md:flex-none">
                <Plus className="w-4 h-4 mr-2" /> Inyectar
              </TacticalButton>
            </DialogTrigger>
            <DialogContent className="glass-card-elevated border-white/[0.08] bg-[#050505]/95 sm:max-w-[500px] max-h-[92dvh] overflow-y-auto p-6 sm:p-5 md:p-8">
              <DialogHeader>
                <DialogTitle className="text-2xl font-black tracking-tighter uppercase flex items-center gap-3">
                  <Layers className="w-6 h-6 text-primary" />
                  {editingTask ? "Modificar" : "Inyectar"}
                </DialogTitle>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-1.5">
                  <Label className="text-[9px] uppercase font-black text-primary tracking-widest">Nombre del Nodo</Label>
                  <Input value={taskForm.title} onChange={(e) => setTaskForm({ ...taskForm, title: e.target.value })} className="bg-white/[0.03] border-white/[0.08] h-11 rounded-lg" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-[9px] uppercase font-black text-white/40 tracking-widest">Descripción</Label>
                  <Textarea value={taskForm.description} onChange={(e) => setTaskForm({ ...taskForm, description: e.target.value })} className="bg-white/[0.03] border-white/[0.08] min-h-[80px] rounded-lg" />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
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
                  <div className="space-y-1.5">
                    <Label className="text-[9px] uppercase font-black tracking-widest">Vencimiento (Opcional)</Label>
                    <Input
                      type="date"
                      value={taskForm.dueDate}
                      onChange={(e) => setTaskForm({ ...taskForm, dueDate: e.target.value })}
                      min={getTodayInputDate()}
                      className="bg-white/[0.03] border-white/[0.08] h-11 rounded-lg text-white [color-scheme:dark]"
                    />
                    <p className="text-[10px] text-white/45">Si no eliges fecha, el nodo se crea sin vencimiento.</p>
                  </div>
                </div>
              </div>
              <DialogFooter>
                <TacticalButton onClick={handleSaveTask} disabled={isSaving} className="w-full">
                  {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : "Confirmar Operación"}
                </TacticalButton>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="glass-card p-3 md:p-4">
          <p className="text-[9px] uppercase tracking-[0.25em] text-white/40 font-black">Total</p>
          <p className="text-xl md:text-2xl font-black mt-1 font-data">{totalTasks}</p>
        </div>
        <div className="glass-card p-3 md:p-4">
          <p className="text-[9px] uppercase tracking-[0.25em] text-white/40 font-black">En Progreso</p>
          <p className="text-xl md:text-2xl font-black mt-1 font-data flex items-center gap-2">
            <Clock3 className="w-4 h-4 text-primary" /> {inProgressTasks}
          </p>
        </div>
        <div className="glass-card p-3 md:p-4">
          <p className="text-[9px] uppercase tracking-[0.25em] text-white/40 font-black">Críticas</p>
          <p className="text-xl md:text-2xl font-black mt-1 font-data flex items-center gap-2 text-red-400">
            <Flame className="w-4 h-4" /> {criticalTasks}
          </p>
        </div>
        <div className="glass-card p-3 md:p-4">
          <p className="text-[9px] uppercase tracking-[0.25em] text-white/40 font-black">Completadas</p>
          <p className="text-xl md:text-2xl font-black mt-1 font-data flex items-center gap-2 text-primary">
            <CircleCheckBig className="w-4 h-4" /> {completedTasks}
          </p>
        </div>
      </div>

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
                <Badge key={col} variant="secondary" className="pl-3 pr-1 py-1 rounded-lg bg-white/[0.03] border-white/[0.06] gap-2">
                  <span className="font-black uppercase tracking-widest text-[11px]">{col}</span>
                  <button onClick={() => handleRemoveColumn(col)} className="text-muted-foreground hover:text-red-500"><X className="w-3 h-3" /></button>
                </Badge>
              ))}
              <div className="flex items-center gap-2">
                <Input placeholder="Nuevo..." value={newColumnName} onChange={(e) => setNewColumnName(e.target.value)} className="bg-white/[0.03] border-white/[0.08] h-8 w-32 rounded-lg text-[11px] font-black uppercase" />
                <Button size="icon" onClick={handleAddColumn} className="h-8 w-8 rounded-lg bg-primary text-black"><Plus className="w-3 h-3" /></Button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Kanban Board */}
      <DndContext sensors={sensors} collisionDetection={closestCorners} onDragStart={handleDragStart} onDragOver={handleDragOver} onDragEnd={handleDragEnd}>
        <div className="glass-card p-3 md:p-4 border-white/[0.08]">
          <div className="flex gap-4 md:gap-8 overflow-x-auto pb-4 scrollbar-hide min-h-[50vh] -mx-1 px-1 md:mx-0">
          <div className="flex gap-4 md:gap-8 min-w-full">
            {isTasksLoading ? (
              [...Array(3)].map((_, i) => (
                <div key={i} className="flex-shrink-0 w-80 space-y-4">
                  <Skeleton className="h-6 w-24 bg-white/[0.03]" />
                  <Skeleton className="h-[400px] w-full rounded-2xl bg-white/[0.03]" />
                </div>
              ))
            ) : (
              columns.map((status) => (
                <KanbanColumn
                  key={status}
                  status={status}
                  tasks={tasks?.filter((t) => t.status === status) || []}
                  onDelete={handleDeleteTask}
                  onEdit={openEditDialog}
                />
              ))
            )}
          </div>
          </div>
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
  );
}
