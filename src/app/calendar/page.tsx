"use client";

import { useState, useEffect } from "react";
import { AnimatePresence } from "framer-motion";
import { useFirestore, useUser, useCollection, useMemoFirebase } from "@/firebase";
import { Calendar } from "@/components/ui/calendar";
import { Card } from "@/components/ui/card";
import { format, isSameDay, parseISO, setHours, setMinutes, getDay, getDate } from "date-fns";
import { es } from "date-fns/locale";
import { Calendar as CalendarIcon, Clock, Plus, Inbox, LayoutGrid } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAppContextStore } from "@/lib/store";
import { toast } from "@/hooks/use-toast";
import { Skeleton } from "@/components/ui/skeleton";
import { TacticalButton } from "@/components/atoms";
import { CalendarEvent } from "@/components/molecules";
import { buildTasksQuery, createTask, updateTask, deleteTask } from "@/services/task-service";
import type { Task, Priority, RecurrenceType, CalendarFormData } from "@/types/task";

const CATEGORIES = [
  { label: "Personal", color: "bg-blue-500" },
  { label: "Académico", color: "bg-purple-500" },
  { label: "Laboral", color: "bg-orange-500" },
  { label: "Especial", color: "bg-pink-500" },
];

const INITIAL_FORM: CalendarFormData = {
  title: "", time: "09:00", priority: "media", status: "Pendiente",
  location: "", category: "Personal", recurrenceType: "none",
};

export default function CalendarPage() {
  const { context } = useAppContextStore();
  const { user, isUserLoading } = useUser();
  const firestore = useFirestore();
  const router = useRouter();

  const [mounted, setMounted] = useState(false);
  const [date, setDate] = useState<Date | undefined>(undefined);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [formData, setFormData] = useState<CalendarFormData>(INITIAL_FORM);

  useEffect(() => { setMounted(true); setDate(new Date()); }, []);

  useEffect(() => {
    setFormData(INITIAL_FORM);
    setEditingTask(null);
    setIsDialogOpen(false);
  }, [context]);

  const tasksQuery = useMemoFirebase(() => {
    if (!firestore || !user) return null;
    return buildTasksQuery(firestore, user.uid, context);
  }, [firestore, user, context]);

  const { data: tasks, isLoading: isTasksLoading } = useCollection<Task>(tasksQuery);

  useEffect(() => {
    if (!isUserLoading && !user) router.push("/login");
  }, [user, isUserLoading, router]);

  if (!mounted || isUserLoading || !user) return (
    <div className="max-w-7xl mx-auto space-y-8 p-4">
      <Skeleton className="h-16 w-1/2 bg-white/[0.03] rounded-2xl" />
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        <Skeleton className="lg:col-span-5 h-[400px] bg-white/[0.03] rounded-2xl" />
        <Skeleton className="lg:col-span-7 h-[400px] bg-white/[0.03] rounded-2xl" />
      </div>
    </div>
  );

  const selectedDayTasks = tasks?.filter((task) => {
    if (!task.dueDate || !date || task.context !== context) return false;
    const taskDate = parseISO(task.dueDate);
    if (isSameDay(taskDate, date)) return true;
    if (task.recurrenceType === "weekly" && task.recurringDays?.includes(getDay(date))) return true;
    if (task.recurrenceType === "monthly" && getDate(taskDate) === getDate(date)) return true;
    return false;
  }).sort((a, b) => (a.dueDate ?? "").localeCompare(b.dueDate ?? "")) || [];

  const daysWithTasks = tasks?.filter((t) => t.context === context && t.dueDate).map((t) => parseISO(t.dueDate!)) || [];

  const handleSaveEvent = () => {
    if (!formData.title.trim() || !date) return;
    const [hours, minutes] = formData.time.split(":").map(Number);
    const finalDate = setMinutes(setHours(date, hours), minutes).toISOString();

    const taskData = {
      title: formData.title,
      dueDate: finalDate,
      scheduledStartTime: finalDate,
      priority: formData.priority,
      status: formData.status,
      location: formData.location,
      category: formData.category,
      recurrenceType: formData.recurrenceType,
      isRecurring: formData.recurrenceType !== "none",
      recurringDays: formData.recurrenceType === "weekly" ? [getDay(date)] : [],
      context,
    };

    if (editingTask) {
      updateTask(firestore, user.uid, editingTask.id, taskData);
    } else {
      createTask(firestore, user.uid, taskData);
    }

    resetForm();
    setIsDialogOpen(false);
    toast({ title: editingTask ? "Actualizado" : "Agendado" });
  };

  const resetForm = () => { setFormData(INITIAL_FORM); setEditingTask(null); };

  const openEditDialog = (task: Task) => {
    setEditingTask(task);
    setFormData({
      title: task.title,
      time: task.dueDate ? format(parseISO(task.dueDate), "HH:mm") : "09:00",
      priority: task.priority || "media",
      status: task.status,
      location: task.location || "",
      category: task.category || "Personal",
      recurrenceType: task.recurrenceType || "none",
    });
    setIsDialogOpen(true);
  };

  const handleDeleteEvent = (taskId: string) => {
    deleteTask(firestore, user.uid, taskId);
  };

  return (
    <div className="max-w-7xl mx-auto space-y-8 pb-24 px-2 md:px-0">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 px-2 md:px-0">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <h2 className="text-2xl md:text-4xl font-black tracking-tighter uppercase">
              Calendario <span className="text-primary italic glow-text">{context}</span>
            </h2>
            <Badge variant="outline" className="h-5 rounded-full border-primary/20 text-primary bg-primary/5 px-2 font-black text-[11px] font-data">
              {tasks?.length || 0} TOTAL
            </Badge>
          </div>
          <p className="text-[9px] text-muted-foreground font-black uppercase tracking-[0.4em] flex items-center gap-2">
            <CalendarIcon className="w-3 h-3 text-primary/40" /> Control Temporal
          </p>
        </div>

        <Dialog open={isDialogOpen} onOpenChange={(open) => { if (!open) resetForm(); setIsDialogOpen(open); }}>
          <DialogTrigger asChild>
            <TacticalButton className="w-full md:w-auto"><Plus className="w-4 h-4 mr-2" /> Agendar</TacticalButton>
          </DialogTrigger>
          <DialogContent className="glass-card-elevated border-white/[0.08] bg-[#050505]/95 w-[95vw] sm:max-w-[450px] p-6 md:p-8 mx-auto">
            <DialogHeader><DialogTitle className="text-xl font-black uppercase">Evento</DialogTitle></DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-1.5">
                <Label className="text-[9px] uppercase font-black text-primary">Nombre</Label>
                <Input value={formData.title} onChange={(e) => setFormData({ ...formData, title: e.target.value })} className="bg-white/[0.03] border-white/[0.08] h-11 rounded-lg" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-[9px] uppercase font-black">Categoría</Label>
                  <Select value={formData.category} onValueChange={(v) => setFormData({ ...formData, category: v })}>
                    <SelectTrigger className="bg-white/[0.03] border-white/[0.08] h-11 rounded-lg"><SelectValue /></SelectTrigger>
                    <SelectContent className="bg-[#0a0a0a] border-white/[0.08]">
                      {CATEGORIES.map((cat) => <SelectItem key={cat.label} value={cat.label}>{cat.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-[9px] uppercase font-black">Repetición</Label>
                  <Select value={formData.recurrenceType} onValueChange={(v) => setFormData({ ...formData, recurrenceType: v as RecurrenceType })}>
                    <SelectTrigger className="bg-white/[0.03] border-white/[0.08] h-11 rounded-lg"><SelectValue /></SelectTrigger>
                    <SelectContent className="bg-[#0a0a0a] border-white/[0.08]">
                      <SelectItem value="none">Ninguna</SelectItem>
                      <SelectItem value="weekly">Semanal</SelectItem>
                      <SelectItem value="monthly">Mensual</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-[9px] uppercase font-black">Hora</Label>
                  <Input type="time" value={formData.time} onChange={(e) => setFormData({ ...formData, time: e.target.value })} className="bg-white/[0.03] border-white/[0.08] h-11 rounded-lg font-data" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-[9px] uppercase font-black">Prioridad</Label>
                  <Select value={formData.priority} onValueChange={(v) => setFormData({ ...formData, priority: v as Priority })}>
                    <SelectTrigger className="bg-white/[0.03] border-white/[0.08] h-11 rounded-lg"><SelectValue /></SelectTrigger>
                    <SelectContent className="bg-[#0a0a0a] border-white/[0.08]">
                      <SelectItem value="baja">Baja</SelectItem>
                      <SelectItem value="media">Media</SelectItem>
                      <SelectItem value="alta">Alta</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
            <DialogFooter>
              <TacticalButton onClick={handleSaveEvent} className="w-full">Confirmar</TacticalButton>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        <div className="lg:col-span-5 space-y-4">
          <Card className="glass-card bg-[#050505]/40 p-4 md:p-6 flex justify-center">
            <div className="scale-95 sm:scale-100 w-full overflow-hidden flex justify-center">
              <Calendar
                mode="single" selected={date} onSelect={setDate} locale={es} className="rounded-2xl border-none p-0"
                classNames={{
                  day_today: "bg-primary/10 text-primary border border-primary/20 font-black",
                  day_selected: "bg-primary text-primary-foreground neon-glow hover:bg-primary font-black scale-105",
                  day: "h-9 w-9 sm:h-10 sm:w-10 p-0 font-bold transition-all hover:bg-white/[0.03] rounded-lg relative font-data",
                }}
                modifiers={{ hasTask: daysWithTasks }}
                modifiersClassNames={{ hasTask: "after:content-[''] after:absolute after:bottom-1 after:left-1/2 after:-translate-x-1/2 after:w-1.5 after:h-1.5 after:bg-primary after:rounded-full" }}
              />
            </div>
          </Card>
          <div className="glass-card p-4 flex items-center justify-between">
            <span className="text-[11px] font-black text-white/30 uppercase tracking-widest">Integridad</span>
            <LayoutGrid className="w-4 h-4 text-primary/40" />
          </div>
        </div>

        <div className="lg:col-span-7 space-y-6">
          <div className="flex items-center justify-between px-2">
            <h3 className="text-[9px] font-black uppercase tracking-[0.3em] flex items-center gap-3">
              <Clock className="w-3.5 h-3.5 text-primary" />
              <span className="font-data">{date ? format(date, "EEEE, d 'de' MMMM", { locale: es }) : "Fecha"}</span>
            </h3>
            <Badge variant="outline" className="rounded-full border-primary/20 text-primary bg-primary/5 h-6 font-black text-[11px] font-data">
              {selectedDayTasks.length} EVENTOS
            </Badge>
          </div>

          <div className="space-y-4 max-h-[600px] overflow-y-auto pr-1 scrollbar-hide px-2">
            <AnimatePresence mode="popLayout">
              {selectedDayTasks.length > 0 ? (
                selectedDayTasks.map((task, idx) => (
                  <CalendarEvent key={task.id} task={task} index={idx} onEdit={openEditDialog} onDelete={handleDeleteEvent} />
                ))
              ) : (
                <div className="flex flex-col items-center justify-center py-24 opacity-[0.04]">
                  <Inbox className="w-12 h-12 mb-2" />
                  <p className="text-[11px] font-black uppercase tracking-[0.4em]">Sin Eventos</p>
                </div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>
    </div>
  );
}
