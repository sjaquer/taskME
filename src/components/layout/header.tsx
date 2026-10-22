
"use client";

import { useAppContextStore } from "@/lib/store";
import { Sun, Moon } from "lucide-react";
import { cn } from "@/lib/utils";
import Image from "next/image";
import { SidebarTrigger, useSidebar } from "@/components/ui/sidebar";
import { ContextSwitcher } from "@/components/layout/context-switcher";
import { resolveColorMode } from "@/lib/appearance";

export function Header() {
  const { colorMode, setColorMode } = useAppContextStore();
  const { state } = useSidebar();

  return (
    <header className={cn(
      "fixed top-0 left-0 right-0 z-50 glass-blur gpu-blur safe-top safe-x flex items-center justify-between border-b border-border min-h-16 transition-all duration-300",
      state === "expanded" ? "md:left-[16rem]" : "md:left-[3rem]"
    )}>
      <div className="flex items-center gap-3">
        <SidebarTrigger className="hidden md:flex hover:bg-primary/10 hover:text-primary transition-all rounded-xl p-1.5 h-9 w-9" />
        <div className="w-8 h-8 rounded-lg overflow-hidden neon-glow shrink-0">
          <Image src="/isotipo.svg" alt="TaskMe" width={32} height={32} className="w-full h-full object-contain" />
        </div>
        <h1 className="text-xl font-headline font-bold tracking-tight bg-gradient-to-r from-foreground to-foreground/60 bg-clip-text text-transparent hidden sm:block">
          TaskMe
        </h1>
      </div>

      <div className="flex items-center gap-2 sm:gap-4">
        <ContextSwitcher />

        <button
          onClick={() => {
            // En modo Sistema se alterna respecto de lo que se ve ahora.
            const shown = colorMode === 'system' ? resolveColorMode('system') : colorMode;
            setColorMode(shown === 'dark' ? 'light' : 'dark');
          }}
          className="p-2.5 rounded-full bg-muted/30 border border-border text-muted-foreground hover:text-foreground transition-all"
          aria-label="Cambiar entre modo claro y oscuro"
        >
          <Sun className="w-4 h-4 hidden dark:block" />
          <Moon className="w-4 h-4 block dark:hidden" />
        </button>
      </div>
    </header>
  );
}
