
"use client";

import { motion } from "framer-motion";
import { format, addDays, startOfWeek } from "date-fns";
import { Calendar as CalendarIcon, Clock, MoreVertical, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAppContextStore } from "@/lib/store";
import { cn } from "@/lib/utils";

export default function SchedulePage() {
  const { context } = useAppContextStore();
  const startDate = startOfWeek(new Date());
  const days = [...Array(7)].map((_, i) => addDays(startDate, i));

  const timeBlocks = [
    { time: "09:00", duration: "1h", title: "Focus Deep Work", type: "Work" },
    { time: "11:00", duration: "45m", title: "Sync Meeting", type: "Work" },
    { time: "14:00", duration: "2h", title: "System Architecture", type: "Work" },
    { time: "16:30", duration: "1.5h", title: "Research & Development", type: "Study" },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-black">Timeline</h2>
          <p className="text-xs text-muted-foreground">Your weekly time blocks</p>
        </div>
        <Button size="icon" className="rounded-xl neon-glow">
          <CalendarIcon className="w-5 h-5" />
        </Button>
      </div>

      <div className="flex gap-2 overflow-x-auto pb-4 scrollbar-hide">
        {days.map((day) => {
          const isToday = format(day, 'yyyy-MM-dd') === format(new Date(), 'yyyy-MM-dd');
          return (
            <div
              key={day.toString()}
              className={cn(
                "flex-shrink-0 w-14 py-3 rounded-2xl flex flex-col items-center gap-1 transition-all",
                isToday ? "bg-primary text-primary-foreground neon-glow" : "glass hover:border-white/20"
              )}
            >
              <span className="text-[10px] uppercase font-bold opacity-70">{format(day, 'EEE')}</span>
              <span className="text-lg font-black">{format(day, 'd')}</span>
            </div>
          );
        })}
      </div>

      <div className="relative mt-4 ml-12">
        <div className="absolute left-[-32px] top-0 bottom-0 w-px bg-white/5" />
        
        <div className="space-y-8">
          {timeBlocks.map((block, idx) => (
            <motion.div
              key={idx}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: idx * 0.1 }}
              className="relative"
            >
              <div className="absolute left-[-36px] top-1.5 w-2 h-2 rounded-full bg-primary neon-glow" />
              <div className="flex items-start gap-4">
                <div className="w-8 pt-1">
                  <span className="text-[10px] font-bold text-muted-foreground">{block.time}</span>
                </div>
                <div className={cn(
                  "flex-1 glass p-4 rounded-2xl flex items-center justify-between border-l-4",
                  block.type === context ? "border-l-primary" : "border-l-white/10 opacity-50"
                )}>
                  <div className="space-y-1">
                    <h4 className="text-sm font-bold">{block.title}</h4>
                    <div className="flex items-center gap-3 text-[10px] text-muted-foreground uppercase font-medium tracking-widest">
                      <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> {block.duration}</span>
                      <span className="bg-white/5 px-1.5 py-0.5 rounded border border-white/10">{block.type}</span>
                    </div>
                  </div>
                  <MoreVertical className="w-4 h-4 text-muted-foreground" />
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>

      <Button className="w-full h-12 rounded-2xl bg-white/5 border border-white/10 hover:bg-white/10 transition-all font-bold gap-2">
        <Plus className="w-4 h-4" />
        Add Schedule Block
      </Button>
    </div>
  );
}
