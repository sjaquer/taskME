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
  Compass,
  ListTodo,
  CalendarDays,
} from "lucide-react";
import { useEffect, useMemo } from "react";
import { useUser, useFirestore, useCollectionOnce, useMemoFirebase } from "@/firebase";
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
  const { context, defaultPage } = useAppContextStore();
  const { user, isUserLoading } = useUser();
  const firestore = useFirestore();
  const router = useRouter();

  useEffect(() => {
    if (!isUserLoading && !user) {
      router.push("/login");
    } else if (!isUserLoading && user) {
      if (defaultPage && defaultPage !== "/" && !sessionStorage.getItem("hasRedirectedToDefault")) {
        sessionStorage.setItem("hasRedirectedToDefault", "true");
        router.push(defaultPage);
      }
    }
  }, [user, isUserLoading, router, defaultPage]);

  const tasksQuery = useMemoFirebase(() => {
    if (!firestore || !user) return null;
    return buildTasksQuery(firestore, user.uid, context);
  }, [firestore, user, context]);

  const { data: tasks, isLoading: isTasksLoading } = useCollectionOnce<Task>(tasksQuery);

  const metrics = useMemo(() => {
    if (!tasks)
      return {
        allTasks: [] as Task[],
        completedCount: 0,
        progressPercent: 0,
        highPriorityTasks: [] as Task[],
        pendingTasksCount: 0,
        nextPendingTask: null as Task | null,
      };

    const completedCount = tasks.filter((t) => t.status === "Hecho").length;
    const progressPercent = tasks.length > 0 ? Math.round((completedCount / tasks.length) * 100) : 0;
    const highPriorityTasks = tasks.filter((t) => t.priority === "alta" && t.status !== "Hecho").slice(0, 3);
    const pendingTasksCount = tasks.filter((t) => t.status !== "Hecho").length;
    const nextPendingTask = tasks.find((t) => t.status !== "Hecho") || null;

    return { allTasks: tasks, completedCount, progressPercent, highPriorityTasks, pendingTasksCount, nextPendingTask };
  }, [tasks]);

  const handleQuickComplete = (taskId: string) => {
    if (!user || !firestore) return;
    completeTask(firestore, user.uid, taskId);
    toast({ variant: "success", title: "Nodo Finalizado", description: "Operación completada." });
  };

  if (isUserLoading || !user)
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
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-8 px-2">
        <div className="space-y-4 max-w-2xl">
          <div className="flex flex-wrap items-center gap-3">
            <div className="bg-primary/10 border border-primary/20 px-2.5 py-1 rounded-md">
              <span className="text-primary text-[11px] font-black uppercase tracking-[0.4em] flex items-center gap-2">
                <Terminal className="w-3 h-3" /> Cabine Grid
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
              Panel <span className="text-primary italic glow-text">{context}</span>
            </h2>
            {isTasksLoading ? (
              <Skeleton className="h-4 w-64 bg-white/[0.03] rounded-full" />
            ) : (
              <p className="text-white/40 text-[10px] md:text-xs font-black uppercase tracking-widest">
                {metrics.pendingTasksCount > 0
                  ? `Tienes ${metrics.pendingTasksCount} tareas pendientes. Empieza por: ${metrics.nextPendingTask?.title ?? "tu tablero"}.`
                  : "Todo al día. Puedes planificar la siguiente semana."}
              </p>
            )}
          </div>
        </div>

        <Link href="/kanban" className="group w-full md:w-auto">
          <div className="glass-card px-6 py-4 flex items-center justify-between md:justify-start gap-5 group-hover:border-primary/30 group-hover:scale-105 active:scale-95 transition-all cursor-pointer relative overflow-hidden">
            <div className="absolute inset-0 bg-primary/[0.03] opacity-0 group-hover:opacity-100 transition-opacity" />
            <div className="space-y-0.5">
              <span className="text-[10px] font-black uppercase tracking-[0.3em] relative z-10 block text-primary">Acceso</span>
              <span className="text-[11px] font-bold uppercase tracking-[0.1em] text-white/40 relative z-10">Abrir Kanban</span>
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
              subValue={`${metrics.completedCount}/${metrics.allTasks.length} Procesadas`}
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

      {/* Quick Orientation */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6 px-2">
        <Link href="/kanban" className="glass-card p-5 hover:border-primary/30 transition-colors group">
          <p className="text-[10px] uppercase font-black tracking-[0.25em] text-primary mb-2">Siguiente Paso</p>
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-sm font-black uppercase tracking-wider">Mover y priorizar tareas</p>
              <p className="text-[11px] text-white/40 mt-1">Reordena estados y resuelve bloqueos críticos.</p>
            </div>
            <Compass className="w-5 h-5 text-primary/70 group-hover:text-primary" />
          </div>
        </Link>

        <Link href="/schedule" className="glass-card p-5 hover:border-primary/30 transition-colors group">
          <p className="text-[10px] uppercase font-black tracking-[0.25em] text-primary mb-2">Plan Diario</p>
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-sm font-black uppercase tracking-wider">Bloques de enfoque</p>
              <p className="text-[11px] text-white/40 mt-1">Reserva tiempo para tareas de mayor impacto.</p>
            </div>
            <ListTodo className="w-5 h-5 text-primary/70 group-hover:text-primary" />
          </div>
        </Link>

        <Link href="/calendar" className="glass-card p-5 hover:border-primary/30 transition-colors group">
          <p className="text-[10px] uppercase font-black tracking-[0.25em] text-primary mb-2">Agenda</p>
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-sm font-black uppercase tracking-wider">Revisa próximos eventos</p>
              <p className="text-[11px] text-white/40 mt-1">Coordina entregas y reuniones en un solo lugar.</p>
            </div>
            <CalendarDays className="w-5 h-5 text-primary/70 group-hover:text-primary" />
          </div>
        </Link>
      </div>

      {/* Main Content */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 px-2">
        <div className="lg:col-span-8 space-y-8">
          <div className="flex items-center justify-between border-b border-white/[0.06] pb-4">
            <SectionLabel icon={<Layers className="w-5 h-5 text-primary" />}>Lo Más Urgente Hoy</SectionLabel>
            <div className="flex items-center gap-2">
              <div className="w-1.5 h-1.5 rounded-full bg-primary animate-ping" />
              <span className="text-[11px] font-black text-primary uppercase tracking-[0.3em] hidden sm:inline font-data">En Vivo</span>
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
                        <span className="font-data">Prioridad: Alta</span>
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
              <SystemFeature label="Pendientes" value={metrics.pendingTasksCount.toString()} icon={<Layers className="w-4 h-4" />} />
              <SystemFeature label="Cuenta" value={user.displayName || "Operador"} icon={<ShieldCheck className="w-4 h-4" />} />
            </div>
            <div className="pt-6 border-t border-white/[0.06] space-y-3">
              <p className="text-[11px] font-black text-white/20 uppercase tracking-[0.2em]">Estado Rápido</p>
              <div className="bg-[#050505] rounded-xl p-4 border border-white/[0.06] font-mono text-[9px] text-primary/60 space-y-1">
                <p>{">"} Sesión iniciada correctamente.</p>
                <p>{">"} Contexto activo: {context}.</p>
                <p>{">"} Tareas registradas: <span className="font-data">{metrics.allTasks.length}</span>.</p>
                <p>{">"} Completadas: <span className="font-data">{metrics.completedCount}</span>.</p>
                <p className="text-white/40 animate-pulse">{">"} Listo para continuar.</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
