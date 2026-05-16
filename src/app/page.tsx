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
      router.push("/welcome");
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

function DashboardSkeleton() {
  return (
    <div className="space-y-10 md:space-y-12 pb-24 px-4 sm:px-6 lg:px-8 max-w-[1400px] mx-auto w-full animate-pulse">
      {/* Header Skeleton */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-8">
        <div className="space-y-4 max-w-2xl w-full">
          <div className="flex flex-wrap items-center gap-3">
             <Skeleton className="h-7 w-28 bg-muted/30 rounded-md" />
             <Skeleton className="h-7 w-20 bg-muted/30 rounded-md" />
          </div>
          <div className="space-y-3">
            <Skeleton className="h-12 md:h-16 w-3/4 max-w-md bg-muted/30 rounded-lg" />
            <Skeleton className="h-4 w-64 bg-muted/30 rounded-full" />
          </div>
        </div>
        <Skeleton className="h-16 w-full lg:w-48 bg-muted/30 rounded-2xl" />
      </div>

      {/* Metrics Skeleton */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
        {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-36 rounded-2xl bg-muted/30" />)}
      </div>

      {/* Quick Orientation Skeleton */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6">
        {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-28 rounded-2xl bg-muted/30" />)}
      </div>

      {/* Main Content Skeleton */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        <div className="lg:col-span-8 space-y-8">
          <div className="flex items-center justify-between border-b border-border pb-4">
             <Skeleton className="h-6 w-48 bg-muted/30 rounded-md" />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
            {[...Array(2)].map((_, i) => <Skeleton key={i} className="h-56 rounded-2xl bg-muted/30" />)}
          </div>
        </div>
        <div className="lg:col-span-4 space-y-6">
          <Skeleton className="h-[26rem] rounded-2xl bg-muted/30 w-full" />
        </div>
      </div>
    </div>
  );
}

  if (isUserLoading || !user || isTasksLoading) return <DashboardSkeleton />;

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-10 md:space-y-12 pb-24 px-4 sm:px-6 lg:px-8 max-w-[1400px] mx-auto w-full">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6">
        <div className="space-y-1">
          <h2 className="text-2xl md:text-3xl font-bold tracking-tight text-foreground">
            Panel <span className="text-primary">{context}</span>
          </h2>
          <p className="text-sm text-muted-foreground">
            {metrics.pendingTasksCount > 0
              ? `Tienes ${metrics.pendingTasksCount} tareas pendientes. Empieza por: ${metrics.nextPendingTask?.title ?? "tu tablero"}.`
              : "Todo al día. Puedes planificar la siguiente semana."}
          </p>
        </div>

        <Link href="/kanban">
          <Button variant="outline" className="rounded-xl border-border bg-muted/30 hover:bg-muted/50 gap-2">
            <span className="text-xs font-semibold">Abrir Kanban</span>
            <ArrowUpRight className="w-4 h-4 text-primary" />
          </Button>
        </Link>
      </div>

      {/* Metrics Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
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
              color={metrics.highPriorityTasks.length > 0 ? "text-red-500" : "text-muted-foreground/30"}
            />
            <MetricCard
              label="Integridad"
              value="OK"
              icon={<Cpu className="w-5 h-5 text-yellow-500" />}
              subValue="Servicios Activos"
              color="text-yellow-500"
            />
      </div>

      {/* Quick Orientation */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6">
        <Link href="/kanban" className="glass-card p-4 hover:border-primary/30 transition-colors group flex flex-col justify-between min-h-[100px]">
          <p className="text-xs font-semibold tracking-wider text-primary mb-2">Siguiente Paso</p>
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-sm font-bold uppercase tracking-wider">Mover y priorizar tareas</p>
              <p className="text-xs text-muted-foreground/70 mt-1">Reordena estados y resuelve bloqueos críticos.</p>
            </div>
            <Compass className="w-5 h-5 text-primary/70 group-hover:text-primary" />
          </div>
        </Link>

        <Link href="/schedule" className="glass-card p-4 hover:border-primary/30 transition-colors group flex flex-col justify-between min-h-[100px]">
          <p className="text-xs font-semibold tracking-wider text-primary mb-2">Plan Diario</p>
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-sm font-bold uppercase tracking-wider">Bloques de enfoque</p>
              <p className="text-xs text-muted-foreground/70 mt-1">Reserva tiempo para tareas de mayor impacto.</p>
            </div>
            <ListTodo className="w-5 h-5 text-primary/70 group-hover:text-primary" />
          </div>
        </Link>

        <Link href="/calendar" className="glass-card p-4 hover:border-primary/30 transition-colors group flex flex-col justify-between min-h-[100px]">
          <p className="text-xs font-semibold tracking-wider text-primary mb-2">Agenda</p>
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-sm font-bold uppercase tracking-wider">Revisa próximos eventos</p>
              <p className="text-xs text-muted-foreground/70 mt-1">Coordina entregas y reuniones en un solo lugar.</p>
            </div>
            <CalendarDays className="w-5 h-5 text-primary/70 group-hover:text-primary" />
          </div>
        </Link>
      </div>

      {/* Main Content */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        <div className="lg:col-span-8 space-y-8">
          <div className="flex items-center justify-between border-b border-border pb-4">
            <SectionLabel icon={<Layers className="w-5 h-5 text-primary" />}>Lo Más Urgente Hoy</SectionLabel>
            <div className="flex items-center gap-2">
              <div className="w-1.5 h-1.5 rounded-full bg-primary animate-ping" />
              <span className="text-[11px] font-black text-primary uppercase tracking-[0.3em] hidden sm:inline font-data">En Vivo</span>
            </div>
          </div>

          <div className="flex flex-col gap-4">
            <AnimatePresence mode="popLayout">
              {metrics.highPriorityTasks.length > 0 ? (
                metrics.highPriorityTasks.map((task, i) => (
                  <motion.div
                    key={task.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.05 }}
                    className="glass-card p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:border-primary/30 transition-all group relative"
                  >
                    <div className="space-y-1 relative flex-1">
                      <h4 className="font-bold text-base md:text-lg tracking-tight group-hover:text-primary transition-colors duration-300">
                        {task.title}
                      </h4>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-red-500/10 text-red-500 border border-red-500/20 uppercase">
                          CRÍTICO
                        </span>
                        <p className="text-xs text-muted-foreground flex items-center gap-1">
                          <Clock className="w-3 h-3 text-primary" />
                          <span>Prioridad Alta</span>
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center justify-between sm:justify-end gap-4 shrink-0 border-t sm:border-t-0 pt-3 sm:pt-0 border-border">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleQuickComplete(task.id)}
                        className="text-xs font-semibold text-primary/80 hover:text-primary hover:bg-primary/5 h-9 px-3 rounded-lg flex items-center gap-1.5"
                      >
                        <Check className="w-3.5 h-3.5" /> Finalizar
                      </Button>
                    </div>
                  </motion.div>
                ))
              ) : (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="py-12 glass-card border-dashed flex flex-col items-center justify-center"
                >
                  <CheckCircle2 className="w-12 h-12 mb-3 stroke-[0.5] text-primary/30" />
                  <p className="text-xs font-semibold tracking-wider text-muted-foreground/60">Todo al día</p>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>

        <div className="lg:col-span-4 space-y-6">
          <div className="glass-card p-6 space-y-6">
            <SectionLabel icon={<Zap className="w-4 h-4 text-yellow-500" />} className="text-foreground mb-4">Acción Rápida</SectionLabel>
            
            {metrics.nextPendingTask ? (
              <div className="space-y-3">
                <p className="text-xs font-semibold text-muted-foreground">⚡ Próxima Tarea</p>
                <div className="p-4 rounded-xl border border-border bg-muted/20 space-y-3">
                  <p className="text-sm font-bold">{metrics.nextPendingTask.title}</p>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-primary/10 text-primary border border-primary/20 uppercase">
                      {metrics.nextPendingTask.priority}
                    </span>
                  </div>
                  <div className="flex gap-2 pt-2">
                    <Button
                      size="sm"
                      onClick={() => handleQuickComplete(metrics.nextPendingTask!.id)}
                      className="w-full rounded-lg text-xs font-semibold bg-primary text-primary-foreground hover:bg-primary/90 h-8 shadow-sm"
                    >
                      <Check className="w-3.5 h-3.5 mr-1.5" /> Completar
                    </Button>
                    <Link href="/kanban" className="w-full">
                      <Button
                        size="sm"
                        variant="outline"
                        className="w-full rounded-lg text-xs font-semibold border-border bg-muted/30 hover:bg-muted/50 h-8"
                      >
                        Ver Kanban
                      </Button>
                    </Link>
                  </div>
                </div>
              </div>
            ) : (
              <p className="text-xs text-muted-foreground/70">No hay tareas pendientes.</p>
            )}

            <div className="pt-6 border-t border-border space-y-3">
              <p className="text-xs font-semibold text-muted-foreground">📊 Resumen del Día</p>
              <div className="space-y-2 text-xs text-muted-foreground/80">
                <p className="flex justify-between">
                  <span>Contexto Activo</span>
                  <span className="font-semibold text-foreground">{context}</span>
                </p>
                <p className="flex justify-between">
                  <span>Tareas Pendientes</span>
                  <span className="font-semibold text-foreground">{metrics.pendingTasksCount}</span>
                </p>
                <p className="flex justify-between">
                  <span>Completadas</span>
                  <span className="font-semibold text-foreground">{metrics.completedCount}</span>
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
