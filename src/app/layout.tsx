
import type { Metadata } from 'next';
import './globals.css';
import { Header } from '@/components/layout/header';
import { BottomNav } from '@/components/navigation/bottom-nav';
import { Toaster } from '@/components/ui/toaster';
import { SidebarProvider, Sidebar, SidebarContent, SidebarHeader, SidebarMenu, SidebarMenuItem, SidebarMenuButton } from '@/components/ui/sidebar';
import { Home, LayoutGrid, Clock, Calendar, Settings } from 'lucide-react';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'TaskMe | Gestión de Tareas Cyber',
  description: 'Kanban inteligente y programación para el profesional moderno.',
};

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
  return (
    <html lang="es" className="dark">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&display=swap" rel="stylesheet" />
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=0, viewport-fit=cover" />
      </head>
      <body className="font-body antialiased min-h-screen bg-background text-foreground overflow-x-hidden">
        <SidebarProvider defaultOpen={true}>
          <div className="flex min-h-screen w-full">
            {/* Desktop Sidebar */}
            <Sidebar className="hidden md:flex border-r border-white/5 bg-black/40 backdrop-blur-xl">
              <SidebarHeader className="p-6">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center neon-glow">
                    <span className="text-primary-foreground font-black text-sm">TM</span>
                  </div>
                  <span className="text-xl font-black tracking-tighter">TaskMe</span>
                </div>
              </SidebarHeader>
              <SidebarContent className="px-4 py-6">
                <SidebarMenu>
                  {desktopItems.map((item) => (
                    <SidebarMenuItem key={item.href}>
                      <SidebarMenuButton asChild className="hover:bg-primary/10 hover:text-primary rounded-xl py-6 px-4 transition-all">
                        <Link href={item.href} className="flex items-center gap-4">
                          <item.icon className="w-5 h-5" />
                          <span className="font-bold">{item.label}</span>
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  ))}
                </SidebarMenu>
              </SidebarContent>
            </Sidebar>

            <div className="flex-1 flex flex-col min-w-0">
              <Header />
              <main className="flex-1 pt-20 pb-24 px-4 md:px-10 md:pb-10 max-w-7xl mx-auto w-full transition-all">
                {children}
              </main>
              <BottomNav />
            </div>
          </div>
        </SidebarProvider>
        <Toaster />
      </body>
    </html>
  );
}
