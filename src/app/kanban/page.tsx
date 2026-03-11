
"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { useAppContextStore } from "@/lib/store";
import { Plus, MoreVertical, GripVertical } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type Status = 'Pending' | 'Doing' | 'Done';

interface Task {
  id: string;
  title: string;
  status: Status;
  priority: 'low' | 'medium' | 'high';
}

const initialTasks: Task[] = [
  { id: '1', title: 'Complete wireframes', status: 'Pending', priority: 'high' },
  { id: '2', title: 'Review documentation', status: 'Doing', priority: 'medium' },
  { id: '3', title: 'Meeting with team', status: 'Done', priority: 'low' },
];

export default function KanbanPage() {
  const { context } = useAppContextStore();
  const [tasks, setTasks] = useState<Task[]>(initialTasks);

  const columns: Status[] = ['Pending', 'Doing', 'Done'];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-black">{context} Board</h2>
          <p className="text-xs text-muted-foreground">Manage your status and flow</p>
        </div>
        <Button size="icon" className="rounded-xl neon-glow">
          <Plus className="w-5 h-5" />
        </Button>
      </div>

      <div className="flex gap-4 overflow-x-auto pb-4 scrollbar-hide snap-x">
        {columns.map((status) => (
          <div key={status} className="flex-shrink-0 w-[85vw] sm:w-[320px] snap-center space-y-4">
            <div className="flex items-center justify-between px-2">
              <div className="flex items-center gap-2">
                <div className={cn(
                  "w-2 h-2 rounded-full",
                  status === 'Pending' ? 'bg-orange-500' : 
                  status === 'Doing' ? 'bg-primary neon-glow' : 'bg-blue-500'
                )} />
                <h3 className="font-bold uppercase tracking-widest text-xs opacity-60">{status}</h3>
                <span className="text-[10px] bg-white/5 px-1.5 py-0.5 rounded border border-white/10">
                  {tasks.filter(t => t.status === status).length}
                </span>
              </div>
              <MoreVertical className="w-4 h-4 text-muted-foreground" />
            </div>

            <div className="glass rounded-2xl p-2 min-h-[400px] space-y-3">
              {tasks.filter(t => t.status === status).map((task) => (
                <motion.div
                  layoutId={task.id}
                  key={task.id}
                  className="bg-background border border-white/5 rounded-xl p-4 shadow-lg flex items-start gap-3 group"
                >
                  <GripVertical className="w-4 h-4 text-muted-foreground/30 mt-0.5 cursor-grab group-hover:text-primary transition-colors" />
                  <div className="flex-1 space-y-2">
                    <h4 className="text-sm font-medium leading-tight">{task.title}</h4>
                    <div className="flex items-center justify-between">
                      <div className={cn(
                        "text-[10px] font-bold px-1.5 py-0.5 rounded uppercase tracking-tighter",
                        task.priority === 'high' ? 'bg-red-500/10 text-red-500' :
                        task.priority === 'medium' ? 'bg-primary/10 text-primary' : 'bg-white/10 text-muted-foreground'
                      )}>
                        {task.priority}
                      </div>
                      <div className="flex -space-x-2">
                        {[1, 2].map(i => (
                          <div key={i} className="w-5 h-5 rounded-full border border-background bg-secondary text-[8px] flex items-center justify-center font-bold">
                            U{i}
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </motion.div>
              ))}
              
              <button className="w-full py-3 border border-dashed border-white/10 rounded-xl text-muted-foreground text-xs hover:text-foreground hover:border-white/20 transition-all flex items-center justify-center gap-2">
                <Plus className="w-3 h-3" />
                Quick Task
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
