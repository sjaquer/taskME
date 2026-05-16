'use client';

import { motion } from 'framer-motion';
import { 
  Zap, Shield, Globe, ArrowRight, Kanban, 
  Calendar, Clock, CheckCircle2, LayoutDashboard,
  ShieldCheck, Lock, Sparkles
} from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { TacticalButton } from '@/components/atoms';

export default function WelcomePage() {
  return (
    <div className="min-h-screen bg-background overflow-hidden selection:bg-primary/30">
      {/* Background Effects */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-primary/10 blur-[120px] rounded-full animate-pulse" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-blue-500/5 blur-[100px] rounded-full" />
        <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-20 mix-blend-overlay" />
      </div>

      {/* Navigation */}
      <nav className="relative z-50 px-6 py-6 border-b border-border bg-background/50 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center shadow-[0_0_20px_rgba(57,255,20,0.3)]">
              <Zap className="w-6 h-6 text-black" />
            </div>
            <span className="text-xl font-black uppercase tracking-tighter italic">Task<span className="text-primary">Me</span></span>
          </div>
          
          <div className="hidden md:flex items-center gap-8 text-[11px] font-black uppercase tracking-widest text-muted-foreground">
            <Link href="#features" className="hover:text-primary transition-colors">Funcionalidades</Link>
            <Link href="#security" className="hover:text-primary transition-colors">Seguridad</Link>
            <Link href="/privacy" className="hover:text-primary transition-colors">Privacidad</Link>
          </div>

          <Link href="/login">
            <Button variant="outline" className="rounded-xl border-primary/20 bg-primary/5 hover:bg-primary/10 text-primary gap-2">
              Iniciar Sesión <ArrowRight className="w-4 h-4" />
            </Button>
          </Link>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative z-10 pt-24 pb-32 px-6">
        <div className="max-w-7xl mx-auto text-center space-y-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 border border-primary/20 text-primary text-[10px] font-black uppercase tracking-[0.2em]"
          >
            <Sparkles className="w-3.5 h-3.5" /> Nueva Era de Productividad
          </motion.div>
          
          <motion.h1 
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="text-5xl md:text-8xl font-black uppercase tracking-tighter italic leading-none"
          >
            Orquesta tu flujo <br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary to-blue-500">
              Sin Límites
            </span>
          </motion.h1>

          <motion.p 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.2 }}
            className="max-w-2xl mx-auto text-lg text-muted-foreground font-medium"
          >
            TaskMe es el ecosistema definitivo para operadores de alto rendimiento. Gestiona tareas, rutinas y calendarios en una interfaz unificada diseñada para el enfoque absoluto.
          </motion.p>

          <motion.div 
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.3 }}
            className="pt-6 flex flex-col sm:flex-row items-center justify-center gap-4"
          >
            <Link href="/login">
              <TacticalButton className="w-64 h-14 text-sm">Comenzar Ahora</TacticalButton>
            </Link>
          </motion.div>
        </div>
      </section>

      {/* Features Grid */}
      <section id="features" className="relative z-10 py-32 px-6 bg-muted/30">
        <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-8">
          <FeatureCard 
            icon={<Kanban className="w-8 h-8 text-primary" />}
            title="Kanban Dinámico"
            description="Visualiza tus procesos con un tablero fluido. Priorización con efectos neón y estados personalizables."
          />
          <FeatureCard 
            icon={<Clock className="w-8 h-8 text-blue-400" />}
            title="Monitor de Rutinas"
            description="Configura tus bloques de tiempo semanales. Seguimiento en vivo con barras de progreso en tiempo real."
          />
          <FeatureCard 
            icon={<Calendar className="w-8 h-8 text-yellow-500" />}
            title="Control de Eventos"
            description="Sincronización bidireccional con Google Calendar. Toda tu agenda en un solo lugar centralizado."
          />
        </div>
      </section>

      {/* Security Section */}
      <section id="security" className="relative z-10 py-32 px-6">
        <div className="max-w-4xl mx-auto glass-card p-12 md:p-24 text-center space-y-8 overflow-hidden relative">
          <div className="absolute top-0 right-0 p-8 opacity-10">
            <ShieldCheck className="w-64 h-64 text-primary" />
          </div>
          
          <div className="inline-flex items-center gap-2 text-primary font-black uppercase tracking-widest text-xs">
            <Lock className="w-4 h-4" /> Seguridad de Grado Militar
          </div>
          <h2 className="text-3xl md:text-5xl font-black uppercase tracking-tighter italic">
            Tus datos están <span className="text-primary">Protegidos</span>
          </h2>
          <p className="text-muted-foreground text-lg">
            Utilizamos infraestructura de Google Cloud (Firebase) y autenticación OAuth 2.0. Tus datos nunca se comparten y solo tú tienes el control total sobre tus integraciones.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-8 pt-8 opacity-60 grayscale hover:grayscale-0 transition-all">
            <div className="flex items-center gap-2">
              <Globe className="w-6 h-6" /> Cloud Persistency
            </div>
            <div className="flex items-center gap-2">
              <Shield className="w-6 h-6" /> Zod Validation
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-6 h-6" /> Zero Latency
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="relative z-10 py-24 border-t border-border bg-background">
        <div className="max-w-7xl mx-auto px-6 grid grid-cols-1 md:grid-cols-4 gap-12">
          <div className="col-span-2 space-y-6">
            <div className="flex items-center gap-3 text-2xl font-black uppercase tracking-tighter italic">
              Task<span className="text-primary">Me</span>
            </div>
            <p className="text-muted-foreground max-w-sm">
              La terminal de productividad definitiva para desarrolladores y operadores de alto rendimiento.
            </p>
          </div>
          
          <div className="space-y-4">
            <h4 className="text-xs font-black uppercase tracking-widest text-foreground">Legal</h4>
            <div className="flex flex-col gap-2 text-sm text-muted-foreground font-medium">
              <Link href="/privacy" className="hover:text-primary transition-colors">Política de Privacidad</Link>
              <Link href="/terms" className="hover:text-primary transition-colors">Condiciones de Servicio</Link>
            </div>
          </div>

          <div className="space-y-4">
            <h4 className="text-xs font-black uppercase tracking-widest text-foreground">App</h4>
            <div className="flex flex-col gap-2 text-sm text-muted-foreground font-medium">
              <Link href="/login" className="hover:text-primary transition-colors">Entrar</Link>
              <Link href="/" className="hover:text-primary transition-colors">Dashboard</Link>
            </div>
          </div>
        </div>
        <div className="max-w-7xl mx-auto px-6 mt-24 pt-8 border-t border-border flex flex-col md:flex-row justify-between gap-4">
          <p className="text-[10px] font-black uppercase tracking-[0.3em] text-muted-foreground/40">
            © 2026 TASKME ECOSYSTEM • DESIGNED BY SJAQUER
          </p>
          <div className="flex gap-6 opacity-30 text-[10px] font-black uppercase tracking-widest italic">
            <span>Performance</span>
            <span>Security</span>
            <span>Focus</span>
          </div>
        </div>
      </footer>
    </div>
  );
}

function FeatureCard({ icon, title, description }: { icon: React.ReactNode, title: string, description: string }) {
  return (
    <motion.div 
      whileHover={{ y: -5 }}
      className="glass-card p-8 space-y-6 border-b-4 border-b-transparent hover:border-b-primary transition-all group"
    >
      <div className="w-16 h-16 rounded-2xl bg-background border border-border flex items-center justify-center shadow-sm group-hover:shadow-primary/10 transition-all">
        {icon}
      </div>
      <h3 className="text-xl font-bold uppercase tracking-tight">{title}</h3>
      <p className="text-muted-foreground text-sm leading-relaxed">{description}</p>
    </motion.div>
  );
}
