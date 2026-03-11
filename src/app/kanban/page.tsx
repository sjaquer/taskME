
"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { useAppContextStore } from "@/lib/store";
import { Plus, MoreVertical, GripVertical } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type Status = 'Pendiente' | 'Haciendo' | 'Hecho';

interface Task {
  id: string;
  title: string;
  status: Status;
  priority: 'baja' | 'media' | 'alta';
}

const initialTasks: Task[] = [
  { id: '1', title: 'Completar wireframes', status: 'Pendiente', priority: 'alta' },
  { id: '2', title: 'Revisar documentación', status: 'Haciendo', priority: 'media' },
  { id: '3', title: 'Reunión con equipo', status: 'Hecho', priority: 'baja' },
];

export default function KanbanPage() {
  const { context } = useAppContextStore();
  const [tasks, setTasks] = useState<Task[]>(initialTasks);

  const columns: Status[] = ['Pendiente', 'Haciendo', 'Hecho'];

  return (
    <div className="space-y-8 max-w-full overflow-hidden">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-black tracking-tighter">Tablero de {context}</h2>
          <p className="text-xs text-muted-foreground uppercase tracking-widest font-bold">Gestión de flujo y estatus</p>
        </div>
        <Button size="icon" className="rounded-2xl h-12 w-12 neon-glow">
          <Plus className="w-6 h-6" />
        </Button>
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
                  {tasks.filter(t => t.status === status).length}
                </span>
              </div>
              <MoreVertical className="w-4 h-4 text-muted-foreground opacity-30 hover:opacity-100 transition-opacity cursor-pointer" />
            </div>

            <div className="glass rounded-[2.5rem] p-3 min-h-[500px] space-y-4 bg-white/[0.02]">
              {tasks.filter(t => t.status === status).map((task) => (
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
                        {task.priority}
                      </div>
                      <div className="flex -space-x-2">
                        {[1, 2].map(i => (
                          <div key={i} className="w-6 h-6 rounded-full border-2 border-background bg-secondary text-[8px] flex items-center justify-center font-black">
                            U{i}
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </motion.div>
              ))}
              
              <button className="w-full py-4 border-2 border-dashed border-white/5 rounded-3xl text-muted-foreground text-[10px] font-black uppercase tracking-widest hover:text-primary hover:border-primary/20 hover:bg-primary/5 transition-all flex items-center justify-center gap-2">
                <Plus className="w-4 h-4" />
                Tarea Rápida
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
