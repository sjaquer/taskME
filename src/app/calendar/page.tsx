
"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useFirestore, useUser, useCollection, useMemoFirebase } from "@/firebase";
import { collection, doc, serverTimestamp, query, where } from "firebase/firestore";
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
  MapPin,
  Inbox,
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
import { toast } from "@/hooks/use-toast";
import { Skeleton } from "@/components/ui/skeleton";
import { Task } from "@/types/task";

const CATEGORIES = [
  { label: "Personal", color: "bg-blue-500" }, { label: "AcadÃ©mico", color: "bg-purple-500" },
  { label: "Laboral", color: "bg-orange-500" }, { label: "Especial", color: "bg-pink-500" },
];

export default function CalendarPage() {
  const { context } = useAppContextStore();
  const { user, isUserLoading } = useUser();
  const firestore = useFirestore();
  const router = useRouter();
  
  const [mounted, setMounted] = useState(false);
  const [date, setDate] = useState<Date | undefined>(undefined);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);

  useEffect(() => {
    setMounted(true);
    setDate(new Date());
  }, []);

  const [formData, setFormData] = useState({
    title: "", time: "09:00", priority: "media" as 'baja' | 'media' | 'alta',
    status: "Pendiente", location: "", category: "Personal", recurrenceType: "none" as 'none' | 'weekly' | 'monthly'
  });

  useEffect(() => {
    setFormData({ title: "", time: "09:00", priority: "media", status: "Pendiente", location: "", category: "Personal", recurrenceType: "none" });
    setEditingTask(null);
    setIsDialogOpen(false);
  }, [context]);

  const tasksQuery = useMemoFirebase(() => {
    if (!firestore || !user) return null;
    return query(
      collection(firestore, "users", user.uid, "tasks"),
      where("context", "==", context)
    );
  }, [firestore, user, context]);

  const { data: tasks, isLoading: isTasksLoading } = useCollection<Task>(tasksQuery);

  useEffect(() => {
    if (!isUserLoading && !user) router.push("/login");
  }, [user, isUserLoading, router]);

  if (!mounted || isUserLoading || !user) return (
    <div className="max-w-7xl mx-auto space-y-8 p-4">
      <Skeleton className="h-16 w-1/2 bg-white/5 rounded-2xl" />
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        <Skeleton className="lg:col-span-5 h-[400px] bg-white/5 rounded-[2rem]" />
        <Skeleton className="lg:col-span-7 h-[400px] bg-white/5 rounded-[2rem]" />
      </div>
    </div>
  );

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
      title: formData.title, dueDate: finalDate, scheduledStartTime: finalDate,
      priority: formData.priority, status: formData.status, location: formData.location,
      category: formData.category, recurrenceType: formData.recurrenceType,
      isRecurring: formData.recurrenceType !== 'none',
      recurringDays: formData.recurrenceType === 'weekly' ? [getDay(date)] : [],
      context, userId: user.uid, updatedAt: serverTimestamp(),
    };

    if (editingTask) {
      updateDocumentNonBlocking(doc(firestore, "users", user.uid, "tasks", editingTask.id), taskData);
    } else {
      addDocumentNonBlocking(collection(firestore, "users", user.uid, "tasks"), { ...taskData, createdAt: serverTimestamp() });
    }

    resetForm(); setIsDialogOpen(false);
    toast({ title: editingTask ? "Actualizado" : "Agendado" });
  };

  const resetForm = () => {
    setFormData({ title: "", time: "09:00", priority: "media", status: "Pendiente", location: "", category: "Personal", recurrenceType: "none" });
    setEditingTask(null);
  };

  const openEditDialog = (task: Task) => {
    setEditingTask(task);
    setFormData({
      title: task.title, time: format(parseISO(task.dueDate), "HH:mm"),
      priority: task.priority || "media", status: task.status, location: task.location || "",
      category: task.category || "Personal", recurrenceType: task.recurrenceType || "none"
    });
    setIsDialogOpen(true);
  };

  return (
    <div className="max-w-7xl mx-auto space-y-8 pb-24 px-2 md:px-0">
      {/* Optimized Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 px-2 md:px-0">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <h2 className="text-2xl md:text-4xl font-black tracking-tighter uppercase">Calendario <span className="text-primary italic glow-text">{context}</span></h2>
            <Badge variant="outline" className="h-5 rounded-full border-primary/20 text-primary bg-primary/5 px-2 font-black text-[11px]">
              {tasks?.length || 0} TOTAL
            </Badge>
          </div>
          <p className="text-[9px] text-muted-foreground font-black uppercase tracking-[0.4em] flex items-center gap-2">
            <CalendarIcon className="w-3 h-3 text-primary/40" /> Control Temporal
          </p>
        </div>
        
        <Dialog open={isDialogOpen} onOpenChange={(open) => { if(!open) resetForm(); setIsDialogOpen(open); }}>
          <DialogTrigger asChild>
            <Button className="rounded-xl h-12 px-6 font-black uppercase tracking-widest text-[10px] neon-glow w-full md:w-auto">
              <Plus className="w-4 h-4 mr-2" /> Agendar
            </Button>
          </DialogTrigger>
          <DialogContent className="glass-card border-white/10 bg-black/95 w-[95vw] sm:max-w-[450px] p-6 md:p-8 mx-auto">
            <DialogHeader><DialogTitle className="text-xl font-black uppercase">Evento</DialogTitle></DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-1.5">
                <Label className="text-[9px] uppercase font-black text-primary">Nombre</Label>
                <Input value={formData.title} onChange={(e) => setFormData({...formData, title: e.target.value})} className="bg-white/5 border-white/10 h-11 rounded-lg" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-[9px] uppercase font-black">CategorÃ­a</Label>
                  <Select value={formData.category} onValueChange={(v) => setFormData({...formData, category: v})}>
                    <SelectTrigger className="bg-white/5 border-white/10 h-11 rounded-lg"><SelectValue /></SelectTrigger>
                    <SelectContent className="bg-zinc-900 border-white/10">
                      {CATEGORIES.map(cat => <SelectItem key={cat.label} value={cat.label}>{cat.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-[9px] uppercase font-black">RepeticiÃ³n</Label>
                  <Select value={formData.recurrenceType} onValueChange={(v: string) => setFormData({...formData, recurrenceType: v as 'none' | 'weekly' | 'monthly'})}>
                    <SelectTrigger className="bg-white/5 border-white/10 h-11 rounded-lg"><SelectValue /></SelectTrigger>
                    <SelectContent className="bg-zinc-900 border-white/10">
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
                  <Input type="time" value={formData.time} onChange={(e) => setFormData({...formData, time: e.target.value})} className="bg-white/5 border-white/10 h-11 rounded-lg" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-[9px] uppercase font-black">Prioridad</Label>
                  <Select value={formData.priority} onValueChange={(v: string) => setFormData({...formData, priority: v as 'baja' | 'media' | 'alta'})}>
                    <SelectTrigger className="bg-white/5 border-white/10 h-11 rounded-lg"><SelectValue /></SelectTrigger>
                    <SelectContent className="bg-zinc-900 border-white/10">
                      <SelectItem value="baja">Baja</SelectItem>
                      <SelectItem value="media">Media</SelectItem>
                      <SelectItem value="alta">Alta</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
            <DialogFooter><Button onClick={handleSaveEvent} className="w-full neon-glow font-black uppercase text-[10px] h-12 rounded-xl">Confirmar</Button></DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        <div className="lg:col-span-5 space-y-4">
          <Card className="glass-card border-white/5 bg-black/40 p-4 md:p-6 flex justify-center">
            <div className="scale-95 sm:scale-100 w-full overflow-hidden flex justify-center">
              <Calendar
                mode="single" selected={date} onSelect={setDate} locale={es} className="rounded-2xl border-none p-0"
                classNames={{
                  day_today: "bg-primary/10 text-primary border border-primary/20 font-black",
                  day_selected: "bg-primary text-primary-foreground neon-glow hover:bg-primary font-black scale-105",
                  day: "h-9 w-9 sm:h-10 sm:w-10 p-0 font-bold transition-all hover:bg-white/5 rounded-lg relative",
                }}
                modifiers={{ hasTask: daysWithTasks }}
                modifiersClassNames={{ hasTask: "after:content-[''] after:absolute after:bottom-1 after:left-1/2 after:-translate-x-1/2 after:w-1.5 after:h-1.5 after:bg-primary after:rounded-full" }}
              />
            </div>
          </Card>
          <div className="glass p-4 rounded-2xl border-white/5 flex items-center justify-between">
            <span className="text-[11px] font-black text-white/30 uppercase tracking-widest">Integridad</span>
            <LayoutGrid className="w-4 h-4 text-primary/40" />
          </div>
        </div>

        <div className="lg:col-span-7 space-y-6">
          <div className="flex items-center justify-between px-2">
            <h3 className="text-[9px] font-black uppercase tracking-[0.3em] flex items-center gap-3">
              <Clock className="w-3.5 h-3.5 text-primary" />
              {date ? format(date, "EEEE, d 'de' MMMM", { locale: es }) : "Fecha"}
            </h3>
            <Badge variant="outline" className="rounded-full border-primary/20 text-primary bg-primary/5 h-6 font-black text-[11px]">
              {selectedDayTasks.length} EVENTOS
            </Badge>
          </div>

          <div className="space-y-4 max-h-[600px] overflow-y-auto pr-1 scrollbar-hide px-2">
            <AnimatePresence mode="popLayout">
              {selectedDayTasks.length > 0 ? (
                selectedDayTasks.map((task, idx) => (
                  <motion.div key={task.id} initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: idx * 0.05 }} className="glass p-4 md:p-6 rounded-[1.8rem] border border-white/5 hover:border-primary/40 transition-all group relative overflow-hidden">
                    <div className={cn("absolute top-0 left-0 w-1 h-full", task.priority === 'alta' ? 'bg-red-500' : task.priority === 'media' ? 'bg-primary' : 'bg-white/10')} />
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                      <div className="space-y-3">
                        <div className="flex items-center gap-2">
                          <span className={cn("text-[10px] font-black px-2 py-0.5 rounded-full uppercase border", task.priority === 'alta' ? 'bg-red-500/10 text-red-500 border-red-500/20' : 'bg-white/5 text-muted-foreground')}>
                            {task.priority}
                          </span>
                          {task.category && <Badge className="bg-white/5 text-white/40 border-white/10 text-[10px] px-1.5">{task.category}</Badge>}
                        </div>
                        <h4 className="font-black text-lg md:text-xl leading-tight pr-10">{task.title}</h4>
                        {task.location && <p className="text-[11px] font-black text-muted-foreground uppercase flex items-center gap-2"><MapPin className="w-3 h-3" /> {task.location}</p>}
                      </div>
                      <div className="flex items-center gap-2 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-all">
                        <Button variant="ghost" size="icon" onClick={() => openEditDialog(task)} className="h-9 w-9 rounded-lg bg-black/40"><Edit3 className="w-4 h-4" /></Button>
                        <Button variant="ghost" size="icon" onClick={() => { if(confirm("Â¿Eliminar este evento?")) deleteDocumentNonBlocking(doc(firestore, "users", user.uid, "tasks", task.id)); }} className="h-9 w-9 rounded-lg hover:text-red-500 bg-black/40"><Trash2 className="w-4 h-4" /></Button>
                      </div>
                    </div>
                  </motion.div>
                ))
              ) : (
                <div className="flex flex-col items-center justify-center py-24 opacity-5"><Inbox className="w-12 h-12 mb-2" /><p className="text-[11px] font-black uppercase tracking-[0.4em]">Sin Eventos</p></div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>
    </div>
  );
}
