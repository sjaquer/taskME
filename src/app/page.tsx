
"use client";

import { motion, AnimatePresence } from "framer-motion";
import { useAppContextStore } from "@/lib/store";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { 
  CheckCircle2, 
  Circle, 
  Clock, 
  TrendingUp, 
  Zap, 
  AlertTriangle,
  ArrowUpRight,
  Target,
  Loader2
} from "lucide-react";
import { useEffect, useState, useMemo } from "react";
import { useUser, useFirestore, useCollection, useMemoFirebase } from "@/firebase";
import { collection } from "firebase/firestore";
import { isSameDay, parseISO, startOfToday } from "date-fns";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import Link from "next/link";
import { Skeleton } from "@/components/ui/skeleton";

interface Task {
  id: string;
  title: string;
  description?: string;
  status: string;
  priority: 'baja' | 'media' | 'alta';
  context: string;
  dueDate: string;
}

export default function Home() {
  const { context } = useAppContextStore();
  const { user, isUserLoading } = useUser();
  const firestore = useFirestore();
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const [today, setToday] = useState<Date | null>(null);

  useEffect(() => {
    setMounted(true);
    setToday(startOfToday());
  }, []);

  const tasksQuery = useMemoFirebase(() => {
    if (!firestore || !user) return null;
    return collection(firestore, "users", user.uid, "tasks");
  }, [firestore, user]);

  const { data: tasks, isLoading: isTasksLoading } = useCollection<Task>(tasksQuery);

  const metrics = useMemo(() => {
    if (!tasks || !today) return { todayTasks: [], completedToday: 0, progressPercent: 0, highPriorityTasks: [], pendingTasksCount: 0 };

    const todayTasks = tasks.filter(t => 
      t.context === context && t.dueDate && isSameDay(parseISO(t.dueDate), today)
    );

    const completedToday = todayTasks.filter(t => t.status === "Hecho").length;
    const progressPercent = todayTasks.length > 0 ? Math.round((completedToday / todayTasks.length) * 100) : 0;
    
    const highPriorityTasks = todayTasks
      .filter(t => t.priority === 'alta' && t.status !== "Hecho")
      .slice(0, 3);

    const pendingTasksCount = todayTasks.filter(t => t.status !== "Hecho").length;

    return { todayTasks, completedToday, progressPercent, highPriorityTasks, pendingTasksCount };
  }, [tasks, context, today]);

  if (!mounted || isUserLoading) return null;
  if (!user) {
    router.push("/login");
    return null;
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="space-y-12 pb-24"
    >
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-8 px-2">
        <div className="space-y-4">
          <motion.div 
            initial={{ x: -20, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            className="flex items-center gap-3 text-primary text-[10px] font-black uppercase tracking-[0.5em]"
          >
            <span className="w-10 h-px bg-primary/40" /> Terminal de Control Activa
          </motion.div>
          <h2 className="text-5xl md:text-7xl font-black tracking-tighter leading-none">
            Enfoque: <span className="text-primary glow-text">{context}</span>
          </h2>
          <div className="flex items-center gap-3">
            {isTasksLoading ? (
              <Skeleton className="h-4 w-64 bg-white/5" />
            ) : (
              <p className="text-muted-foreground text-sm font-bold flex items-center gap-3">
                <Zap className="w-4 h-4 text-primary animate-pulse" />
                {metrics.pendingTasksCount > 0 
                  ? `${metrics.pendingTasksCount} nodos críticos pendientes para el ciclo actual.` 
                  : "Estado nominal. Sin tareas pendientes para hoy."}
              </p>
            )}
          </div>
        </div>

        <Link href="/kanban" className="group">
          <div className="glass px-8 py-4 rounded-[2rem] flex items-center gap-4 border-white/5 group-hover:border-primary/40 transition-all cursor-pointer shadow-xl">
            <span className="text-[10px] font-black uppercase tracking-widest">Abrir Tablero</span>
            <ArrowUpRight className="w-5 h-5 text-primary group-hover:translate-x-1 group-hover:-translate-y-1 transition-transform" />
          </div>
        </Link>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 px-2">
        {isTasksLoading ? (
          [...Array(4)].map((_, i) => <Skeleton key={i} className="h-32 rounded-[2rem] bg-white/5" />)
        ) : (
          <>
            <MetricCard 
              label="Eficiencia Diaria" 
              value={`${metrics.progressPercent}%`} 
              icon={<Target className="w-5 h-5 text-primary" />} 
              subValue={`${metrics.completedToday}/${metrics.todayTasks.length} Tareas`}
              color="text-primary"
            />
            <MetricCard 
              label="Nodos Pendientes" 
              value={metrics.pendingTasksCount.toString()} 
              icon={<Clock className="w-5 h-5" />} 
              subValue="Procesos en cola"
            />
            <MetricCard 
              label="Alertas Críticas" 
              value={metrics.highPriorityTasks.length.toString()} 
              icon={<AlertTriangle className="w-5 h-5 text-red-500" />} 
              subValue="Requiere intervención"
              color={metrics.highPriorityTasks.length > 0 ? "text-red-500" : ""}
            />
            <MetricCard 
              label="Estado Global" 
              value="ACTIVO" 
              icon={<Zap className="w-5 h-5 text-yellow-500" />} 
              subValue="Integridad del sistema"
            />
          </>
        )}
      </div>

      <div className="space-y-8 px-2">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-black uppercase tracking-[0.5em] text-muted-foreground flex items-center gap-4">
            <TrendingUp className="w-5 h-5 text-primary" />
            Prioridades en Pipeline
          </h3>
          <span className="text-[10px] font-black text-primary/30 uppercase tracking-[0.3em]">Monitor en tiempo real</span>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <AnimatePresence mode="popLayout">
            {isTasksLoading ? (
               [...Array(3)].map((_, i) => <Skeleton key={i} className="h-64 rounded-[3rem] bg-white/5" />)
            ) : metrics.highPriorityTasks.length > 0 ? (
              metrics.highPriorityTasks.map((task, i) => (
                <motion.div
                  key={task.id}
                  initial={{ opacity: 0, y: 30 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.1 }}
                  className="glass p-8 md:p-10 rounded-[3rem] flex flex-col gap-6 hover:border-primary/50 transition-all cursor-pointer group relative overflow-hidden shadow-2xl"
                >
                  <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-full -mr-16 -mt-16 blur-3xl group-hover:bg-primary/10 transition-colors" />
                  
                  <div className="flex items-start justify-between relative">
                    <div className="w-14 h-14 rounded-[1.5rem] bg-white/5 flex items-center justify-center border border-white/10 group-hover:bg-primary/10 transition-colors shadow-inner">
                      <Circle className="w-7 h-7 text-primary" />
                    </div>
                    <div className="text-[10px] font-black text-red-500 px-4 py-1.5 rounded-full bg-red-500/10 border border-red-500/20 shadow-[0_0_20px_rgba(239,68,68,0.2)]">
                      CRÍTICO
                    </div>
                  </div>

                  <div className="space-y-2 relative">
                    <h4 className="font-black text-2xl md:text-3xl tracking-tight leading-tight group-hover:text-primary transition-colors">
                      {task.title}
                    </h4>
                    <p className="text-[10px] text-muted-foreground uppercase font-black tracking-widest mt-2 flex items-center gap-2">
                      <Clock className="w-4 h-4" /> Vence hoy • {task.dueDate ? task.dueDate.split('T')[1].slice(0, 5) : '00:00'}
                    </p>
                  </div>
                </motion.div>
              ))
            ) : (
              <motion.div 
                initial={{ opacity: 0 }} 
                animate={{ opacity: 1 }}
                className="col-span-full py-24 md:py-32 glass rounded-[4rem] border-dashed border-white/10 flex flex-col items-center justify-center text-muted-foreground/10"
              >
                <CheckCircle2 className="w-24 h-24 mb-6 stroke-[0.5] text-primary/20" />
                <p className="text-[12px] font-black uppercase tracking-[0.6em] text-center">Protocolos Completados</p>
                <p className="text-[9px] mt-4 font-bold uppercase tracking-widest text-white/20">Sin alertas de prioridad en el ciclo actual</p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </motion.div>
  );
}

function MetricCard({ label, value, icon, subValue, color }: { label: string, value: string, icon: React.ReactNode, subValue: string, color?: string }) {
  return (
    <Card className="glass-card border-white/5 bg-black/40 hover:border-primary/20 transition-all group relative overflow-hidden p-2">
      <div className="absolute -right-6 -top-6 w-24 h-24 bg-primary/5 rounded-full blur-3xl group-hover:bg-primary/10 transition-colors" />
      <CardHeader className="pb-4 relative">
        <CardTitle className="text-[10px] text-muted-foreground flex items-center gap-3 uppercase tracking-[0.3em] font-black">
          {icon} {label}
        </CardTitle>
      </CardHeader>
      <CardContent className="relative space-y-1">
        <div className={cn("text-4xl md:text-6xl font-black tracking-tighter leading-none", color)}>
          {value}
        </div>
        <p className="text-[10px] text-muted-foreground/30 font-black uppercase tracking-widest pt-2">
          {subValue}
        </p>
      </CardContent>
    </Card>
  );
}
