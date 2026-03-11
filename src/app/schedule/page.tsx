
"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { format, addDays, startOfWeek, isSameDay, parseISO, setHours, setMinutes, getDay, isAfter, isBefore, differenceInMinutes } from "date-fns";
import { es } from "date-fns/locale";
import { 
  Clock, 
  Plus, 
  Trash2, 
  Edit3, 
  Inbox,
  RotateCcw,
  Timer,
  CalendarDays
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAppContextStore } from "@/lib/store";
import { cn } from "@/lib/utils";
import { useFirestore, useUser, useCollection, useMemoFirebase } from "@/firebase";
import { collection, doc, serverTimestamp, query, where } from "firebase/firestore";
import { addDocumentNonBlocking, updateDocumentNonBlocking, deleteDocumentNonBlocking } from "@/firebase/non-blocking-updates";
import { useRouter } from "next/navigation";
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogTrigger, 
  DialogFooter 
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Progress } from "@/components/ui/progress";
import { z } from "zod";
import { toast } from "@/hooks/use-toast";
import { Task } from "@/types/task";

const ScheduleTaskSchema = z.object({
  title: z.string().min(1).max(100),
  startTime: z.string(),
  endTime: z.string(),
  priority: z.enum(['baja', 'media', 'alta']),
  isRecurring: z.boolean(),
  recurringDays: z.array(z.number()),
});

const WEEK_DAYS = [
  { label: 'L', value: 1 }, { label: 'M', value: 2 }, { label: 'M', value: 3 },
  { label: 'J', value: 4 }, { label: 'V', value: 5 }, { label: 'S', value: 6 }, { label: 'D', value: 0 },
];

export default function SchedulePage() {
  const { context } = useAppContextStore();
  const { user, isUserLoading } = useUser();
  const firestore = useFirestore();
  const router = useRouter();

  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [currentTime, setCurrentTime] = useState(new Date());
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);

  const [formData, setFormData] = useState({
    title: "", startTime: "09:00", endTime: "10:00", priority: "media" as 'baja' | 'media' | 'alta',
    isRecurring: false, recurringDays: [] as number[]
  });

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 30000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    setFormData({ title: "", startTime: "09:00", endTime: "10:00", priority: "media", isRecurring: false, recurringDays: [] });
    setEditingTask(null);
    setIsDialogOpen(false);
  }, [context]);

  const startDate = startOfWeek(new Date(), { weekStartsOn: 1 });
  const days = [...Array(14)].map((_, i) => addDays(startDate, i));

  const tasksQuery = useMemoFirebase(() => {
    if (!firestore || !user) return null;
    return query(
      collection(firestore, "users", user.uid, "tasks"),
      where("context", "==", context)
    );
  }, [firestore, user, context]);

  const { data: tasks } = useCollection<Task>(tasksQuery);

  useEffect(() => {
    if (!isUserLoading && !user) router.push("/login");
  }, [user, isUserLoading, router]);

  if (isUserLoading || !user) return null;

  const dailyTasks = tasks?.filter(task => {
    if (task.context !== context) return false;
    if (task.isRecurring && task.recurringDays?.includes(getDay(selectedDate))) return true;
    return task.scheduledStartTime && isSameDay(parseISO(task.scheduledStartTime), selectedDate);
  }).sort((a, b) => a.scheduledStartTime.localeCompare(b.scheduledStartTime)) || [];

  const handleSaveTask = () => {
    const result = ScheduleTaskSchema.safeParse(formData);
    if (!result.success) {
      toast({ variant: "destructive", title: "Error", description: "Verifique los datos." });
      return;
    }

    const { title, startTime, endTime, priority, isRecurring, recurringDays } = result.data;
    const [startH, startM] = startTime.split(':').map(Number);
    const [endH, endM] = endTime.split(':').map(Number);

    const scheduledStartTime = setMinutes(setHours(selectedDate, startH), startM).toISOString();
    const scheduledEndTime = setMinutes(setHours(selectedDate, endH), endM).toISOString();

    const taskData = {
      title, scheduledStartTime, scheduledEndTime, priority, context, userId: user.uid,
      isRecurring, recurringDays: isRecurring ? recurringDays : [],
      updatedAt: serverTimestamp(), status: 'Pendiente', dueDate: scheduledStartTime,
    };

    if (editingTask) {
      updateDocumentNonBlocking(doc(firestore, "users", user.uid, "tasks", editingTask.id), taskData);
    } else {
      addDocumentNonBlocking(collection(firestore, "users", user.uid, "tasks"), { ...taskData, createdAt: serverTimestamp() });
    }

    resetForm();
    setIsDialogOpen(false);
    toast({ title: editingTask ? "Actualizado" : "Programado" });
  };

  const resetForm = () => {
    setFormData({ title: "", startTime: "09:00", endTime: "10:00", priority: "media", isRecurring: false, recurringDays: [] });
    setEditingTask(null);
  };

  const openEditDialog = (task: Task) => {
    setEditingTask(task);
    setFormData({
      title: task.title,
      startTime: format(parseISO(task.scheduledStartTime), "HH:mm"),
      endTime: task.scheduledEndTime ? format(parseISO(task.scheduledEndTime), "HH:mm") : "10:00",
      priority: task.priority || "media",
      isRecurring: task.isRecurring || false,
      recurringDays: task.recurringDays || []
    });
    setIsDialogOpen(true);
  };

  const getActivityProgress = (task: Task) => {
    if (!task.scheduledStartTime || !task.scheduledEndTime || !isSameDay(selectedDate, new Date())) return null;
    const start = parseISO(task.scheduledStartTime);
    const end = parseISO(task.scheduledEndTime);
    const now = currentTime;
    const currentStart = setMinutes(setHours(now, start.getHours()), start.getMinutes());
    const currentEnd = setMinutes(setHours(now, end.getHours()), end.getMinutes());

    if (isAfter(now, currentStart) && isBefore(now, currentEnd)) {
      const total = differenceInMinutes(currentEnd, currentStart);
      const elapsed = differenceInMinutes(now, currentStart);
      return Math.round((elapsed / total) * 100);
    }
    return null;
  };

  return (
    <div className="space-y-8 max-w-5xl mx-auto pb-24 px-1 md:px-0">
      {/* Optimized Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 px-4 md:px-0">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <h2 className="text-2xl md:text-4xl font-black tracking-tighter uppercase">Horario <span className="text-primary italic glow-text">{context}</span></h2>
            <Badge variant="outline" className="h-5 rounded-full border-primary/20 text-primary bg-primary/5 px-2 font-black text-[11px]">
              {dailyTasks.length} BLOQUES
            </Badge>
          </div>
          <p className="text-[9px] text-muted-foreground font-black uppercase tracking-[0.4em] flex items-center gap-2">
            <CalendarDays className="w-3 h-3 text-primary/40" /> Monitor de Rutinas
          </p>
        </div>
        
        <Dialog open={isDialogOpen} onOpenChange={(open) => { if(!open) resetForm(); setIsDialogOpen(open); }}>
          <DialogTrigger asChild>
            <Button className="rounded-xl h-12 px-6 font-black uppercase tracking-widest text-[10px] neon-glow w-full md:w-auto">
              <Plus className="w-4 h-4 mr-2" /> Programar
            </Button>
          </DialogTrigger>
          <DialogContent className="glass-card border-white/10 bg-black/95 w-[95vw] sm:max-w-[450px] p-6 md:p-8 mx-auto">
            <DialogHeader>
              <DialogTitle className="text-xl font-black uppercase tracking-tighter">Nueva Actividad</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-1.5">
                <Label className="text-[9px] uppercase font-black text-primary">Nombre</Label>
                <Input value={formData.title} onChange={(e) => setFormData({...formData, title: e.target.value})} className="bg-white/5 border-white/10 h-11 rounded-lg" />
              </div>
              <div className="flex items-center justify-between p-3 glass rounded-xl border-white/5">
                <div className="space-y-0.5">
                  <Label className="text-[9px] uppercase font-black">Recurrente</Label>
                  <p className="text-[10px] text-muted-foreground uppercase">Repetir semanal</p>
                </div>
                <Switch checked={formData.isRecurring} onCheckedChange={(val) => setFormData({...formData, isRecurring: val})} />
              </div>
              {formData.isRecurring && (
                <div className="flex justify-between gap-1">
                  {WEEK_DAYS.map((day) => (
                    <button key={day.value} onClick={() => setFormData(prev => ({
                      ...prev, recurringDays: prev.recurringDays.includes(day.value) ? prev.recurringDays.filter(d => d !== day.value) : [...prev.recurringDays, day.value]
                    }))} className={cn("w-8 h-8 rounded-lg text-[11px] font-black transition-all border", formData.recurringDays.includes(day.value) ? "bg-primary text-black border-primary" : "bg-white/5 border-white/10 text-muted-foreground")}>
                      {day.label}
                    </button>
                  ))}
                </div>
              )}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-[9px] uppercase font-black">Inicio</Label>
                  <Input type="time" value={formData.startTime} onChange={(e) => setFormData({...formData, startTime: e.target.value})} className="bg-white/5 border-white/10 h-10 rounded-lg" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-[9px] uppercase font-black">Fin</Label>
                  <Input type="time" value={formData.endTime} onChange={(e) => setFormData({...formData, endTime: e.target.value})} className="bg-white/5 border-white/10 h-10 rounded-lg" />
                </div>
              </div>
            </div>
            <DialogFooter><Button onClick={handleSaveTask} className="w-full neon-glow font-black uppercase text-[10px] h-12 rounded-xl">Sincronizar</Button></DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="flex gap-2 overflow-x-auto pb-4 scrollbar-hide -mx-4 px-4 md:mx-0">
        {days.map((day) => {
          const isSelected = isSameDay(day, selectedDate);
          return (
            <button key={day.toString()} onClick={() => setSelectedDate(day)} className={cn("flex-shrink-0 w-16 py-3 rounded-2xl flex flex-col items-center gap-1 transition-all border", isSelected ? "bg-primary text-black border-primary scale-105 shadow-lg" : "glass border-white/5")}>
              <span className={cn("text-[10px] uppercase font-black tracking-widest", isSelected ? "text-black/60" : "text-muted-foreground/50")}>{format(day, 'EEE', { locale: es })}</span>
              <span className="text-lg font-black">{format(day, 'd')}</span>
            </button>
          );
        })}
      </div>

      <div className="relative mt-12 ml-4 md:ml-24">
        <div className="absolute left-[-12px] md:left-[-40px] top-0 bottom-0 w-px bg-white/10" />
        <div className="space-y-8">
          <AnimatePresence mode="popLayout">
            {dailyTasks.length > 0 ? (
              dailyTasks.map((task) => {
                const progress = getActivityProgress(task);
                const isActive = progress !== null;
                return (
                  <motion.div key={task.id} initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} className="relative">
                    <div className={cn("absolute left-[-16px] md:left-[-44px] top-4 w-2.5 h-2.5 rounded-full border transition-all z-20", isActive ? "bg-primary border-primary animate-pulse shadow-[0_0_8px_rgba(57,255,20,0.5)]" : "bg-white/10 border-white/20")} />
                    <div className="flex flex-col md:flex-row md:items-start gap-3 md:gap-12">
                      <div className="w-16 pt-3"><span className={cn("text-xs md:text-sm font-black tracking-widest", isActive ? "text-primary" : "text-white/20")}>{format(parseISO(task.scheduledStartTime), "HH:mm")}</span></div>
                      <div className={cn("flex-1 glass p-4 md:p-6 rounded-[1.5rem] flex flex-col gap-4 border-l-4 transition-all relative overflow-hidden group", task.priority === 'alta' ? 'border-l-red-500' : isActive ? 'border-l-primary' : 'border-l-white/10')}>
                        <div className="absolute top-0 right-0 p-3 opacity-100 md:opacity-0 group-hover:opacity-100 transition-opacity z-10 flex gap-1.5">
                           <Button variant="ghost" size="icon" onClick={() => openEditDialog(task)} className="h-8 w-8 rounded-lg bg-black/40"><Edit3 className="w-3.5 h-3.5" /></Button>
                           <Button variant="ghost" size="icon" onClick={() => { if(confirm("Â¿Eliminar?")) deleteDocumentNonBlocking(doc(firestore, "users", user.uid, "tasks", task.id)); }} className="h-8 w-8 rounded-lg bg-black/40"><Trash2 className="w-3.5 h-3.5" /></Button>
                        </div>
                        <div className="space-y-1.5">
                            <h4 className="text-base md:text-xl font-black tracking-tighter text-white pr-12">{task.title}</h4>
                            <div className="flex gap-2">
                              {task.isRecurring && <Badge className="bg-primary/10 text-primary border-primary/20 text-[10px] font-black px-1.5 py-0.5">RUTINA</Badge>}
                              <Badge variant="outline" className="text-[10px] font-black uppercase px-1.5 py-0.5">{task.priority || 'media'}</Badge>
                            </div>
                        </div>
                        {isActive && (
                          <div className="space-y-1.5 bg-white/5 p-3 rounded-lg border border-white/5">
                            <div className="flex justify-between text-[10px] font-black text-primary uppercase"><span>Sistema Activo</span><span>{progress}%</span></div>
                            <Progress value={progress} className="h-1" />
                          </div>
                        )}
                        <div className="flex items-center gap-4 text-[11px] text-white/20 uppercase font-black tracking-widest"><Clock className="w-3 h-3 text-primary" /> {format(parseISO(task.scheduledStartTime), "HH:mm")} - {task.scheduledEndTime ? format(parseISO(task.scheduledEndTime), "HH:mm") : '...'}</div>
                      </div>
                    </div>
                  </motion.div>
                );
              })
            ) : (
              <div className="flex flex-col items-center justify-center py-20 opacity-5"><Inbox className="w-12 h-12 mb-2" /><p className="text-[11px] font-black uppercase tracking-[0.4em]">Sin Bloques</p></div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
