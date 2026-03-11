
"use client";

import './globals.css';
import { Header } from '@/components/layout/header';
import { BottomNav } from '@/components/navigation/bottom-nav';
import { Toaster } from '@/components/ui/toaster';
import { SidebarProvider, Sidebar, SidebarContent, SidebarHeader, SidebarMenu, SidebarMenuItem, SidebarMenuButton } from '@/components/ui/sidebar';
import { Home, LayoutGrid, Clock, Calendar, Settings } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { FirebaseClientProvider } from '@/firebase/client-provider';
import { cn } from '@/lib/utils';

const desktopItems = [
  { icon: Home, label: "Inicio", href: "/" },
  { icon: LayoutGrid, label: "Tablero", href: "/kanban" },
  { icon: Clock, label: "Horario", href: "/schedule" },
  { icon: Calendar, label: "Eventos", href: "/calendar" },
  { icon: Settings, label: "Perfil", href: "/settings" },
];

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const pathname = usePathname();

  return (
    <html lang="es" className="dark">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Inter:ital,opsz,wght@0,14..32,100..900;1,14..32,100..900&family=JetBrains+Mono:ital,wght@0,100..800;1,100..800&display=swap" rel="stylesheet" />
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=0, viewport-fit=cover" />
      </head>
      <body className="font-body antialiased min-h-screen bg-background text-foreground overflow-x-hidden selection:bg-primary/30">
        <FirebaseClientProvider>
          <SidebarProvider defaultOpen={true}>
            <div className="flex min-h-screen w-full relative">
              {/* Decorative Background Elements */}
              <div className="fixed inset-0 pointer-events-none overflow-hidden opacity-20">
                <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-primary/20 blur-[120px] rounded-full animate-pulse" />
                <div className="absolute bottom-[-10%] right-[-10%] w-[30%] h-[30%] bg-blue-500/10 blur-[100px] rounded-full" />
              </div>

              {/* Desktop Sidebar */}
              <Sidebar className="hidden md:flex border-r border-white/5 bg-black/40 backdrop-blur-3xl z-40">
                <SidebarHeader className="p-8">
                  <div className="flex items-center gap-4 group cursor-pointer">
                    <div className="w-12 h-12 rounded-2xl bg-primary flex items-center justify-center neon-glow group-hover:scale-110 transition-transform duration-500">
                      <span className="text-primary-foreground font-black text-xl italic">T</span>
                    </div>
                    <div className="flex flex-col">
                      <span className="text-2xl font-black tracking-tighter leading-none glow-text">TaskMe</span>
                      <span className="text-[9px] font-black tracking-[0.3em] text-primary uppercase mt-1">v2.0 Beta</span>
                    </div>
                  </div>
                </SidebarHeader>
                <SidebarContent className="px-6 py-8">
                  <SidebarMenu className="gap-3">
                    {desktopItems.map((item) => {
                      const isActive = pathname === item.href;
                      return (
                        <SidebarMenuItem key={item.href}>
                          <SidebarMenuButton 
                            asChild 
                            isActive={isActive}
                            className={cn(
                              "rounded-2xl py-8 px-6 transition-all duration-500 active:scale-95 group",
                              isActive 
                                ? "bg-primary/10 text-primary border border-primary/20 shadow-[0_0_25px_rgba(57,255,20,0.15)]" 
                                : "hover:bg-white/5 text-muted-foreground hover:text-white border border-transparent"
                            )}
                          >
                            <Link href={item.href} className="flex items-center gap-5">
                              <item.icon className={cn("w-6 h-6 transition-transform duration-300 group-hover:scale-110", isActive && "neon-glow")} />
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
                <main className="flex-1 pt-24 pb-24 px-4 md:px-12 md:pb-12 max-w-7xl mx-auto w-full">
                  {children}
                </main>
                <BottomNav />
              </div>
            </div>
          </SidebarProvider>
        </FirebaseClientProvider>
        <Toaster />
      </body>
    </html>
  );
}
