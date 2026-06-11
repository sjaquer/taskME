'use client';

import { type ReactNode, Suspense, useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
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
import { Home, LayoutGrid, Clock, Calendar, Settings, DollarSign } from 'lucide-react';
import Link from 'next/link';
import Image from 'next/image';
import { FirebaseClientProvider } from '@/firebase/client-provider';
import { cn } from '@/lib/utils';
import { useAppContextStore } from '@/lib/store';
import { NotificationMonitor } from './notification-monitor';
import { isNativeAndroidContainer } from '@/lib/native-bridge';
import { NativeBridgeProvider } from './native-bridge-provider';

const DESKTOP_NAV = [
  { icon: Home, label: "Inicio", href: "/" },
  { icon: LayoutGrid, label: "Tablero", href: "/kanban" },
  { icon: Clock, label: "Horario", href: "/schedule" },
  { icon: Calendar, label: "Eventos", href: "/calendar" },
  { icon: DollarSign, label: "Finanzas", href: "/finance" },
  { icon: Settings, label: "Perfil", href: "/settings" },
];

export function ClientShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const theme = useAppContextStore((state) => state.theme);
  const colorMode = useAppContextStore((state) => state.colorMode);
  const visualConfig = useAppContextStore((state) => state.visualConfig);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);

  useEffect(() => {
    document.documentElement.dataset.mode = colorMode;
    if (colorMode === 'dark') {
      document.documentElement.classList.add('dark');
      document.documentElement.classList.remove('light');
    } else {
      document.documentElement.classList.add('light');
      document.documentElement.classList.remove('dark');
    }
  }, [colorMode]);

  useEffect(() => {
    document.documentElement.dataset.grid = String(visualConfig.showGrid);
    document.documentElement.dataset.glow = String(visualConfig.glowEnabled);
    document.documentElement.dataset.compact = String(visualConfig.compactMode);
    document.documentElement.style.setProperty('--glass-intensity', String(visualConfig.glassIntensity));
  }, [visualConfig]);

  useEffect(() => {
    if (isNativeAndroidContainer()) {
      document.documentElement.dataset.shell = 'android-webview';
    } else {
      delete document.documentElement.dataset.shell;
    }
  }, []);

  const PUBLIC_ROUTES = ['/welcome', '/login', '/privacy', '/terms'];
  const isPublic = PUBLIC_ROUTES.includes(pathname);

  if (isPublic) {
    return (
      <>
        <FirebaseClientProvider>
          <NativeBridgeProvider>
            <div className="min-h-[100dvh] w-full bg-background transition-colors duration-500">
              <main className="w-full min-h-screen">
                <AnimatePresence mode="wait">
                  <motion.div
                    key={pathname}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    className="w-full min-h-screen"
                  >
                    {children}
                  </motion.div>
                </AnimatePresence>
              </main>
            </div>
          </NativeBridgeProvider>
        </FirebaseClientProvider>
        <Toaster />
      </>
    );
  }

  return (
    <>
      <FirebaseClientProvider>
        <NativeBridgeProvider>
          <SidebarProvider defaultOpen={true}>
            <div className={cn(
              "flex min-h-[100dvh] w-full relative transition-colors duration-500 bg-background",
              visualConfig.showGrid && "bg-grid-pattern"
            )}>


              {/* Desktop Sidebar */}
              <Sidebar className="hidden md:flex border-r border-border bg-card/60 backdrop-blur-2xl z-40 transition-all duration-500">
                <SidebarHeader className="p-8">
                  <div className="flex items-center gap-4 group cursor-pointer">
                    <div className={cn(
                      "w-12 h-12 rounded-2xl overflow-hidden group-hover:scale-110 transition-transform duration-500 shrink-0 bg-background/50",
                      visualConfig.glowEnabled && "neon-glow"
                    )}>
                      <Image src="/isotipo.svg" alt="TaskMe" width={48} height={48} className="w-full h-full object-contain" />
                    </div>
                    <div className="flex flex-col">
                      <span className={cn("text-2xl font-black tracking-tighter leading-none transition-all", visualConfig.glowEnabled && "glow-text")}>TaskMe</span>
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
                                ? "bg-primary/10 text-primary border border-primary/20 shadow-[0_0_20px_rgba(var(--primary),0.1)]"
                                : "hover:bg-primary/5 text-muted-foreground hover:text-foreground border border-transparent"
                            )}
                          >
                            <Link href={item.href} className="flex items-center gap-5">
                              <item.icon className={cn("w-6 h-6 transition-transform duration-300 group-hover:scale-110", isActive && visualConfig.glowEnabled && "drop-shadow-[0_0_8px_hsl(var(--primary)/0.4)]")} />
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
                <main className={cn(
                  "flex-1 pt-[calc(4.5rem+env(safe-area-inset-top))] pb-[calc(6rem+env(safe-area-inset-bottom))] px-4 sm:px-6 md:px-8 lg:px-12 md:pb-10 max-w-7xl mx-auto w-full safe-x transition-all duration-500",
                  visualConfig.compactMode ? "space-y-4" : "space-y-8"
                )}>
                  <AnimatePresence mode="wait">
                    <motion.div
                      key={pathname}
                      initial={{ opacity: 0, y: 15 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -15 }}
                      transition={{ duration: 0.25, ease: "easeInOut" }}
                      className="w-full h-full flex flex-col"
                    >
                      {children}
                    </motion.div>
                  </AnimatePresence>
                </main>
                <BottomNav />
              </div>
            </div>
          </SidebarProvider>
          <Suspense fallback={null}>
            <NotificationMonitor />
          </Suspense>
        </NativeBridgeProvider>
      </FirebaseClientProvider>
      <Toaster />
    </>
  );
}

