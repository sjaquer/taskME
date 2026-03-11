
"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { useFirestore, useUser, useCollection, useMemoFirebase } from "@/firebase";
import { collection, query, where } from "firebase/firestore";
import { Calendar } from "@/components/ui/calendar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { format, isSameDay } from "date-fns";
import { es } from "date-fns/locale";
import { Calendar as CalendarIcon, Clock, MapPin, Tag } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useRouter } from "next/navigation";

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

  return (
    <div className="space-y-8 max-w-6xl mx-auto">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-black tracking-tighter">Calendario</h2>
          <p className="text-xs text-muted-foreground font-bold uppercase tracking-widest">Visualiza tu carga de trabajo temporal</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        <Card className="lg:col-span-5 glass-card border-white/5 bg-black/20 p-4">
          <Calendar
            mode="single"
            selected={date}
            onSelect={setDate}
            locale={es}
            className="rounded-3xl border-none mx-auto scale-110 md:scale-125 my-8"
            classNames={{
              day_today: "bg-primary/20 text-primary border border-primary/30",
              day_selected: "bg-primary text-primary-foreground neon-glow hover:bg-primary hover:text-primary-foreground",
            }}
          />
        </Card>

        <div className="lg:col-span-7 space-y-6">
          <div className="flex items-center justify-between px-2">
            <h3 className="font-black uppercase tracking-widest text-xs flex items-center gap-2">
              <CalendarIcon className="w-4 h-4 text-primary" />
              Tareas para el {date ? format(date, "d 'de' MMMM", { locale: es }) : "..."}
            </h3>
            <Badge variant="outline" className="rounded-full border-primary/20 text-primary bg-primary/5 px-4">
              {selectedDayTasks.length} Tareas
            </Badge>
          </div>

          <div className="space-y-4">
            {selectedDayTasks.length > 0 ? (
              selectedDayTasks.map((task, idx) => (
                <motion.div
                  key={task.id}
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: idx * 0.05 }}
                  className="glass p-6 rounded-[2rem] border border-white/5 hover:border-primary/30 transition-all group relative overflow-hidden"
                >
                  <div className="absolute top-0 left-0 w-1 h-full bg-primary/20 group-hover:bg-primary transition-colors" />
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="space-y-2">
                      <h4 className="font-bold text-lg leading-tight">{task.title}</h4>
                      <div className="flex flex-wrap items-center gap-4 text-[10px] text-muted-foreground font-black uppercase tracking-widest">
                        <span className="flex items-center gap-1.5"><Clock className="w-3.5 h-3.5 text-primary" /> {format(new Date(task.dueDate), "HH:mm")}</span>
                        <span className="flex items-center gap-1.5"><Tag className="w-3.5 h-3.5" /> {task.context}</span>
                      </div>
                    </div>
                    <Badge className={cn(
                      "w-fit uppercase text-[10px] px-3 py-1 rounded-full border",
                      task.status === 'Hecho' ? "bg-blue-500/10 text-blue-500 border-blue-500/20" :
                      task.status === 'Haciendo' ? "bg-primary/10 text-primary border-primary/20" :
                      "bg-orange-500/10 text-orange-500 border-orange-500/20"
                    )}>
                      {task.status}
                    </Badge>
                  </div>
                </motion.div>
              ))
            ) : (
              <div className="flex flex-col items-center justify-center py-20 glass rounded-[3rem] border-dashed border-white/5 text-muted-foreground">
                <CalendarIcon className="w-12 h-12 mb-4 opacity-10" />
                <p className="text-sm font-bold uppercase tracking-[0.2em]">Sin tareas programadas</p>
                <p className="text-[10px] mt-2 opacity-50">Tómate un descanso o agrega nuevas metas</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

import { cn } from "@/lib/utils";
