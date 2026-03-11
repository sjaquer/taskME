
import type { Metadata } from 'next';
import './globals.css';
import { Header } from '@/components/layout/header';
import { BottomNav } from '@/components/navigation/bottom-nav';
import { Toaster } from '@/components/ui/toaster';

export const metadata: Metadata = {
  title: 'TaskMe | Cyber Task Management',
  description: 'Smart Kanban and scheduling for the modern focused professional.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&display=swap" rel="stylesheet" />
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=0, viewport-fit=cover" />
      </head>
      <body className="font-body antialiased min-h-screen bg-background text-foreground overflow-x-hidden">
        <Header />
        <main className="pt-20 pb-24 px-4 max-w-lg mx-auto min-h-screen">
          {children}
        </main>
        <BottomNav />
        <Toaster />
      </body>
    </html>
  );
}
