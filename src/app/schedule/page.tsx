
"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { format, addDays, startOfWeek, isSameDay, parseISO, setHours, setMinutes } from "date-fns";
import { es } from "date-fns/locale";
import { 
  Calendar as CalendarIcon, 
  Clock, 
  Plus, 
  MoreVertical, 
  Trash2, 
  Edit3, 
  ChevronRight,
  Inbox
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

interface ScheduledTask {
  id: string;
  title: string;
  context: string;
  scheduledStartTime: string;
  scheduledEndTime?: string;
  priority?: 'baja' | 'media' | 'alta';
  userId: string;
}

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
    priority: "media" as 'baja' | 'media' | 'alta'
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

  const dailyTasks = tasks?.filter(task => {
    if (!task.scheduledStartTime) return false;
    return isSameDay(parseISO(task.scheduledStartTime), selectedDate) && task.context === context;
  }).sort((a, b) => a.scheduledStartTime.localeCompare(b.scheduledStartTime)) || [];

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
      updatedAt: serverTimestamp(),
      status: 'Pendiente',
      dueDate: scheduledStartTime, // Sync due date for calendar view
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
    setFormData({ title: "", startTime: "09:00", endTime: "10:00", priority: "media" });
    setEditingTask(null);
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
      priority: task.priority || "media"
    });
    setIsDialogOpen(true);
  };

  return (
    <div className="space-y-8 md:space-y-12 max-w-5xl mx-auto pb-24">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div>
          <h2 className="text-3xl md:text-5xl font-black tracking-tighter">Cronograma</h2>
          <p className="text-[10px] text-muted-foreground font-black uppercase tracking-[0.4em] mt-3 flex items-center gap-2">
            <span className="w-8 h-px bg-primary/40" /> Optimización Temporal {context}
          </p>
        </div>
        
        <Dialog open={isDialogOpen} onOpenChange={(open) => { if(!open) resetForm(); setIsDialogOpen(open); }}>
          <DialogTrigger asChild>
            <Button className="rounded-2xl h-12 md:h-14 px-6 md:px-8 font-black uppercase tracking-widest text-[10px] md:text-xs neon-glow w-full md:w-auto">
              <Plus className="w-4 h-4 md:w-5 md:h-5 mr-2" /> Bloque de Horario
            </Button>
          </DialogTrigger>
          <DialogContent className="glass-card border-white/10 bg-black/95 sm:max-w-[450px] p-6 md:p-8">
            <DialogHeader>
              <DialogTitle className="text-2xl md:text-3xl font-black tracking-tighter uppercase">
                {editingTask ? 'Editar Bloque' : 'Nuevo Bloque'}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4 md:space-y-6 py-4">
              <div className="space-y-2">
                <Label className="text-[10px] uppercase font-black text-primary">Actividad</Label>
                <Input 
                  placeholder="Ej: Desarrollo de API..."
                  value={formData.title} 
                  onChange={(e) => setFormData({...formData, title: e.target.value})}
                  className="bg-white/5 border-white/10 h-11 rounded-xl" 
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-[10px] uppercase font-black">Inicio</Label>
                  <Input 
                    type="time"
                    value={formData.startTime}
                    onChange={(e) => setFormData({...formData, startTime: e.target.value})}
                    className="bg-white/5 border-white/10 h-11 rounded-xl"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-[10px] uppercase font-black">Fin</Label>
                  <Input 
                    type="time"
                    value={formData.endTime}
                    onChange={(e) => setFormData({...formData, endTime: e.target.value})}
                    className="bg-white/5 border-white/10 h-11 rounded-xl"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label className="text-[10px] uppercase font-black">Prioridad</Label>
                <Select value={formData.priority} onValueChange={(v: any) => setFormData({...formData, priority: v})}>
                  <SelectTrigger className="bg-white/5 border-white/10 h-11 rounded-xl">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-zinc-900 border-white/10">
                    <SelectItem value="baja">Baja</SelectItem>
                    <SelectItem value="media">Media</SelectItem>
                    <SelectItem value="alta">Alta</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button onClick={handleSaveTask} className="w-full neon-glow font-black uppercase text-xs h-12 md:h-14 rounded-2xl">
                {editingTask ? 'Actualizar Sistema' : 'Sincronizar Bloque'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Day Selector */}
      <div className="flex gap-3 overflow-x-auto pb-6 scrollbar-hide -mx-4 px-4 md:mx-0 md:px-0">
        {days.map((day) => {
          const isSelected = isSameDay(day, selectedDate);
          const isToday = isSameDay(day, new Date());
          return (
            <button
              key={day.toString()}
              onClick={() => setSelectedDate(day)}
              className={cn(
                "flex-shrink-0 w-16 md:w-20 py-4 rounded-[2rem] flex flex-col items-center gap-1 transition-all border outline-none",
                isSelected 
                  ? "bg-primary text-primary-foreground neon-glow border-primary scale-105 z-10" 
                  : "glass hover:border-white/20 border-white/5 hover:bg-white/5"
              )}
            >
              <span className={cn(
                "text-[9px] md:text-[10px] uppercase font-black tracking-tighter",
                isSelected ? "opacity-90" : "opacity-40"
              )}>
                {format(day, 'EEE', { locale: es })}
              </span>
              <span className="text-xl md:text-2xl font-black">{format(day, 'd')}</span>
              {isToday && !isSelected && <div className="w-1 h-1 rounded-full bg-primary mt-1" />}
            </button>
          );
        })}
      </div>

      {/* Timeline View */}
      <div className="relative mt-8 md:mt-12 ml-4 md:ml-24">
        <div className="absolute left-[-16px] md:left-[-40px] top-0 bottom-0 w-px bg-white/5" />
        
        <div className="space-y-12">
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
                  <div className="absolute left-[-20px] md:left-[-44px] top-4 w-2 md:w-2.5 h-2 md:h-2.5 rounded-full bg-primary/20 border border-primary/40 group-hover:bg-primary group-hover:neon-glow transition-all" />
                  
                  <div className="flex flex-col sm:flex-row sm:items-start gap-4 md:gap-12">
                    <div className="w-16 pt-1 sm:pt-4">
                      <span className="text-[11px] md:text-sm font-black text-muted-foreground uppercase tracking-widest">
                        {format(parseISO(task.scheduledStartTime), "HH:mm")}
                      </span>
                    </div>

                    <div className={cn(
                      "flex-1 glass p-5 md:p-7 rounded-[2rem] md:rounded-[2.5rem] flex items-center justify-between border-l-4 transition-all hover:translate-x-2 group-hover:border-primary/40",
                      task.priority === 'alta' ? 'border-l-red-500' : 
                      task.priority === 'media' ? 'border-l-primary' : 'border-l-white/20'
                    )}>
                      <div className="space-y-3">
                        <div className="flex items-center gap-3">
                          <Badge variant="outline" className="text-[8px] font-black uppercase px-2 py-0 border-white/10 text-muted-foreground">
                            {task.priority || 'media'}
                          </Badge>
                          <span className="text-[9px] font-black text-muted-foreground/40 uppercase tracking-[0.2em]">{task.context}</span>
                        </div>
                        <h4 className="text-base md:text-xl font-black tracking-tight leading-none group-hover:text-primary transition-colors">
                          {task.title}
                        </h4>
                        <div className="flex items-center gap-6 text-[10px] text-muted-foreground uppercase font-black tracking-widest">
                          <span className="flex items-center gap-2">
                            <Clock className="w-3.5 h-3.5 text-primary" /> 
                            {format(parseISO(task.scheduledStartTime), "HH:mm")} 
                            {task.scheduledEndTime && ` - ${format(parseISO(task.scheduledEndTime), "HH:mm")}`}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-1 md:gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          onClick={() => openEditDialog(task)}
                          className="h-9 w-9 md:h-11 md:w-11 rounded-xl hover:bg-primary/10 hover:text-primary"
                        >
                          <Edit3 className="w-4 h-4" />
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          onClick={() => handleDeleteTask(task.id)}
                          className="h-9 w-9 md:h-11 md:w-11 rounded-xl hover:bg-red-500/10 hover:text-red-500"
                        >
                          <Trash2 className="w-4 h-4" />
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
                className="flex flex-col items-center justify-center py-20 md:py-32 glass rounded-[2.5rem] md:rounded-[3.5rem] border-dashed border-white/5 text-muted-foreground/20"
              >
                <Inbox className="w-12 h-12 md:w-16 md:h-16 mb-6 stroke-[1]" />
                <p className="text-[10px] md:text-xs font-black uppercase tracking-[0.4em] text-center">Espacio Temporal Vacío</p>
                <p className="text-[8px] md:text-[9px] mt-2 font-bold uppercase">Pulsa el botón superior para sincronizar una actividad</p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
