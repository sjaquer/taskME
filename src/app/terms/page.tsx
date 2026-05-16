'use client';

import { motion } from 'framer-motion';
import { FileText, ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';

export default function TermsPage() {
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
              <FileText className="w-6 h-6 text-primary" />
            </div>
            <h1 className="text-4xl md:text-5xl font-black uppercase tracking-tighter italic">
              Condiciones del <span className="text-primary">Servicio</span>
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
            <h2 className="text-xl font-bold text-foreground uppercase tracking-tight">1. Aceptación de los Términos</h2>
            <p>
              Al acceder y utilizar TaskMe, aceptas cumplir con estas condiciones. Si no estás de acuerdo con alguna parte de los términos, no podrás utilizar el servicio.
            </p>
          </section>

          <section className="space-y-4">
            <h2 className="text-xl font-bold text-foreground uppercase tracking-tight">2. Uso del Servicio</h2>
            <p>
              TaskMe se proporciona para la gestión personal y profesional de tareas y eventos. No debes utilizar la plataforma para ninguna actividad ilegal o no autorizada.
            </p>
          </section>

          <section className="space-y-4">
            <h2 className="text-xl font-bold text-foreground uppercase tracking-tight">3. Cuentas de Usuario</h2>
            <p>
              Eres responsable de mantener la seguridad de tu cuenta y de todas las actividades que ocurran bajo ella. TaskMe utiliza Firebase Auth para garantizar un acceso seguro.
            </p>
          </section>

          <section className="space-y-4">
            <h2 className="text-xl font-bold text-foreground uppercase tracking-tight">4. Integraciones de Terceros</h2>
            <p>
              El servicio incluye integraciones con Google Calendar. Al activar esta función, autorizas a TaskMe a interactuar con tu cuenta de Google según los permisos concedidos. No somos responsables de las políticas de privacidad o el funcionamiento de servicios de terceros.
            </p>
          </section>

          <section className="space-y-4">
            <h2 className="text-xl font-bold text-foreground uppercase tracking-tight">5. Limitación de Responsabilidad</h2>
            <p>
              TaskMe se proporciona "tal cual". Aunque nos esforzamos por ofrecer un servicio de alto rendimiento, no garantizamos que la plataforma esté libre de errores o interrupciones.
            </p>
          </section>

          <section className="space-y-4">
            <h2 className="text-xl font-bold text-foreground uppercase tracking-tight">6. Modificaciones</h2>
            <p>
              Nos reservamos el derecho de modificar estos términos en cualquier momento. El uso continuo del servicio tras dichos cambios constituye tu aceptación de los nuevos términos.
            </p>
          </section>
        </motion.div>

        <footer className="text-center pt-12 border-t border-border">
          <p className="text-xs text-muted-foreground uppercase tracking-widest">TaskMe Ecosystem • Operación de Alto Rendimiento</p>
        </footer>
      </div>
    </div>
  );
}
