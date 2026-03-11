
import type { Metadata, Viewport } from 'next';
import { ClientShell } from '@/components/client-shell';
import './globals.css';

export const metadata: Metadata = {
  title: 'TaskMe — Gestión de Tareas',
  description: 'Organiza tus tareas de trabajo y estudio con un sistema visual de alto rendimiento.',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: 'cover',
};

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
        <link href="https://fonts.googleapis.com/css2?family=Inter:ital,opsz,wght@0,14..32,100..900;1,14..32,100..900&family=JetBrains+Mono:ital,wght@0,100..800;1,100..800&display=swap" rel="stylesheet" />
        <meta name="theme-color" content="#39FF14" />
      </head>
      <body className="font-body antialiased min-h-screen bg-background text-foreground overflow-x-hidden selection:bg-primary/30">
        <ClientShell>{children}</ClientShell>
      </body>
    </html>
  );
}
