
"use client";

import { useState, useMemo, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useAppContextStore } from "@/lib/store";
import { 
  Plus, 
  GripVertical, 
  Trash2, 
  Tag, 
  AlertCircle, 
  Settings2,
  X,
  Loader2,
  Edit3,
  CheckCircle2
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useFirestore, useUser, useCollection, useMemoFirebase } from "@/firebase";
import { collection, doc, serverTimestamp, query, where } from "firebase/firestore";
import { addDocumentNonBlocking, updateDocumentNonBlocking, deleteDocumentNonBlocking } from "@/firebase/non-blocking-updates";
import { useRouter } from "next/navigation";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { z } from "zod";
import { toast } from "@/hooks/use-toast";

// Drag and Drop Imports
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
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

// Esquema de validación para tareas
const TaskSchema = z.object({
  title: z.string().min(1, "El título es requerido").max(100),
  description: z.string().optional(),
  priority: z.enum(['baja', 'media', 'alta']),
  status: z.string().min(1),
  tags: z.array(z.string()),
  context: z.string(),
  userId: z.string(),
});

type Priority = 'baja' | 'media' | 'alta';

interface Task {
  id: string;
  title: string;
  description?: string;
  status: string;
  priority: Priority;
  context: string;
  userId: string;
  dueDate: string;
  tags?: string[];
}

export default function KanbanPage() {
  const { context } = useAppContextStore();
  const { user, isUserLoading } = useUser();
  const firestore = useFirestore();
  const router = useRouter();
  
  const [columns, setColumns] = useState<string[]>(['Pendiente', 'Haciendo', 'Hecho']);
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
    tags: ""
  });

  const [activeTask, setActiveTask] = useState<Task | null>(null);

  const tasksQuery = useMemoFirebase(() => {
    if (!firestore || !user) return null;
    return query(
      collection(firestore, "users", user.uid, "tasks"),
      where("context", "==", context)
    );
  }, [firestore, user, context]);

  const { data: tasks, isLoading: isTasksLoading } = useCollection<Task>(tasksQuery);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  useEffect(() => {
    if (columns.length > 0 && !taskForm.status) {
      setTaskForm(prev => ({ ...prev, status: columns[0] }));
    }
  }, [columns]);

  if (isUserLoading) return null;
  if (!user) {
    router.push("/login");
    return null;
  }

  const handleSaveTask = () => {
    setIsSaving(true);
    const rawData = {
      title: taskForm.title,
      description: taskForm.description,
      priority: taskForm.priority,
      status: taskForm.status || columns[0],
      tags: taskForm.tags.split(',').map(t => t.trim()).filter(t => t !== ""),
      context,
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
      updatedAt: serverTimestamp(),
      dueDate: editingTask?.dueDate || new Date().toISOString(),
    };

    if (editingTask) {
      const docRef = doc(firestore, "users", user.uid, "tasks", editingTask.id);
      updateDocumentNonBlocking(docRef, taskData);
      toast({ title: "Nodo Actualizado", description: "Los cambios se han inyectado con éxito." });
    } else {
      const colRef = collection(firestore, "users", user.uid, "tasks");
      addDocumentNonBlocking(colRef, { ...taskData, createdAt: serverTimestamp() });
      toast({ title: "Nodo Creado", description: "Nuevo proceso añadido al sistema." });
    }
    
    setTimeout(() => {
      resetForm();
      setIsDialogOpen(false);
      setIsSaving(false);
    }, 400);
  };

  const resetForm = () => {
    setTaskForm({ title: "", description: "", priority: "media", status: columns[0], tags: "" });
    setEditingTask(null);
  };

  const openEditDialog = (task: Task) => {
    setEditingTask(task);
    setTaskForm({
      title: task.title,
      description: task.description || "",
      priority: task.priority,
      status: task.status,
      tags: task.tags?.join(', ') || ""
    });
    setIsDialogOpen(true);
  };

  const handleDeleteTask = (taskId: string) => {
    if(confirm("¿Confirmar eliminación permanente de este nodo?")) {
      const docRef = doc(firestore, "users", user.uid, "tasks", taskId);
      deleteDocumentNonBlocking(docRef);
      toast({ title: "Nodo Eliminado", variant: "destructive" });
    }
  };

  const handleAddColumn = () => {
    if (newColumnName.trim() && !columns.includes(newColumnName.trim())) {
      setColumns([...columns, newColumnName.trim()]);
      setNewColumnName("");
    }
  };

  const handleRemoveColumn = (col: string) => {
    if (tasks?.some(t => t.status === col)) {
      toast({ variant: "destructive", title: "Error", description: "No puedes eliminar un estado con tareas activas." });
      return;
    }
    setColumns(columns.filter(c => c !== col));
  };

  function handleDragStart(event: DragStartEvent) {
    const { active } = event;
    const task = tasks?.find(t => t.id === active.id);
    if (task) setActiveTask(task);
  }

  function handleDragOver(event: DragOverEvent) {
    const { active, over } = event;
    if (!over) return;
    const activeId = active.id;
    const overId = over.id;
    if (activeId === overId) return;

    const isActiveATask = active.data.current?.type === "Task";
    const isOverAColumn = over.data.current?.type === "Column";

    if (isActiveATask && isOverAColumn) {
      const overStatus = overId as string;
      const task = tasks?.find(t => t.id === activeId);
      if (task && task.status !== overStatus) {
        const docRef = doc(firestore, "users", user.uid, "tasks", activeId as string);
        updateDocumentNonBlocking(docRef, { status: overStatus, updatedAt: serverTimestamp() });
      }
    }
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    setActiveTask(null);
    if (!over) return;
    const activeId = active.id;
    const overId = over.id;

    const overStatus = columns.includes(overId as string) 
      ? (overId as string) 
      : tasks?.find(t => t.id === overId)?.status;

    if (overStatus && active.data.current?.task.status !== overStatus) {
      const docRef = doc(firestore, "users", user.uid, "tasks", activeId as string);
      updateDocumentNonBlocking(docRef, { status: overStatus, updatedAt: serverTimestamp() });
    }
  }

  return (
    <div className="space-y-8 md:space-y-12 pb-24 px-2">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-8">
        <div>
          <h2 className="text-4xl md:text-6xl font-black tracking-tighter flex items-center gap-6">
            Tablero <span className="text-primary glow-text">{context}</span>
          </h2>
          <p className="text-[10px] text-muted-foreground uppercase font-black tracking-[0.5em] mt-3 flex items-center gap-3">
            <span className="w-12 h-px bg-primary/30" /> Orquestación de Procesos
          </p>
        </div>
        
        <div className="flex items-center gap-3 w-full md:w-auto">
          <Button 
            variant="outline" 
            onClick={() => setIsManagingColumns(!isManagingColumns)}
            className="flex-1 md:flex-none rounded-2xl h-14 md:h-16 px-6 border-white/5 bg-white/5 hover:bg-white/10 transition-all"
          >
            <Settings2 className="w-5 h-5 mr-3" /> <span className="text-[10px] font-black uppercase">Estados</span>
          </Button>

          <Dialog open={isDialogOpen} onOpenChange={(open) => { if(!open) resetForm(); setIsDialogOpen(open); }}>
            <DialogTrigger asChild>
              <Button className="flex-1 md:flex-none rounded-2xl h-14 md:h-16 px-8 md:px-12 font-black uppercase tracking-widest text-[10px] md:text-xs neon-glow transition-all hover:scale-105 active:scale-95">
                <Plus className="w-5 h-5 mr-3" /> Inyectar Tarea
              </Button>
            </DialogTrigger>
            <DialogContent className="glass-card border-white/10 bg-black/95 sm:max-w-[550px] p-8 md:p-10">
              <DialogHeader>
                <DialogTitle className="text-3xl md:text-4xl font-black tracking-tighter uppercase text-white">
                  {editingTask ? "Modificar Nodo" : "Inyectar Tarea"}
                </DialogTitle>
              </DialogHeader>
              <div className="space-y-6 py-6">
                <div className="space-y-2">
                  <Label className="text-[10px] uppercase font-black text-primary tracking-widest">Nombre del Proceso</Label>
                  <Input 
                    placeholder="Ej: Análisis de Datos Alpha..."
                    value={taskForm.title} 
                    onChange={(e) => setTaskForm({...taskForm, title: e.target.value})}
                    className="bg-white/5 border-white/10 h-12 rounded-xl focus:ring-primary/40 text-white" 
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-[10px] uppercase font-black text-white/40 tracking-widest">Descripción Técnica</Label>
                  <Textarea 
                    placeholder="Detalla los requisitos del nodo..."
                    value={taskForm.description}
                    onChange={(e) => setTaskForm({...taskForm, description: e.target.value})}
                    className="bg-white/5 border-white/10 min-h-[120px] rounded-xl text-white" 
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="text-[10px] uppercase font-black tracking-widest">Prioridad</Label>
                    <Select value={taskForm.priority} onValueChange={(v: Priority) => setTaskForm({...taskForm, priority: v})}>
                      <SelectTrigger className="bg-white/5 border-white/10 h-12 rounded-xl text-white">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-zinc-900 border-white/10">
                        <SelectItem value="baja">BAJA</SelectItem>
                        <SelectItem value="media">MEDIA</SelectItem>
                        <SelectItem value="alta">ALTA</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-[10px] uppercase font-black tracking-widest">Estado</Label>
                    <Select value={taskForm.status} onValueChange={(v) => setTaskForm({...taskForm, status: v})}>
                      <SelectTrigger className="bg-white/5 border-white/10 h-12 rounded-xl text-white">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-zinc-900 border-white/10">
                        {columns.map(col => (
                          <SelectItem key={col} value={col}>{col}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label className="text-[10px] uppercase font-black text-white/40 tracking-widest">Etiquetas (separadas por coma)</Label>
                  <Input 
                    placeholder="UI, Backend, Dev..."
                    value={taskForm.tags} 
                    onChange={(e) => setTaskForm({...taskForm, tags: e.target.value})}
                    className="bg-white/5 border-white/10 h-12 rounded-xl text-white" 
                  />
                </div>
              </div>
              <DialogFooter>
                <Button 
                  onClick={handleSaveTask} 
                  disabled={isSaving}
                  className="w-full neon-glow font-black uppercase text-xs h-16 rounded-2xl flex items-center justify-center gap-3"
                >
                  {isSaving ? <Loader2 className="w-5 h-5 animate-spin" /> : "Confirmar Operación de Datos"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <AnimatePresence>
        {isManagingColumns && (
          <motion.div 
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="glass p-6 md:p-8 rounded-[3rem] border-white/10 space-y-6 overflow-hidden bg-black/40"
          >
            <div className="flex items-center justify-between">
              <h3 className="text-[10px] font-black uppercase tracking-[0.4em] text-primary">Configuración de Estados</h3>
              <Button variant="ghost" size="icon" onClick={() => setIsManagingColumns(false)} className="rounded-xl hover:bg-white/10">
                <X className="w-5 h-5" />
              </Button>
            </div>
            <div className="flex flex-wrap gap-3">
              {columns.map(col => (
                <Badge key={col} variant="secondary" className="pl-5 pr-3 py-2.5 rounded-2xl bg-white/5 border-white/10 gap-3 hover:border-primary/40 transition-all">
                  <span className="font-black uppercase tracking-widest text-[10px]">{col}</span>
                  <button onClick={() => handleRemoveColumn(col)} className="text-muted-foreground hover:text-red-500 transition-colors">
                    <X className="w-4 h-4" />
                  </button>
                </Badge>
              ))}
              <div className="flex items-center gap-3">
                <Input 
                  placeholder="Nuevo estado..."
                  value={newColumnName}
                  onChange={(e) => setNewColumnName(e.target.value)}
                  className="bg-white/5 border-white/10 h-10 w-40 md:w-56 rounded-xl text-[10px] font-black uppercase tracking-widest"
                />
                <Button size="icon" onClick={handleAddColumn} className="h-10 w-10 rounded-xl bg-primary text-black hover:scale-110 transition-transform">
                  <Plus className="w-5 h-5" />
                </Button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <DndContext 
        sensors={sensors} 
        collisionDetection={closestCorners} 
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragEnd={handleDragEnd}
      >
        <div className="flex gap-6 md:gap-8 overflow-x-auto pb-12 scrollbar-hide min-h-[70vh] -mx-4 px-4 md:mx-0">
          {isTasksLoading ? (
            [...Array(3)].map((_, i) => (
              <div key={i} className="flex-shrink-0 w-80 space-y-6">
                <Skeleton className="h-8 w-32 bg-white/5" />
                <Skeleton className="h-[500px] w-full rounded-[3rem] bg-white/5" />
              </div>
            ))
          ) : (
            columns.map((status) => (
              <Column 
                key={status} 
                status={status} 
                tasks={tasks?.filter(t => t.status === status) || []}
                onDelete={handleDeleteTask}
                onEdit={openEditDialog}
              />
            ))
          )}
        </div>
        <DragOverlay>
          {activeTask ? (
            <div className="w-[300px] rotate-3 scale-105 pointer-events-none opacity-90 shadow-[0_0_50px_rgba(0,0,0,0.5)]">
               <TaskCard task={activeTask} onDelete={() => {}} onEdit={() => {}} isOverlay />
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>
    </div>
  );
}

function Column({ status, tasks, onDelete, onEdit }: { status: string, tasks: Task[], onDelete: (id: string) => void, onEdit: (task: Task) => void }) {
  return (
    <div className="flex-shrink-0 w-80 md:w-96 flex flex-col gap-6" id={status}>
      <div className="flex items-center justify-between px-4">
        <div className="flex items-center gap-4">
          <div className={cn(
            "w-2.5 h-2.5 rounded-full",
            status === 'Hecho' ? 'bg-primary neon-glow' : 'bg-white/20'
          )} />
          <h3 className="font-black uppercase tracking-[0.3em] text-[10px] md:text-[11px] text-white/80">{status}</h3>
          <span className="text-[9px] font-black bg-white/5 px-3 py-1 rounded-full border border-white/10 text-muted-foreground shadow-inner">
            {tasks.length}
          </span>
        </div>
      </div>

      <div className="flex-1 glass rounded-[3.5rem] md:rounded-[4rem] p-4 md:p-6 bg-white/[0.01] border-white/5 border-dashed min-h-[500px] hover:bg-white/[0.02] transition-colors">
        <SortableContext items={tasks.map(t => t.id)} strategy={verticalListSortingStrategy}>
          <div className="space-y-4">
            {tasks.map((task) => (
              <TaskCard key={task.id} task={task} onDelete={onDelete} onEdit={onEdit} />
            ))}
          </div>
        </SortableContext>
        
        {tasks.length === 0 && (
          <div className="flex flex-col items-center justify-center py-32 md:py-40 text-muted-foreground opacity-10">
            <AlertCircle className="w-16 h-16 mb-6 stroke-[0.5]" />
            <p className="text-[10px] md:text-[11px] font-black uppercase tracking-[0.6em] text-center">Zona de Vacío</p>
          </div>
        )}
      </div>
    </div>
  );
}

function TaskCard({ task, onDelete, onEdit, isOverlay }: { task: Task, onDelete: (id: string) => void, onEdit: (task: Task) => void, isOverlay?: boolean }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: task.id,
    data: { 
      type: "Task",
      task 
    }
  });

  const style = {
    transform: CSS.Translate.toString(transform),
    transition,
    opacity: isDragging && !isOverlay ? 0.3 : 1,
  };

  const priorityColors = {
    alta: "border-red-500/40 text-red-500 bg-red-500/10 shadow-[0_0_20px_rgba(239,68,68,0.2)]",
    media: "border-primary/40 text-primary bg-primary/10 shadow-[0_0_20px_rgba(57,255,20,0.1)]",
    baja: "border-white/10 text-muted-foreground bg-white/5"
  };

  return (
    <motion.div
      ref={setNodeRef}
      style={style}
      layoutId={task.id}
      className="group relative bg-black/60 backdrop-blur-3xl border border-white/5 rounded-[2rem] md:rounded-[2.5rem] p-6 md:p-8 hover:border-primary/40 transition-all cursor-default select-none overflow-hidden shadow-xl"
    >
      <div className="absolute top-0 right-0 p-4 opacity-0 group-hover:opacity-100 transition-opacity z-10 flex gap-2">
        <button 
          onClick={(e) => { e.stopPropagation(); onEdit(task); }}
          className="p-2 hover:bg-primary/20 rounded-xl text-primary/40 hover:text-primary transition-all"
        >
          <Edit3 className="w-4 h-4" />
        </button>
        <button 
          onClick={(e) => { e.stopPropagation(); onDelete(task.id); }}
          className="p-2 hover:bg-red-500/20 rounded-xl text-red-500/40 hover:text-red-500 transition-all"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>

      <div className="space-y-4 md:space-y-6">
        <div className="flex items-center gap-3">
          <Badge className={cn("text-[8px] font-black px-3 py-1 rounded-full uppercase border tracking-widest", priorityColors[task.priority])}>
            {task.priority}
          </Badge>
          <div {...attributes} {...listeners} className="p-2 hover:bg-white/5 rounded-xl cursor-grab active:cursor-grabbing ml-auto opacity-20 group-hover:opacity-100 transition-opacity">
            <GripVertical className="w-4 h-4" />
          </div>
        </div>

        <div className="space-y-2" onClick={() => onEdit(task)}>
          <h4 className="text-sm md:text-base font-black leading-tight tracking-tight group-hover:text-primary transition-colors">
            {task.title}
          </h4>
          {task.description && (
            <p className="text-[10px] md:text-[11px] text-muted-foreground/60 line-clamp-3 font-medium leading-relaxed">
              {task.description}
            </p>
          )}
        </div>

        {task.tags && task.tags.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {task.tags.map((tag, i) => (
              <span key={i} className="text-[8px] font-black px-2.5 py-1 rounded-lg bg-white/5 border border-white/10 text-muted-foreground/50 tracking-widest uppercase">
                #{tag}
              </span>
            ))}
          </div>
        )}

        <div className="pt-4 flex items-center justify-between border-t border-white/5">
          <div className="flex items-center gap-2 text-[8px] font-black text-muted-foreground uppercase tracking-widest">
            <Tag className="w-3.5 h-3.5 text-primary/50" /> {task.context}
          </div>
          {task.status === "Hecho" && (
            <CheckCircle2 className="w-4 h-4 text-primary animate-pulse" />
          )}
        </div>
      </div>
    </motion.div>
  );
}
