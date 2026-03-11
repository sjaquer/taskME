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
  Activity,
  Timer,
  Layout
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAppContextStore } from "@/lib/store";
import { cn } from "@/lib/utils";
import { useFirestore, useUser, useCollection, useMemoFirebase } from "@/firebase";
import { collection, doc, serverTimestamp } from "firebase/firestore";
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

const ScheduleTaskSchema = z.object({
  title: z.string().min(1, "El título es obligatorio").max(100, "El título es demasiado largo"),
  startTime: z.string(),
  endTime: z.string(),
  priority: z.enum(['baja', 'media', 'alta']),
  isRecurring: z.boolean(),
  recurringDays: z.array(z.number()),
});

interface ScheduledTask {
  id: string;
  title: string;
  context: string;
  scheduledStartTime: string;
  scheduledEndTime?: string;
  priority?: 'baja' | 'media' | 'alta';
  userId: string;
  isRecurring?: boolean;
  recurringDays?: number[];
}

const WEEK_DAYS = [
  { label: 'L', value: 1 },
  { label: 'M', value: 2 },
  { label: 'M', value: 3 },
  { label: 'J', value: 4 },
  { label: 'V', value: 5 },
  { label: 'S', value: 6 },
  { label: 'D', value: 0 },
];

export default function SchedulePage() {
  const { context } = useAppContextStore();
  const { user, isUserLoading } = useUser();
  const firestore = useFirestore();
  const router = useRouter();

  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [currentTime, setCurrentTime] = useState(new Date());
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<ScheduledTask | null>(null);

  const [formData, setFormData] = useState({
    title: "",
    startTime: "09:00",
    endTime: "10:00",
    priority: "media" as 'baja' | 'media' | 'alta',
    isRecurring: false,
    recurringDays: [] as number[]
  });

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 30000);
    return () => clearInterval(timer);
  }, []);

  const startDate = startOfWeek(new Date(), { weekStartsOn: 1 });
  const days = [...Array(14)].map((_, i) => addDays(startDate, i));

  const tasksQuery = useMemoFirebase(() => {
    if (!firestore || !user) return null;
    return collection(firestore, "users", user.uid, "tasks");
  }, [firestore, user]);

  const { data: tasks, isLoading: isTasksLoading } = useCollection<ScheduledTask>(tasksQuery);

  if (isUserLoading) return null;
  if (!user) {
    router.push("/login");
    return null;
  }

  const dailyTasks = tasks?.filter(task => {
    if (task.context !== context) return false;
    if (task.isRecurring && task.recurringDays?.includes(getDay(selectedDate))) return true;
    return task.scheduledStartTime && isSameDay(parseISO(task.scheduledStartTime), selectedDate);
  }).sort((a, b) => a.scheduledStartTime.compare(b.scheduledStartTime)) || [];

  const handleSaveTask = () => {
    const result = ScheduleTaskSchema.safeParse(formData);
    if (!result.success) {
      toast({ variant: "destructive", title: "Error", description: result.error.errors[0].message });
      return;
    }

    const { title, startTime, endTime, priority, isRecurring, recurringDays } = result.data;
    const [startH, startM] = startTime.split(':').map(Number);
    const [endH, endM] = endTime.split(':').map(Number);

    const scheduledStartTime = setMinutes(setHours(selectedDate, startH), startM).toISOString();
    const scheduledEndTime = setMinutes(setHours(selectedDate, endH), endM).toISOString();

    const taskData = {
      title,
      scheduledStartTime,
      scheduledEndTime,
      priority,
      context,
      userId: user.uid,
      isRecurring,
      recurringDays: isRecurring ? recurringDays : [],
      updatedAt: serverTimestamp(),
      status: 'Pendiente',
      dueDate: scheduledStartTime,
    };

    if (editingTask) {
      const docRef = doc(firestore, "users", user.uid, "tasks", editingTask.id);
      updateDocumentNonBlocking(docRef, taskData);
      toast({ title: "Actualizado", description: "Agenda modificada." });
    } else {
      const colRef = collection(firestore, "users", user.uid, "tasks");
      addDocumentNonBlocking(colRef, { ...taskData, createdAt: serverTimestamp() });
      toast({ title: "Programado", description: "Bloque añadido." });
    }

    resetForm();
    setIsDialogOpen(false);
  };

  const resetForm = () => {
    setFormData({ title: "", startTime: "09:00", endTime: "10:00", priority: "media", isRecurring: false, recurringDays: [] });
    setEditingTask(null);
  };

  const openEditDialog = (task: ScheduledTask) => {
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

  const getActivityProgress = (task: ScheduledTask) => {
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
    <div className="space-y-8 md:space-y-12 max-w-5xl mx-auto pb-24 px-1 md:px-0">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 px-2 md:px-0">
        <div className="space-y-2">
          <h2 className="text-4xl md:text-7xl font-black tracking-tighter leading-none">Mi Horario</h2>
          <p className="text-[10px] text-muted-foreground font-black uppercase tracking-[0.4em] mt-2 flex items-center gap-2">
            <span className="w-8 h-px bg-primary/40" /> Rutinas de {context}
          </p>
        </div>
        
        <Dialog open={isDialogOpen} onOpenChange={(open) => { if(!open) resetForm(); setIsDialogOpen(open); }}>
          <DialogTrigger asChild>
            <Button className="rounded-2xl h-14 md:h-16 px-6 md:px-10 font-black uppercase tracking-widest text-[10px] md:text-xs neon-glow w-full md:w-auto">
              <Plus className="w-4 h-4 md:w-5 md:h-5 mr-2" /> Programar Actividad
            </Button>
          </DialogTrigger>
          <DialogContent className="glass-card border-white/10 bg-black/95 sm:max-w-[480px] p-6 md:p-8">
            <DialogHeader>
              <DialogTitle className="text-2xl md:text-4xl font-black tracking-tighter uppercase text-white">
                {editingTask ? 'Modificar' : 'Nuevo Bloque'}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-5 py-4">
              <div className="space-y-2">
                <Label className="text-[10px] uppercase font-black text-primary">Actividad</Label>
                <Input 
                  placeholder="Nombre de la actividad..."
                  value={formData.title} 
                  onChange={(e) => setFormData({...formData, title: e.target.value})}
                  className="bg-white/5 border-white/10 h-11 md:h-12 rounded-xl" 
                />
              </div>

              <div className="flex items-center justify-between p-4 glass rounded-2xl border-white/5">
                <div className="space-y-1">
                  <Label className="text-[10px] uppercase font-black tracking-widest text-white/80">Recurrente</Label>
                  <p className="text-[8px] text-muted-foreground uppercase font-bold">Repetir semanalmente</p>
                </div>
                <Switch checked={formData.isRecurring} onCheckedChange={(val) => setFormData({...formData, isRecurring: val})} />
              </div>

              {formData.isRecurring && (
                <div className="space-y-3">
                  <Label className="text-[10px] uppercase font-black tracking-widest">Días</Label>
                  <div className="flex justify-between gap-1 md:gap-2">
                    {WEEK_DAYS.map((day) => (
                      <button
                        key={day.value}
                        onClick={() => setFormData(prev => ({
                          ...prev,
                          recurringDays: prev.recurringDays.includes(day.value) ? prev.recurringDays.filter(d => d !== day.value) : [...prev.recurringDays, day.value]
                        }))}
                        className={cn(
                          "w-9 h-9 md:w-11 md:h-11 rounded-lg md:rounded-xl text-[9px] md:text-[10px] font-black transition-all border",
                          formData.recurringDays.includes(day.value) ? "bg-primary text-black border-primary" : "bg-white/5 border-white/10 text-muted-foreground"
                        )}
                      >
                        {day.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-[10px] uppercase font-black tracking-widest">Inicio</Label>
                  <Input type="time" value={formData.startTime} onChange={(e) => setFormData({...formData, startTime: e.target.value})} className="bg-white/5 border-white/10 h-11 rounded-xl" />
                </div>
                <div className="space-y-2">
                  <Label className="text-[10px] uppercase font-black tracking-widest">Fin</Label>
                  <Input type="time" value={formData.endTime} onChange={(e) => setFormData({...formData, endTime: e.target.value})} className="bg-white/5 border-white/10 h-11 rounded-xl" />
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button onClick={handleSaveTask} className="w-full neon-glow font-black uppercase text-xs h-14 md:h-16 rounded-2xl">
                Sincronizar Agenda
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="flex gap-3 md:gap-4 overflow-x-auto pb-6 scrollbar-hide -mx-4 px-4 md:mx-0 md:px-0">
        {days.map((day) => {
          const isSelected = isSameDay(day, selectedDate);
          const isToday = isSameDay(day, new Date());
          return (
            <button
              key={day.toString()}
              onClick={() => setSelectedDate(day)}
              className={cn(
                "flex-shrink-0 w-20 md:w-24 py-5 md:py-6 rounded-[2rem] md:rounded-[2.5rem] flex flex-col items-center gap-2 transition-all border outline-none",
                isSelected ? "bg-primary text-black border-primary scale-105 md:scale-110 z-10 shadow-xl" : "glass border-white/5"
              )}
            >
              <span className={cn("text-[9px] md:text-[11px] uppercase font-black tracking-widest", isSelected ? "text-black/60" : "text-muted-foreground/50")}>
                {format(day, 'EEE', { locale: es })}
              </span>
              <span className="text-2xl md:text-3xl font-black">{format(day, 'd')}</span>
              {isToday && !isSelected && <div className="absolute top-2 right-4 w-1.5 h-1.5 rounded-full bg-primary neon-glow" />}
            </button>
          );
        })}
      </div>

      <div className="relative mt-8 md:mt-12 ml-4 md:ml-32">
        <div className="absolute left-[-16px] md:left-[-48px] top-0 bottom-0 w-px bg-white/10" />
        
        <div className="space-y-12 md:space-y-16">
          <AnimatePresence mode="popLayout">
            {dailyTasks.length > 0 ? (
              dailyTasks.map((task, idx) => {
                const progress = getActivityProgress(task);
                const isActive = progress !== null;

                return (
                  <motion.div
                    key={task.id}
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    className="relative"
                  >
                    <div className={cn(
                      "absolute left-[-22px] md:left-[-54px] top-6 w-3 h-3 md:w-4 md:h-4 rounded-full border-2 transition-all z-20",
                      isActive ? "bg-primary border-primary animate-pulse shadow-[0_0_10px_rgba(57,255,20,0.5)]" : (task.priority === 'alta' ? 'bg-red-500 border-red-200' : 'bg-white/20 border-white/40')
                    )} />
                    
                    <div className="flex flex-col md:flex-row md:items-start gap-4 md:gap-16">
                      <div className="w-20 pt-1 md:pt-6">
                        <span className={cn("text-sm md:text-xl font-black uppercase tracking-widest", isActive ? "text-primary glow-text" : "text-white/40")}>
                          {format(parseISO(task.scheduledStartTime), "HH:mm")}
                        </span>
                      </div>

                      <div className={cn(
                        "flex-1 glass p-5 md:p-10 rounded-[2rem] md:rounded-[3.5rem] flex flex-col gap-5 border-l-[6px] transition-all relative overflow-hidden",
                        task.priority === 'alta' ? 'border-l-red-500' : (isActive ? 'border-l-primary' : 'border-l-white/20')
                      )}>
                        <div className="absolute top-0 right-0 p-4 md:p-8 opacity-0 group-hover:opacity-100 transition-opacity z-10 flex gap-2">
                           <Button variant="ghost" size="icon" onClick={() => openEditDialog(task)} className="h-10 w-10 md:h-12 md:w-12 rounded-2xl bg-black/40"><Edit3 className="w-4 h-4 md:w-5 md:h-5" /></Button>
                           <Button variant="ghost" size="icon" onClick={() => { if(confirm("¿Eliminar?")) deleteDocumentNonBlocking(doc(firestore, "users", user.uid, "tasks", task.id)); }} className="h-10 w-10 md:h-12 md:w-12 rounded-2xl bg-black/40"><Trash2 className="w-4 h-4 md:w-5 md:h-5" /></Button>
                        </div>

                        <div className="space-y-3">
                            <div className="flex flex-wrap items-center gap-2">
                              <Badge variant="outline" className="text-[8px] md:text-[10px] font-black uppercase px-2 py-0.5">
                                {task.priority || 'media'}
                              </Badge>
                              {task.isRecurring && (
                                <Badge className="bg-primary/10 text-primary border-primary/20 text-[8px] md:text-[10px] font-black px-2 py-0.5">
                                  <RotateCcw className="w-3 h-3 mr-1" /> RUTINA
                                </Badge>
                              )}
                            </div>
                            <h4 className="text-xl md:text-4xl font-black tracking-tighter leading-none text-white">
                              {task.title}
                            </h4>
                        </div>

                        {isActive && (
                          <div className="space-y-3 bg-white/5 p-4 md:p-6 rounded-2xl md:rounded-3xl border border-white/5">
                            <div className="flex justify-between text-[9px] md:text-[10px] font-black text-primary uppercase">
                              <span>SISTEMA ACTIVO</span>
                              <span>{progress}%</span>
                            </div>
                            <Progress value={progress} className="h-1.5 md:h-2" />
                          </div>
                        )}

                        <div className="flex items-center gap-6 md:gap-8 text-[10px] md:text-xs text-white/40 uppercase font-black tracking-[0.2em]">
                          <span className="flex items-center gap-2"><Clock className="w-4 h-4 text-primary" /> {format(parseISO(task.scheduledStartTime), "HH:mm")} - {task.scheduledEndTime ? format(parseISO(task.scheduledEndTime), "HH:mm") : '...'}</span>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                );
              })
            ) : (
              <div className="flex flex-col items-center justify-center py-20 glass rounded-[2.5rem] border-dashed border-white/5 opacity-10">
                <Inbox className="w-16 h-16 mb-4" />
                <p className="text-[10px] font-black uppercase tracking-[0.5em]">Sin Actividades</p>
              </div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}