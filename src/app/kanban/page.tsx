
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
  CheckCircle2,
  Layers,
  ChevronRight,
  Database
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
import { Task, Priority } from "@/types/task";

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

const TaskSchema = z.object({
  title: z.string().min(1, "El tÃ­tulo es requerido").max(100),
  description: z.string().optional(),
  priority: z.enum(['baja', 'media', 'alta']),
  status: z.string().min(1),
  tags: z.array(z.string()),
  context: z.string(),
  userId: z.string(),
});

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

  useEffect(() => {
    setTaskForm({ title: "", description: "", priority: "media", status: columns[0], tags: "" });
    setEditingTask(null);
    setIsDialogOpen(false);
  }, [context]);

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
      toast({ title: "Actualizado" });
    } else {
      const colRef = collection(firestore, "users", user.uid, "tasks");
      addDocumentNonBlocking(colRef, { ...taskData, createdAt: serverTimestamp() });
      toast({ title: "Inyectado" });
    }
    
    resetForm();
    setIsDialogOpen(false);
    setIsSaving(false);
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
    const docRef = doc(firestore, "users", user.uid, "tasks", taskId);
    deleteDocumentNonBlocking(docRef);
    toast({ title: "Nodo Purgado", variant: "destructive" });
  };

  const handleAddColumn = () => {
    if (newColumnName.trim() && !columns.includes(newColumnName.trim())) {
      setColumns([...columns, newColumnName.trim()]);
      setNewColumnName("");
    }
  };

  const handleRemoveColumn = (col: string) => {
    if (tasks?.some(t => t.status === col)) {
      toast({ variant: "destructive", title: "Ocupado", description: "Estado con tareas activas." });
      return;
    }
    setColumns(columns.filter(c => c !== col));
  };

  function handleDragStart(event: DragStartEvent) {
    const { active } = event;
    const task = tasks?.find(t => t.id === active.id);
    if (task) setActiveTask(task);
  }

  function handleDragOver(_event: DragOverEvent) {
    // Visual-only preview during drag. Firestore write happens in handleDragEnd.
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
    <div className="space-y-8 pb-24 px-1 md:px-4">
      {/* Optimized Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 px-2 md:px-0">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <h2 className="text-2xl md:text-4xl font-black tracking-tighter uppercase">
              Tablero <span className="text-primary italic glow-text">{context}</span>
            </h2>
            <Badge variant="outline" className="rounded-full border-primary/20 text-primary bg-primary/5 px-2 h-5 font-black text-[11px]">
              {tasks?.length || 0} NODOS
            </Badge>
          </div>
          <p className="text-[9px] text-muted-foreground uppercase font-black tracking-[0.4em] flex items-center gap-3">
            <Database className="w-3 h-3 text-primary/40" /> OrquestaciÃ³n de Datos
          </p>
        </div>
        
        <div className="flex items-center gap-2 w-full md:w-auto">
          <Button 
            variant="outline" 
            onClick={() => setIsManagingColumns(!isManagingColumns)}
            className="rounded-xl h-12 px-4 border-white/5 bg-white/5 hover:bg-white/10"
          >
            <Settings2 className="w-4 h-4 mr-2 text-primary/40" /> 
            <span className="text-[9px] font-black uppercase tracking-widest">Config</span>
          </Button>

          <Dialog open={isDialogOpen} onOpenChange={(open) => { if(!open) resetForm(); setIsDialogOpen(open); }}>
            <DialogTrigger asChild>
              <Button className="flex-1 md:flex-none rounded-xl h-12 px-8 font-black uppercase tracking-widest text-[10px] neon-glow">
                <Plus className="w-4 h-4 mr-2" /> Inyectar
              </Button>
            </DialogTrigger>
            <DialogContent className="glass-card border-white/10 bg-black/95 w-[95vw] sm:max-w-[500px] p-6 md:p-8 mx-auto">
              <DialogHeader>
                <DialogTitle className="text-2xl font-black tracking-tighter uppercase flex items-center gap-3">
                  <Layers className="w-6 h-6 text-primary" />
                  {editingTask ? "Modificar" : "Inyectar"}
                </DialogTitle>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-1.5">
                  <Label className="text-[9px] uppercase font-black text-primary tracking-widest">Nombre del Nodo</Label>
                  <Input value={taskForm.title} onChange={(e) => setTaskForm({...taskForm, title: e.target.value})} className="bg-white/5 border-white/10 h-11 rounded-lg" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-[9px] uppercase font-black text-white/40 tracking-widest">DescripciÃ³n</Label>
                  <Textarea value={taskForm.description} onChange={(e) => setTaskForm({...taskForm, description: e.target.value})} className="bg-white/5 border-white/10 min-h-[80px] rounded-lg" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label className="text-[9px] uppercase font-black tracking-widest">Prioridad</Label>
                    <Select value={taskForm.priority} onValueChange={(v: Priority) => setTaskForm({...taskForm, priority: v})}>
                      <SelectTrigger className="bg-white/5 border-white/10 h-11 rounded-lg"><SelectValue /></SelectTrigger>
                      <SelectContent className="bg-zinc-900 border-white/10">
                        <SelectItem value="baja">BAJA</SelectItem>
                        <SelectItem value="media">MEDIA</SelectItem>
                        <SelectItem value="alta">ALTA</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-[9px] uppercase font-black tracking-widest">Estado</Label>
                    <Select value={taskForm.status} onValueChange={(v) => setTaskForm({...taskForm, status: v})}>
                      <SelectTrigger className="bg-white/5 border-white/10 h-11 rounded-lg"><SelectValue /></SelectTrigger>
                      <SelectContent className="bg-zinc-900 border-white/10">
                        {columns.map(col => (
                          <SelectItem key={col} value={col}>{col}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>
              <DialogFooter>
                <Button onClick={handleSaveTask} disabled={isSaving} className="w-full neon-glow font-black uppercase text-[10px] h-12 rounded-xl">
                  {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : "Confirmar OperaciÃ³n"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <AnimatePresence>
        {isManagingColumns && (
          <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="glass p-5 rounded-2xl border-white/10 space-y-4 bg-black/40">
            <div className="flex items-center justify-between">
              <h3 className="text-[9px] font-black uppercase tracking-[0.4em] text-primary">Estados de Red</h3>
              <Button variant="ghost" size="icon" onClick={() => setIsManagingColumns(false)} className="rounded-lg h-8 w-8"><X className="w-4 h-4" /></Button>
            </div>
            <div className="flex flex-wrap gap-2">
              {columns.map(col => (
                <Badge key={col} variant="secondary" className="pl-3 pr-1 py-1 rounded-lg bg-white/5 border-white/10 gap-2">
                  <span className="font-black uppercase tracking-widest text-[11px]">{col}</span>
                  <button onClick={() => handleRemoveColumn(col)} className="text-muted-foreground hover:text-red-500"><X className="w-3 h-3" /></button>
                </Badge>
              ))}
              <div className="flex items-center gap-2">
                <Input placeholder="Nuevo..." value={newColumnName} onChange={(e) => setNewColumnName(e.target.value)} className="bg-white/5 border-white/10 h-8 w-32 rounded-lg text-[11px] font-black uppercase" />
                <Button size="icon" onClick={handleAddColumn} className="h-8 w-8 rounded-lg bg-primary text-black"><Plus className="w-3 h-3" /></Button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <DndContext sensors={sensors} collisionDetection={closestCorners} onDragStart={handleDragStart} onDragOver={handleDragOver} onDragEnd={handleDragEnd}>
        <div className="flex gap-4 md:gap-8 overflow-x-auto pb-8 scrollbar-hide min-h-[50vh] -mx-4 px-4 md:mx-0">
          <div className="flex gap-4 md:gap-8 min-w-full">
            {isTasksLoading ? (
              [...Array(3)].map((_, i) => (
                <div key={i} className="flex-shrink-0 w-80 space-y-4">
                  <Skeleton className="h-6 w-24 bg-white/5" />
                  <Skeleton className="h-[400px] w-full rounded-[2rem] bg-white/5" />
                </div>
              ))
            ) : (
              columns.map((status) => (
                <Column key={status} status={status} tasks={tasks?.filter(t => t.status === status) || []} onDelete={handleDeleteTask} onEdit={openEditDialog} />
              ))
            )}
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

function Column({ status, tasks, onDelete, onEdit }: { status: string, tasks: Task[], onDelete: (id: string) => void, onEdit: (task: Task) => void }) {
  return (
    <div className="flex-shrink-0 w-[80vw] sm:w-80 md:w-96 flex flex-col gap-4" id={status}>
      <div className="flex items-center gap-3 px-2">
        <div className={cn("w-1.5 h-1.5 rounded-full", status === 'Hecho' ? 'bg-primary neon-glow' : 'bg-white/20')} />
        <h3 className="font-black uppercase tracking-[0.2em] text-[9px] text-white/60">{status}</h3>
        <span className="text-[11px] font-black bg-white/5 px-2 py-0.5 rounded-full border border-white/10 text-muted-foreground/50">{tasks.length}</span>
      </div>

      <div className="flex-1 glass rounded-[2rem] p-3 md:p-5 bg-white/[0.01] border-white/5 border-dashed min-h-[400px] relative">
        <SortableContext items={tasks.map(t => t.id)} strategy={verticalListSortingStrategy}>
          <div className="space-y-4 relative z-10">
            {tasks.map((task) => (
              <TaskCard key={task.id} task={task} onDelete={onDelete} onEdit={onEdit} />
            ))}
          </div>
        </SortableContext>
        {tasks.length === 0 && (
          <div className="flex flex-col items-center justify-center py-32 opacity-5">
            <AlertCircle className="w-12 h-12 mb-2" />
            <p className="text-[9px] font-black uppercase tracking-[0.5em]">VacÃ­o</p>
          </div>
        )}
      </div>
    </div>
  );
}

function TaskCard({ task, onDelete, onEdit, isOverlay }: { task: Task, onDelete: (id: string) => void, onEdit: (task: Task) => void, isOverlay?: boolean }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: task.id,
    data: { type: "Task", task }
  });

  const style = {
    transform: CSS.Translate.toString(transform),
    transition,
    opacity: isDragging && !isOverlay ? 0.3 : 1,
  };

  return (
    <motion.div ref={setNodeRef} style={style} layoutId={task.id} whileHover={{ y: -2 }} className="group relative bg-black/60 backdrop-blur-2xl border border-white/5 rounded-[1.5rem] p-5 hover:border-primary/40 transition-all shadow-lg">
      <div className="absolute top-0 right-0 p-3 opacity-100 md:opacity-0 group-hover:opacity-100 transition-opacity z-10 flex gap-1.5">
        <button onClick={(e) => { e.stopPropagation(); onEdit(task); }} className="p-1.5 hover:bg-primary/20 rounded-lg text-primary/40 bg-black/40"><Edit3 className="w-3 h-3" /></button>
        <button onClick={(e) => { e.stopPropagation(); onDelete(task.id); }} className="p-1.5 hover:bg-red-500/20 rounded-lg text-red-500/40 bg-black/40"><Trash2 className="w-3 h-3" /></button>
      </div>

      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <Badge className={cn("text-[10px] font-black px-2 py-0.5 rounded-full uppercase border tracking-widest", task.priority === 'alta' ? 'border-red-500/30 text-red-500 bg-red-500/5' : task.priority === 'media' ? 'border-primary/30 text-primary bg-primary/5' : 'border-white/10 text-muted-foreground bg-white/5')}>
            {task.priority}
          </Badge>
          <div {...attributes} {...listeners} className="p-1.5 hover:bg-white/5 rounded-lg cursor-grab active:cursor-grabbing ml-auto opacity-20 group-hover:opacity-100">
            <GripVertical className="w-3 h-3" />
          </div>
        </div>

        <div onClick={() => onEdit(task)} className="space-y-1">
          <h4 className="text-[11px] md:text-sm font-black leading-tight tracking-tight group-hover:text-primary transition-colors pr-8">{task.title}</h4>
          {task.description && <p className="text-[9px] text-muted-foreground/60 line-clamp-2 font-medium">{task.description}</p>}
        </div>

        <div className="pt-3 flex items-center justify-between border-t border-white/5">
          <div className="flex items-center gap-1.5 text-[10px] font-black text-white/20 uppercase tracking-widest">
            <Tag className="w-2.5 h-2.5" /> NODE_{task.id.slice(0, 4)}
          </div>
          {task.status === "Hecho" && <CheckCircle2 className="w-3 h-3 text-primary" />}
        </div>
      </div>
    </motion.div>
  );
}
