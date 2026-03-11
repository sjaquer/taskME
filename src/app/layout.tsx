
"use client";

import type { Metadata } from 'next';
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
  { icon: Calendar, label: "Calendario", href: "/calendar" },
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
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&display=swap" rel="stylesheet" />
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=0, viewport-fit=cover" />
      </head>
      <body className="font-body antialiased min-h-screen bg-background text-foreground overflow-x-hidden">
        <FirebaseClientProvider>
          <SidebarProvider defaultOpen={true}>
            <div className="flex min-h-screen w-full">
              {/* Desktop Sidebar */}
              <Sidebar className="hidden md:flex border-r border-white/5 bg-black/60 backdrop-blur-3xl">
                <SidebarHeader className="p-8">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-2xl bg-primary flex items-center justify-center neon-glow">
                      <span className="text-primary-foreground font-black text-lg">TM</span>
                    </div>
                    <span className="text-2xl font-black tracking-tighter">TaskMe</span>
                  </div>
                </SidebarHeader>
                <SidebarContent className="px-6 py-8">
                  <SidebarMenu className="gap-2">
                    {desktopItems.map((item) => {
                      const isActive = pathname === item.href;
                      return (
                        <SidebarMenuItem key={item.href}>
                          <SidebarMenuButton 
                            asChild 
                            isActive={isActive}
                            className={cn(
                              "rounded-2xl py-8 px-6 transition-all duration-300",
                              isActive 
                                ? "bg-primary/10 text-primary border border-primary/20 shadow-[0_0_20px_rgba(57,255,20,0.1)]" 
                                : "hover:bg-white/5 text-muted-foreground hover:text-white"
                            )}
                          >
                            <Link href={item.href} className="flex items-center gap-5">
                              <item.icon className={cn("w-6 h-6", isActive && "neon-glow")} />
                              <span className="font-black uppercase tracking-widest text-[10px]">{item.label}</span>
                            </Link>
                          </SidebarMenuButton>
                        </SidebarMenuItem>
                      );
                    })}
                  </SidebarMenu>
                </SidebarContent>
              </Sidebar>

              <div className="flex-1 flex flex-col min-w-0">
                <Header />
                <main className="flex-1 pt-24 pb-24 px-4 md:px-12 md:pb-12 max-w-7xl mx-auto w-full transition-all">
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
