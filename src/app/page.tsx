
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
  Terminal,
  Activity,
  Check,
  ZapOff
} from "lucide-react";
import { useEffect, useState, useMemo } from "react";
import { useUser, useFirestore, useCollection, useMemoFirebase } from "@/firebase";
import { collection, query, where, doc, serverTimestamp } from "firebase/firestore";
import { isSameDay, parseISO, startOfToday } from "date-fns";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import Link from "next/link";
import { Skeleton } from "@/components/ui/skeleton";
import { updateDocumentNonBlocking } from "@/firebase/non-blocking-updates";
import { Button } from "@/components/ui/button";
import { toast } from "@/hooks/use-toast";

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
    return query(
      collection(firestore, "users", user.uid, "tasks"),
      where("context", "==", context)
    );
  }, [firestore, user, context]);

  const { data: tasks, isLoading: isTasksLoading } = useCollection<Task>(tasksQuery);

  const metrics = useMemo(() => {
    if (!tasks || !today) return { todayTasks: [], completedToday: 0, progressPercent: 0, highPriorityTasks: [], pendingTasksCount: 0 };

    const todayTasks = tasks.filter(t => 
      t.dueDate && isSameDay(parseISO(t.dueDate), today)
    );

    const completedToday = todayTasks.filter(t => t.status === "Hecho").length;
    const progressPercent = todayTasks.length > 0 ? Math.round((completedToday / todayTasks.length) * 100) : 0;
    
    const highPriorityTasks = todayTasks
      .filter(t => t.priority === 'alta' && t.status !== "Hecho")
      .slice(0, 3);

    const pendingTasksCount = todayTasks.filter(t => t.status !== "Hecho").length;

    return { todayTasks, completedToday, progressPercent, highPriorityTasks, pendingTasksCount };
  }, [tasks, today]);

  const handleQuickComplete = (taskId: string) => {
    if (!user || !firestore) return;
    const docRef = doc(firestore, "users", user.uid, "tasks", taskId);
    updateDocumentNonBlocking(docRef, { status: "Hecho", updatedAt: serverTimestamp() });
    toast({ 
      title: "Nodo Finalizado", 
      description: "Operación de datos completada con éxito.",
      variant: "default"
    });
  };

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
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-10 px-2">
        <div className="space-y-6 max-w-3xl">
          <motion.div 
            initial={{ x: -20, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            className="flex items-center gap-4"
          >
            <div className="bg-primary/10 border border-primary/20 px-3 py-1 rounded-md">
              <span className="text-primary text-[9px] font-black uppercase tracking-[0.4em] flex items-center gap-2">
                <Terminal className="w-3 h-3" /> System Terminal Ready
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse shadow-[0_0_8px_rgba(57,255,20,0.8)]" />
              <span className="text-[9px] font-black text-white/40 uppercase tracking-widest">Online</span>
            </div>
          </motion.div>
          
          <h2 className="text-6xl md:text-8xl font-black tracking-tighter leading-[0.85] text-white">
            Protocolo <span className="text-primary italic glow-text">{context}</span>
          </h2>
          
          <div className="flex items-center gap-4">
            {isTasksLoading ? (
              <Skeleton className="h-6 w-80 bg-white/5 rounded-full" />
            ) : (
              <p className="text-white/60 text-lg font-medium tracking-tight">
                {metrics.pendingTasksCount > 0 
                  ? `Optimización requerida: ${metrics.pendingTasksCount} nodos críticos detectados en el pipeline diario.` 
                  : "Estado del sistema: Nominal. Todos los procesos del ciclo actual finalizados."}
              </p>
            )}
          </div>
        </div>

        <Link href="/kanban" className="group">
          <div className="glass px-10 py-5 rounded-[2.5rem] flex items-center gap-5 border-white/5 group-hover:border-primary/40 group-hover:scale-105 active:scale-95 transition-all cursor-pointer shadow-2xl relative overflow-hidden">
            <div className="absolute inset-0 bg-primary/5 opacity-0 group-hover:opacity-100 transition-opacity" />
            <span className="text-[11px] font-black uppercase tracking-[0.2em] relative z-10">Acceder al Tablero</span>
            <ArrowUpRight className="w-6 h-6 text-primary group-hover:translate-x-1 group-hover:-translate-y-1 transition-transform relative z-10" />
          </div>
        </Link>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 px-2">
        {isTasksLoading ? (
          [...Array(4)].map((_, i) => <Skeleton key={i} className="h-44 rounded-[2.5rem] bg-white/5" />)
        ) : (
          <>
            <MetricCard 
              label="Eficiencia de Ciclo" 
              value={`${metrics.progressPercent}%`} 
              icon={<Target className="w-6 h-6 text-primary" />} 
              subValue={`${metrics.completedToday} de ${metrics.todayTasks.length} Tareas Procesadas`}
              color="text-primary"
            />
            <MetricCard 
              label="Carga del Sistema" 
              value={metrics.pendingTasksCount.toString()} 
              icon={<Activity className="w-6 h-6 text-blue-400" />} 
              subValue="Nodos en cola de ejecución"
              color="text-blue-400"
            />
            <MetricCard 
              label="Alertas de Enfoque" 
              value={metrics.highPriorityTasks.length.toString()} 
              icon={<AlertTriangle className="w-6 h-6 text-red-500" />} 
              subValue="Requieren intervención inmediata"
              color={metrics.highPriorityTasks.length > 0 ? "text-red-500" : "text-white/20"}
            />
            <MetricCard 
              label="Integridad Operativa" 
              value="ACTIVA" 
              icon={<Zap className="w-6 h-6 text-yellow-500" />} 
              subValue="Servicios de backend estables"
              color="text-yellow-500"
            />
          </>
        )}
      </div>

      <div className="space-y-10 px-2">
        <div className="flex items-center justify-between border-b border-white/5 pb-6">
          <h3 className="text-sm font-black uppercase tracking-[0.4em] text-white/40 flex items-center gap-5">
            <TrendingUp className="w-6 h-6 text-primary" />
            Prioridades en Ejecución
          </h3>
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-primary animate-ping" />
            <span className="text-[10px] font-black text-primary uppercase tracking-[0.3em]">Live Monitor</span>
          </div>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          <AnimatePresence mode="popLayout">
            {isTasksLoading ? (
               [...Array(3)].map((_, i) => <Skeleton key={i} className="h-72 rounded-[3rem] bg-white/5" />)
            ) : metrics.highPriorityTasks.length > 0 ? (
              metrics.highPriorityTasks.map((task, i) => (
                <motion.div
                  key={task.id}
                  initial={{ opacity: 0, y: 30 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.1, type: "spring", stiffness: 100 }}
                  className="glass-card p-10 flex flex-col gap-8 hover:scale-[1.02] active:scale-95 group relative shadow-2xl border-white/5 hover:border-primary/30"
                >
                  <div className="absolute top-0 right-0 w-40 h-40 bg-primary/5 rounded-full -mr-20 -mt-20 blur-[80px] group-hover:bg-primary/15 transition-colors duration-500" />
                  
                  <div className="flex items-center justify-between relative">
                    <div className="w-16 h-16 rounded-2xl bg-white/5 flex items-center justify-center border border-white/10 group-hover:bg-primary/10 transition-colors shadow-2xl">
                      <Activity className="w-8 h-8 text-primary group-hover:scale-110 transition-transform" />
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      <span className="text-[10px] font-black text-red-500 px-4 py-1.5 rounded-full bg-red-500/10 border border-red-500/20 shadow-[0_0_15px_rgba(239,68,68,0.2)]">
                        PRIORIDAD ALTA
                      </span>
                    </div>
                  </div>

                  <div className="space-y-4 relative">
                    <h4 className="font-black text-3xl tracking-tighter leading-none group-hover:text-primary transition-colors duration-300">
                      {task.title}
                    </h4>
                    <p className="text-[11px] text-white/40 uppercase font-black tracking-widest flex items-center gap-3">
                      <Clock className="w-4 h-4 text-primary" /> Vence: {task.dueDate ? task.dueDate.split('T')[1].slice(0, 5) : '00:00'} h
                    </p>
                  </div>
                  
                  <div className="mt-auto pt-6 border-t border-white/5 flex items-center justify-between">
                     <Button 
                       variant="ghost" 
                       size="sm" 
                       onClick={() => handleQuickComplete(task.id)}
                       className="text-[10px] font-black uppercase tracking-widest text-primary/60 hover:text-primary hover:bg-primary/5 h-10 px-4 rounded-xl"
                     >
                       <Check className="w-4 h-4 mr-2" /> Finalizar Nodo
                     </Button>
                     <ArrowUpRight className="w-5 h-5 text-white/10 group-hover:text-primary transition-colors" />
                  </div>
                </motion.div>
              ))
            ) : (
              <motion.div 
                initial={{ opacity: 0 }} 
                animate={{ opacity: 1 }}
                className="col-span-full py-32 glass rounded-[4rem] border-dashed border-white/10 flex flex-col items-center justify-center text-white/5"
              >
                <CheckCircle2 className="w-24 h-24 mb-6 stroke-[0.5] text-primary/30 animate-float" />
                <p className="text-xl font-black uppercase tracking-[0.5em] text-center text-white/20">Protocolos Sincronizados</p>
                <p className="text-[10px] mt-4 font-bold uppercase tracking-[0.3em] text-white/10">No hay alertas críticas en el sector actual</p>
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
    <Card className="glass-card hover:border-primary/30 group relative overflow-hidden p-1 shadow-2xl transition-all duration-500">
      <div className="absolute -right-8 -top-8 w-32 h-32 bg-primary/5 rounded-full blur-[60px] group-hover:bg-primary/10 transition-colors duration-700" />
      <CardHeader className="pb-6 relative px-8 pt-8">
        <CardTitle className="text-[10px] text-white/40 flex items-center gap-4 uppercase tracking-[0.4em] font-black">
          <div className="p-2 bg-white/5 rounded-xl border border-white/10 group-hover:bg-primary/10 transition-colors">
            {icon}
          </div>
          {label}
        </CardTitle>
      </CardHeader>
      <CardContent className="relative px-8 pb-10 space-y-3">
        <div className={cn("text-5xl md:text-7xl font-black tracking-tighter leading-none italic", color)}>
          {value}
        </div>
        <p className="text-[10px] text-white/30 font-black uppercase tracking-[0.2em] pt-2 border-t border-white/5">
          {subValue}
        </p>
      </CardContent>
    </Card>
  );
}
