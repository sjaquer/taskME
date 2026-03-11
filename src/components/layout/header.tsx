
"use client";

import { useAppContextStore } from "@/lib/store";
import { Briefcase, GraduationCap } from "lucide-react";
import { cn } from "@/lib/utils";

export function Header() {
  const { context, setContext } = useAppContextStore();

  return (
    <header className="fixed top-0 left-0 right-0 z-50 glass-blur h-16 px-4 flex items-center justify-between border-b border-white/5 md:px-8">
      <div className="flex items-center gap-2">
        <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center neon-glow">
          <span className="text-primary-foreground font-black text-xs">TM</span>
        </div>
        <h1 className="text-xl font-headline font-bold tracking-tight bg-gradient-to-r from-white to-white/60 bg-clip-text text-transparent hidden sm:block">
          TaskMe
        </h1>
      </div>

      <div className="flex bg-white/5 rounded-full p-1 border border-white/10">
        <button
          onClick={() => setContext('Trabajo')}
          className={cn(
            "flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-medium transition-all",
            context === 'Trabajo' 
              ? "bg-primary text-primary-foreground neon-glow" 
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          <Briefcase className="w-3.5 h-3.5" />
          Trabajo
        </button>
        <button
          onClick={() => setContext('Estudio')}
          className={cn(
            "flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-medium transition-all",
            context === 'Estudio' 
              ? "bg-primary text-primary-foreground neon-glow" 
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          <GraduationCap className="w-3.5 h-3.5" />
          Estudio
        </button>
      </div>
    </header>
  );
}
