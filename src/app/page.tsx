"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowRight, CalendarDays, Check, Clock } from "lucide-react";
import { useUser, useFirestore, useTasks, useRoutines, useActiveContext } from "@/firebase";
import { Skeleton } from "@/components/ui/skeleton";
import { useAppContextStore } from "@/lib/store";
import { haptic } from "@/lib/native-features";
import { consumeLaunchRedirect } from "@/lib/launch-state";
import { getDueMeta, timeToMinutes } from "@/lib/tasks";
import { cn, formatTime } from "@/lib/utils";
import { setTaskStatus } from "@/services/task-service";
import type { Priority, Routine, Task } from "@/types/task";

const PRIORITY_RANK: Record<Priority, number> = { alta: 0, media: 1, baja: 2 };
const PRIORITY_DOT: Record<Priority, string> = { alta: "bg-red-500", media: "bg-amber-500", baja: "bg-blue-500" };

function getGreeting(date: Date) {
  const hour = date.getHours();
  if (hour < 12) return "Buenos días";
  if (hour < 19) return "Buenas tardes";
  return "Buenas noches";
}

export default function Home() {
  const { defaultPage, activeModules, hourFormat } = useAppContextStore();
  const { user, isUserLoading } = useUser();
  const firestore = useFirestore();
  const router = useRouter();
  const dashboardEnabled = activeModules.dashboard;
  const activeContext = useActiveContext();
  const { data: tasks, isLoading: isTasksLoading } = useTasks(activeContext.id);
  const { data: routines } = useRoutines(activeContext.id);
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    // La sesión la controla el shell (AuthGate); aquí solo se decide la página de inicio.
    if (isUserLoading || !user) return;
    if (!dashboardEnabled) {
      router.replace(defaultPage && defaultPage !== "/" ? defaultPage : "/kanban");
      return;
    }
    // Solo al abrir la app se salta a la página de inicio elegida; luego "/" muestra el Dashboard.
    if (consumeLaunchRedirect() && defaultPage && defaultPage !== "/") {
      router.replace(defaultPage);
    }
  }, [user, isUserLoading, router, defaultPage, dashboardEnabled]);

  useEffect(() => {
    const intervalId = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(intervalId);
  }, []);

  const summary = useMemo(() => {
    const open = tasks.filter((task) => task.status !== "Hecho");
    const withDue = open.map((task) => ({ task, due: getDueMeta(task.dueDate, task.dueTime) }));
    const forToday = withDue
      .filter(({ due }) => due && due.daysLeft <= 0)
      .sort((a, b) => (a.due!.daysLeft - b.due!.daysLeft) || PRIORITY_RANK[a.task.priority] - PRIORITY_RANK[b.task.priority])
      .map(({ task }) => task);
    const forTodayIds = new Set(forToday.map((task) => task.id));
    const highPriority = open.filter((task) => task.priority === "alta" && !forTodayIds.has(task.id)).slice(0, 3);
    // Si hoy hay poco, se sugieren las siguientes pendientes para que Inicio no quede vacío.
    const shownIds = new Set([...forTodayIds, ...highPriority.map((task) => task.id)]);
    const upNext =
      forToday.length + highPriority.length < 3
        ? open
            .filter((task) => !shownIds.has(task.id))
            .sort((a, b) => PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority])
            .slice(0, 3 - forToday.length - highPriority.length)
        : [];
    return {
      upNext,
      openCount: open.length,
      overdueCount: withDue.filter(({ due }) => due?.isOverdue).length,
      forToday,
      highPriority,
    };
  }, [tasks]);

  const todayRoutines = useMemo(() => {
    const day = now.getDay();
    const nowMinutes = now.getHours() * 60 + now.getMinutes();
    return routines
      .filter((routine) => routine.recurringDays?.includes(day))
      .map((routine) => {
        const start = timeToMinutes(routine.startTime) ?? 0;
        const end = timeToMinutes(routine.endTime) ?? start;
        return { routine, start, end, isNow: nowMinutes >= start && nowMinutes < end, isPast: nowMinutes >= end };
      })
      .sort((a, b) => a.start - b.start);
  }, [routines, now]);

  if (isUserLoading || !user || !dashboardEnabled || isTasksLoading) return <DashboardSkeleton />;

  const currentOrNext = todayRoutines.find((item) => item.isNow) ?? todayRoutines.find((item) => !item.isPast);
  const remainingRoutines = todayRoutines.filter((item) => !item.isPast && item !== currentOrNext);
  const firstName = user.displayName?.split(" ")[0];
  const toggleTask = (task: Task) => {
    haptic();
    setTaskStatus(firestore, user.uid, task, task.status === "Hecho" ? "Pendiente" : "Hecho");
  };

  return (
    <div className="mx-auto w-full max-w-2xl space-y-8 pb-12">
      <header className="space-y-1">
        <p className="text-xs text-muted-foreground first-letter:uppercase">
          {new Intl.DateTimeFormat("es-ES", { weekday: "long", day: "numeric", month: "long" }).format(now)}
        </p>
        <h1 className="text-2xl font-black tracking-tight md:text-3xl">
          {getGreeting(now)}
          {firstName ? `, ${firstName}` : ""}
        </h1>
        <p className="text-sm text-muted-foreground">
          {summary.openCount === 0 ? (
            `Todo al día en ${activeContext.name}.`
          ) : (
            <>
              {summary.openCount} pendientes en {activeContext.name}
              {summary.overdueCount > 0 && <span className="text-red-400"> · {summary.overdueCount} vencidas</span>}
            </>
          )}
        </p>
      </header>

      {currentOrNext && (
        <section className="space-y-2">
          <SectionTitle>{currentOrNext.isNow ? "Ahora" : "Siguiente"}</SectionTitle>
          <RoutineNow item={currentOrNext} now={now} hourFormat={hourFormat} />
          {remainingRoutines.length > 0 && (
            <div className="space-y-0.5">
              {remainingRoutines.map(({ routine }) => (
                <div key={routine.id} className="flex items-center gap-3 px-1 py-1.5 text-sm">
                  <span className="w-16 shrink-0 font-data text-xs text-muted-foreground">
                    {formatTime(routine.startTime, hourFormat)}
                  </span>
                  <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ backgroundColor: routine.color || "hsl(var(--primary))" }} />
                  <span className="truncate">{routine.title}</span>
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      <section className="space-y-1">
        <SectionTitle>Para hoy</SectionTitle>
        {summary.forToday.length > 0 ? (
          summary.forToday.map((task) => <TaskLine key={task.id} task={task} onToggle={toggleTask} />)
        ) : (
          <p className="px-1 py-2 text-sm text-muted-foreground">Nada vence hoy.</p>
        )}
      </section>

      {summary.highPriority.length > 0 && (
        <section className="space-y-1">
          <SectionTitle>Prioridad alta</SectionTitle>
          {summary.highPriority.map((task) => (
            <TaskLine key={task.id} task={task} onToggle={toggleTask} />
          ))}
        </section>
      )}

      {summary.upNext.length > 0 && (
        <section className="space-y-1">
          <SectionTitle>Siguientes</SectionTitle>
          {summary.upNext.map((task) => (
            <TaskLine key={task.id} task={task} onToggle={toggleTask} />
          ))}
        </section>
      )}

      <Link
        href="/kanban"
        className="flex items-center justify-between rounded-2xl border border-border px-4 py-3 text-sm font-semibold text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground"
      >
        Ver todas las tareas
        <ArrowRight className="h-4 w-4" />
      </Link>
    </div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <h2 className="px-1 text-[11px] font-black uppercase tracking-widest text-muted-foreground">{children}</h2>;
}

function RoutineNow({
  item,
  now,
  hourFormat,
}: {
  item: { routine: Routine; start: number; end: number; isNow: boolean };
  now: Date;
  hourFormat: "24h" | "12h";
}) {
  const nowMinutes = now.getHours() * 60 + now.getMinutes();
  const progress = item.isNow && item.end > item.start ? Math.round(((nowMinutes - item.start) / (item.end - item.start)) * 100) : 0;
  const color = item.routine.color || "hsl(var(--primary))";

  return (
    <Link href="/schedule" className="block rounded-2xl border border-border p-4 transition-colors hover:border-primary/40">
      <div className="flex items-center justify-between gap-3">
        <p className="truncate font-semibold">{item.routine.title}</p>
        <span className="flex shrink-0 items-center gap-1 font-data text-xs text-muted-foreground">
          <Clock className="h-3 w-3" />
          {formatTime(item.routine.startTime, hourFormat)} – {formatTime(item.routine.endTime, hourFormat)}
        </span>
      </div>
      {item.isNow && (
        <div className="mt-3 h-1 overflow-hidden rounded-full bg-muted/40">
          <div className="h-full rounded-full" style={{ width: `${progress}%`, backgroundColor: color }} />
        </div>
      )}
    </Link>
  );
}

function TaskLine({ task, onToggle }: { task: Task; onToggle: (task: Task) => void }) {
  const due = getDueMeta(task.dueDate, task.dueTime);
  const isDone = task.status === "Hecho";
  return (
    <div className="flex items-center gap-3 rounded-xl px-1 py-2">
      <button
        type="button"
        onClick={() => onToggle(task)}
        aria-label={isDone ? `Marcar "${task.title}" como pendiente` : `Completar "${task.title}"`}
        className={cn(
          "flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 transition-colors",
          isDone ? "border-primary bg-primary text-primary-foreground" : "border-muted-foreground/40 hover:border-primary"
        )}
      >
        {isDone && <Check className="h-3 w-3" strokeWidth={3} />}
      </button>
      <span className={cn("h-1.5 w-1.5 shrink-0 rounded-full", PRIORITY_DOT[task.priority])} />
      <span className={cn("min-w-0 flex-1 truncate text-sm", isDone && "text-muted-foreground line-through")}>{task.title}</span>
      {due && (
        <span className={cn("flex shrink-0 items-center gap-1 text-[11px]", due.isOverdue ? "text-red-400" : "text-muted-foreground")}>
          <CalendarDays className="h-3 w-3" />
          {due.label}
        </span>
      )}
    </div>
  );
}

function DashboardSkeleton() {
  return (
    <div className="mx-auto w-full max-w-2xl space-y-8 pb-12">
      <div className="space-y-2">
        <Skeleton className="h-3 w-40 rounded-full bg-muted/30" />
        <Skeleton className="h-8 w-64 rounded-lg bg-muted/30" />
        <Skeleton className="h-4 w-48 rounded-full bg-muted/30" />
      </div>
      <Skeleton className="h-20 w-full rounded-2xl bg-muted/30" />
      <div className="space-y-3">
        {[0, 1, 2].map((index) => (
          <Skeleton key={index} className="h-6 w-full rounded-lg bg-muted/30" />
        ))}
      </div>
    </div>
  );
}
