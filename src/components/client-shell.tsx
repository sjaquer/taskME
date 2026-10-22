'use client';

import { type ReactNode, Suspense, useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { motion, MotionConfig } from 'framer-motion';
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
  useSidebar,
} from '@/components/ui/sidebar';
import Link from 'next/link';
import Image from 'next/image';
import { FirebaseClientProvider } from '@/firebase/client-provider';
import { UserDataProvider, useContexts } from '@/firebase/user-data';
import { cn } from '@/lib/utils';
import { useAppContextStore } from '@/lib/store';
import { getVisibleNavItems } from '@/lib/navigation';
import { NotificationMonitor } from './notification-monitor';
import { NativeBridgeProvider } from './native-bridge-provider';
import { AppearanceManager } from './appearance-manager';
import { SettingsSync } from './settings-sync';
import { DeviceState } from './device-state';
import { useUser } from '@/firebase';
import { consumeLaunchRedirect } from '@/lib/launch-state';

const PUBLIC_ROUTES = ['/login', '/privacy', '/terms'];

export function ClientShell({ children }: { children: ReactNode }) {
  const reduceMotion = useAppContextStore((state) => state.reduceMotion);
  return (
    <MotionConfig reducedMotion={reduceMotion ? 'always' : 'user'}>
      <FirebaseClientProvider>
        <UserDataProvider>
          <AppearanceManager />
          <SettingsSync />
          <NativeBridgeProvider>
            <ShellRouter>{children}</ShellRouter>
          </NativeBridgeProvider>
        </UserDataProvider>
      </FirebaseClientProvider>
      <Toaster />
    </MotionConfig>
  );
}

// Mismo criterio que la pantalla de login: invitado o email verificado.
function canEnterApp(user: ReturnType<typeof useUser>['user']) {
  return !!user && (user.isAnonymous || user.emailVerified);
}

function ShellRouter({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, isUserLoading } = useUser();

  // Si la app se abrió directamente en otra pantalla (deep link de una notificación,
  // por ejemplo), ya no corresponde saltar a la página de inicio al visitar "/".
  useEffect(() => {
    if (pathname !== '/' && !PUBLIC_ROUTES.includes(pathname)) {
      consumeLaunchRedirect();
    }
  }, [pathname]);

  // /tickets es público solo para visitantes sin sesión (crear un ticket);
  // una vez autenticado, el dueño ve el shell completo con la gestión de tickets.
  const isPublic = PUBLIC_ROUTES.includes(pathname) || (pathname === '/tickets' && !user);
  const isAuthorized = canEnterApp(user);

  // Control de sesión central para todas las rutas privadas.
  useEffect(() => {
    if (!isPublic && !isUserLoading && !isAuthorized) {
      router.replace('/login');
    }
  }, [isPublic, isUserLoading, isAuthorized, router]);

  if (isPublic) {
    return (
      <div className="min-h-[100dvh] w-full bg-background transition-colors duration-500">
        <main className="w-full min-h-screen">
          <PageTransition pathname={pathname} className="w-full min-h-screen">
            {children}
          </PageTransition>
        </main>
      </div>
    );
  }

  if (!isAuthorized) {
    return <div className="min-h-[100dvh] w-full bg-background" aria-busy="true" />;
  }

  return (
    <>
      <SidebarProvider defaultOpen={true}>
        <ClientShellInner>{children}</ClientShellInner>
      </SidebarProvider>
      <Suspense fallback={null}>
        <NotificationMonitor />
      </Suspense>
    </>
  );
}

function ClientShellInner({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const { state } = useSidebar();
  const visualConfig = useAppContextStore((state) => state.visualConfig);
  const activeModules = useAppContextStore((state) => state.activeModules);
  const activeContextId = useAppContextStore((state) => state.context);
  const setContext = useAppContextStore((state) => state.setContext);
  const { data: contexts, isLoading: contextsLoading } = useContexts();

  // Si el contexto activo se borró (o vino de otro dispositivo), se pasa al primero disponible.
  useEffect(() => {
    if (!contextsLoading && !contexts.some((item) => item.id === activeContextId)) {
      setContext(contexts[0].id);
    }
  }, [contexts, contextsLoading, activeContextId, setContext]);
  const navOrder = useAppContextStore((state) => state.navOrder);
  const navItems = getVisibleNavItems(navOrder, activeModules);

  return (
    <div className={cn(
      "flex min-h-[100dvh] w-full relative transition-colors duration-500 bg-background",
      visualConfig.showGrid && "bg-grid-pattern"
    )}>
      {/* Desktop Sidebar */}
      <Sidebar collapsible="icon" className="hidden md:flex border-r border-border bg-card/60 backdrop-blur-2xl z-40 transition-all duration-500">
        <SidebarHeader className={cn("transition-all duration-300", state === "collapsed" ? "p-2 items-center justify-center" : "p-8")}>
          <div className="flex items-center gap-4 group cursor-pointer justify-center">
            <div className={cn(
              "rounded-2xl overflow-hidden group-hover:scale-110 transition-transform duration-500 shrink-0 bg-background/50",
              state === "collapsed" ? "w-8 h-8" : "w-12 h-12",
              visualConfig.glowEnabled && "neon-glow"
            )}>
              <Image src="/isotipo.svg" alt="TaskMe" width={state === "collapsed" ? 32 : 48} height={state === "collapsed" ? 32 : 48} className="w-full h-full object-contain" />
            </div>
            {state !== "collapsed" && (
              <div className="flex flex-col animate-in fade-in duration-300">
                <span className={cn("text-2xl font-black tracking-tighter leading-none transition-all", visualConfig.glowEnabled && "glow-text")}>TaskMe</span>
              </div>
            )}
          </div>
        </SidebarHeader>
        <SidebarContent className={cn("transition-all duration-300", state === "collapsed" ? "px-2" : "px-6")}>
          <SidebarMenu className="gap-3">
            {navItems.map((item) => {
              const isActive = pathname === item.href;
              return (
                <SidebarMenuItem key={item.href}>
                  <SidebarMenuButton
                    asChild
                    isActive={isActive}
                    className={cn(
                      "rounded-2xl py-8 px-6 transition-all duration-500 active:scale-95 group",
                      state === "collapsed" ? "py-4 px-2 justify-center" : "",
                      isActive
                        ? "bg-primary/10 text-primary border border-primary/20 shadow-[0_0_20px_hsl(var(--primary)/0.15)]"
                        : "hover:bg-primary/5 text-muted-foreground hover:text-foreground border border-transparent"
                    )}
                  >
                    <Link href={item.href} className="flex items-center gap-5 justify-center">
                      <item.icon className={cn("w-6 h-6 transition-transform duration-300 group-hover:scale-110 shrink-0", isActive && visualConfig.glowEnabled && "drop-shadow-[0_0_8px_hsl(var(--primary)/0.4)]")} />
                      {state !== "collapsed" && (
                        <span className="font-black uppercase tracking-[0.2em] text-[10px] animate-in fade-in duration-300">{item.label}</span>
                      )}
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
          "flex-1 pt-[calc(4.5rem+env(safe-area-inset-top))] pb-[calc(6rem+env(safe-area-inset-bottom))] safe-x sm:px-6 md:px-8 lg:px-12 md:pb-10 max-w-7xl mx-auto w-full transition-all duration-500",
          visualConfig.compactMode ? "space-y-4" : "space-y-8"
        )}>
          <PageTransition pathname={pathname} className="w-full h-full flex flex-col">
            {children}
          </PageTransition>
        </main>
        <BottomNav />
        <DeviceState />
      </div>
    </div>
  );
}

// Fundido corto al cambiar de página. Sin AnimatePresence mode="wait": la página
// nueva no espera a que termine la animación de salida de la anterior.
function PageTransition({ pathname, className, children }: { pathname: string; className: string; children: ReactNode }) {
  return (
    <motion.div
      key={pathname}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.15, ease: 'easeOut' }}
      className={className}
    >
      {children}
    </motion.div>
  );
}
