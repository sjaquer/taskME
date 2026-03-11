
"use client";

import { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useAppContextStore } from "@/lib/store";
import { Plus, MoreVertical, GripVertical, Loader2, Trash2, Calendar as CalendarIcon, Tag, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useFirestore, useUser, useCollection, useMemoFirebase } from "@/firebase";
import { collection, doc, serverTimestamp, deleteDoc } from "firebase/firestore";
import { addDocumentNonBlocking, updateDocumentNonBlocking, deleteDocumentNonBlocking } from "@/firebase/non-blocking-updates";
import { useRouter } from "next/navigation";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

// Drag and Drop Imports
import {
  DndContext,
  closestCorners,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragOverlay,
  defaultDropAnimationSideEffects,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

type Status = 'Pendiente' | 'Haciendo' | 'Hecho';
type Priority = 'baja' | 'media' | 'alta';

interface Task {
  id: string;
  title: string;
  description?: string;
  status: Status;
  priority: Priority;
  context: string;
  userId: string;
  dueDate: string;
}

const COLUMNS: Status[] = ['Pendiente', 'Haciendo', 'Hecho'];

export default function KanbanPage() {
  const { context } = useAppContextStore();
  const { user, isUserLoading } = useUser();
  const firestore = useFirestore();
  const router = useRouter();
  
  // Form State
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [newTask, setNewTask] = useState({
    title: "",
    description: "",
    priority: "media" as Priority,
    status: "Pendiente" as Status,
  });

  const tasksQuery = useMemoFirebase(() => {
    if (!firestore || !user) return null;
    return collection(firestore, "users", user.uid, "tasks");
  }, [firestore, user]);

  const { data: tasks, isLoading: isTasksLoading } = useCollection<Task>(tasksQuery);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  if (isUserLoading) return null;
  if (!user) {
    router.push("/login");
    return null;
  }

  const handleAddTask = () => {
    if (!newTask.title.trim()) return;

    const taskData = {
      ...newTask,
      context,
      userId: user.uid,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      dueDate: new Date().toISOString(),
    };

    const colRef = collection(firestore, "users", user.uid, "tasks");
    addDocumentNonBlocking(colRef, taskData);
    setNewTask({ title: "", description: "", priority: "media", status: "Pendiente" });
    setIsDialogOpen(false);
  };

  const handleDeleteTask = (taskId: string) => {
    const docRef = doc(firestore, "users", user.uid, "tasks", taskId);
    deleteDocumentNonBlocking(docRef);
  };

  const onDragEnd = (event: any) => {
    const { active, over } = event;
    if (!over) return;

    const activeId = active.id;
    const overId = over.id;

    // Check if dropped over a column or another card
    const overStatus = COLUMNS.includes(overId as Status) 
      ? (overId as Status) 
      : tasks?.find(t => t.id === overId)?.status;

    if (overStatus && active.data.current.status !== overStatus) {
      const docRef = doc(firestore, "users", user.uid, "tasks", activeId);
      updateDocumentNonBlocking(docRef, { 
        status: overStatus,
        updatedAt: serverTimestamp()
      });
    }
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-4xl font-black tracking-tighter flex items-center gap-3">
            Tablero <span className="text-primary">{context}</span>
          </h2>
          <p className="text-[10px] text-muted-foreground uppercase font-black tracking-[0.3em] mt-1">
            Optimiza tu flujo de trabajo digital
          </p>
        </div>
        
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button className="rounded-2xl h-14 px-8 font-black uppercase tracking-widest text-xs neon-glow transition-all hover:scale-105">
              <Plus className="w-5 h-5 mr-2" /> Nueva Tarea
            </Button>
          </DialogTrigger>
          <DialogContent className="glass-card border-white/10 bg-black/90 sm:max-w-[425px]">
            <DialogHeader>
              <DialogTitle className="text-2xl font-black tracking-tighter uppercase">Crear Nueva Tarea</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="title" className="text-[10px] uppercase font-black">Título</Label>
                <Input 
                  id="title" 
                  value={newTask.title} 
                  onChange={(e) => setNewTask({...newTask, title: e.target.value})}
                  className="bg-white/5 border-white/10" 
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="desc" className="text-[10px] uppercase font-black">Descripción</Label>
                <Textarea 
                  id="desc" 
                  value={newTask.description}
                  onChange={(e) => setNewTask({...newTask, description: e.target.value})}
                  className="bg-white/5 border-white/10 min-h-[100px]" 
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-[10px] uppercase font-black">Prioridad</Label>
                  <Select value={newTask.priority} onValueChange={(v: Priority) => setNewTask({...newTask, priority: v})}>
                    <SelectTrigger className="bg-white/5 border-white/10">
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
                  <Label className="text-[10px] uppercase font-black">Estado</Label>
                  <Select value={newTask.status} onValueChange={(v: Status) => setNewTask({...newTask, status: v})}>
                    <SelectTrigger className="bg-white/5 border-white/10">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-zinc-900 border-white/10">
                      <SelectItem value="Pendiente">Pendiente</SelectItem>
                      <SelectItem value="Haciendo">Haciendo</SelectItem>
                      <SelectItem value="Hecho">Hecho</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button onClick={handleAddTask} className="w-full neon-glow font-black uppercase text-xs h-12 rounded-xl">Inyectar Tarea</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <DndContext sensors={sensors} collisionDetection={closestCorners} onDragEnd={onDragEnd}>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {COLUMNS.map((status) => (
            <Column 
              key={status} 
              status={status} 
              tasks={tasks?.filter(t => t.status === status && t.context === context) || []}
              onDelete={handleDeleteTask}
            />
          ))}
        </div>
      </DndContext>
    </div>
  );
}

function Column({ status, tasks, onDelete }: { status: Status, tasks: Task[], onDelete: (id: string) => void }) {
  return (
    <div className="space-y-4 min-h-[500px] flex flex-col">
      <div className="flex items-center justify-between px-4">
        <div className="flex items-center gap-3">
          <div className={cn(
            "w-2 h-2 rounded-full",
            status === 'Pendiente' ? 'bg-orange-500' : 
            status === 'Haciendo' ? 'bg-primary neon-glow' : 'bg-blue-500 shadow-[0_0_10px_rgba(59,130,246,0.5)]'
          )} />
          <h3 className="font-black uppercase tracking-[0.2em] text-xs">{status}</h3>
          <span className="text-[9px] font-black bg-white/5 px-2 py-0.5 rounded-lg border border-white/10 text-muted-foreground">
            {tasks.length}
          </span>
        </div>
      </div>

      <div className="glass rounded-[2rem] p-3 flex-1 bg-white/[0.01] border-white/5 border-dashed">
        <div className="space-y-3">
          <AnimatePresence>
            {tasks.map((task) => (
              <TaskCard key={task.id} task={task} onDelete={onDelete} />
            ))}
          </AnimatePresence>
          {tasks.length === 0 && (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground opacity-20">
              <AlertCircle className="w-8 h-8 mb-2" />
              <p className="text-[10px] font-black uppercase">Vacío</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function TaskCard({ task, onDelete }: { task: Task, onDelete: (id: string) => void }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: task.id,
    data: { status: task.status }
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.3 : 1,
  };

  return (
    <motion.div
      ref={setNodeRef}
      style={style}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95 }}
      className="group bg-card/40 border border-white/5 rounded-[1.5rem] p-5 hover:border-primary/40 transition-all cursor-default"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 space-y-3">
          <div className="flex items-center gap-2">
            <span className={cn(
              "text-[8px] font-black px-2 py-0.5 rounded-full uppercase tracking-tighter border",
              task.priority === 'alta' ? 'bg-red-500/10 text-red-500 border-red-500/20 shadow-[0_0_10px_rgba(239,68,68,0.2)]' :
              task.priority === 'media' ? 'bg-primary/10 text-primary border-primary/20' : 
              'bg-zinc-500/10 text-zinc-500 border-zinc-500/20'
            )}>
              {task.priority}
            </span>
            <span className="text-[8px] font-black text-muted-foreground uppercase flex items-center gap-1">
              <Tag className="w-2.5 h-2.5" /> {task.context}
            </span>
          </div>
          <h4 className="text-sm font-bold leading-tight group-hover:text-white transition-colors">{task.title}</h4>
          {task.description && (
            <p className="text-[10px] text-muted-foreground line-clamp-2 font-medium">{task.description}</p>
          )}
        </div>
        <div className="flex flex-col gap-2">
          <div {...attributes} {...listeners} className="p-1 hover:bg-white/5 rounded-lg cursor-grab active:cursor-grabbing">
            <GripVertical className="w-4 h-4 text-muted-foreground/30" />
          </div>
          <button 
            onClick={() => onDelete(task.id)}
            className="p-1 hover:bg-red-500/10 rounded-lg text-muted-foreground/20 hover:text-red-500 transition-colors"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>
    </motion.div>
  );
}

