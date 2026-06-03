
import type { Metadata, Viewport } from 'next';
import { ClientShell } from '@/components/client-shell';
import './globals.css';

export const metadata: Metadata = {
  title: 'TaskMe — Gestión de Tareas',
  description: 'Organiza tus tareas de trabajo y estudio con un sistema visual de alto rendimiento.',
  icons: {
    icon: [
      { url: '/favicon-96x96.png', sizes: '96x96', type: 'image/png' },
      { url: '/favicon.svg', type: 'image/svg+xml' },
    ],
    apple: [{ url: '/apple-touch-icon.png', sizes: '180x180' }],
  },
  manifest: '/site.webmanifest',
  appleWebApp: {
    title: 'TaskMe',
  },
  verification: {
    google: 'XXXcSKs9hnuQpt4nxbfKDzlXRvZMPRmHXZMO2zgQmEc',
  },
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
        <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:ital,wght@0,200..800;1,200..800&family=JetBrains+Mono:ital,wght@0,100..800;1,100..800&display=swap" rel="stylesheet" />
        <meta name="theme-color" content="#3dbd7d" />
      </head>
      <body className="font-body antialiased min-h-screen bg-background text-foreground overflow-x-hidden selection:bg-primary/30">
        <ClientShell>{children}</ClientShell>
      </body>
    </html>
  );
}
