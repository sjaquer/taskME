
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, Calendar, LayoutGrid, Clock, Settings, DollarSign } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAppContextStore } from "@/lib/store";

const NAV_ITEMS = [
  { icon: Home, label: "Inicio", href: "/", moduleKey: "dashboard" as const },
  { icon: LayoutGrid, label: "Tablero", href: "/kanban", moduleKey: "kanban" as const },
  { icon: Clock, label: "Horario", href: "/schedule", moduleKey: "schedule" as const },
  { icon: Calendar, label: "Eventos", href: "/calendar", moduleKey: "calendar" as const },
  { icon: DollarSign, label: "Finanzas", href: "/finance", moduleKey: null },
  { icon: Settings, label: "Perfil", href: "/settings", moduleKey: null },
] as const;

export function BottomNav() {
  const pathname = usePathname();
  const { activeModules } = useAppContextStore();

  const visibleItems = NAV_ITEMS.filter(
    (item) => item.moduleKey === null || activeModules[item.moduleKey]
  );

  return (
    <nav className="fixed bottom-3 left-[2px] right-[2px] z-50 glass-blur gpu-blur border border-border rounded-2xl px-2 py-1.5 md:hidden transition-all duration-500 shadow-2xl">
      <div className="flex justify-around items-center max-w-md mx-auto h-16">
        {visibleItems.map((item) => {
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "relative flex flex-col items-center justify-center gap-1",
                "min-w-[60px] min-h-[56px] py-1 px-2 rounded-xl",
                "transition-all duration-200 active:scale-95",
                isActive
                  ? "text-primary"
                  : "text-muted-foreground active:text-primary/60"
              )}
            >
              {isActive && (
                <div className="absolute -top-0.5 left-1/2 -translate-x-1/2 w-6 h-1 rounded-full bg-primary shadow-[0_0_12px_rgba(57,255,20,0.8)]" />
              )}
              <item.icon className={cn("w-6 h-6", isActive && "drop-shadow-[0_0_8px_rgba(57,255,20,0.6)]")} />
              <span className={cn(
                "text-[10px] font-black uppercase tracking-widest transition-all",
                isActive ? "opacity-100 scale-105" : "opacity-70"
              )}>
                {item.label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
