
"use client";

import { useAppContextStore } from "@/lib/store";
import { Briefcase, GraduationCap, Sun, Moon } from "lucide-react";
import { cn } from "@/lib/utils";
import type { AppContext } from "@/types/task";
import Image from "next/image";

const CONTEXTS: { value: AppContext; icon: typeof Briefcase; label: string }[] = [
  { value: 'Trabajo', icon: Briefcase, label: 'Trabajo' },
  { value: 'Estudio', icon: GraduationCap, label: 'Estudio' },
];

export function Header() {
  const { context, setContext, colorMode, setColorMode } = useAppContextStore();

  return (
    <header className="fixed top-0 left-0 right-0 z-50 glass-blur gpu-blur px-4 safe-top safe-x flex items-center justify-between border-b border-white/[0.06] md:px-8 min-h-16">
      <div className="flex items-center gap-2">
        <div className="w-8 h-8 rounded-lg overflow-hidden neon-glow shrink-0">
          <Image src="/isotipo.svg" alt="TaskMe" width={32} height={32} className="w-full h-full object-contain" />
        </div>
        <h1 className="text-xl font-headline font-bold tracking-tight bg-gradient-to-r from-white to-white/60 bg-clip-text text-transparent hidden sm:block">
          TaskMe
        </h1>
      </div>

      <div className="flex items-center gap-4">
        <div className="flex bg-white/[0.03] rounded-full p-1 border border-white/[0.06]">
          {CONTEXTS.map(({ value, icon: Icon, label }) => (
            <button
              key={value}
              onClick={() => setContext(value)}
              className={cn(
                "flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-medium transition-all",
                context === value
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <Icon className="w-3.5 h-3.5" />
              {label}
            </button>
          ))}
        </div>

        <button
          onClick={() => setColorMode(colorMode === 'dark' ? 'light' : 'dark')}
          className="p-2.5 rounded-full bg-white/[0.03] border border-white/[0.06] text-muted-foreground hover:text-foreground transition-all"
          aria-label="Toggle theme"
        >
          {colorMode === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
        </button>
      </div>
    </header>
  );
}
