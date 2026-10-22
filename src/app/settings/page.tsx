"use client";

import { useState } from "react";
import {
  Bell, Check, Compass, Info, Fingerprint, Layers, LogOut, Monitor, Moon, Palette, RefreshCcw, Shield, SlidersHorizontal, Sun, Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useUser, useAuth, useFirestore } from "@/firebase";
import { useAppContextStore } from "@/lib/store";
import type { AppTheme, HourFormat, TaskRetentionPeriod } from "@/lib/store";
import { cn } from "@/lib/utils";
import { toast } from "@/hooks/use-toast";
import { logoutUser } from "@/services/user-service";
import { cleanupCompletedTasks } from "@/services/task-service";
import { NotificationSetup } from "@/components/notification-setup";
import { ContextsManager } from "@/components/settings/contexts-manager";
import { NavigationSettings } from "@/components/settings/navigation-settings";
import { AboutSection } from "@/components/settings/about-section";
import { ExportDataButton } from "@/components/settings/export-data-button";
import { Segmented, SettingRow, SettingSwitch, SettingsSection } from "@/components/settings/settings-ui";

const THEME_OPTIONS: { value: Exclude<AppTheme, "custom">; label: string; color: string }[] = [
  { value: "neon", label: "Verde", color: "#22c55e" },
  { value: "emerald", label: "Esmeralda", color: "#10b981" },
  { value: "cyan", label: "Cyan", color: "#06b6d4" },
  { value: "indigo", label: "Índigo", color: "#6366f1" },
  { value: "violet", label: "Violeta", color: "#8b5cf6" },
  { value: "rose", label: "Rosa", color: "#f43f5e" },
  { value: "crimson", label: "Carmesí", color: "#dc2626" },
  { value: "amber", label: "Ámbar", color: "#f59e0b" },
  { value: "slate", label: "Pizarra", color: "#64748b" },
];

const FONT_SCALES = [
  { value: 0.9, label: "A−" },
  { value: 1, label: "A" },
  { value: 1.1, label: "A+" },
  { value: 1.2, label: "A++" },
];

export default function SettingsPage() {
  const { user } = useUser();
  const auth = useAuth();
  const firestore = useFirestore();
  const {
    theme, setTheme,
    colorMode, setColorMode,
    customAccent, accentFromContext, pureBlack, fontScale, reduceMotion, haptics, updateAppearance,
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

  const handleCleanupNow = async () => {
    if (!user) return;
    setIsCleaning(true);
    try {
      const deletedCount = await cleanupCompletedTasks(firestore, user.uid, taskRetentionPeriod);
      toast({
        variant: "success",
        title: deletedCount > 0 ? "Limpieza completada" : "Nada que limpiar",
        description: deletedCount > 0 ? `Se eliminaron ${deletedCount} tarea(s) completadas.` : "No hay tareas completadas fuera del periodo elegido.",
      });
    } catch (error) {
      console.error("Error al limpiar tareas completadas:", error);
      toast({ variant: "destructive", title: "Error", description: "No se pudo completar la limpieza." });
    } finally {
      setIsCleaning(false);
    }
  };

  return (
    <div className="mx-auto w-full max-w-3xl space-y-8 pb-12">
      <div className="flex items-center justify-between gap-4">
        <div className="min-w-0 space-y-1">
          <h2 className="text-2xl font-black tracking-tight md:text-3xl">Ajustes</h2>
          {user?.email && (
            <p className="flex items-center gap-2 truncate text-xs text-muted-foreground">
              <Fingerprint className="h-3.5 w-3.5 shrink-0 text-primary/60" />
              <span className="truncate font-data">{user.email}</span>
            </p>
          )}
        </div>
        <Button onClick={handleLogout} variant="outline" className="shrink-0 gap-2 rounded-xl text-xs font-bold">
          <LogOut className="h-4 w-4" /> Salir
        </Button>
      </div>

      <SettingsSection id="contextos" icon={<Layers className="h-3.5 w-3.5 text-primary" />} title="Contextos">
        <ContextsManager />
      </SettingsSection>

      <SettingsSection id="apariencia" icon={<Palette className="h-3.5 w-3.5 text-primary" />} title="Apariencia">
        <div className="glass-card divide-y divide-border">
          <SettingRow label="Modo" stacked>
            <Segmented
              ariaLabel="Modo de color"
              value={colorMode}
              onChange={setColorMode}
              options={[
                { value: "dark", label: <><Moon className="h-3.5 w-3.5" /> Oscuro</> },
                { value: "light", label: <><Sun className="h-3.5 w-3.5" /> Claro</> },
                { value: "system", label: <><Monitor className="h-3.5 w-3.5" /> Sistema</> },
              ]}
            />
          </SettingRow>

          <div className="space-y-3 p-4">
            <div className="space-y-0.5">
              <p className="text-sm font-semibold">Color de acento</p>
              <p className="text-[11px] text-muted-foreground">
                {accentFromContext ? "Se usa el color del contexto activo." : "Botones, selección y detalles destacados."}
              </p>
            </div>
            <div className={cn("flex flex-wrap gap-2.5", accentFromContext && "pointer-events-none opacity-40")}>
              {THEME_OPTIONS.map((option) => (
                <AccentSwatch
                  key={option.value}
                  color={option.color}
                  label={option.label}
                  selected={theme === option.value}
                  onClick={() => setTheme(option.value)}
                />
              ))}
              <label
                className={cn(
                  "relative flex h-9 w-9 cursor-pointer items-center justify-center rounded-full border-2",
                  theme === "custom" ? "border-foreground" : "border-dashed border-muted-foreground/40"
                )}
                style={theme === "custom" ? { backgroundColor: customAccent } : undefined}
                title="Color personalizado"
              >
                {theme === "custom" ? <Check className="h-4 w-4 text-white mix-blend-difference" /> : <Palette className="h-4 w-4 text-muted-foreground" />}
                <input
                  type="color"
                  value={customAccent}
                  aria-label="Color personalizado"
                  onChange={(event) => {
                    updateAppearance({ customAccent: event.target.value });
                    setTheme("custom");
                  }}
                  className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
                />
              </label>
            </div>
          </div>

          <SettingSwitch
            label="Acento según el contexto"
            description="Cada contexto tiñe la app con su propio color."
            checked={accentFromContext}
            onCheckedChange={(checked) => updateAppearance({ accentFromContext: checked })}
          />
          <SettingSwitch
            label="Negro puro"
            description="Fondo totalmente negro en modo oscuro; ahorra batería en pantallas AMOLED."
            checked={pureBlack}
            onCheckedChange={(checked) => updateAppearance({ pureBlack: checked })}
          />
          <SettingRow label="Tamaño del texto" stacked>
            <Segmented
              ariaLabel="Tamaño del texto"
              value={fontScale}
              onChange={(value) => updateAppearance({ fontScale: value })}
              options={FONT_SCALES}
            />
          </SettingRow>
          <SettingSwitch
            label="Reducir movimiento"
            description="Quita animaciones y transiciones."
            checked={reduceMotion}
            onCheckedChange={(checked) => updateAppearance({ reduceMotion: checked })}
          />
          <SettingSwitch
            label="Vibración"
            description="Vibración corta al completar o borrar (en el teléfono)."
            checked={haptics}
            onCheckedChange={(checked) => updateAppearance({ haptics: checked })}
          />
          <SettingSwitch
            label="Modo compacto"
            description="Menos espacio entre elementos para ver más a la vez."
            checked={visualConfig.compactMode}
            onCheckedChange={(checked) => updateVisualConfig({ compactMode: checked })}
          />

          <details className="group">
            <summary className="flex cursor-pointer list-none items-center justify-between p-4 text-sm font-semibold">
              <span className="flex items-center gap-2">
                <SlidersHorizontal className="h-4 w-4 text-muted-foreground" /> Efectos visuales
              </span>
              <span className="text-[11px] font-normal text-muted-foreground group-open:hidden">Brillo, rejilla y transparencia</span>
            </summary>
            <div className="divide-y divide-border border-t border-border">
              <SettingSwitch
                label="Efectos de brillo"
                description="Resplandor en tarjetas e indicadores."
                checked={visualConfig.glowEnabled}
                onCheckedChange={(checked) => updateVisualConfig({ glowEnabled: checked })}
              />
              <SettingSwitch
                label="Rejilla de fondo"
                description="Patrón técnico detrás del contenido."
                checked={visualConfig.showGrid}
                onCheckedChange={(checked) => updateVisualConfig({ showGrid: checked })}
              />
              <SettingRow label="Opacidad de tarjetas" stacked>
                <Segmented
                  ariaLabel="Opacidad de tarjetas"
                  value={visualConfig.glassIntensity}
                  onChange={(value) => updateVisualConfig({ glassIntensity: value })}
                  options={[0.4, 0.6, 0.8, 1].map((value) => ({ value, label: `${value * 100}%` }))}
                />
              </SettingRow>
            </div>
          </details>
        </div>
      </SettingsSection>

      <SettingsSection id="navegacion" icon={<Compass className="h-3.5 w-3.5 text-primary" />} title="Navegación">
        <NavigationSettings />
        <div className="glass-card divide-y divide-border">
          <SettingRow label="Página de inicio" description="Lo primero que ves al abrir la app." stacked>
            <Select value={defaultPage} onValueChange={setDefaultPage}>
              <SelectTrigger className="h-10 w-full rounded-xl border-border bg-muted/30 sm:w-44">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="border-border bg-card">
                <SelectItem value="/">Inicio</SelectItem>
                <SelectItem value="/kanban">Tablero</SelectItem>
                <SelectItem value="/schedule">Horario</SelectItem>
                <SelectItem value="/tickets">Tickets</SelectItem>
                <SelectItem value="/notes">Notas</SelectItem>
              </SelectContent>
            </Select>
          </SettingRow>
          <SettingRow label="Formato de hora" stacked>
            <Segmented<HourFormat>
              ariaLabel="Formato de hora"
              value={hourFormat}
              onChange={setHourFormat}
              options={[
                { value: "24h", label: "24 h" },
                { value: "12h", label: "12 h" },
              ]}
            />
          </SettingRow>
        </div>
      </SettingsSection>

      <SettingsSection id="mantenimiento" icon={<Shield className="h-3.5 w-3.5 text-primary" />} title="Mantenimiento">
        <div className="glass-card divide-y divide-border">
          <SettingRow
            label="Antigüedad para limpiar"
            description="Las tareas completadas nunca se borran solas; elige desde cuándo se pueden limpiar."
            stacked
          >
            <Select value={taskRetentionPeriod} onValueChange={(value) => setTaskRetentionPeriod(value as TaskRetentionPeriod)}>
              <SelectTrigger className="h-10 w-full rounded-xl border-border bg-muted/30 sm:w-44">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="border-border bg-card">
                <SelectItem value="weekly">7 días</SelectItem>
                <SelectItem value="monthly">30 días</SelectItem>
                <SelectItem value="quarterly">90 días</SelectItem>
                <SelectItem value="yearly">365 días</SelectItem>
              </SelectContent>
            </Select>
          </SettingRow>
          <div className="p-4">
            <Button onClick={handleCleanupNow} disabled={isCleaning} variant="outline" className="h-10 w-full gap-2 rounded-xl text-xs font-bold">
              {isCleaning ? <RefreshCcw className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
              Limpiar tareas completadas ahora
            </Button>
          </div>
          <div className="space-y-2 p-4">
            <p className="text-[11px] text-muted-foreground">Copia de seguridad con tus contextos, tareas, proyectos, notas y rutinas.</p>
            <ExportDataButton />
          </div>
        </div>
      </SettingsSection>

      <SettingsSection id="notificaciones" icon={<Bell className="h-3.5 w-3.5 text-primary" />} title="Notificaciones">
        <div className="glass-card space-y-3 p-4">
          <p className="text-[11px] text-muted-foreground">Permisos para alertas del navegador y la app Android.</p>
          <NotificationSetup className="h-10 rounded-xl text-[10px] tracking-[0.2em]" />
        </div>
      </SettingsSection>

      <SettingsSection id="acerca" icon={<Info className="h-3.5 w-3.5 text-primary" />} title="Acerca de">
        <AboutSection />
      </SettingsSection>
    </div>
  );
}

function AccentSwatch({ color, label, selected, onClick }: { color: string; label: string; selected: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      title={label}
      aria-label={`Acento ${label}`}
      aria-pressed={selected}
      onClick={onClick}
      className={cn(
        "flex h-9 w-9 items-center justify-center rounded-full border-2 transition-transform",
        selected ? "scale-110 border-foreground" : "border-transparent hover:scale-105"
      )}
      style={{ backgroundColor: color }}
    >
      {selected && <Check className="h-4 w-4 text-white" />}
    </button>
  );
}
