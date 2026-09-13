"use client";

import { useState } from "react";
import {
  Shield, LogOut, Zap, Layout, Check, RefreshCcw, Fingerprint,
  Palette, Bell, Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { useUser, useAuth, useFirestore } from "@/firebase";
import { useAppContextStore } from "@/lib/store";
import type { AppTheme, TaskRetentionPeriod } from "@/lib/store";
import { toast } from "@/hooks/use-toast";
import { logoutUser, saveSettingsToCloud } from "@/services/user-service";
import { cleanupCompletedTasks } from "@/services/task-service";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { NotificationSetup } from "@/components/notification-setup";

const THEME_OPTIONS: { value: AppTheme; label: string; hint: string; color: string }[] = [
  { value: "neon", label: "Neon Verde", hint: "Modo original", color: "#22c55e" },
  { value: "cyan", label: "Cyan", hint: "Frío y técnico", color: "#06b6d4" },
  { value: "amber", label: "Amber", hint: "Cálido y enfocado", color: "#f59e0b" },
  { value: "rose", label: "Rose", hint: "Alto contraste", color: "#f43f5e" },
  { value: "violet", label: "Violet", hint: "Profundo y suave", color: "#8b5cf6" },
  { value: "emerald", label: "Emerald", hint: "Naturaleza digital", color: "#10b981" },
  { value: "indigo", label: "Indigo", hint: "Elegancia nocturna", color: "#6366f1" },
  { value: "crimson", label: "Crimson", hint: "Poder y energía", color: "#dc2626" },
  { value: "slate", label: "Slate", hint: "Neutral y sobrio", color: "#64748b" },
];

export default function SettingsPage() {
  const { user } = useUser();
  const auth = useAuth();
  const firestore = useFirestore();
  const {
    activeModules, toggleModule,
    theme, setTheme,
    colorMode, setColorMode,
    visualConfig, updateVisualConfig,
    hourFormat, setHourFormat,
    defaultPage, setDefaultPage,
    taskRetentionPeriod, setTaskRetentionPeriod,
  } = useAppContextStore();

  const [isCleaning, setIsCleaning] = useState(false);

  const handleLogout = async () => {
    await logoutUser(auth);
    window.location.href = "/login";
  };

  const handleToggleModule = (module: keyof typeof activeModules) => {
    toggleModule(module);
    if (firestore && user) {
      saveSettingsToCloud(firestore, user.uid, {
        activeModules: { ...activeModules, [module]: !activeModules[module] },
      });
    }
  };

  const handleCleanupNow = async () => {
    if (!firestore || !user) return;
    setIsCleaning(true);
    try {
      const deletedCount = await cleanupCompletedTasks(firestore, user.uid, taskRetentionPeriod);
      toast({
        variant: "success",
        title: deletedCount > 0 ? "Limpieza completada" : "Nada que limpiar",
        description: deletedCount > 0 ? `Se eliminaron ${deletedCount} tarea(s) completadas.` : "No hay tareas completadas fuera del periodo elegido.",
      });
    } catch {
      toast({ variant: "destructive", title: "Error", description: "No se pudo completar la limpieza." });
    } finally {
      setIsCleaning(false);
    }
  };

  return (
    <div className="space-y-8 max-w-4xl mx-auto py-4 px-0">
      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div className="space-y-1">
          <h2 className="text-2xl md:text-4xl font-black tracking-tighter uppercase">
            Configuraciones
          </h2>
          {user?.email && (
            <p className="text-[11px] text-muted-foreground font-black uppercase tracking-[0.4em] flex items-center gap-2">
              <Fingerprint className="w-3 h-3 text-primary/40" />
              <span className="font-data">{user.email}</span>
            </p>
          )}
        </div>
        <Button onClick={handleLogout} variant="destructive" className="rounded-xl font-black uppercase text-[9px] tracking-widest gap-2 shrink-0">
          <LogOut className="w-4 h-4" /> Salir
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Modules */}
        <section className="space-y-3">
          <h3 className="text-[11px] uppercase font-black text-muted-foreground tracking-[0.3em] flex items-center gap-2">
            <Layout className="w-3.5 h-3.5 text-primary" /> Módulos del Sistema
          </h3>
          <div className="glass-card p-5 space-y-4">
            <ModuleToggle label="Terminal" active={activeModules.dashboard} onToggle={() => handleToggleModule("dashboard")} />
            <ModuleToggle label="Tablero" active={activeModules.kanban} onToggle={() => handleToggleModule("kanban")} />
            <ModuleToggle label="Horario" active={activeModules.schedule} onToggle={() => handleToggleModule("schedule")} />
          </div>
        </section>

        {/* Maintenance */}
        <section className="space-y-3">
          <h3 className="text-[11px] uppercase font-black text-muted-foreground tracking-[0.3em] flex items-center gap-2">
            <Shield className="w-3.5 h-3.5 text-primary" /> Mantenimiento
          </h3>
          <div className="glass-card p-5 space-y-4">
            <div className="space-y-1.5">
              <Label className="text-[11px] uppercase font-black text-primary">Periodo de retención</Label>
              <p className="text-[10px] text-muted-foreground">Las tareas completadas nunca se borran solas. Elige a partir de qué antigüedad se pueden limpiar manualmente.</p>
              <Select value={taskRetentionPeriod} onValueChange={(value) => setTaskRetentionPeriod(value as TaskRetentionPeriod)}>
                <SelectTrigger className="w-full bg-muted/30 border-border h-11 rounded-xl text-[10px] font-black uppercase tracking-widest">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-card border-border">
                  <SelectItem value="weekly" className="text-[10px] font-black uppercase">Semanal (7 días)</SelectItem>
                  <SelectItem value="monthly" className="text-[10px] font-black uppercase">Mensual (30 días)</SelectItem>
                  <SelectItem value="quarterly" className="text-[10px] font-black uppercase">Trimestral (90 días)</SelectItem>
                  <SelectItem value="yearly" className="text-[10px] font-black uppercase">Anual (365 días)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button onClick={handleCleanupNow} disabled={isCleaning} variant="outline" className="w-full h-11 rounded-xl border-border bg-muted/20 text-[9px] font-black uppercase tracking-widest gap-2 hover:bg-muted/40">
              {isCleaning ? <RefreshCcw className="w-4 h-4 animate-spin text-primary" /> : <Trash2 className="w-4 h-4 text-primary" />}
              Limpiar tareas completadas ahora
            </Button>
          </div>
        </section>
      </div>

      <section className="space-y-3">
        <h3 className="text-[11px] uppercase font-black text-muted-foreground tracking-[0.3em] flex items-center gap-2">
          <Palette className="w-3.5 h-3.5 text-primary" /> Apariencia y Estilo
        </h3>
        <div className="glass-card p-5 space-y-8">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="space-y-4">
              <Label className="text-[11px] uppercase font-black text-primary tracking-widest">Modo de Color</Label>
              <div className="flex p-1 bg-muted/30 border border-border rounded-2xl h-14">
                <button
                  onClick={() => setColorMode("dark")}
                  className={`flex-1 flex items-center justify-center gap-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${
                    colorMode === "dark" ? "bg-primary text-primary-foreground shadow-lg" : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <Fingerprint className="w-4 h-4" /> Dark Mode
                </button>
                <button
                  onClick={() => setColorMode("light")}
                  className={`flex-1 flex items-center justify-center gap-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${
                    colorMode === "light" ? "bg-foreground text-background shadow-lg" : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <Zap className="w-4 h-4" /> Light Mode
                </button>
              </div>
            </div>

            <div className="space-y-4">
              <Label className="text-[11px] uppercase font-black text-primary tracking-widest">Tema del Sistema</Label>
              <Select value={theme} onValueChange={(value) => setTheme(value as AppTheme)}>
                <SelectTrigger className="bg-muted/30 border-border h-14 rounded-2xl text-[11px] font-black uppercase tracking-wider px-4">
                  <div className="flex items-center gap-3">
                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: THEME_OPTIONS.find(o => o.value === theme)?.color }} />
                    <SelectValue />
                  </div>
                </SelectTrigger>
                <SelectContent className="bg-card border-border">
                  {THEME_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value} className="text-[11px] font-black uppercase tracking-wider py-3">
                      <div className="flex items-center gap-2">
                        <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: option.color }} />
                        {option.label}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-4">
            <Label className="text-[11px] uppercase font-black text-muted-foreground/50 tracking-widest">Paleta de Colores Expandida</Label>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
              {THEME_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  onClick={() => setTheme(option.value)}
                  className={`relative flex flex-col items-center gap-3 rounded-2xl border p-4 transition-all ${
                    theme === option.value
                      ? "border-primary bg-primary/10 shadow-[0_0_20px_hsl(var(--primary)/0.15)]"
                      : "border-border bg-muted/20 hover:bg-muted/40"
                  }`}
                >
                  <div 
                    className="w-8 h-8 rounded-full shadow-inner flex items-center justify-center border-4 border-black/5" 
                    style={{ backgroundColor: option.color }}
                  >
                    {theme === option.value && <Check className="w-4 h-4 text-white font-bold" />}
                  </div>
                  <div className="text-center">
                    <p className={`text-[9px] font-black uppercase tracking-widest ${theme === option.value ? 'text-primary' : 'text-muted-foreground'}`}>
                      {option.label}
                    </p>
                    <p className="text-[8px] text-muted-foreground/40 lowercase tracking-normal mt-0.5">{option.hint}</p>
                  </div>
                </button>
              ))}
            </div>
          </div>

          <div className="border-t border-border pt-6 space-y-6">
            <div className="flex items-center gap-2">
              <Zap className="w-4 h-4 text-primary" />
              <h4 className="text-[11px] uppercase font-black tracking-widest">Preferencias Visuales</h4>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-6">
              <PreferenceToggle 
                label="Efectos de Brillo (Glow)" 
                description="Habilita resplandores neón en tarjetas e indicadores."
                active={visualConfig.glowEnabled}
                onToggle={() => updateVisualConfig({ glowEnabled: !visualConfig.glowEnabled })}
              />
              <PreferenceToggle 
                label="Rejilla de Fondo" 
                description="Muestra un patrón técnico de red en el fondo."
                active={visualConfig.showGrid}
                onToggle={() => updateVisualConfig({ showGrid: !visualConfig.showGrid })}
              />
              <PreferenceToggle 
                label="Modo Compacto" 
                description="Reduce espaciado para ver más contenido a la vez."
                active={visualConfig.compactMode}
                onToggle={() => updateVisualConfig({ compactMode: !visualConfig.compactMode })}
              />
              <div className="flex items-center justify-between group">
                <div className="space-y-0.5">
                  <p className="text-xs font-bold">Opacidad Glass</p>
                  <p className="text-[10px] text-muted-foreground">Controla la transparencia de las tarjetas.</p>
                </div>
                <div className="flex items-center gap-3 bg-muted/30 p-1.5 rounded-xl border border-border">
                   {[0.4, 0.6, 0.8, 1.0].map((v) => (
                     <button
                       key={v}
                       onClick={() => updateVisualConfig({ glassIntensity: v })}
                       className={`w-8 h-8 rounded-lg text-[9px] font-black transition-all ${
                         visualConfig.glassIntensity === v ? "bg-primary text-primary-foreground" : "hover:bg-primary/10 text-muted-foreground"
                       }`}
                     >
                       {v * 100}%
                     </button>
                   ))}
                </div>
              </div>
            </div>
          </div>

          <div className="border-t border-border pt-6 grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="space-y-1.5">
              <Label className="text-[11px] uppercase font-black text-primary tracking-widest">Formato de Hora</Label>
              <Select value={hourFormat} onValueChange={(value) => setHourFormat(value as any)}>
                <SelectTrigger className="bg-muted/30 border-border h-12 rounded-xl text-[11px] font-black uppercase tracking-wider">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-card border-border">
                  <SelectItem value="24h" className="text-[11px] font-black uppercase tracking-wider">24 Horas</SelectItem>
                  <SelectItem value="12h" className="text-[11px] font-black uppercase tracking-wider">12 Horas (AM/PM)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-[11px] uppercase font-black text-primary tracking-widest">Página de Inicio</Label>
              <Select value={defaultPage} onValueChange={(value) => setDefaultPage(value)}>
                <SelectTrigger className="bg-muted/30 border-border h-12 rounded-xl text-[11px] font-black uppercase tracking-wider">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-card border-border">
                  <SelectItem value="/" className="text-[11px] font-black uppercase tracking-wider">Dashboard</SelectItem>
                  <SelectItem value="/kanban" className="text-[11px] font-black uppercase tracking-wider">Kanban</SelectItem>
                  <SelectItem value="/schedule" className="text-[11px] font-black uppercase tracking-wider">Horario</SelectItem>
                  <SelectItem value="/tickets" className="text-[11px] font-black uppercase tracking-wider">Tickets</SelectItem>
                  <SelectItem value="/notes" className="text-[11px] font-black uppercase tracking-wider">Notas</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
      </section>

      <section className="space-y-3">
        <h3 className="text-[11px] uppercase font-black text-muted-foreground tracking-[0.3em] flex items-center gap-2">
          <Bell className="w-3.5 h-3.5 text-primary" /> Notificaciones
        </h3>
        <div className="glass-card p-5 space-y-3">
          <p className="text-[11px] text-muted-foreground">
            Configura aqui los permisos para alertas del navegador y la integracion con la app Android.
          </p>
          <NotificationSetup className="h-11 rounded-xl text-[10px] tracking-[0.2em]" />
        </div>
      </section>
    </div>
  );
}

function ModuleToggle({ label, active, onToggle }: { label: string; active: boolean; onToggle: () => void }) {
  return (
    <div className="flex items-center justify-between group">
      <div className="space-y-0.5">
        <p className="text-xs font-bold group-hover:text-primary transition-colors">{label}</p>
        <p className="text-[11px] text-muted-foreground uppercase font-data">{active ? "En línea" : "Desconectado"}</p>
      </div>
      <Switch checked={active} onCheckedChange={onToggle} className="scale-75" />
    </div>
  );
}

function PreferenceToggle({ label, description, active, onToggle }: { label: string; description: string; active: boolean; onToggle: () => void }) {
  return (
    <div className="flex items-center justify-between group">
      <div className="space-y-0.5">
        <p className="text-xs font-bold group-hover:text-primary transition-colors">{label}</p>
        <p className="text-[10px] text-muted-foreground">{description}</p>
      </div>
      <Switch checked={active} onCheckedChange={onToggle} className="scale-75" />
    </div>
  );
}
