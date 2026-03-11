
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, Calendar, LayoutGrid, Clock, Settings } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAppContextStore } from "@/lib/store";

export function BottomNav() {
  const pathname = usePathname();
  const { activeModules } = useAppContextStore();

  const navItems = [
    { icon: Home, label: "Inicio", href: "/", visible: activeModules.dashboard },
    { icon: LayoutGrid, label: "Tablero", href: "/kanban", visible: activeModules.kanban },
    { icon: Clock, label: "Horario", href: "/schedule", visible: activeModules.schedule },
    { icon: Calendar, label: "Eventos", href: "/calendar", visible: activeModules.calendar },
    { icon: Settings, label: "Perfil", href: "/settings", visible: true },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 glass-blur border-t border-white/5 px-6 pt-3 pb-safe-bottom md:hidden">
      <div className="flex justify-around items-center max-w-md mx-auto">
        {navItems.filter(item => item.visible).map((item) => {
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex flex-col items-center justify-center gap-1 min-w-[44px] min-h-[44px] py-2 px-3 transition-colors duration-200",
                isActive ? "text-primary" : "text-muted-foreground hover:text-foreground"
              )}
            >
              <item.icon className={cn("w-6 h-6", isActive && "neon-glow")} />
              <span className="text-[10px] font-medium">{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
