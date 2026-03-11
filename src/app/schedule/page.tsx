"use client";

import { useState, useEffect } from "react";
import { AnimatePresence } from "framer-motion";
import { format, addDays, startOfWeek, isSameDay, getDay } from "date-fns";
import { es } from "date-fns/locale";
import { Plus, Inbox, CalendarDays } from "lucide-react";
import { useAppContextStore } from "@/lib/store";
import { cn } from "@/lib/utils";
import { useFirestore, useUser, useCollection, useMemoFirebase } from "@/firebase";
import { useRouter } from "next/navigation";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { z } from "zod";
import { toast } from "@/hooks/use-toast";
import { Skeleton } from "@/components/ui/skeleton";
import { TacticalButton } from "@/components/atoms";
import { ScheduleItem } from "@/components/molecules";
import { buildTasksQuery, createTask, updateTask, deleteTask } from "@/services/task-service";
import type { Task, Priority, ScheduleFormData } from "@/types/task";

const ScheduleTaskSchema = z.object({
  title: z.string().min(1).max(100),
  startTime: z.string(),
  endTime: z.string(),
  priority: z.enum(["baja", "media", "alta"]),
  isRecurring: z.boolean(),
  recurringDays: z.array(z.number()),
});

const WEEK_DAYS = [
  { label: "L", value: 1 }, { label: "M", value: 2 }, { label: "X", value: 3 },
  { label: "J", value: 4 }, { label: "V", value: 5 }, { label: "S", value: 6 }, { label: "D", value: 0 },
];

const INITIAL_FORM: ScheduleFormData = {
  title: "", startTime: "09:00", endTime: "10:00", priority: "media",
  isRecurring: false, recurringDays: [],
};

export default function SchedulePage() {
  const { context } = useAppContextStore();
  const { user, isUserLoading } = useUser();
  const firestore = useFirestore();
  const router = useRouter();

  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [currentTime, setCurrentTime] = useState(new Date());
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [formData, setFormData] = useState<ScheduleFormData>(INITIAL_FORM);

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 30000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    setFormData(INITIAL_FORM);
    setEditingTask(null);
    setIsDialogOpen(false);
  }, [context]);

  const startDate = startOfWeek(new Date(), { weekStartsOn: 1 });
  const days = [...Array(14)].map((_, i) => addDays(startDate, i));

  const tasksQuery = useMemoFirebase(() => {
    if (!firestore || !user) return null;
    return buildTasksQuery(firestore, user.uid, context);
  }, [firestore, user, context]);

  const { data: tasks } = useCollection<Task>(tasksQuery);

  useEffect(() => {
    if (!isUserLoading && !user) router.push("/login");
  }, [user, isUserLoading, router]);

  if (isUserLoading || !user) return (
    <div className="max-w-5xl mx-auto space-y-8 p-4">
      <Skeleton className="h-14 w-1/2 bg-white/[0.03] rounded-2xl" />
      <Skeleton className="h-20 bg-white/[0.03] rounded-2xl" />
      <Skeleton className="h-64 bg-white/[0.03] rounded-2xl" />
    </div>
  );

  const dailyTasks = tasks?.filter((task) => {
    if (task.context !== context) return false;
    if (task.isRecurring && task.recurringDays?.includes(getDay(selectedDate))) return true;
    return task.scheduledStartTime && isSameDay(new Date(task.scheduledStartTime), selectedDate);
  }).sort((a, b) => (a.scheduledStartTime ?? "").localeCompare(b.scheduledStartTime ?? "")) || [];

  const handleSaveTask = () => {
    const result = ScheduleTaskSchema.safeParse(formData);
    if (!result.success) {
      toast({ variant: "destructive", title: "Error", description: "Verifique los datos." });
      return;
    }

    const { title, startTime, endTime, priority, isRecurring, recurringDays } = result.data;
    const [startH, startM] = startTime.split(":").map(Number);
    const [endH, endM] = endTime.split(":").map(Number);

    const base = new Date(selectedDate);
    const scheduledStartTime = new Date(base.setHours(startH, startM, 0, 0)).toISOString();
    const scheduledEndTime = new Date(new Date(selectedDate).setHours(endH, endM, 0, 0)).toISOString();

    const taskData = {
      title, scheduledStartTime, scheduledEndTime, priority: priority as Priority,
      context, isRecurring, recurringDays: isRecurring ? recurringDays : [],
      status: "Pendiente", dueDate: scheduledStartTime,
    };

    if (editingTask) {
      updateTask(firestore, user.uid, editingTask.id, taskData);
    } else {
      createTask(firestore, user.uid, taskData);
    }

    resetForm();
    setIsDialogOpen(false);
    toast({ title: editingTask ? "Actualizado" : "Programado" });
  };

  const resetForm = () => { setFormData(INITIAL_FORM); setEditingTask(null); };

  const openEditDialog = (task: Task) => {
    setEditingTask(task);
    setFormData({
      title: task.title,
      startTime: task.scheduledStartTime ? format(new Date(task.scheduledStartTime), "HH:mm") : "09:00",
      endTime: task.scheduledEndTime ? format(new Date(task.scheduledEndTime), "HH:mm") : "10:00",
      priority: task.priority || "media",
      isRecurring: task.isRecurring || false,
      recurringDays: task.recurringDays || [],
    });
    setIsDialogOpen(true);
  };

  const handleDeleteTask = (taskId: string) => {
    deleteTask(firestore, user.uid, taskId);
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-24">
      {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <h2 className="text-2xl md:text-4xl font-black tracking-tighter uppercase">
              Horario <span className="text-primary italic glow-text">{context}</span>
            </h2>
            <Badge variant="outline" className="h-5 rounded-full border-primary/20 text-primary bg-primary/5 px-2 font-black text-[11px] font-data">
              {dailyTasks.length} BLOQUES
            </Badge>
          </div>
          <p className="text-[9px] text-muted-foreground font-black uppercase tracking-[0.4em] flex items-center gap-2">
            <CalendarDays className="w-3 h-3 text-primary/40" /> Monitor de Rutinas
          </p>
        </div>

        <Dialog open={isDialogOpen} onOpenChange={(open) => { if (!open) resetForm(); setIsDialogOpen(open); }}>
          <DialogTrigger asChild>
            <TacticalButton className="w-full md:w-auto"><Plus className="w-4 h-4 mr-2" /> Programar</TacticalButton>
          </DialogTrigger>
          <DialogContent className="glass-card-elevated border-white/[0.08] bg-[#050505]/95 sm:max-w-[450px] p-6 sm:p-5 md:p-8">
            <DialogHeader>
              <DialogTitle className="text-xl font-black uppercase tracking-tighter">Nueva Actividad</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-1.5">
                <Label className="text-[9px] uppercase font-black text-primary">Nombre</Label>
                <Input value={formData.title} onChange={(e) => setFormData({ ...formData, title: e.target.value })} className="bg-white/[0.03] border-white/[0.08] h-11 rounded-lg" />
              </div>
              <div className="flex items-center justify-between p-3 glass-card border-white/[0.06]">
                <div className="space-y-0.5">
                  <Label className="text-[9px] uppercase font-black">Recurrente</Label>
                  <p className="text-[10px] text-muted-foreground uppercase">Repetir semanal</p>
                </div>
                <Switch checked={formData.isRecurring} onCheckedChange={(val) => setFormData({ ...formData, isRecurring: val })} />
              </div>
              {formData.isRecurring && (
                <div className="flex justify-between gap-1">
                  {WEEK_DAYS.map((day) => (
                    <button key={day.value} onClick={() => setFormData((prev) => ({
                      ...prev,
                      recurringDays: prev.recurringDays.includes(day.value)
                        ? prev.recurringDays.filter((d) => d !== day.value)
                        : [...prev.recurringDays, day.value],
                    }))} className={cn(
                      "w-8 h-8 rounded-lg text-[11px] font-black transition-all border",
                      formData.recurringDays.includes(day.value)
                        ? "bg-primary text-black border-primary"
                        : "bg-white/[0.03] border-white/[0.08] text-muted-foreground"
                    )}>
                      {day.label}
                    </button>
                  ))}
                </div>
              )}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-[9px] uppercase font-black">Inicio</Label>
                  <Input type="time" value={formData.startTime} onChange={(e) => setFormData({ ...formData, startTime: e.target.value })} className="bg-white/[0.03] border-white/[0.08] h-11 rounded-lg font-data" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-[9px] uppercase font-black">Fin</Label>
                  <Input type="time" value={formData.endTime} onChange={(e) => setFormData({ ...formData, endTime: e.target.value })} className="bg-white/[0.03] border-white/[0.08] h-11 rounded-lg font-data" />
                </div>
              </div>
            </div>
            <DialogFooter>
              <TacticalButton onClick={handleSaveTask} className="w-full">Sincronizar</TacticalButton>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Day Selector */}
      <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
        {days.map((day) => {
          const isSelected = isSameDay(day, selectedDate);
          return (
            <button key={day.toString()} onClick={() => setSelectedDate(day)} className={cn(
              "flex-shrink-0 w-16 py-3 rounded-2xl flex flex-col items-center gap-1 transition-all border",
              isSelected
                ? "bg-primary text-black border-primary scale-105 shadow-lg"
                : "glass-card border-white/[0.06]"
            )}>
              <span className={cn("text-[10px] uppercase font-black tracking-widest", isSelected ? "text-black/60" : "text-muted-foreground/50")}>
                {format(day, "EEE", { locale: es })}
              </span>
              <span className="text-lg font-black font-data">{format(day, "d")}</span>
            </button>
          );
        })}
      </div>

      {/* Timeline */}
      <div className="relative mt-12 ml-4 md:ml-24">
        <div className="absolute left-[-12px] md:left-[-40px] top-0 bottom-0 w-px bg-white/[0.06]" />
        <div className="space-y-8">
          <AnimatePresence mode="popLayout">
            {dailyTasks.length > 0 ? (
              dailyTasks.map((task, idx) => (
                <ScheduleItem
                  key={task.id}
                  task={task}
                  selectedDate={selectedDate}
                  currentTime={currentTime}
                  index={idx}
                  onEdit={openEditDialog}
                  onDelete={handleDeleteTask}
                />
              ))
            ) : (
              <div className="flex flex-col items-center justify-center py-20 opacity-[0.04]">
                <Inbox className="w-12 h-12 mb-2" />
                <p className="text-[11px] font-black uppercase tracking-[0.4em]">Sin Bloques</p>
              </div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
