'use client';

import { type ReactNode, useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { Header } from '@/components/layout/header';
import { BottomNav } from '@/components/navigation/bottom-nav';
import { Toaster } from '@/components/ui/toaster';
import {
  SidebarProvider,
  Sidebar,
  SidebarContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
} from '@/components/ui/sidebar';
import { Home, LayoutGrid, Clock, Calendar, Settings } from 'lucide-react';
import Link from 'next/link';
import Image from 'next/image';
import { FirebaseClientProvider } from '@/firebase/client-provider';
import { cn } from '@/lib/utils';
import { useAppContextStore } from '@/lib/store';
import { NotificationMonitor } from './notification-monitor';

const DESKTOP_NAV = [
  { icon: Home, label: "Inicio", href: "/" },
  { icon: LayoutGrid, label: "Tablero", href: "/kanban" },
  { icon: Clock, label: "Horario", href: "/schedule" },
  { icon: Calendar, label: "Eventos", href: "/calendar" },
  { icon: Settings, label: "Perfil", href: "/settings" },
];

export function ClientShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const theme = useAppContextStore((state) => state.theme);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);

  return (
    <>
      <FirebaseClientProvider>
        <SidebarProvider defaultOpen={true}>
          <div className="flex min-h-screen w-full relative bg-[#050505]">
            {/* Subtle ambient glow — GPU composited */}
            <div className="fixed inset-0 pointer-events-none overflow-hidden opacity-15 gpu-blur">
              <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-primary/15 blur-[120px] rounded-full" />
              <div className="absolute bottom-[-10%] right-[-10%] w-[30%] h-[30%] bg-blue-500/5 blur-[100px] rounded-full" />
            </div>

            {/* Desktop Sidebar */}
            <Sidebar className="hidden md:flex border-r border-white/[0.06] bg-[#050505]/80 backdrop-blur-2xl z-40">
              <SidebarHeader className="p-8">
                <div className="flex items-center gap-4 group cursor-pointer">
                  <div className="w-12 h-12 rounded-2xl overflow-hidden neon-glow group-hover:scale-110 transition-transform duration-500 shrink-0">
                    <Image src="/isotipo.svg" alt="TaskMe" width={48} height={48} className="w-full h-full object-contain" />
                  </div>
                  <div className="flex flex-col">
                    <span className="text-2xl font-black tracking-tighter leading-none glow-text">TaskMe</span>

                  </div>
                </div>
              </SidebarHeader>
              <SidebarContent className="px-6 py-8">
                <SidebarMenu className="gap-3">
                  {DESKTOP_NAV.map((item) => {
                    const isActive = pathname === item.href;
                    return (
                      <SidebarMenuItem key={item.href}>
                        <SidebarMenuButton
                          asChild
                          isActive={isActive}
                          className={cn(
                            "rounded-2xl py-8 px-6 transition-all duration-500 active:scale-95 group",
                            isActive
                              ? "bg-primary/10 text-primary border border-primary/20 shadow-[0_0_15px_rgba(57,255,20,0.1)]"
                              : "hover:bg-white/[0.03] text-muted-foreground hover:text-white border border-transparent"
                          )}
                        >
                          <Link href={item.href} className="flex items-center gap-5">
                            <item.icon className={cn("w-6 h-6 transition-transform duration-300 group-hover:scale-110", isActive && "drop-shadow-[0_0_6px_rgba(57,255,20,0.4)]")} />
                            <span className="font-black uppercase tracking-[0.2em] text-[10px]">{item.label}</span>
                          </Link>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    );
                  })}
                </SidebarMenu>
              </SidebarContent>
            </Sidebar>

            <div className="flex-1 flex flex-col min-w-0 z-10">
              <Header />
              <main className="flex-1 pt-20 pb-24 px-4 md:px-10 md:pb-10 max-w-7xl mx-auto w-full">
                {children}
              </main>
              <BottomNav />
            </div>
          </div>
        </SidebarProvider>
        <NotificationMonitor />
      </FirebaseClientProvider>
      <Toaster />
    </>
  );
}
