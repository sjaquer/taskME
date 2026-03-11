"use client";

import { useState, useEffect } from "react";
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
import { Skeleton } from "@/components/ui/skeleton";

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
  
  const [mounted, setMounted] = useState(false);
  const [date, setDate] = useState<Date | undefined>(undefined);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<CalendarTask | null>(null);

  useEffect(() => {
    setMounted(true);
    setDate(new Date());
  }, []);

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

  if (!mounted || isUserLoading) return (
    <div className="max-w-7xl mx-auto space-y-8 p-4">
      <Skeleton className="h-16 w-2/3 md:w-1/3 bg-white/5" />
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        <Skeleton className="lg:col-span-5 h-[400px] md:h-[500px] bg-white/5 rounded-[2.5rem]" />
        <Skeleton className="lg:col-span-7 h-[400px] md:h-[500px] bg-white/5 rounded-[2.5rem]" />
      </div>
    </div>
  );

  if (!user) {
    router.push("/login");
    return null;
  }

  const selectedDayTasks = tasks?.filter(task => {
    if (!task.dueDate || !date) return false;
    if (task.context !== context) return false;

    const taskDate = parseISO(task.dueDate);
    if (isSameDay(taskDate, date)) return true;
    if (task.recurrenceType === 'weekly' && task.recurringDays?.includes(getDay(date))) return true;
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
    toast({ title: editingTask ? "Actualizado" : "Agendado" });
  };

  const resetForm = () => {
    setFormData({ title: "", time: "09:00", priority: "media", status: "Pendiente", location: "", category: "Personal", recurrenceType: "none" });
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

  return (
    <div className="max-w-7xl mx-auto space-y-8 md:space-y-12 pb-24 lg:pb-10 px-2 md:px-0">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 px-2 md:px-0">
        <div className="space-y-2">
          <h2 className="text-4xl md:text-6xl font-black tracking-tighter leading-none">Calendario</h2>
          <p className="text-[10px] text-primary font-black uppercase tracking-[0.4em] flex items-center gap-2">
            <span className="w-8 h-px bg-primary/40" /> Control {context}
          </p>
        </div>
        
        <Dialog open={isDialogOpen} onOpenChange={(open) => { if(!open) resetForm(); setIsDialogOpen(open); }}>
          <DialogTrigger asChild>
            <Button className="rounded-2xl h-14 md:h-16 px-8 font-black uppercase tracking-widest text-xs neon-glow w-full md:w-auto">
              <Plus className="w-5 h-5 mr-2" /> Agendar Evento
            </Button>
          </DialogTrigger>
          <DialogContent className="glass-card border-white/10 bg-black/95 w-[95vw] sm:max-w-[500px] p-6 md:p-8 mx-auto">
            <DialogHeader>
              <DialogTitle className="text-2xl md:text-3xl font-black tracking-tighter uppercase">
                {editingTask ? 'Modificar' : 'Agendar'}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label className="text-[10px] uppercase font-black text-primary">Nombre</Label>
                <Input value={formData.title} onChange={(e) => setFormData({...formData, title: e.target.value})} className="bg-white/5 border-white/10 h-11 rounded-xl" />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-[10px] uppercase font-black">Categoría</Label>
                  <Select value={formData.category} onValueChange={(v) => setFormData({...formData, category: v})}>
                    <SelectTrigger className="bg-white/5 border-white/10 h-11 rounded-xl"><SelectValue /></SelectTrigger>
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
                    <SelectTrigger className="bg-white/5 border-white/10 h-11 rounded-xl"><SelectValue /></SelectTrigger>
                    <SelectContent className="bg-zinc-900 border-white/10">
                      <SelectItem value="none">Ninguna</SelectItem>
                      <SelectItem value="weekly">Semanal</SelectItem>
                      <SelectItem value="monthly">Mensual</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-[10px] uppercase font-black">Hora</Label>
                  <Input type="time" value={formData.time} onChange={(e) => setFormData({...formData, time: e.target.value})} className="bg-white/5 border-white/10 h-11 rounded-xl" />
                </div>
                <div className="space-y-2">
                  <Label className="text-[10px] uppercase font-black">Prioridad</Label>
                  <Select value={formData.priority} onValueChange={(v: any) => setFormData({...formData, priority: v})}>
                    <SelectTrigger className="bg-white/5 border-white/10 h-11 rounded-xl"><SelectValue /></SelectTrigger>
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
              <Button onClick={handleSaveEvent} className="w-full neon-glow font-black uppercase text-xs h-14 md:h-16 rounded-2xl">
                {editingTask ? 'Actualizar' : 'Agendar'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        <div className="lg:col-span-5 space-y-6">
          <Card className="glass-card border-white/5 bg-black/40 p-4 md:p-8 relative overflow-hidden group shadow-2xl flex justify-center">
            <div className="scale-95 sm:scale-105 lg:scale-110 w-full overflow-hidden flex justify-center">
              <Calendar
                mode="single"
                selected={date}
                onSelect={setDate}
                locale={es}
                className="rounded-3xl border-none p-0"
                classNames={{
                  day_today: "bg-primary/10 text-primary border border-primary/20 font-black",
                  day_selected: "bg-primary text-primary-foreground neon-glow hover:bg-primary hover:text-primary-foreground font-black scale-105",
                  day: "h-9 w-9 sm:h-11 sm:w-11 p-0 font-bold transition-all hover:bg-white/10 rounded-xl relative",
                }}
                modifiers={{ hasTask: daysWithTasks }}
                modifiersClassNames={{ hasTask: "after:content-[''] after:absolute after:bottom-1 after:left-1/2 after:-translate-x-1/2 after:w-1.5 after:h-1.5 after:bg-primary after:rounded-full" }}
              />
            </div>
          </Card>

          <div className="glass p-6 md:p-8 rounded-[2rem] border-white/5 flex items-center justify-between group">
            <div className="space-y-1">
              <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Nodos Totales</p>
              <p className="text-2xl md:text-3xl font-black">{tasks?.filter(t => t.context === context).length || 0}</p>
            </div>
            <LayoutGrid className="w-8 h-8 text-primary/40 group-hover:text-primary transition-colors" />
          </div>
        </div>

        <div className="lg:col-span-7 space-y-6">
          <div className="flex items-center justify-between px-4">
            <h3 className="text-[10px] font-black uppercase tracking-[0.3em] flex items-center gap-3">
              <CalendarIcon className="w-4 h-4 text-primary" />
              {date ? format(date, "EEEE, d 'de' MMMM", { locale: es }) : "Fecha"}
            </h3>
            <Badge variant="outline" className="rounded-full border-primary/20 text-primary bg-primary/5 px-4 h-8 font-black text-[9px]">
              {selectedDayTasks.length} EVENTOS
            </Badge>
          </div>

          <div className="space-y-4 max-h-[600px] overflow-y-auto pr-1 scrollbar-hide px-2">
            <AnimatePresence mode="popLayout">
              {selectedDayTasks.length > 0 ? (
                selectedDayTasks.map((task, idx) => (
                  <motion.div
                    key={task.id}
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    transition={{ delay: idx * 0.05 }}
                    className="glass p-5 md:p-6 rounded-[2rem] border border-white/5 hover:border-primary/40 transition-all group relative overflow-hidden"
                  >
                    <div className={cn(
                      "absolute top-0 left-0 w-1.5 h-full transition-all duration-500",
                      task.priority === 'alta' ? 'bg-red-500' : task.priority === 'media' ? 'bg-primary' : 'bg-white/10'
                    )} />
                    
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6">
                      <div className="space-y-4">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className={cn(
                            "text-[8px] font-black px-2 py-0.5 rounded-full uppercase border",
                            task.priority === 'alta' ? 'bg-red-500/10 text-red-500 border-red-500/20' :
                            task.priority === 'media' ? 'bg-primary/10 text-primary border-primary/20' : 
                            'bg-white/5 text-muted-foreground'
                          )}>
                            {task.priority}
                          </span>
                          {task.category && (
                            <Badge className="bg-white/5 text-white/50 border-white/10 text-[8px] font-black px-2">
                              {task.category}
                            </Badge>
                          )}
                        </div>

                        <div className="space-y-1">
                          <h4 className="font-black text-xl md:text-2xl leading-none pr-10">{task.title}</h4>
                          {task.location && (
                            <p className="text-[9px] font-black text-muted-foreground uppercase flex items-center gap-2 mt-2">
                              <MapPin className="w-3.5 h-3.5" /> {task.location}
                            </p>
                          )}
                        </div>

                        <div className="flex items-center gap-6 text-[10px] text-muted-foreground font-black uppercase tracking-widest">
                          <span className="flex items-center gap-2"><Clock className="w-3.5 h-3.5 text-primary" /> {format(parseISO(task.dueDate), "HH:mm")}</span>
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-2 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-all">
                        <Button variant="ghost" size="icon" onClick={() => openEditDialog(task)} className="h-10 w-10 rounded-xl hover:bg-primary/10">
                          <Edit3 className="w-5 h-5" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => deleteDocumentNonBlocking(doc(firestore, "users", user.uid, "tasks", task.id))} className="h-10 w-10 rounded-xl hover:bg-red-500/10 hover:text-red-500">
                          <Trash2 className="w-5 h-5" />
                        </Button>
                      </div>
                    </div>
                  </motion.div>
                ))
              ) : (
                <div className="flex flex-col items-center justify-center py-24 glass rounded-[3rem] border-dashed border-white/5 opacity-5">
                  <Inbox className="w-16 h-16 mb-4" />
                  <p className="text-[10px] font-black uppercase tracking-[0.5em]">Vacío</p>
                </div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>
    </div>
  );
}
