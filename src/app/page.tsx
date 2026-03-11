
"use client";

import { motion } from "framer-motion";
import { useAppContextStore } from "@/lib/store";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CheckCircle2, Circle, Clock, TrendingUp, Zap } from "lucide-react";
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
      className="space-y-8"
    >
      <div className="space-y-2">
        <h2 className="text-3xl md:text-5xl font-headline font-black text-white">
          Enfoque: <span className="text-primary">{context}</span>
        </h2>
        <p className="text-muted-foreground text-sm md:text-base flex items-center gap-2">
          <Zap className="w-4 h-4 text-primary animate-pulse" />
          Tienes 4 tareas críticas para completar hoy.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
        <Card className="glass-card border-white/5 hover:border-primary/20 transition-all">
          <CardHeader className="pb-2">
            <CardTitle className="text-[10px] md:text-xs text-muted-foreground flex items-center gap-2 uppercase tracking-[0.2em] font-black">
              <Clock className="w-3 h-3" /> Tiempo Restante
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl md:text-4xl font-black">12h</div>
          </CardContent>
        </Card>
        <Card className="glass-card border-white/5 hover:border-primary/20 transition-all">
          <CardHeader className="pb-2">
            <CardTitle className="text-[10px] md:text-xs text-muted-foreground flex items-center gap-2 uppercase tracking-[0.2em] font-black">
              <CheckCircle2 className="w-3 h-3 text-primary" /> Progreso Diario
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl md:text-4xl font-black text-primary">85%</div>
          </CardContent>
        </Card>
        {/* Desktop extra metrics */}
        <Card className="glass-card border-white/5 hidden lg:block">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs text-muted-foreground flex items-center gap-2 uppercase tracking-[0.2em] font-black">
              Enfoque Activo
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-4xl font-black">2.4h</div>
          </CardContent>
        </Card>
        <Card className="glass-card border-white/5 hidden lg:block">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs text-muted-foreground flex items-center gap-2 uppercase tracking-[0.2em] font-black">
              Meta Semanal
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-4xl font-black text-blue-400">92%</div>
          </CardContent>
        </Card>
      </div>

      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h3 className="text-xl font-black tracking-tight">Pipeline de Prioridades</h3>
          <TrendingUp className="w-5 h-5 text-primary" />
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.1 }}
              className="glass p-5 rounded-3xl flex items-center gap-4 hover:border-primary/50 transition-all cursor-pointer group"
            >
              <div className="w-12 h-12 rounded-2xl bg-white/5 flex items-center justify-center border border-white/10 group-hover:bg-primary/10 transition-colors">
                <Circle className="w-6 h-6 text-primary" />
              </div>
              <div className="flex-1">
                <h4 className="font-bold text-sm md:text-base leading-tight">Arquitectura de Sistema v2</h4>
                <p className="text-[10px] text-muted-foreground uppercase tracking-widest mt-1">Hoy • 14:00</p>
              </div>
              <div className="text-[10px] font-black text-primary px-3 py-1 rounded-full bg-primary/10 border border-primary/20">
                ALTA
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </motion.div>
  );
}
