"use client";

import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useAppContextStore } from "@/lib/store";
import { Plus, Settings2, X, Loader2, Layers, Database, CircleCheckBig, Clock3, Flame, Sparkles, ChevronRight, ChevronLeft } from "lucide-react";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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

  const boardRef = useRef<HTMLDivElement>(null);
  const topScrollRef = useRef<HTMLDivElement>(null);
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

  const tasksQuery = useMemoFirebase(() => {
    if (!firestore || !user) return null;
    return buildTasksQuery(firestore, user.uid, context);
  }, [firestore, user, context]);

  const { data: firestoreTasks, isLoading: isTasksLoading } = useCollection<Task>(tasksQuery);
  const [tasks, setTasks] = useState<Task[]>([]);

  useEffect(() => {
    if (firestoreTasks) {
      setTasks(firestoreTasks);
    }
  }, [firestoreTasks]);

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
      // Optimistic Update
      setTasks(prev => prev.map(t => t.id === editingTask.id ? { ...t, ...taskData } : t));
      updateTask(firestore, user.uid, editingTask.id, taskData);
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

  function handleDragStart(event: DragStartEvent) {
    const task = tasks?.find((t) => t.id === event.active.id);
    if (task) setActiveTask(task);
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
    setActiveTask(null);
    
    if (!over) return;

    const overId = over.id;
    const overData = over.data.current;
    let overStatus: string | undefined;

    if (overData?.type === 'Column') {
      overStatus = overData.status;
    } else if (overData?.type === 'Task') {
      overStatus = overData.task.status;
    } else if (columns.includes(overId as string)) {
      overStatus = overId as string;
    }

    if (overStatus && user) {
      // Sincronizar con Firestore
      updateTask(firestore, user.uid, active.id as string, { status: overStatus });
      toast({ 
        title: "Nodo Sincronizado", 
        description: `Estado ${overStatus} persistido.`,
        variant: "success" 
      });
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
            <Database className="w-3 h-3 text-primary/40" /> {columns.length} ESTADOS • {totalTasks} NODOS ACTIVOS
          </p>
        </div>

        <div className="flex items-center gap-2 w-full md:w-auto">
          {/* Mobile Column Navigator */}
          <div className="flex md:hidden overflow-x-auto scrollbar-hide gap-1 bg-white/[0.03] p-1 rounded-xl border border-white/[0.06] w-full">
            {columns.map((col) => {
              const count = tasks?.filter((t) => t.status === col).length || 0;
              return (
                <button
                  key={col}
                  onClick={() => {
                    const el = document.getElementById(col);
                    el?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
                  }}
                  className="flex-shrink-0 px-4 py-2 rounded-lg text-[9px] font-black uppercase tracking-widest whitespace-nowrap bg-white/[0.05] border border-white/[0.05] active:bg-primary/20 active:text-primary transition-all"
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

          <Dialog open={isDialogOpen} onOpenChange={(open) => { if (!open) resetForm(); setIsDialogOpen(open); }}>
            <DialogTrigger asChild>
              <TacticalButton className="flex-1 md:flex-none">
                <Plus className="w-4 h-4 mr-2" /> Inyectar
              </TacticalButton>
            </DialogTrigger>
            <DialogContent className="glass-card-elevated border-white/[0.08] bg-[#050505]/95 sm:max-w-[500px] sm:max-h-[92dvh] overflow-y-auto p-6 sm:p-5 md:p-8">
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
                  <TabsList className="grid w-full grid-cols-2 bg-white/[0.03] border border-white/[0.08] p-1 h-auto rounded-lg mb-4">
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
                      <Textarea 
                        placeholder="Ej: Mañana tengo que enviar el reporte mensual y también ir a comprar el pan..."
                        value={aiPrompt}
                        onChange={(e) => setAiPrompt(e.target.value)}
                        className="bg-white/[0.03] border-white/[0.08] min-h-[160px] rounded-lg text-sm resize-none focus-visible:ring-purple-500/50"
                      />
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

      {/* Kanban Board Container */}
      <div className="space-y-4">
        {/* Top Scrollbar (Desktop Only) */}
        <div 
          ref={topScrollRef}
          className="hidden md:block overflow-x-auto h-2 bg-white/[0.02] border-y border-white/[0.05] rounded-full mx-auto max-w-[80%] transition-all hover:bg-white/[0.05]"
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

        <DndContext sensors={sensors} collisionDetection={closestCorners} onDragStart={handleDragStart} onDragOver={handleDragOver} onDragEnd={handleDragEnd}>
          <div className="glass-card-elevated p-3 md:p-6 border-white/[0.08] relative">
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

            {/* Mobile Navigation Arrows (Visual hint) */}
            <div className="md:hidden absolute inset-y-0 left-0 w-8 pointer-events-none bg-gradient-to-r from-[#050505]/40 to-transparent" />
            <div className="md:hidden absolute inset-y-0 right-0 w-8 pointer-events-none bg-gradient-to-l from-[#050505]/40 to-transparent" />
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
