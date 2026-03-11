
"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useFirestore, useUser, useCollection, useMemoFirebase } from "@/firebase";
import { collection, doc, serverTimestamp } from "firebase/firestore";
import { addDocumentNonBlocking, updateDocumentNonBlocking, deleteDocumentNonBlocking } from "@/firebase/non-blocking-updates";
import { Calendar } from "@/components/ui/calendar";
import { Card } from "@/components/ui/card";
import { format, isSameDay, parseISO, setHours, setMinutes } from "date-fns";
import { es } from "date-fns/locale";
import { 
  Calendar as CalendarIcon, 
  Clock, 
  ChevronRight, 
  Inbox, 
  Plus, 
  Trash2, 
  Edit3,
  LayoutGrid
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
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
import { useAppContextStore } from "@/lib/store";

interface CalendarTask {
  id: string;
  title: string;
  description?: string;
  status: string;
  priority: 'baja' | 'media' | 'alta';
  context: string;
  userId: string;
  dueDate: string;
  scheduledStartTime?: string;
}

export default function CalendarPage() {
  const { context } = useAppContextStore();
  const { user, isUserLoading } = useUser();
  const firestore = useFirestore();
  const router = useRouter();
  
  const [date, setDate] = useState<Date | undefined>(new Date());
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<CalendarTask | null>(null);

  // Form State
  const [formData, setFormData] = useState({
    title: "",
    time: "09:00",
    priority: "media" as 'baja' | 'media' | 'alta',
    status: "Pendiente"
  });

  const tasksQuery = useMemoFirebase(() => {
    if (!firestore || !user) return null;
    return collection(firestore, "users", user.uid, "tasks");
  }, [firestore, user]);

  const { data: tasks, isLoading: isTasksLoading } = useCollection<CalendarTask>(tasksQuery);

  if (isUserLoading) return null;
  if (!user) {
    router.push("/login");
    return null;
  }

  const selectedDayTasks = tasks?.filter(task => {
    if (!task.dueDate || !date) return false;
    return isSameDay(parseISO(task.dueDate), date) && task.context === context;
  }).sort((a, b) => a.dueDate.localeCompare(b.dueDate)) || [];

  const daysWithTasks = tasks?.filter(t => t.context === context).map(t => parseISO(t.dueDate)) || [];

  const handleSaveEvent = () => {
    if (!formData.title.trim() || !date) return;

    const [hours, minutes] = formData.time.split(':').map(Number);
    const finalDate = setMinutes(setHours(date, hours), minutes).toISOString();

    const taskData = {
      title: formData.title,
      dueDate: finalDate,
      scheduledStartTime: finalDate, // Synchronize for Schedule view
      priority: formData.priority,
      status: formData.status,
      context,
      userId: user.uid,
      updatedAt: serverTimestamp(),
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
    setFormData({ title: "", time: "09:00", priority: "media", status: "Pendiente" });
    setEditingTask(null);
  };

  const openEditDialog = (task: CalendarTask) => {
    setEditingTask(task);
    setFormData({
      title: task.title,
      time: format(parseISO(task.dueDate), "HH:mm"),
      priority: task.priority || "media",
      status: task.status
    });
    setIsDialogOpen(true);
  };

  const handleDeleteTask = (taskId: string) => {
    const docRef = doc(firestore, "users", user.uid, "tasks", taskId);
    deleteDocumentNonBlocking(docRef);
  };

  return (
    <div className="max-w-7xl mx-auto space-y-8 md:space-y-12 pb-24 lg:pb-10">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 px-2 md:px-0">
        <div>
          <h2 className="text-3xl md:text-5xl font-black tracking-tighter leading-none">Mi Calendario</h2>
          <p className="text-[10px] text-muted-foreground font-black uppercase tracking-[0.4em] mt-3 flex items-center gap-2">
            <span className="w-8 h-px bg-primary/40" /> Sincronización de Eventos {context}
          </p>
        </div>
        
        <Dialog open={isDialogOpen} onOpenChange={(open) => { if(!open) resetForm(); setIsDialogOpen(open); }}>
          <DialogTrigger asChild>
            <Button className="rounded-2xl h-12 md:h-14 px-6 md:px-8 font-black uppercase tracking-widest text-[10px] md:text-xs neon-glow w-full md:w-auto">
              <Plus className="w-4 h-4 md:w-5 md:h-5 mr-2" /> Nuevo Evento
            </Button>
          </DialogTrigger>
          <DialogContent className="glass-card border-white/10 bg-black/95 sm:max-w-[450px] p-6 md:p-8">
            <DialogHeader>
              <DialogTitle className="text-2xl md:text-3xl font-black tracking-tighter uppercase">
                {editingTask ? 'Modificar Evento' : 'Agendar Evento'}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4 md:space-y-6 py-4">
              <div className="space-y-2">
                <Label className="text-[10px] uppercase font-black text-primary">Nombre del Evento</Label>
                <Input 
                  placeholder="Ej: Revisión de Sprint..."
                  value={formData.title} 
                  onChange={(e) => setFormData({...formData, title: e.target.value})}
                  className="bg-white/5 border-white/10 h-11 rounded-xl" 
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-[10px] uppercase font-black">Hora</Label>
                  <Input 
                    type="time"
                    value={formData.time}
                    onChange={(e) => setFormData({...formData, time: e.target.value})}
                    className="bg-white/5 border-white/10 h-11 rounded-xl"
                  />
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
              <div className="space-y-2">
                <Label className="text-[10px] uppercase font-black">Estado</Label>
                <Select value={formData.status} onValueChange={(v) => setFormData({...formData, status: v})}>
                  <SelectTrigger className="bg-white/5 border-white/10 h-11 rounded-xl">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-zinc-900 border-white/10">
                    <SelectItem value="Pendiente">Pendiente</SelectItem>
                    <SelectItem value="Haciendo">Haciendo</SelectItem>
                    <SelectItem value="Hecho">Hecho</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button onClick={handleSaveEvent} className="w-full neon-glow font-black uppercase text-xs h-12 md:h-14 rounded-2xl">
                {editingTask ? 'Actualizar Evento' : 'Sincronizar con Calendario'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start px-2 md:px-0">
        {/* Calendar View */}
        <div className="lg:col-span-5 space-y-6">
          <Card className="glass-card border-white/5 bg-black/40 p-4 md:p-6 relative overflow-hidden group">
            <div className="absolute -top-24 -right-24 w-48 h-48 bg-primary/10 rounded-full blur-3xl group-hover:bg-primary/20 transition-all" />
            <Calendar
              mode="single"
              selected={date}
              onSelect={setDate}
              locale={es}
              className="rounded-3xl border-none mx-auto scale-100 sm:scale-105 lg:scale-110 xl:scale-125 my-4"
              classNames={{
                day_today: "bg-primary/10 text-primary border border-primary/20 font-black",
                day_selected: "bg-primary text-primary-foreground neon-glow hover:bg-primary hover:text-primary-foreground font-black scale-110",
                day: "h-10 w-10 sm:h-12 sm:w-12 p-0 font-bold transition-all hover:bg-white/5 rounded-xl",
              }}
              modifiers={{ hasTask: daysWithTasks }}
              modifiersClassNames={{ hasTask: "after:content-[''] after:absolute after:bottom-1.5 after:left-1/2 after:-translate-x-1/2 after:w-1.5 after:h-1.5 after:bg-primary after:rounded-full after:neon-glow" }}
            />
          </Card>

          <div className="glass p-6 rounded-[2.5rem] border-white/5 flex items-center justify-between">
            <div className="space-y-1">
              <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Resumen del Mes</p>
              <p className="text-2xl font-black">{tasks?.filter(t => t.context === context).length || 0} Eventos Activos</p>
            </div>
            <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center border border-primary/20">
              <CalendarIcon className="w-6 h-6 text-primary" />
            </div>
          </div>
        </div>

        {/* Task List for Selected Day */}
        <div className="lg:col-span-7 space-y-6">
          <div className="flex items-center justify-between px-4">
            <h3 className="text-xs md:text-sm font-black uppercase tracking-[0.2em] flex items-center gap-3">
              <LayoutGrid className="w-4 h-4 text-primary" />
              Eventos: {date ? format(date, "d 'de' MMMM", { locale: es }) : "..."}
            </h3>
            <Badge variant="outline" className="rounded-full border-primary/20 text-primary bg-primary/5 px-4 h-8 font-black text-[10px] md:text-xs">
              {selectedDayTasks.length} NODOS
            </Badge>
          </div>

          <div className="space-y-4 max-h-[600px] overflow-y-auto pr-2 scrollbar-hide">
            <AnimatePresence mode="popLayout">
              {selectedDayTasks.length > 0 ? (
                selectedDayTasks.map((task, idx) => (
                  <motion.div
                    key={task.id}
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    transition={{ delay: idx * 0.05 }}
                    className="glass p-5 md:p-7 rounded-[2rem] md:rounded-[2.5rem] border border-white/5 hover:border-primary/40 transition-all group relative overflow-hidden"
                  >
                    <div className={cn(
                      "absolute top-0 left-0 w-1.5 h-full transition-all duration-500",
                      task.priority === 'alta' ? 'bg-red-500 shadow-[0_0_15px_rgba(239,68,68,0.4)]' : 
                      task.priority === 'media' ? 'bg-primary shadow-[0_0_15px_rgba(57,255,20,0.4)]' : 'bg-white/10'
                    )} />
                    
                    <div className="flex items-center justify-between gap-6">
                      <div className="space-y-3">
                        <div className="flex items-center gap-3">
                          <span className={cn(
                            "text-[8px] font-black px-2.5 py-0.5 rounded-full uppercase border",
                            task.priority === 'alta' ? 'bg-red-500/10 text-red-500 border-red-500/20' :
                            task.priority === 'media' ? 'bg-primary/10 text-primary border-primary/20' : 
                            'bg-white/5 text-muted-foreground border-white/10'
                          )}>
                            {task.priority || 'media'}
                          </span>
                          <span className="text-[9px] font-black text-muted-foreground/50 uppercase tracking-widest">{task.status}</span>
                        </div>
                        <h4 className="font-black text-lg md:text-2xl leading-none group-hover:translate-x-1 transition-transform">{task.title}</h4>
                        <div className="flex items-center gap-6 text-[10px] text-muted-foreground font-black uppercase tracking-widest">
                          <span className="flex items-center gap-2"><Clock className="w-4 h-4 text-primary" /> {format(parseISO(task.dueDate), "HH:mm")}</span>
                          <span className="text-primary/40">ID: {task.id.slice(0, 6)}</span>
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          onClick={() => openEditDialog(task)}
                          className="h-10 w-10 md:h-12 md:w-12 rounded-2xl hover:bg-primary hover:text-black transition-all"
                        >
                          <Edit3 className="w-5 h-5" />
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          onClick={() => handleDeleteTask(task.id)}
                          className="h-10 w-10 md:h-12 md:w-12 rounded-2xl hover:bg-red-500 hover:text-white transition-all"
                        >
                          <Trash2 className="w-5 h-5" />
                        </Button>
                      </div>
                    </div>
                  </motion.div>
                ))
              ) : (
                <motion.div 
                  initial={{ opacity: 0 }} 
                  animate={{ opacity: 1 }}
                  className="flex flex-col items-center justify-center py-24 md:py-32 glass rounded-[2.5rem] md:rounded-[3.5rem] border-dashed border-white/5 text-muted-foreground/30"
                >
                  <Inbox className="w-16 h-16 mb-6 stroke-[1]" />
                  <p className="text-[10px] font-black uppercase tracking-[0.4em] text-center">Espacio Vacío</p>
                  <p className="text-[8px] md:text-[9px] mt-2 font-bold uppercase">Sincroniza un evento para este día</p>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>
    </div>
  );
}
