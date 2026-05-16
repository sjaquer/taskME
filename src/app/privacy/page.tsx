'use client';

import { motion } from 'framer-motion';
import { Shield, ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-background text-foreground p-6 md:p-12 lg:p-24">
      <div className="max-w-3xl mx-auto space-y-12">
        <header className="space-y-6">
          <Link href="/">
            <Button variant="ghost" className="gap-2 -ml-4 text-muted-foreground hover:text-primary">
              <ArrowLeft className="w-4 h-4" /> Volver
            </Button>
          </Link>
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center border border-primary/20">
              <Shield className="w-6 h-6 text-primary" />
            </div>
            <h1 className="text-4xl md:text-5xl font-black uppercase tracking-tighter italic">
              Política de <span className="text-primary">Privacidad</span>
            </h1>
          </div>
          <p className="text-muted-foreground font-medium">Última actualización: 16 de mayo de 2026</p>
        </header>

        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="glass-card p-8 md:p-12 space-y-8 text-sm md:text-base leading-relaxed text-muted-foreground"
        >
          <section className="space-y-4">
            <h2 className="text-xl font-bold text-foreground uppercase tracking-tight">1. Introducción</h2>
            <p>
              En TaskMe, valoramos tu privacidad. Esta política describe cómo recopilamos, usamos y protegemos tu información cuando utilizas nuestro ecosistema de productividad.
            </p>
          </section>

          <section className="space-y-4">
            <h2 className="text-xl font-bold text-foreground uppercase tracking-tight">2. Información que Recopilamos</h2>
            <p>
              Recopilamos información necesaria para el funcionamiento de la aplicación, incluyendo:
            </p>
            <ul className="list-disc pl-6 space-y-2">
              <li><strong>Datos de Cuenta:</strong> Nombre y correo electrónico proporcionados vía Firebase Auth o Google Sign-In.</li>
              <li><strong>Datos de Contenido:</strong> Tareas, rutinas y eventos que creas dentro de la plataforma.</li>
              <li><strong>Integración con Google Calendar:</strong> Si vinculas tu cuenta, accedemos a tus calendarios para leer y escribir eventos según tu solicitud.</li>
            </ul>
          </section>

          <section className="space-y-4">
            <h2 className="text-xl font-bold text-foreground uppercase tracking-tight">3. Uso de Google Calendar API</h2>
            <p>
              TaskMe utiliza los servicios de Google API para sincronizar tus eventos. Nuestro uso de la información recibida de las APIs de Google cumplirá con la <a href="https://developers.google.com/terms/api-services-user-data-policy" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">Política de Datos de Usuario de los Servicios de API de Google</a>, incluyendo los requisitos de Uso Limitado.
            </p>
          </section>

          <section className="space-y-4">
            <h2 className="text-xl font-bold text-foreground uppercase tracking-tight">4. Protección de Datos</h2>
            <p>
              Toda la información se almacena de forma segura en Firebase (Google Cloud). Implementamos Reglas de Seguridad estrictas para asegurar que solo tú puedas acceder a tus datos personales.
            </p>
          </section>

          <section className="space-y-4">
            <h2 className="text-xl font-bold text-foreground uppercase tracking-tight">5. Tus Derechos</h2>
            <p>
              Puedes exportar o eliminar tus datos en cualquier momento desde la configuración de la aplicación o contactándonos directamente.
            </p>
          </section>
        </motion.div>

        <footer className="text-center pt-12 border-t border-border">
          <p className="text-xs text-muted-foreground uppercase tracking-widest">TaskMe Ecosystem • Seguridad y Transparencia</p>
        </footer>
      </div>
    </div>
  );
}
