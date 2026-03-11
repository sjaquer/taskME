
"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useFirestore, useUser, useCollection, useMemoFirebase } from "@/firebase";
import { collection, doc, serverTimestamp } from "firebase/firestore";
import { addDocumentNonBlocking, updateDocumentNonBlocking, deleteDocumentNonBlocking } from "@/firebase/non-blocking-updates";
import { Calendar } from "@/components/ui/calendar";
import { Card } from "@/components/ui/card";
import { format, isSameDay, parseISO, setHours, setMinutes, getDay, getDate } from "date-fns";
import { es } from "date-fns/locale";
import { 
  Calendar as CalendarIcon, 
  Clock, 
  Plus, 
  Trash2, 
  Edit3,
  LayoutGrid,
  MapPin,
  RefreshCcw,
  Tag,
  Share2,
  ExternalLink,
  Inbox
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
import { toast } from "@/hooks/use-toast";

interface CalendarTask {
  id: string;
  title: string;
  description?: string;
  status: string;
  priority: 'baja' | 'media' | 'alta';
  context: string;
  userId: string;
  dueDate: string;
  location?: string;
  category?: string;
  isRecurring?: boolean;
  recurrenceType?: 'none' | 'weekly' | 'monthly';
  recurringDays?: number[];
}

const CATEGORIES = [
  { label: "Personal", color: "bg-blue-500" },
  { label: "Académico", color: "bg-purple-500" },
  { label: "Laboral", color: "bg-orange-500" },
  { label: "Especial", color: "bg-pink-500" },
];

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
    status: "Pendiente",
    location: "",
    category: "Personal",
    recurrenceType: "none" as 'none' | 'weekly' | 'monthly'
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
    if (task.context !== context) return false;

    const taskDate = parseISO(task.dueDate);
    
    // 1. Direct match
    if (isSameDay(taskDate, date)) return true;

    // 2. Weekly match
    if (task.recurrenceType === 'weekly' && task.recurringDays?.includes(getDay(date))) return true;

    // 3. Monthly match
    if (task.recurrenceType === 'monthly' && getDate(taskDate) === getDate(date)) return true;

    return false;
  }).sort((a, b) => a.dueDate.localeCompare(b.dueDate)) || [];

  const daysWithTasks = tasks?.filter(t => t.context === context).map(t => parseISO(t.dueDate)) || [];

  const handleSaveEvent = () => {
    if (!formData.title.trim() || !date) return;

    const [hours, minutes] = formData.time.split(':').map(Number);
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
      isRecurring: formData.recurrenceType !== 'none',
      recurringDays: formData.recurrenceType === 'weekly' ? [getDay(date)] : [],
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
    toast({ title: editingTask ? "Evento actualizado" : "Evento agendado", description: "La base de datos ha sido sincronizada." });
  };

  const resetForm = () => {
    setFormData({ 
      title: "", 
      time: "09:00", 
      priority: "media", 
      status: "Pendiente",
      location: "",
      category: "Personal",
      recurrenceType: "none"
    });
    setEditingTask(null);
  };

  const openEditDialog = (task: CalendarTask) => {
    setEditingTask(task);
    setFormData({
      title: task.title,
      time: format(parseISO(task.dueDate), "HH:mm"),
      priority: task.priority || "media",
      status: task.status,
      location: task.location || "",
      category: task.category || "Personal",
      recurrenceType: task.recurrenceType || "none"
    });
    setIsDialogOpen(true);
  };

  const handleDeleteTask = (taskId: string) => {
    const docRef = doc(firestore, "users", user.uid, "tasks", taskId);
    deleteDocumentNonBlocking(docRef);
  };

  const handleGoogleSync = () => {
    toast({
      title: "Sincronización Iniciada",
      description: "Conectando con Google Calendar API...",
    });
    // In a production app, we would use window.location.href to trigger OAuth
  };

  return (
    <div className="max-w-7xl mx-auto space-y-8 md:space-y-12 pb-24 lg:pb-10 px-4 md:px-0">
      {/* Header Adaptativo */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div className="space-y-2">
          <h2 className="text-4xl md:text-6xl font-black tracking-tighter leading-none">Calendario</h2>
          <div className="flex items-center gap-3">
            <p className="text-[10px] text-primary font-black uppercase tracking-[0.4em] flex items-center gap-2">
              <span className="w-8 h-px bg-primary/40" /> Control de Eventos {context}
            </p>
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={handleGoogleSync}
              className="h-8 rounded-full border border-white/5 bg-white/5 hover:bg-primary/20 hover:text-primary transition-all text-[9px] font-black uppercase tracking-widest px-4"
            >
              <RefreshCcw className="w-3 h-3 mr-2" /> Google Sync
            </Button>
          </div>
        </div>
        
        <Dialog open={isDialogOpen} onOpenChange={(open) => { if(!open) resetForm(); setIsDialogOpen(open); }}>
          <DialogTrigger asChild>
            <Button className="rounded-2xl h-14 md:h-16 px-8 font-black uppercase tracking-widest text-xs neon-glow w-full md:w-auto">
              <Plus className="w-5 h-5 mr-2" /> Agendar Evento
            </Button>
          </DialogTrigger>
          <DialogContent className="glass-card border-white/10 bg-black/95 sm:max-w-[500px] p-6 md:p-8">
            <DialogHeader>
              <DialogTitle className="text-3xl font-black tracking-tighter uppercase">
                {editingTask ? 'Modificar Evento' : 'Inyectar Evento'}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-5 py-4">
              <div className="space-y-2">
                <Label className="text-[10px] uppercase font-black text-primary">Nombre del Evento</Label>
                <Input 
                  placeholder="Ej: Lanzamiento de Módulo..."
                  value={formData.title} 
                  onChange={(e) => setFormData({...formData, title: e.target.value})}
                  className="bg-white/5 border-white/10 h-12 rounded-xl" 
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-[10px] uppercase font-black">Categoría</Label>
                  <Select value={formData.category} onValueChange={(v) => setFormData({...formData, category: v})}>
                    <SelectTrigger className="bg-white/5 border-white/10 h-12 rounded-xl">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-zinc-900 border-white/10">
                      {CATEGORIES.map(cat => (
                        <SelectItem key={cat.label} value={cat.label}>{cat.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label className="text-[10px] uppercase font-black">Repetición</Label>
                  <Select value={formData.recurrenceType} onValueChange={(v: any) => setFormData({...formData, recurrenceType: v})}>
                    <SelectTrigger className="bg-white/5 border-white/10 h-12 rounded-xl">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-zinc-900 border-white/10">
                      <SelectItem value="none">Ninguna</SelectItem>
                      <SelectItem value="weekly">Semanal</SelectItem>
                      <SelectItem value="monthly">Mensual</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label className="text-[10px] uppercase font-black text-white/50">Localización / Lugar</Label>
                <div className="relative">
                  <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-primary/60" />
                  <Input 
                    placeholder="Sede Central, Sala 4..."
                    value={formData.location}
                    onChange={(e) => setFormData({...formData, location: e.target.value})}
                    className="pl-10 bg-white/5 border-white/10 h-12 rounded-xl" 
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-[10px] uppercase font-black">Hora</Label>
                  <Input 
                    type="time"
                    value={formData.time}
                    onChange={(e) => setFormData({...formData, time: e.target.value})}
                    className="bg-white/5 border-white/10 h-12 rounded-xl"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-[10px] uppercase font-black">Prioridad</Label>
                  <Select value={formData.priority} onValueChange={(v: any) => setFormData({...formData, priority: v})}>
                    <SelectTrigger className="bg-white/5 border-white/10 h-12 rounded-xl">
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
            </div>
            <DialogFooter>
              <Button onClick={handleSaveEvent} className="w-full neon-glow font-black uppercase text-xs h-16 rounded-2xl">
                {editingTask ? 'Actualizar Evento' : 'Sincronizar Evento'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Calendar Column */}
        <div className="lg:col-span-5 space-y-6">
          <Card className="glass-card border-white/5 bg-black/40 p-6 md:p-8 relative overflow-hidden group shadow-2xl">
            <div className="absolute -top-24 -right-24 w-64 h-64 bg-primary/10 rounded-full blur-[100px] group-hover:bg-primary/20 transition-all" />
            <Calendar
              mode="single"
              selected={date}
              onSelect={setDate}
              locale={es}
              className="rounded-3xl border-none mx-auto scale-100 sm:scale-110 lg:scale-110 xl:scale-125 my-8"
              classNames={{
                day_today: "bg-primary/10 text-primary border border-primary/20 font-black",
                day_selected: "bg-primary text-primary-foreground neon-glow hover:bg-primary hover:text-primary-foreground font-black scale-110",
                day: "h-10 w-10 sm:h-12 sm:w-12 p-0 font-bold transition-all hover:bg-white/10 rounded-xl relative",
              }}
              modifiers={{ hasTask: daysWithTasks }}
              modifiersClassNames={{ hasTask: "after:content-[''] after:absolute after:bottom-1.5 after:left-1/2 after:-translate-x-1/2 after:w-1.5 after:h-1.5 after:bg-primary after:rounded-full after:neon-glow" }}
            />
          </Card>

          <div className="glass p-8 rounded-[2.5rem] border-white/5 flex items-center justify-between group">
            <div className="space-y-1">
              <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Resumen del Contexto</p>
              <p className="text-3xl font-black">{tasks?.filter(t => t.context === context).length || 0} Nodos Totales</p>
            </div>
            <div className="w-16 h-16 rounded-3xl bg-primary/10 flex items-center justify-center border border-primary/20 group-hover:scale-110 transition-transform">
              <LayoutGrid className="w-8 h-8 text-primary" />
            </div>
          </div>
        </div>

        {/* Task List Column */}
        <div className="lg:col-span-7 space-y-6">
          <div className="flex items-center justify-between px-4">
            <h3 className="text-xs font-black uppercase tracking-[0.3em] flex items-center gap-3">
              <CalendarIcon className="w-5 h-5 text-primary" />
              {date ? format(date, "EEEE, d 'de' MMMM", { locale: es }) : "Selecciona una fecha"}
            </h3>
            <Badge variant="outline" className="rounded-full border-primary/20 text-primary bg-primary/5 px-5 h-10 font-black text-xs">
              {selectedDayTasks.length} EVENTOS
            </Badge>
          </div>

          <div className="space-y-4 max-h-[700px] overflow-y-auto pr-2 scrollbar-hide">
            <AnimatePresence mode="popLayout">
              {selectedDayTasks.length > 0 ? (
                selectedDayTasks.map((task, idx) => (
                  <motion.div
                    key={task.id}
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    transition={{ delay: idx * 0.05 }}
                    className="glass p-6 md:p-8 rounded-[2.5rem] border border-white/5 hover:border-primary/40 transition-all group relative overflow-hidden"
                  >
                    <div className={cn(
                      "absolute top-0 left-0 w-2 h-full transition-all duration-500",
                      task.priority === 'alta' ? 'bg-red-500 shadow-[0_0_20px_rgba(239,68,68,0.5)]' : 
                      task.priority === 'media' ? 'bg-primary shadow-[0_0_20px_rgba(57,255,20,0.5)]' : 'bg-white/10'
                    )} />
                    
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                      <div className="space-y-4">
                        <div className="flex flex-wrap items-center gap-3">
                          <span className={cn(
                            "text-[9px] font-black px-3 py-1 rounded-full uppercase border",
                            task.priority === 'alta' ? 'bg-red-500/10 text-red-500 border-red-500/20' :
                            task.priority === 'media' ? 'bg-primary/10 text-primary border-primary/20' : 
                            'bg-white/5 text-muted-foreground border-white/10'
                          )}>
                            {task.priority || 'media'}
                          </span>
                          <span className="text-[9px] font-black text-white/20 uppercase tracking-widest">{task.status}</span>
                          {task.category && (
                            <Badge className="bg-white/5 text-white/60 border-white/10 text-[9px] font-black px-3">
                              <Tag className="w-3 h-3 mr-2" /> {task.category}
                            </Badge>
                          )}
                          {task.isRecurring && (
                            <Badge className="bg-primary/5 text-primary border-primary/20 text-[9px] font-black">
                              <RefreshCcw className="w-3 h-3 mr-2" /> 
                              {task.recurrenceType === 'monthly' ? 'Mensual' : 'Semanal'}
                            </Badge>
                          )}
                        </div>

                        <div className="space-y-1">
                          <h4 className="font-black text-2xl md:text-3xl leading-none group-hover:text-primary transition-colors">{task.title}</h4>
                          {task.location && (
                            <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest flex items-center gap-2 mt-2">
                              <MapPin className="w-4 h-4 text-primary/40" /> {task.location}
                            </p>
                          )}
                        </div>

                        <div className="flex items-center gap-8 text-[11px] text-muted-foreground font-black uppercase tracking-widest">
                          <span className="flex items-center gap-2"><Clock className="w-4 h-4 text-primary" /> {format(parseISO(task.dueDate), "HH:mm")}</span>
                          <span className="text-primary/20">NODE ID: {task.id.slice(0, 8)}</span>
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-3 opacity-0 group-hover:opacity-100 transition-all scale-90 group-hover:scale-100">
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          onClick={() => openEditDialog(task)}
                          className="h-12 w-12 md:h-14 md:w-14 rounded-2xl hover:bg-primary/10 hover:text-primary transition-all"
                        >
                          <Edit3 className="w-6 h-6" />
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          onClick={() => handleDeleteTask(task.id)}
                          className="h-12 w-12 md:h-14 md:w-14 rounded-2xl hover:bg-red-500/10 hover:text-red-500 transition-all"
                        >
                          <Trash2 className="w-6 h-6" />
                        </Button>
                      </div>
                    </div>
                  </motion.div>
                ))
              ) : (
                <motion.div 
                  initial={{ opacity: 0 }} 
                  animate={{ opacity: 1 }}
                  className="flex flex-col items-center justify-center py-32 glass rounded-[3.5rem] border-dashed border-white/5 text-muted-foreground/10"
                >
                  <Inbox className="w-24 h-24 mb-6 stroke-[0.5]" />
                  <p className="text-[11px] font-black uppercase tracking-[0.5em] text-center">Espacio Vacío</p>
                  <p className="text-[9px] mt-3 font-bold uppercase tracking-widest">Sincroniza un proceso para este día</p>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>
    </div>
  );
}

