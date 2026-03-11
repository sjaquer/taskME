
"use client";

import { motion } from "framer-motion";
import { format, addDays, startOfWeek } from "date-fns";
import { es } from "date-fns/locale";
import { Calendar as CalendarIcon, Clock, MoreVertical, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAppContextStore } from "@/lib/store";
import { cn } from "@/lib/utils";

export default function SchedulePage() {
  const { context } = useAppContextStore();
  const startDate = startOfWeek(new Date());
  const days = [...Array(7)].map((_, i) => addDays(startDate, i));

  const timeBlocks = [
    { time: "09:00", duration: "1h", title: "Trabajo Profundo de Enfoque", type: "Trabajo" },
    { time: "11:00", duration: "45m", title: "Reunión de Sincronización", type: "Trabajo" },
    { time: "14:00", duration: "2h", title: "Arquitectura de Sistemas", type: "Trabajo" },
    { time: "16:30", duration: "1.5h", title: "Investigación y Desarrollo", type: "Estudio" },
  ];

  return (
    <div className="space-y-8 max-w-4xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-black tracking-tighter">Cronograma</h2>
          <p className="text-xs text-muted-foreground font-bold uppercase tracking-widest">Tus bloques de tiempo semanal</p>
        </div>
        <Button size="icon" className="rounded-2xl h-12 w-12 neon-glow">
          <CalendarIcon className="w-6 h-6" />
        </Button>
      </div>

      <div className="flex gap-3 overflow-x-auto pb-4 scrollbar-hide md:justify-between">
        {days.map((day) => {
          const isToday = format(day, 'yyyy-MM-dd') === format(new Date(), 'yyyy-MM-dd');
          return (
            <div
              key={day.toString()}
              className={cn(
                "flex-shrink-0 w-16 md:w-20 py-4 rounded-3xl flex flex-col items-center gap-1 transition-all border",
                isToday 
                  ? "bg-primary text-primary-foreground neon-glow border-primary" 
                  : "glass hover:border-white/20 border-white/5"
              )}
            >
              <span className="text-[10px] uppercase font-black opacity-70">
                {format(day, 'EEE', { locale: es })}
              </span>
              <span className="text-xl font-black">{format(day, 'd')}</span>
            </div>
          );
        })}
      </div>

      <div className="relative mt-10 ml-8 md:ml-20">
        <div className="absolute left-[-24px] md:left-[-40px] top-0 bottom-0 w-px bg-white/5" />
        
        <div className="space-y-10">
          {timeBlocks.map((block, idx) => (
            <motion.div
              key={idx}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: idx * 0.1 }}
              className="relative"
            >
              <div className="absolute left-[-28px] md:left-[-44px] top-2 w-2 h-2 rounded-full bg-primary neon-glow" />
              <div className="flex items-start gap-4 md:gap-8">
                <div className="w-12 pt-1.5">
                  <span className="text-xs font-black text-muted-foreground">{block.time}</span>
                </div>
                <div className={cn(
                  "flex-1 glass p-5 rounded-3xl flex items-center justify-between border-l-4 transition-all hover:translate-x-1",
                  block.type === context ? "border-l-primary" : "border-l-white/10 opacity-60"
                )}>
                  <div className="space-y-2">
                    <h4 className="text-sm md:text-base font-black tracking-tight">{block.title}</h4>
                    <div className="flex items-center gap-4 text-[10px] text-muted-foreground uppercase font-black tracking-widest">
                      <span className="flex items-center gap-1.5"><Clock className="w-3.5 h-3.5 text-primary" /> {block.duration}</span>
                      <span className="bg-white/5 px-2 py-0.5 rounded-lg border border-white/10">{block.type}</span>
                    </div>
                  </div>
                  <MoreVertical className="w-5 h-5 text-muted-foreground opacity-30" />
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>

      <Button className="w-full h-14 rounded-3xl bg-white/5 border border-white/10 hover:bg-white/10 transition-all font-black text-xs uppercase tracking-widest gap-3">
        <Plus className="w-5 h-5" />
        Agregar Bloque de Horario
      </Button>
    </div>
  );
}
