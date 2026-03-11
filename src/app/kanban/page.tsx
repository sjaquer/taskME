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
  X
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useFirestore, useUser, useCollection, useMemoFirebase } from "@/firebase";
import { collection, doc, serverTimestamp } from "firebase/firestore";
import { addDocumentNonBlocking, updateDocumentNonBlocking, deleteDocumentNonBlocking } from "@/firebase/non-blocking-updates";
import { useRouter } from "next/navigation";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { z } from "zod";

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
  const [newTask, setNewTask] = useState({
    title: "",
    description: "",
    priority: "media" as Priority,
    status: "",
    tags: ""
  });

  const [activeTask, setActiveTask] = useState<Task | null>(null);

  const tasksQuery = useMemoFirebase(() => {
    if (!firestore || !user) return null;
    return collection(firestore, "users", user.uid, "tasks");
  }, [firestore, user]);

  const { data: tasks } = useCollection<Task>(tasksQuery);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  useEffect(() => {
    if (columns.length > 0 && !newTask.status) {
      setNewTask(prev => ({ ...prev, status: columns[0] }));
    }
  }, [columns]);

  if (isUserLoading) return null;
  if (!user) {
    router.push("/login");
    return null;
  }

  const handleAddTask = () => {
    const rawData = {
      title: newTask.title,
      description: newTask.description,
      priority: newTask.priority,
      status: newTask.status || columns[0],
      tags: newTask.tags.split(',').map(t => t.trim()).filter(t => t !== ""),
      context,
      userId: user.uid,
    };

    const result = TaskSchema.safeParse(rawData);
    if (!result.success) return;

    const taskData = {
      ...result.data,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      dueDate: new Date().toISOString(),
    };

    const colRef = collection(firestore, "users", user.uid, "tasks");
    addDocumentNonBlocking(colRef, taskData);
    setNewTask({ title: "", description: "", priority: "media", status: columns[0], tags: "" });
    setIsDialogOpen(false);
  };

  const handleDeleteTask = (taskId: string) => {
    const docRef = doc(firestore, "users", user.uid, "tasks", taskId);
    deleteDocumentNonBlocking(docRef);
  };

  const handleAddColumn = () => {
    if (newColumnName.trim() && !columns.includes(newColumnName.trim())) {
      setColumns([...columns, newColumnName.trim()]);
      setNewColumnName("");
    }
  };

  const handleRemoveColumn = (col: string) => {
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
      updateDocumentNonBlocking(docRef, { 
        status: overStatus,
        updatedAt: serverTimestamp()
      });
    }
  }

  return (
    <div className="space-y-6 md:space-y-10 pb-20">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h2 className="text-3xl md:text-5xl font-black tracking-tighter flex items-center gap-4">
            Sistema <span className="text-primary">{context}</span>
          </h2>
          <p className="text-[10px] text-muted-foreground uppercase font-black tracking-[0.4em] mt-2 flex items-center gap-2">
            <span className="w-10 h-px bg-primary/30" /> Gestión de Flujo de Trabajo
          </p>
        </div>
        
        <div className="flex items-center gap-2 md:gap-3">
          <Button 
            variant="outline" 
            onClick={() => setIsManagingColumns(!isManagingColumns)}
            className="flex-1 md:flex-none rounded-2xl h-12 md:h-14 px-4 md:px-6 border-white/5 bg-white/5 hover:bg-white/10"
          >
            <Settings2 className="w-4 h-4 md:w-5 md:h-5 mr-2" /> Estados
          </Button>

          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button className="flex-1 md:flex-none rounded-2xl h-12 md:h-14 px-6 md:px-8 font-black uppercase tracking-widest text-[10px] md:text-xs neon-glow transition-all hover:scale-105 active:scale-95">
                <Plus className="w-4 h-4 md:w-5 md:h-5 mr-2" /> Nueva Tarea
              </Button>
            </DialogTrigger>
            <DialogContent className="glass-card border-white/10 bg-black/95 sm:max-w-[500px] p-6 md:p-8">
              <DialogHeader>
                <DialogTitle className="text-2xl md:text-3xl font-black tracking-tighter uppercase">Inyectar Tarea</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 md:space-y-6 py-4">
                <div className="space-y-2">
                  <Label className="text-[10px] uppercase font-black text-primary">Identificador</Label>
                  <Input 
                    placeholder="Nombre del proceso..."
                    value={newTask.title} 
                    onChange={(e) => setNewTask({...newTask, title: e.target.value})}
                    className="bg-white/5 border-white/10 h-10 md:h-12 rounded-xl focus:ring-primary" 
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-[10px] uppercase font-black">Bitácora</Label>
                  <Textarea 
                    placeholder="Detalles técnicos..."
                    value={newTask.description}
                    onChange={(e) => setNewTask({...newTask, description: e.target.value})}
                    className="bg-white/5 border-white/10 min-h-[80px] md:min-h-[100px] rounded-xl" 
                  />
                </div>
                <div className="grid grid-cols-2 gap-3 md:gap-4">
                  <div className="space-y-2">
                    <Label className="text-[10px] uppercase font-black">Prioridad</Label>
                    <Select value={newTask.priority} onValueChange={(v: Priority) => setNewTask({...newTask, priority: v})}>
                      <SelectTrigger className="bg-white/5 border-white/10 h-10 md:h-12 rounded-xl">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-zinc-900 border-white/10">
                        <SelectItem value="baja">Baja</SelectItem>
                        <SelectItem value="media">Media</SelectItem>
                        <SelectItem value="alta">Alta</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-[10px] uppercase font-black">Estado Inicial</Label>
                    <Select value={newTask.status} onValueChange={(v) => setNewTask({...newTask, status: v})}>
                      <SelectTrigger className="bg-white/5 border-white/10 h-10 md:h-12 rounded-xl">
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
                  <Label className="text-[10px] uppercase font-black">Etiquetas</Label>
                  <Input 
                    placeholder="UI, UX, Backend..."
                    value={newTask.tags} 
                    onChange={(e) => setNewTask({...newTask, tags: e.target.value})}
                    className="bg-white/5 border-white/10 h-10 md:h-12 rounded-xl" 
                  />
                </div>
              </div>
              <DialogFooter>
                <Button onClick={handleAddTask} className="w-full neon-glow font-black uppercase text-xs h-12 md:h-14 rounded-2xl">Confirmar Inyección</Button>
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
            className="glass p-5 md:p-6 rounded-[2rem] md:rounded-[2.5rem] border-white/10 space-y-4 overflow-hidden"
          >
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-black uppercase tracking-widest">Configuración de Estados</h3>
              <Button variant="ghost" size="icon" onClick={() => setIsManagingColumns(false)}>
                <X className="w-4 h-4" />
              </Button>
            </div>
            <div className="flex flex-wrap gap-2 md:gap-3">
              {columns.map(col => (
                <Badge key={col} variant="secondary" className="pl-3 md:pl-4 pr-2 py-1.5 md:py-2 rounded-xl bg-white/5 border-white/10 gap-2">
                  <span className="font-bold text-[10px] md:text-sm">{col}</span>
                  <button onClick={() => handleRemoveColumn(col)} className="hover:text-red-500 transition-colors">
                    <X className="w-3 h-3" />
                  </button>
                </Badge>
              ))}
              <div className="flex items-center gap-2">
                <Input 
                  placeholder="Nuevo estado..."
                  value={newColumnName}
                  onChange={(e) => setNewColumnName(e.target.value)}
                  className="bg-white/5 border-white/10 h-9 w-32 md:w-40 rounded-xl text-xs"
                />
                <Button size="icon" onClick={handleAddColumn} className="h-9 w-9 rounded-xl bg-primary text-black">
                  <Plus className="w-4 h-4" />
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
        <div className="flex gap-4 md:gap-6 overflow-x-auto pb-8 scrollbar-hide min-h-[60vh] md:min-h-[70vh] -mx-4 px-4">
          {columns.map((status) => (
            <Column 
              key={status} 
              status={status} 
              tasks={tasks?.filter(t => t.status === status && t.context === context) || []}
              onDelete={handleDeleteTask}
            />
          ))}
        </div>
        <DragOverlay>
          {activeTask ? (
            <div className="w-[280px] md:w-[300px] rotate-3 scale-105 pointer-events-none opacity-90 shadow-2xl">
               <TaskCard task={activeTask} onDelete={() => {}} isOverlay />
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>
    </div>
  );
}

function Column({ status, tasks, onDelete }: { status: string, tasks: Task[], onDelete: (id: string) => void }) {
  return (
    <div className="flex-shrink-0 w-72 md:w-80 flex flex-col gap-4 md:gap-6">
      <div className="flex items-center justify-between px-2 md:px-4">
        <div className="flex items-center gap-3">
          <div className={cn(
            "w-2 md:w-2.5 h-2 md:h-2.5 rounded-full",
            status === 'Hecho' ? 'bg-primary neon-glow' : 'bg-white/20'
          )} />
          <h3 className="font-black uppercase tracking-[0.2em] text-[9px] md:text-[10px]">{status}</h3>
          <span className="text-[8px] md:text-[9px] font-black bg-white/5 px-2 py-0.5 md:py-1 rounded-full border border-white/10 text-muted-foreground">
            {tasks.length}
          </span>
        </div>
      </div>

      <div className="flex-1 glass rounded-[2.5rem] md:rounded-[3rem] p-3 md:p-4 bg-white/[0.01] border-white/5 border-dashed min-h-[400px]">
        <SortableContext items={tasks.map(t => t.id)} strategy={verticalListSortingStrategy}>
          <div className="space-y-3 md:space-y-4">
            {tasks.map((task) => (
              <TaskCard key={task.id} task={task} onDelete={onDelete} />
            ))}
          </div>
        </SortableContext>
        
        {tasks.length === 0 && (
          <div className="flex flex-col items-center justify-center py-20 md:py-24 text-muted-foreground opacity-10">
            <AlertCircle className="w-10 h-10 md:w-12 md:h-12 mb-4 stroke-[1]" />
            <p className="text-[9px] md:text-[10px] font-black uppercase tracking-widest text-center">Sin Tareas</p>
          </div>
        )}
      </div>
    </div>
  );
}

function TaskCard({ task, onDelete, isOverlay }: { task: Task, onDelete: (id: string) => void, isOverlay?: boolean }) {
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
    opacity: isDragging && !isOverlay ? 0.4 : 1,
  };

  const priorityColors = {
    alta: "border-red-500/40 text-red-500 bg-red-500/10 shadow-[0_0_15px_rgba(239,68,68,0.2)]",
    media: "border-primary/40 text-primary bg-primary/10 shadow-[0_0_15px_rgba(57,255,20,0.1)]",
    baja: "border-white/10 text-muted-foreground bg-white/5"
  };

  return (
    <motion.div
      ref={setNodeRef}
      style={style}
      layoutId={task.id}
      className="group relative bg-card/60 backdrop-blur-xl border border-white/5 rounded-[1.5rem] md:rounded-[2rem] p-4 md:p-6 hover:border-primary/40 transition-all cursor-default select-none overflow-hidden"
    >
      <div className="absolute top-0 right-0 p-2 md:p-3 opacity-0 group-hover:opacity-100 transition-opacity z-10">
        <button 
          onClick={(e) => { e.stopPropagation(); onDelete(task.id); }}
          className="p-1.5 hover:bg-red-500/20 rounded-xl text-red-500/40 hover:text-red-500 transition-all"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>

      <div className="space-y-3 md:space-y-4">
        <div className="flex items-center gap-2">
          <Badge className={cn("text-[7px] md:text-[8px] font-black px-2 md:px-3 py-0.5 md:py-1 rounded-full uppercase border", priorityColors[task.priority])}>
            {task.priority}
          </Badge>
          <div {...attributes} {...listeners} className="p-1 hover:bg-white/5 rounded-lg cursor-grab active:cursor-grabbing ml-auto opacity-30 group-hover:opacity-100 transition-opacity">
            <GripVertical className="w-3.5 h-3.5" />
          </div>
        </div>

        <div className="space-y-1">
          <h4 className="text-xs md:text-sm font-black leading-tight tracking-tight group-hover:text-primary transition-colors">
            {task.title}
          </h4>
          {task.description && (
            <p className="text-[9px] md:text-[10px] text-muted-foreground/60 line-clamp-2 font-medium leading-relaxed">
              {task.description}
            </p>
          )}
        </div>

        {task.tags && task.tags.length > 0 && (
          <div className="flex flex-wrap gap-1 md:gap-1.5">
            {task.tags.map((tag, i) => (
              <span key={i} className="text-[7px] md:text-[8px] font-bold px-1.5 md:px-2 py-0.5 rounded-lg bg-white/5 border border-white/10 text-muted-foreground">
                #{tag}
              </span>
            ))}
          </div>
        )}

        <div className="pt-2 flex items-center justify-between border-t border-white/5">
          <div className="flex items-center gap-1.5 text-[7px] md:text-[8px] font-black text-muted-foreground uppercase">
            <Tag className="w-3 h-3 text-primary/50" /> {task.context}
          </div>
          <div className="text-[7px] md:text-[8px] font-black text-muted-foreground/30 uppercase">
            ID: {task.id.slice(0, 5)}
          </div>
        </div>
      </div>
    </motion.div>
  );
}