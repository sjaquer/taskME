
"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { useAppContextStore } from "@/lib/store";
import { Plus, MoreVertical, GripVertical, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useFirestore, useUser, useCollection, useMemoFirebase } from "@/firebase";
import { collection, doc, serverTimestamp } from "firebase/firestore";
import { addDocumentNonBlocking, updateDocumentNonBlocking } from "@/firebase/non-blocking-updates";
import { useRouter } from "next/navigation";

type Status = 'Pendiente' | 'Haciendo' | 'Hecho';

interface Task {
  id: string;
  title: string;
  status: Status;
  priority: 'baja' | 'media' | 'alta';
  context: string;
  userId: string;
}

export default function KanbanPage() {
  const { context } = useAppContextStore();
  const { user, isUserLoading } = useUser();
  const firestore = useFirestore();
  const router = useRouter();
  const [newTaskTitle, setNewTaskTitle] = useState("");

  const tasksQuery = useMemoFirebase(() => {
    if (!firestore || !user) return null;
    return collection(firestore, "users", user.uid, "tasks");
  }, [firestore, user]);

  const { data: tasks, isLoading: isTasksLoading } = useCollection<Task>(tasksQuery);

  if (isUserLoading) return null;
  if (!user) {
    router.push("/login");
    return null;
  }

  const columns: Status[] = ['Pendiente', 'Haciendo', 'Hecho'];

  const handleAddTask = (status: Status) => {
    if (!newTaskTitle.trim()) return;

    const taskData = {
      title: newTaskTitle,
      status,
      priority: 'media' as const,
      context,
      userId: user.uid,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      dueDate: new Date().toISOString(), // Default to today
    };

    const colRef = collection(firestore, "users", user.uid, "tasks");
    addDocumentNonBlocking(colRef, taskData);
    setNewTaskTitle("");
  };

  const updateTaskStatus = (taskId: string, newStatus: Status) => {
    const docRef = doc(firestore, "users", user.uid, "tasks", taskId);
    updateDocumentNonBlocking(docRef, { 
      status: newStatus,
      updatedAt: serverTimestamp()
    });
  };

  return (
    <div className="space-y-8 max-w-full overflow-hidden">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-black tracking-tighter">Tablero de {context}</h2>
          <p className="text-xs text-muted-foreground uppercase tracking-widest font-bold">Gestión de flujo y estatus</p>
        </div>
        <div className="flex gap-2">
          {isTasksLoading && <Loader2 className="w-6 h-6 animate-spin text-primary" />}
        </div>
      </div>

      <div className="flex gap-6 overflow-x-auto pb-8 scrollbar-hide snap-x md:grid md:grid-cols-3 md:overflow-visible">
        {columns.map((status) => (
          <div key={status} className="flex-shrink-0 w-[85vw] sm:w-[320px] md:w-full snap-center space-y-6">
            <div className="flex items-center justify-between px-2">
              <div className="flex items-center gap-3">
                <div className={cn(
                  "w-3 h-3 rounded-full",
                  status === 'Pendiente' ? 'bg-orange-500' : 
                  status === 'Haciendo' ? 'bg-primary neon-glow' : 'bg-blue-500'
                )} />
                <h3 className="font-black uppercase tracking-[0.2em] text-[10px] md:text-xs">{status}</h3>
                <span className="text-[10px] font-black bg-white/5 px-2 py-0.5 rounded-lg border border-white/10">
                  {tasks?.filter(t => t.status === status && t.context === context).length || 0}
                </span>
              </div>
              <MoreVertical className="w-4 h-4 text-muted-foreground opacity-30 hover:opacity-100 transition-opacity cursor-pointer" />
            </div>

            <div className="glass rounded-[2.5rem] p-3 min-h-[500px] space-y-4 bg-white/[0.02]">
              {tasks?.filter(t => t.status === status && t.context === context).map((task) => (
                <motion.div
                  layoutId={task.id}
                  key={task.id}
                  className="bg-card/50 border border-white/5 rounded-3xl p-5 shadow-2xl flex items-start gap-3 group hover:border-primary/30 transition-all"
                >
                  <GripVertical className="w-4 h-4 text-muted-foreground/30 mt-1 cursor-grab group-hover:text-primary transition-colors" />
                  <div className="flex-1 space-y-4">
                    <h4 className="text-sm font-bold leading-tight group-hover:text-white transition-colors">{task.title}</h4>
                    <div className="flex items-center justify-between">
                      <div className={cn(
                        "text-[9px] font-black px-2 py-0.5 rounded-full uppercase tracking-widest border",
                        task.priority === 'alta' ? 'bg-red-500/10 text-red-500 border-red-500/20' :
                        task.priority === 'media' ? 'bg-primary/10 text-primary border-primary/20' : 'bg-white/5 text-muted-foreground border-white/10'
                      )}>
                        {task.priority || 'media'}
                      </div>
                      <div className="flex gap-2">
                        {status !== 'Hecho' && (
                          <button 
                            onClick={() => updateTaskStatus(task.id, status === 'Pendiente' ? 'Haciendo' : 'Hecho')}
                            className="text-[9px] font-black text-primary hover:underline uppercase"
                          >
                            Mover
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                </motion.div>
              ))}
              
              <div className="relative">
                <input
                  type="text"
                  placeholder="Nueva tarea..."
                  className="w-full bg-white/5 border border-white/10 rounded-2xl p-4 text-xs font-medium focus:outline-none focus:border-primary/50 transition-all"
                  value={status === 'Pendiente' ? newTaskTitle : ""}
                  onChange={(e) => status === 'Pendiente' && setNewTaskTitle(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleAddTask(status)}
                />
                <button 
                  onClick={() => handleAddTask(status)}
                  className="absolute right-3 top-3 p-1.5 rounded-xl bg-primary/10 text-primary hover:bg-primary hover:text-primary-foreground transition-all"
                >
                  <Plus className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
