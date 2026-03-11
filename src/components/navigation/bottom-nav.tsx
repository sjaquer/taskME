
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, Calendar, LayoutGrid, Clock, Settings } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAppContextStore } from "@/lib/store";

const NAV_ITEMS = [
  { icon: Home, label: "Inicio", href: "/", moduleKey: "dashboard" as const },
  { icon: LayoutGrid, label: "Tablero", href: "/kanban", moduleKey: "kanban" as const },
  { icon: Clock, label: "Horario", href: "/schedule", moduleKey: "schedule" as const },
  { icon: Calendar, label: "Eventos", href: "/calendar", moduleKey: "calendar" as const },
  { icon: Settings, label: "Perfil", href: "/settings", moduleKey: null },
] as const;

export function BottomNav() {
  const pathname = usePathname();
  const { activeModules } = useAppContextStore();

  const visibleItems = NAV_ITEMS.filter(
    (item) => item.moduleKey === null || activeModules[item.moduleKey]
  );

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 glass-blur gpu-blur border-t border-white/[0.06] px-2 pt-1 safe-bottom md:hidden">
      <div className="flex justify-around items-center max-w-md mx-auto">
        {visibleItems.map((item) => {
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "relative flex flex-col items-center justify-center gap-0.5",
                "min-w-[48px] min-h-[48px] py-2 px-3 rounded-xl",
                "transition-all duration-200 active:scale-90",
                isActive
                  ? "text-primary"
                  : "text-muted-foreground active:text-primary/60"
              )}
            >
              {isActive && (
                <div className="absolute -top-1 left-1/2 -translate-x-1/2 w-5 h-0.5 rounded-full bg-primary neon-glow" />
              )}
              <item.icon className={cn("w-5 h-5", isActive && "drop-shadow-[0_0_6px_rgba(57,255,20,0.5)]")} />
              <span className="text-[9px] font-black uppercase tracking-wider">{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
