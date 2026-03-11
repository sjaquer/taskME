
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
  Target
} from "lucide-react";
import { useEffect, useState } from "react";
import { useUser, useFirestore, useCollection, useMemoFirebase } from "@/firebase";
import { collection } from "firebase/firestore";
import { isSameDay, parseISO, startOfToday } from "date-fns";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import Link from "next/link";

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

  useEffect(() => {
    setMounted(true);
  }, []);

  const tasksQuery = useMemoFirebase(() => {
    if (!firestore || !user) return null;
    return collection(firestore, "users", user.uid, "tasks");
  }, [firestore, user]);

  const { data: tasks, isLoading: isTasksLoading } = useCollection<Task>(tasksQuery);

  if (!mounted || isUserLoading) return null;
  if (!user) {
    router.push("/login");
    return null;
  }

  // Lógica de métricas reales
  const todayTasks = tasks?.filter(t => 
    t.context === context && t.dueDate && isSameDay(parseISO(t.dueDate), startOfToday())
  ) || [];

  const completedToday = todayTasks.filter(t => t.status === "Hecho").length;
  const progressPercent = todayTasks.length > 0 ? Math.round((completedToday / todayTasks.length) * 100) : 0;
  
  const highPriorityTasks = todayTasks
    .filter(t => t.priority === 'alta' && t.status !== "Hecho")
    .slice(0, 3);

  const pendingTasksCount = todayTasks.filter(t => t.status !== "Hecho").length;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="space-y-8 md:space-y-12 pb-20"
    >
      {/* Header Seccion */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 px-2">
        <div className="space-y-3">
          <motion.div 
            initial={{ x: -20 }}
            animate={{ x: 0 }}
            className="flex items-center gap-2 text-primary text-[10px] font-black uppercase tracking-[0.4em]"
          >
            <span className="w-8 h-px bg-primary/40" /> Sistema de Control Activo
          </motion.div>
          <h2 className="text-4xl md:text-6xl font-black tracking-tighter leading-none">
            Enfoque: <span className="text-primary">{context}</span>
          </h2>
          <p className="text-muted-foreground text-xs md:text-sm font-medium flex items-center gap-2">
            <Zap className="w-4 h-4 text-primary animate-pulse" />
            {pendingTasksCount > 0 
              ? `Tienes ${pendingTasksCount} tareas críticas pendientes para hoy.` 
              : "Todo bajo control. No hay tareas pendientes para hoy."}
          </p>
        </div>

        <Link href="/kanban" className="group">
          <div className="glass px-6 py-3 rounded-2xl flex items-center gap-3 border-white/5 group-hover:border-primary/40 transition-all cursor-pointer">
            <span className="text-[10px] font-black uppercase tracking-widest">Abrir Tablero</span>
            <ArrowUpRight className="w-4 h-4 text-primary group-hover:translate-x-1 group-hover:-translate-y-1 transition-transform" />
          </div>
        </Link>
      </div>

      {/* Grid de Metricas */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6 px-2">
        <MetricCard 
          label="Progreso Diario" 
          value={`${progressPercent}%`} 
          icon={<Target className="w-4 h-4 text-primary" />} 
          subValue={`${completedToday}/${todayTasks.length} Tareas`}
          color="text-primary"
        />
        <MetricCard 
          label="Pendientes Hoy" 
          value={pendingTasksCount.toString()} 
          icon={<Clock className="w-4 h-4" />} 
          subValue="Nodos activos"
        />
        <MetricCard 
          label="Prioridad Alta" 
          value={highPriorityTasks.length.toString()} 
          icon={<AlertTriangle className="w-4 h-4 text-red-500" />} 
          subValue="Requiere atención"
          color={highPriorityTasks.length > 0 ? "text-red-500" : ""}
        />
        <MetricCard 
          label="Eficiencia" 
          value="A+" 
          icon={<Zap className="w-4 h-4 text-yellow-500" />} 
          subValue="Estado del sistema"
        />
      </div>

      {/* Pipeline de Prioridades */}
      <div className="space-y-6 px-2">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-black uppercase tracking-[0.4em] text-muted-foreground flex items-center gap-3">
            <TrendingUp className="w-4 h-4 text-primary" />
            Pipeline de Prioridades (Hoy)
          </h3>
          <span className="text-[10px] font-black text-primary/40 uppercase tracking-widest">Tiempo Real</span>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
          <AnimatePresence mode="popLayout">
            {highPriorityTasks.length > 0 ? (
              highPriorityTasks.map((task, i) => (
                <motion.div
                  key={task.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.1 }}
                  className="glass p-6 md:p-8 rounded-[2rem] md:rounded-[2.5rem] flex flex-col gap-4 hover:border-primary/50 transition-all cursor-pointer group relative overflow-hidden"
                >
                  <div className="absolute top-0 right-0 w-24 h-24 bg-primary/5 rounded-full -mr-12 -mt-12 blur-2xl group-hover:bg-primary/10 transition-colors" />
                  
                  <div className="flex items-start justify-between relative">
                    <div className="w-12 h-12 rounded-2xl bg-white/5 flex items-center justify-center border border-white/10 group-hover:bg-primary/10 transition-colors">
                      <Circle className="w-6 h-6 text-primary" />
                    </div>
                    <div className="text-[10px] font-black text-red-500 px-3 py-1 rounded-full bg-red-500/10 border border-red-500/20 shadow-[0_0_15px_rgba(239,68,68,0.2)]">
                      ALTA
                    </div>
                  </div>

                  <div className="space-y-1 relative">
                    <h4 className="font-black text-lg md:text-xl leading-tight group-hover:text-primary transition-colors">
                      {task.title}
                    </h4>
                    <p className="text-[10px] text-muted-foreground uppercase tracking-widest mt-1">
                      Vence hoy • {task.dueDate ? task.dueDate.split('T')[1].slice(0, 5) : '00:00'}
                    </p>
                  </div>
                </motion.div>
              ))
            ) : (
              <div className="col-span-full py-16 md:py-24 glass rounded-[2.5rem] border-dashed border-white/5 flex flex-col items-center justify-center text-muted-foreground/20">
                <CheckCircle2 className="w-16 h-16 mb-4 stroke-[1]" />
                <p className="text-[10px] font-black uppercase tracking-[0.4em]">Sin prioridades críticas</p>
                <p className="text-[8px] mt-2 font-bold uppercase">Relájate o agenda un nuevo proceso</p>
              </div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* CTA Footer para Movil */}
      <div className="md:hidden pt-4 px-2">
        <Link href="/kanban">
          <button className="w-full h-14 bg-primary text-black font-black uppercase tracking-widest text-xs rounded-2xl neon-glow">
            Ir al Tablero Completo
          </button>
        </Link>
      </div>
    </motion.div>
  );
}

function MetricCard({ label, value, icon, subValue, color }: { label: string, value: string, icon: React.ReactNode, subValue: string, color?: string }) {
  return (
    <Card className="glass-card border-white/5 bg-black/40 hover:border-primary/20 transition-all group relative overflow-hidden">
      <div className="absolute -right-4 -top-4 w-20 h-20 bg-primary/5 rounded-full blur-2xl group-hover:bg-primary/10 transition-colors" />
      <CardHeader className="pb-2 relative">
        <CardTitle className="text-[9px] md:text-[10px] text-muted-foreground flex items-center gap-2 uppercase tracking-[0.2em] font-black">
          {icon} {label}
        </CardTitle>
      </CardHeader>
      <CardContent className="relative">
        <div className={cn("text-3xl md:text-5xl font-black tracking-tighter", color)}>
          {value}
        </div>
        <p className="text-[8px] md:text-[9px] text-muted-foreground/40 font-black uppercase tracking-widest mt-2">
          {subValue}
        </p>
      </CardContent>
    </Card>
  );
}
