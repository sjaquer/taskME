
"use client";

import { motion } from "framer-motion";
import { useAppContextStore } from "@/lib/store";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CheckCircle2, Circle, Clock, TrendingUp } from "lucide-react";
import { useEffect, useState } from "react";

export default function Home() {
  const { context } = useAppContextStore();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-6"
    >
      <div className="space-y-1">
        <h2 className="text-3xl font-headline font-black text-white">
          Focus: <span className="text-primary">{context}</span>
        </h2>
        <p className="text-muted-foreground">You have 4 tasks to complete today.</p>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <Card className="glass-card">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs text-muted-foreground flex items-center gap-2 uppercase tracking-widest">
              <Clock className="w-3 h-3" /> Remaining
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">12h</div>
          </CardContent>
        </Card>
        <Card className="glass-card">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs text-muted-foreground flex items-center gap-2 uppercase tracking-widest">
              <CheckCircle2 className="w-3 h-3 text-primary" /> Done
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-primary">85%</div>
          </CardContent>
        </Card>
      </div>

      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-bold">Priority Pipeline</h3>
          <TrendingUp className="w-5 h-5 text-primary" />
        </div>
        
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.1 }}
              className="glass p-4 rounded-2xl flex items-center gap-4 hover:border-primary/50 transition-colors"
            >
              <div className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center border border-white/10">
                <Circle className="w-5 h-5 text-primary" />
              </div>
              <div className="flex-1">
                <h4 className="font-semibold text-sm">System Update Architecture</h4>
                <p className="text-[10px] text-muted-foreground uppercase tracking-widest mt-0.5">Today • 14:00</p>
              </div>
              <div className="text-xs font-bold text-primary px-2 py-1 rounded bg-primary/10">
                High
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </motion.div>
  );
}
