"use client";

import { motion, AnimatePresence } from "framer-motion";
import { useAppContextStore } from "@/lib/store";
import {
  CheckCircle2,
  Clock,
  Target,
  AlertTriangle,
  ArrowUpRight,
  Terminal,
  Activity,
  Check,
  Cpu,
  Layers,
  ShieldCheck,
  Zap,
} from "lucide-react";
import { useEffect, useState, useMemo } from "react";
import { useUser, useFirestore, useCollection, useMemoFirebase } from "@/firebase";
import { isSameDay, parseISO, startOfToday } from "date-fns";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { toast } from "@/hooks/use-toast";
import { MetricCard, SystemFeature } from "@/components/molecules";
import { StatusIndicator, SectionLabel } from "@/components/atoms";
import { buildTasksQuery, completeTask } from "@/services/task-service";
import type { Task } from "@/types/task";

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

  useEffect(() => {
    if (!isUserLoading && !user) {
      router.push("/login");
    }
  }, [user, isUserLoading, router]);

  const tasksQuery = useMemoFirebase(() => {
    if (!firestore || !user) return null;
    return buildTasksQuery(firestore, user.uid, context);
  }, [firestore, user, context]);

  const { data: tasks, isLoading: isTasksLoading } = useCollection<Task>(tasksQuery);

  const metrics = useMemo(() => {
    if (!tasks || !today)
      return { todayTasks: [] as Task[], completedToday: 0, progressPercent: 0, highPriorityTasks: [] as Task[], pendingTasksCount: 0 };

    const todayTasks = tasks.filter((t) => t.dueDate && isSameDay(parseISO(t.dueDate), today));
    const completedToday = todayTasks.filter((t) => t.status === "Hecho").length;
    const progressPercent = todayTasks.length > 0 ? Math.round((completedToday / todayTasks.length) * 100) : 0;
    const highPriorityTasks = todayTasks.filter((t) => t.priority === "alta" && t.status !== "Hecho").slice(0, 3);
    const pendingTasksCount = todayTasks.filter((t) => t.status !== "Hecho").length;

    return { todayTasks, completedToday, progressPercent, highPriorityTasks, pendingTasksCount };
  }, [tasks, today]);

  const handleQuickComplete = (taskId: string) => {
    if (!user || !firestore) return;
    completeTask(firestore, user.uid, taskId);
    toast({ title: "Nodo Finalizado", description: "Operación completada." });
  };

  if (!mounted || isUserLoading || !user)
    return (
      <div className="space-y-8 pb-24 px-4">
        <Skeleton className="h-20 w-full md:w-2/3 bg-white/[0.03]" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-44 rounded-2xl bg-white/[0.03]" />
          ))}
        </div>
      </div>
    );

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-10 md:space-y-12 pb-24">
      {/* HUD Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-8 px-2">
        <div className="space-y-4 max-w-2xl">
          <div className="flex flex-wrap items-center gap-3">
            <div className="bg-primary/10 border border-primary/20 px-2.5 py-1 rounded-md">
              <span className="text-primary text-[11px] font-black uppercase tracking-[0.4em] flex items-center gap-2">
                <Terminal className="w-3 h-3" /> System Terminal
              </span>
            </div>
            <div className="flex items-center gap-3">
              <StatusIndicator active label="Active" />
              <div className="flex items-center gap-1.5 border-l border-white/[0.06] pl-3">
                <ShieldCheck className="w-3 h-3 text-blue-500" />
                <span className="text-[11px] font-black text-white/40 uppercase tracking-widest">Secure</span>
              </div>
            </div>
          </div>

          <div className="space-y-1">
            <h2 className="text-3xl sm:text-5xl md:text-6xl font-black tracking-tighter leading-none text-white">
              Protocolo <span className="text-primary italic glow-text">{context}</span>
            </h2>
            {isTasksLoading ? (
              <Skeleton className="h-4 w-64 bg-white/[0.03] rounded-full" />
            ) : (
              <p className="text-white/40 text-[10px] md:text-xs font-black uppercase tracking-widest">
                {metrics.pendingTasksCount > 0
                  ? `Análisis: ${metrics.pendingTasksCount} nodos pendientes detectados en el ciclo.`
                  : "Estado: Nominal. Todos los procesos finalizados."}
              </p>
            )}
          </div>
        </div>

        <Link href="/kanban" className="group w-full md:w-auto">
          <div className="glass-card px-6 py-4 flex items-center justify-between md:justify-start gap-5 group-hover:border-primary/30 group-hover:scale-105 active:scale-95 transition-all cursor-pointer relative overflow-hidden">
            <div className="absolute inset-0 bg-primary/[0.03] opacity-0 group-hover:opacity-100 transition-opacity" />
            <div className="space-y-0.5">
              <span className="text-[10px] font-black uppercase tracking-[0.3em] relative z-10 block text-primary">Acceso</span>
              <span className="text-[11px] font-bold uppercase tracking-[0.1em] text-white/40 relative z-10">Tablero de Procesos</span>
            </div>
            <ArrowUpRight className="w-6 h-6 text-primary group-hover:translate-x-1 group-hover:-translate-y-1 transition-transform relative z-10" />
          </div>
        </Link>
      </div>

      {/* Metrics Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6 px-2">
        {isTasksLoading ? (
          [...Array(4)].map((_, i) => <Skeleton key={i} className="h-40 rounded-2xl bg-white/[0.03]" />)
        ) : (
          <>
            <MetricCard
              label="Eficiencia"
              value={`${metrics.progressPercent}%`}
              icon={<Target className="w-5 h-5 text-primary" />}
              subValue={`${metrics.completedToday}/${metrics.todayTasks.length} Procesadas`}
              color="text-primary"
            />
            <MetricCard
              label="Carga"
              value={metrics.pendingTasksCount.toString()}
              icon={<Activity className="w-5 h-5 text-blue-400" />}
              subValue="Nodos en cola"
              color="text-blue-400"
            />
            <MetricCard
              label="Alertas"
              value={metrics.highPriorityTasks.length.toString()}
              icon={<AlertTriangle className="w-5 h-5 text-red-500" />}
              subValue="Intervención Crítica"
              color={metrics.highPriorityTasks.length > 0 ? "text-red-500" : "text-white/20"}
            />
            <MetricCard
              label="Integridad"
              value="OK"
              icon={<Cpu className="w-5 h-5 text-yellow-500" />}
              subValue="Servicios Activos"
              color="text-yellow-500"
            />
          </>
        )}
      </div>

      {/* Main Content */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 px-2">
        <div className="lg:col-span-8 space-y-8">
          <div className="flex items-center justify-between border-b border-white/[0.06] pb-4">
            <SectionLabel icon={<Layers className="w-5 h-5 text-primary" />}>Prioridades de Ejecución</SectionLabel>
            <div className="flex items-center gap-2">
              <div className="w-1.5 h-1.5 rounded-full bg-primary animate-ping" />
              <span className="text-[11px] font-black text-primary uppercase tracking-[0.3em] hidden sm:inline font-data">Live Monitor</span>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
            <AnimatePresence mode="popLayout">
              {isTasksLoading ? (
                [...Array(2)].map((_, i) => <Skeleton key={i} className="h-64 rounded-2xl bg-white/[0.03]" />)
              ) : metrics.highPriorityTasks.length > 0 ? (
                metrics.highPriorityTasks.map((task, i) => (
                  <motion.div
                    key={task.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.1 }}
                    className="glass-card p-6 md:p-8 flex flex-col gap-6 hover:scale-[1.02] active:scale-95 group relative hover:border-primary/30"
                  >
                    <div className="absolute top-0 right-0 w-32 h-32 bg-primary/[0.03] rounded-full -mr-16 -mt-16 blur-[60px] group-hover:bg-primary/[0.06] transition-colors duration-500" />
                    <div className="flex items-center justify-between relative">
                      <div className="w-12 h-12 rounded-xl bg-white/[0.03] flex items-center justify-center border border-white/[0.06] group-hover:bg-primary/10 transition-colors">
                        <Activity className="w-5 h-5 text-primary group-hover:scale-110 transition-transform" />
                      </div>
                      <span className="text-[11px] font-black text-red-500 px-2 py-1 rounded-full bg-red-500/10 border border-red-500/20 font-data">CRÍTICO</span>
                    </div>
                    <div className="space-y-3 relative">
                      <h4 className="font-black text-xl md:text-2xl tracking-tighter leading-none group-hover:text-primary transition-colors duration-300">{task.title}</h4>
                      <p className="text-[9px] text-white/40 uppercase font-black tracking-widest flex items-center gap-2">
                        <Clock className="w-3.5 h-3.5 text-primary" />
                        <span className="font-data">Vence: {task.dueDate ? task.dueDate.split("T")[1]?.slice(0, 5) ?? "00:00" : "00:00"}</span>
                      </p>
                    </div>
                    <div className="mt-auto pt-4 border-t border-white/[0.06] flex items-center justify-between">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleQuickComplete(task.id)}
                        className="text-[9px] font-black uppercase tracking-widest text-primary/60 hover:text-primary hover:bg-primary/5 h-9 px-3 rounded-lg"
                      >
                        <Check className="w-3.5 h-3.5 mr-2" /> Finalizar
                      </Button>
                      <span className="text-[11px] font-black text-white/10 tracking-widest uppercase font-data">NODE_{task.id.slice(0, 4)}</span>
                    </div>
                  </motion.div>
                ))
              ) : (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="col-span-full py-16 glass-card border-dashed flex flex-col items-center justify-center"
                >
                  <CheckCircle2 className="w-12 h-12 mb-4 stroke-[0.5] text-primary/30 animate-float" />
                  <p className="text-sm font-black uppercase tracking-[0.5em] text-center text-white/20">Protocolos OK</p>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>

        <div className="lg:col-span-4 space-y-6">
          <div className="glass-card p-6 space-y-6 h-full">
            <SectionLabel icon={<Zap className="w-4 h-4 text-yellow-500" />} className="text-white/30 mb-4">Resumen Operativo</SectionLabel>
            <div className="space-y-4">
              <SystemFeature label="Contexto" value={context} icon={<Target className="w-4 h-4" />} />
              <SystemFeature label="Módulos" value="4/4" icon={<Layers className="w-4 h-4" />} />
              <SystemFeature label="Seguridad" value="Active" icon={<ShieldCheck className="w-4 h-4" />} />
            </div>
            <div className="pt-6 border-t border-white/[0.06] space-y-3">
              <p className="text-[11px] font-black text-white/20 uppercase tracking-[0.2em]">System Logs</p>
              <div className="bg-[#050505] rounded-xl p-4 border border-white/[0.06] font-mono text-[9px] text-primary/60 space-y-1">
                <p>{">"} Booting System...</p>
                <p>{">"} Auth: OK</p>
                <p>{">"} Syncing Firestore nodes...</p>
                <p>{">"} <span className="font-data">{metrics.todayTasks.length}</span> mapped.</p>
                <p className="text-white/40 animate-pulse">{">"} Ready.</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
