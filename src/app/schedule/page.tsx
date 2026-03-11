
"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { format, addDays, startOfWeek, isSameDay, parseISO, setHours, setMinutes, getDay, isAfter, isBefore, startOfYear, endOfYear } from "date-fns";
import { es } from "date-fns/locale";
import { 
  Calendar as CalendarIcon, 
  Clock, 
  Plus, 
  Trash2, 
  Edit3, 
  Inbox,
  RotateCcw,
  CheckCircle2
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
import { Checkbox } from "@/components/ui/checkbox";

interface ScheduledTask {
  id: string;
  title: string;
  context: string;
  scheduledStartTime: string;
  scheduledEndTime?: string;
  priority?: 'baja' | 'media' | 'alta';
  userId: string;
  isRecurring?: boolean;
  recurringDays?: number[]; // 0: Dom, 1: Lun, etc.
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
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<ScheduledTask | null>(null);

  // Form State
  const [formData, setFormData] = useState({
    title: "",
    startTime: "09:00",
    endTime: "10:00",
    priority: "media" as 'baja' | 'media' | 'alta',
    isRecurring: false,
    recurringDays: [] as number[]
  });

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

  // Filter tasks for the selected date or recurring day
  const dailyTasks = tasks?.filter(task => {
    if (task.context !== context) return false;

    // Filter to show only tasks within the current year for a cleaner planner feel
    const taskDate = task.scheduledStartTime ? parseISO(task.scheduledStartTime) : null;
    if (taskDate && (isBefore(taskDate, startOfYear(new Date())) || isAfter(taskDate, endOfYear(new Date())))) {
      return false;
    }

    // Logic: Match specific date OR match recurring day of week
    if (task.isRecurring && task.recurringDays?.includes(getDay(selectedDate))) {
      return true;
    }
    
    return task.scheduledStartTime && isSameDay(parseISO(task.scheduledStartTime), selectedDate);
  }).sort((a, b) => {
    const timeA = format(parseISO(a.scheduledStartTime), "HH:mm");
    const timeB = format(parseISO(b.scheduledStartTime), "HH:mm");
    return timeA.localeCompare(timeB);
  }) || [];

  const handleSaveTask = () => {
    if (!formData.title.trim()) return;

    const [startH, startM] = formData.startTime.split(':').map(Number);
    const [endH, endM] = formData.endTime.split(':').map(Number);

    const scheduledStartTime = setMinutes(setHours(selectedDate, startH), startM).toISOString();
    const scheduledEndTime = setMinutes(setHours(selectedDate, endH), endM).toISOString();

    const taskData = {
      title: formData.title,
      scheduledStartTime,
      scheduledEndTime,
      priority: formData.priority,
      context,
      userId: user.uid,
      isRecurring: formData.isRecurring,
      recurringDays: formData.isRecurring ? formData.recurringDays : [],
      updatedAt: serverTimestamp(),
      status: 'Pendiente',
      dueDate: scheduledStartTime,
    };

    if (editingTask) {
      const docRef = doc(firestore, "users", user.uid, "tasks", editingTask.id);
      updateDocumentNonBlocking(docRef, taskData);
    } else {
      const colRef = collection(firestore, "users", user.uid, "tasks");
      addDocumentNonBlocking(colRef, { ...taskData, createdAt: serverTimestamp() });
    }

    resetForm();
    setIsDialogOpen(false);
  };

  const resetForm = () => {
    setFormData({ 
      title: "", 
      startTime: "09:00", 
      endTime: "10:00", 
      priority: "media",
      isRecurring: false,
      recurringDays: []
    });
    setEditingTask(null);
  };

  const toggleDay = (day: number) => {
    setFormData(prev => ({
      ...prev,
      recurringDays: prev.recurringDays.includes(day)
        ? prev.recurringDays.filter(d => d !== day)
        : [...prev.recurringDays, day]
    }));
  };

  const handleDeleteTask = (taskId: string) => {
    const docRef = doc(firestore, "users", user.uid, "tasks", taskId);
    deleteDocumentNonBlocking(docRef);
  };

  const openEditDialog = (task: ScheduledTask) => {
    setEditingTask(task);
    const start = parseISO(task.scheduledStartTime);
    const end = task.scheduledEndTime ? parseISO(task.scheduledEndTime) : addDays(start, 0);
    
    setFormData({
      title: task.title,
      startTime: format(start, "HH:mm"),
      endTime: format(end, "HH:mm"),
      priority: task.priority || "media",
      isRecurring: task.isRecurring || false,
      recurringDays: task.recurringDays || []
    });
    setIsDialogOpen(true);
  };

  return (
    <div className="space-y-8 md:space-y-12 max-w-5xl mx-auto pb-24">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 px-2 md:px-0">
        <div>
          <h2 className="text-3xl md:text-6xl font-black tracking-tighter leading-none">Mi Horario</h2>
          <p className="text-[10px] text-muted-foreground font-black uppercase tracking-[0.4em] mt-3 flex items-center gap-2">
            <span className="w-8 h-px bg-primary/40" /> Rutinas y Bloques de {context}
          </p>
        </div>
        
        <Dialog open={isDialogOpen} onOpenChange={(open) => { if(!open) resetForm(); setIsDialogOpen(open); }}>
          <DialogTrigger asChild>
            <Button className="rounded-2xl h-12 md:h-16 px-6 md:px-10 font-black uppercase tracking-widest text-[10px] md:text-xs neon-glow w-full md:w-auto transition-all hover:scale-105 active:scale-95">
              <Plus className="w-4 h-4 md:w-5 md:h-5 mr-2" /> Programar Actividad
            </Button>
          </DialogTrigger>
          <DialogContent className="glass-card border-white/10 bg-black/95 sm:max-w-[480px] p-6 md:p-8">
            <DialogHeader>
              <DialogTitle className="text-2xl md:text-4xl font-black tracking-tighter uppercase text-white">
                {editingTask ? 'Modificar Rutina' : 'Nuevo Bloque Temporal'}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-6 md:space-y-8 py-6">
              <div className="space-y-2">
                <Label className="text-[10px] uppercase font-black text-primary tracking-[0.2em]">Identificador de Actividad</Label>
                <Input 
                  placeholder="Ej: Matemáticas Avanzadas..."
                  value={formData.title} 
                  onChange={(e) => setFormData({...formData, title: e.target.value})}
                  className="bg-white/5 border-white/10 h-12 rounded-xl focus:ring-primary/40" 
                />
              </div>

              <div className="flex items-center justify-between p-4 glass rounded-2xl border-white/5">
                <div className="space-y-1">
                  <Label className="text-[10px] uppercase font-black tracking-widest text-white/80">Actividad Recurrente</Label>
                  <p className="text-[9px] text-muted-foreground uppercase font-bold">Repetir esta sesión cada semana</p>
                </div>
                <Switch 
                  checked={formData.isRecurring} 
                  onCheckedChange={(val) => setFormData({...formData, isRecurring: val})} 
                />
              </div>

              {formData.isRecurring && (
                <div className="space-y-3">
                  <Label className="text-[10px] uppercase font-black tracking-widest">Días de la Semana</Label>
                  <div className="flex justify-between gap-2">
                    {WEEK_DAYS.map((day) => (
                      <button
                        key={day.value}
                        onClick={() => toggleDay(day.value)}
                        className={cn(
                          "w-10 h-10 md:w-12 md:h-12 rounded-xl text-[10px] font-black transition-all border",
                          formData.recurringDays.includes(day.value)
                            ? "bg-primary text-black border-primary shadow-[0_0_15px_rgba(57,255,20,0.3)]"
                            : "bg-white/5 border-white/10 text-muted-foreground hover:border-white/20"
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
                  <Input 
                    type="time"
                    value={formData.startTime}
                    onChange={(e) => setFormData({...formData, startTime: e.target.value})}
                    className="bg-white/5 border-white/10 h-12 rounded-xl"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-[10px] uppercase font-black tracking-widest">Fin</Label>
                  <Input 
                    type="time"
                    value={formData.endTime}
                    onChange={(e) => setFormData({...formData, endTime: e.target.value})}
                    className="bg-white/5 border-white/10 h-12 rounded-xl"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label className="text-[10px] uppercase font-black tracking-widest">Prioridad del Bloque</Label>
                <Select value={formData.priority} onValueChange={(v: any) => setFormData({...formData, priority: v})}>
                  <SelectTrigger className="bg-white/5 border-white/10 h-12 rounded-xl">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-zinc-900 border-white/10">
                    <SelectItem value="baja">BAJA PRIORIDAD</SelectItem>
                    <SelectItem value="media">PRIORIDAD MEDIA</SelectItem>
                    <SelectItem value="alta">ALTA PRIORIDAD</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button onClick={handleSaveTask} className="w-full neon-glow font-black uppercase text-xs h-14 md:h-16 rounded-2xl">
                {editingTask ? 'Actualizar Rutina' : 'Sincronizar con Agenda'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Day Selector */}
      <div className="flex gap-4 overflow-x-auto pb-8 scrollbar-hide -mx-4 px-4 md:mx-0 md:px-0">
        {days.map((day) => {
          const isSelected = isSameDay(day, selectedDate);
          const isToday = isSameDay(day, new Date());
          return (
            <button
              key={day.toString()}
              onClick={() => setSelectedDate(day)}
              className={cn(
                "flex-shrink-0 w-20 md:w-24 py-5 rounded-[2.5rem] flex flex-col items-center gap-2 transition-all border outline-none group relative",
                isSelected 
                  ? "bg-primary text-black border-primary scale-110 z-10 shadow-[0_0_30px_rgba(57,255,20,0.2)]" 
                  : "glass hover:border-white/20 border-white/5 hover:bg-white/5"
              )}
            >
              <span className={cn(
                "text-[9px] md:text-[11px] uppercase font-black tracking-widest",
                isSelected ? "text-black/60" : "text-muted-foreground/50"
              )}>
                {format(day, 'EEE', { locale: es })}
              </span>
              <span className="text-2xl md:text-3xl font-black">{format(day, 'd')}</span>
              {isToday && !isSelected && (
                <div className="absolute top-2 right-4 w-1.5 h-1.5 rounded-full bg-primary neon-glow" />
              )}
            </button>
          );
        })}
      </div>

      {/* Timeline View */}
      <div className="relative mt-8 md:mt-12 ml-6 md:ml-32">
        <div className="absolute left-[-20px] md:left-[-48px] top-0 bottom-0 w-px bg-white/5 shadow-[0_0_10px_rgba(255,255,255,0.05)]" />
        
        <div className="space-y-16">
          <AnimatePresence mode="popLayout">
            {dailyTasks.length > 0 ? (
              dailyTasks.map((task, idx) => (
                <motion.div
                  key={task.id}
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  transition={{ delay: idx * 0.05 }}
                  className="relative group"
                >
                  <div className={cn(
                    "absolute left-[-26px] md:left-[-54px] top-6 w-3 h-3 md:w-4 md:h-4 rounded-full border-2 transition-all group-hover:scale-125",
                    task.priority === 'alta' ? 'bg-red-500 border-red-200' :
                    task.priority === 'media' ? 'bg-primary border-green-200' : 'bg-white/20 border-white/40'
                  )} />
                  
                  <div className="flex flex-col md:flex-row md:items-start gap-6 md:gap-16">
                    <div className="w-20 pt-1 md:pt-6">
                      <span className="text-xs md:text-lg font-black text-white/40 uppercase tracking-widest group-hover:text-primary transition-colors">
                        {format(parseISO(task.scheduledStartTime), "HH:mm")}
                      </span>
                    </div>

                    <div className={cn(
                      "flex-1 glass p-6 md:p-10 rounded-[2.5rem] md:rounded-[3.5rem] flex items-center justify-between border-l-[6px] transition-all hover:translate-x-3 group-hover:border-primary/60 hover:shadow-2xl",
                      task.priority === 'alta' ? 'border-l-red-500' : 
                      task.priority === 'media' ? 'border-l-primary' : 'border-l-white/20'
                    )}>
                      <div className="space-y-4">
                        <div className="flex flex-wrap items-center gap-3">
                          <Badge variant="outline" className="text-[8px] md:text-[9px] font-black uppercase px-3 py-0.5 border-white/10 text-muted-foreground bg-white/5">
                            {task.priority || 'media'}
                          </Badge>
                          {task.isRecurring && (
                            <Badge className="bg-primary/20 text-primary border-primary/20 text-[8px] md:text-[9px] font-black flex items-center gap-1.5 px-3 py-0.5">
                              <RotateCcw className="w-3 h-3" /> RUTINA SEMANAL
                            </Badge>
                          )}
                          <span className="text-[10px] font-black text-muted-foreground/30 uppercase tracking-[0.3em]">{task.context}</span>
                        </div>
                        <h4 className="text-xl md:text-3xl font-black tracking-tight leading-none text-white group-hover:text-primary transition-colors">
                          {task.title}
                        </h4>
                        <div className="flex items-center gap-8 text-[11px] md:text-xs text-muted-foreground uppercase font-black tracking-[0.2em]">
                          <span className="flex items-center gap-3">
                            <Clock className="w-4 h-4 text-primary" /> 
                            {format(parseISO(task.scheduledStartTime), "HH:mm")} 
                            {task.scheduledEndTime && ` — ${format(parseISO(task.scheduledEndTime), "HH:mm")}`}
                          </span>
                          <span className="hidden sm:inline text-white/10">|</span>
                          <span className="hidden sm:flex items-center gap-2">
                            <CheckCircle2 className="w-4 h-4 text-white/20" /> 
                            ID: {task.id.slice(0, 8)}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-all scale-90 group-hover:scale-100">
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          onClick={() => openEditDialog(task)}
                          className="h-12 w-12 md:h-14 md:w-14 rounded-2xl hover:bg-primary/10 hover:text-primary transition-colors"
                        >
                          <Edit3 className="w-5 h-5" />
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          onClick={() => handleDeleteTask(task.id)}
                          className="h-12 w-12 md:h-14 md:w-14 rounded-2xl hover:bg-red-500/10 hover:text-red-500 transition-colors"
                        >
                          <Trash2 className="w-5 h-5" />
                        </Button>
                      </div>
                    </div>
                  </div>
                </motion.div>
              ))
            ) : (
              <motion.div 
                initial={{ opacity: 0 }} 
                animate={{ opacity: 1 }}
                className="flex flex-col items-center justify-center py-24 md:py-40 glass rounded-[3.5rem] md:rounded-[5rem] border-dashed border-white/5 text-muted-foreground/10 mx-4 md:mx-0"
              >
                <Inbox className="w-20 h-20 md:w-32 md:h-32 mb-8 stroke-[0.5]" />
                <p className="text-[11px] md:text-sm font-black uppercase tracking-[0.6em] text-center">Sin Actividades Sincronizadas</p>
                <p className="text-[9px] md:text-[10px] mt-4 font-bold uppercase tracking-widest text-white/20">Optimiza tu tiempo programando una rutina hoy</p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
