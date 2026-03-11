
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, Calendar, LayoutGrid, Clock, Settings } from "lucide-react";
import { cn } from "@/lib/utils";

const navItems = [
  { icon: Home, label: "Home", href: "/" },
  { icon: LayoutGrid, label: "Board", href: "/kanban" },
  { icon: Clock, label: "Schedule", href: "/schedule" },
  { icon: Calendar, label: "Events", href: "/calendar" },
  { icon: Settings, label: "Profile", href: "/settings" },
];

export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 glass border-t border-white/5 px-6 pt-3 pb-safe-bottom">
      <div className="flex justify-between items-center max-w-md mx-auto">
        {navItems.map((item) => {
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex flex-col items-center gap-1 transition-colors duration-200",
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
