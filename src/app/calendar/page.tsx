
"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useFirestore, useUser, useCollection, useMemoFirebase } from "@/firebase";
import { collection } from "firebase/firestore";
import { Calendar } from "@/components/ui/calendar";
import { Card, CardContent } from "@/components/ui/card";
import { format, isSameDay, startOfMonth, endOfMonth, eachDayOfInterval } from "date-fns";
import { es } from "date-fns/locale";
import { Calendar as CalendarIcon, Clock, Tag, LayoutGrid, ChevronRight, Inbox } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

export default function CalendarPage() {
  const { user, isUserLoading } = useUser();
  const firestore = useFirestore();
  const router = useRouter();
  const [date, setDate] = useState<Date | undefined>(new Date());

  const tasksQuery = useMemoFirebase(() => {
    if (!firestore || !user) return null;
    return collection(firestore, "users", user.uid, "tasks");
  }, [firestore, user]);

  const { data: tasks, isLoading: isTasksLoading } = useCollection(tasksQuery);

  if (isUserLoading) return null;
  if (!user) {
    router.push("/login");
    return null;
  }

  const selectedDayTasks = tasks?.filter(task => {
    if (!task.dueDate || !date) return false;
    return isSameDay(new Date(task.dueDate), date);
  }) || [];

  // Mark days with tasks
  const daysWithTasks = tasks?.map(t => new Date(t.dueDate)) || [];

  return (
    <div className="max-w-7xl mx-auto space-y-8 md:space-y-12">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div>
          <h2 className="text-4xl md:text-5xl font-black tracking-tighter leading-none">Mi Horario</h2>
          <p className="text-[10px] text-muted-foreground font-black uppercase tracking-[0.4em] mt-3 flex items-center gap-2">
            <span className="w-8 h-px bg-primary/40" /> Sincronización Temporal
          </p>
        </div>
        <div className="flex items-center gap-3 glass p-2 rounded-2xl border-white/5 self-start md:self-auto">
          <div className="flex flex-col items-end px-3 md:px-4">
            <span className="text-[10px] font-black text-muted-foreground uppercase">{format(new Date(), 'EEEE', { locale: es })}</span>
            <span className="text-lg md:text-xl font-black">{format(new Date(), 'd MMMM')}</span>
          </div>
          <div className="w-10 h-10 md:w-12 md:h-12 bg-primary rounded-xl flex items-center justify-center neon-glow">
            <CalendarIcon className="w-5 h-5 md:w-6 md:h-6 text-black" />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Calendar View */}
        <div className="lg:col-span-5 space-y-6">
          <Card className="glass-card border-white/5 bg-black/40 p-2 md:p-4 relative overflow-hidden group">
            <div className="absolute -top-24 -right-24 w-48 h-48 bg-primary/10 rounded-full blur-3xl group-hover:bg-primary/20 transition-all" />
            <Calendar
              mode="single"
              selected={date}
              onSelect={setDate}
              locale={es}
              className="rounded-2xl md:rounded-3xl border-none mx-auto scale-95 sm:scale-100 lg:scale-110 xl:scale-125 my-4 md:my-8"
              classNames={{
                day_today: "bg-primary/10 text-primary border border-primary/20 font-black",
                day_selected: "bg-primary text-primary-foreground neon-glow hover:bg-primary hover:text-primary-foreground font-black scale-110",
                day: "h-9 w-9 sm:h-11 sm:w-11 p-0 font-bold transition-all hover:bg-white/5 rounded-xl",
              }}
              modifiers={{ hasTask: daysWithTasks }}
              modifiersClassNames={{ hasTask: "after:content-[''] after:absolute after:bottom-1 after:left-1/2 after:-translate-x-1/2 after:w-1 after:h-1 after:bg-primary after:rounded-full" }}
            />
          </Card>

          <div className="glass p-4 md:p-6 rounded-[2rem] md:rounded-[2.5rem] border-white/5 flex items-center justify-between">
            <div className="space-y-1">
              <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Resumen Mensual</p>
              <p className="text-xl md:text-2xl font-black">{tasks?.length || 0} Tareas Activas</p>
            </div>
            <div className="flex -space-x-3">
              {[1, 2, 3].map(i => (
                <div key={i} className="w-8 h-8 md:w-10 md:h-10 rounded-full border-2 border-black bg-zinc-800 flex items-center justify-center shadow-lg">
                  <span className="text-[8px] md:text-[10px] font-black">+{i}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Task List for Selected Day */}
        <div className="lg:col-span-7 space-y-6">
          <div className="flex items-center justify-between px-2 md:px-4">
            <h3 className="text-[11px] md:text-sm font-black uppercase tracking-[0.2em] flex items-center gap-3">
              <LayoutGrid className="w-4 h-4 text-primary" />
              Eventos: {date ? format(date, "d 'de' MMMM", { locale: es }) : "..."}
            </h3>
            <Badge variant="outline" className="rounded-full border-primary/20 text-primary bg-primary/5 px-3 md:px-4 h-7 md:h-8 font-black text-[10px] md:text-xs">
              {selectedDayTasks.length} NODOS
            </Badge>
          </div>

          <div className="space-y-4 max-h-[600px] md:max-h-[700px] overflow-y-auto pr-2 scrollbar-hide pb-20 lg:pb-0">
            <AnimatePresence mode="popLayout">
              {selectedDayTasks.length > 0 ? (
                selectedDayTasks.map((task, idx) => (
                  <motion.div
                    key={task.id}
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    transition={{ delay: idx * 0.05 }}
                    className="glass p-4 md:p-6 rounded-[2rem] md:rounded-[2.5rem] border border-white/5 hover:border-primary/40 transition-all group relative overflow-hidden"
                  >
                    <div className="absolute top-0 left-0 w-1 md:w-1.5 h-full bg-primary/10 group-hover:bg-primary transition-all duration-500" />
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 md:gap-6">
                      <div className="space-y-2 md:space-y-3">
                        <div className="flex items-center gap-2">
                          <span className={cn(
                            "text-[7px] md:text-[8px] font-black px-2 py-0.5 rounded-full uppercase border",
                            task.priority === 'alta' ? 'bg-red-500/10 text-red-500 border-red-500/20' :
                            task.priority === 'media' ? 'bg-primary/10 text-primary border-primary/20' : 
                            'bg-white/5 text-muted-foreground border-white/10'
                          )}>
                            {task.priority || 'media'}
                          </span>
                          <span className="text-[7px] md:text-[8px] font-black text-muted-foreground/50 uppercase tracking-widest">{task.context}</span>
                        </div>
                        <h4 className="font-black text-lg md:text-xl leading-none group-hover:translate-x-1 transition-transform">{task.title}</h4>
                        <div className="flex flex-wrap items-center gap-4 md:gap-6 text-[9px] md:text-[10px] text-muted-foreground font-black uppercase tracking-widest">
                          <span className="flex items-center gap-2"><Clock className="w-3.5 h-3.5 text-primary" /> {format(new Date(task.dueDate), "HH:mm")}</span>
                          <span className="flex items-center gap-2"><Inbox className="w-3.5 h-3.5" /> {task.status}</span>
                        </div>
                      </div>
                      <Button variant="ghost" size="icon" className="rounded-full hover:bg-primary hover:text-black transition-all self-end sm:self-auto h-10 w-10 md:h-12 md:w-12">
                        <ChevronRight className="w-5 h-5 md:w-6 md:h-6" />
                      </Button>
                    </div>
                  </motion.div>
                ))
              ) : (
                <motion.div 
                  initial={{ opacity: 0 }} 
                  animate={{ opacity: 1 }}
                  className="flex flex-col items-center justify-center py-20 md:py-32 glass rounded-[2.5rem] md:rounded-[3.5rem] border-dashed border-white/5 text-muted-foreground/30"
                >
                  <Inbox className="w-12 h-12 md:w-16 md:h-16 mb-4 md:mb-6 stroke-[1]" />
                  <p className="text-[9px] md:text-[10px] font-black uppercase tracking-[0.4em] text-center">Sin transmisiones hoy</p>
                  <p className="text-[8px] md:text-[9px] mt-2 font-bold uppercase">Planifica tus próximos movimientos</p>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>
    </div>
  );
}
