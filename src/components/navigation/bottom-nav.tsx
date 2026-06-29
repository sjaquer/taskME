
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Calendar, LayoutGrid, Clock, Settings, DollarSign } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAppContextStore } from "@/lib/store";

const NAV_ITEMS = [
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
    <nav className="fixed bottom-4 left-3 right-3 z-50 glass-blur gpu-blur border border-border rounded-2xl px-1.5 py-1 md:hidden transition-all duration-500 shadow-2xl pb-[calc(0.25rem+env(safe-area-inset-bottom))]">
      <div className="flex justify-around items-center max-w-md mx-auto h-14">
        {visibleItems.map((item) => {
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "relative flex flex-col items-center justify-center gap-0.5",
                "flex-1 min-h-[48px] py-1 px-0.5 rounded-xl",
                "transition-all duration-200 active:scale-95",
                isActive
                  ? "text-primary"
                  : "text-muted-foreground active:text-primary/60"
              )}
            >
              {isActive && (
                <div className="absolute -top-1 left-1/2 -translate-x-1/2 w-6 h-0.5 rounded-full bg-primary shadow-[0_0_12px_rgba(57,255,20,0.8)]" />
              )}
              <item.icon className={cn("w-5 h-5 transition-transform duration-300", isActive && "scale-110 drop-shadow-[0_0_8px_rgba(57,255,20,0.6)]")} />
              <span className={cn(
                "text-[8px] font-bold uppercase tracking-wider transition-all truncate max-w-full text-center block",
                isActive ? "opacity-100 scale-100" : "opacity-60"
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
