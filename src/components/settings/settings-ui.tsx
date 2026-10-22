"use client";

import type { ReactNode } from "react";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";

/** Sección de Ajustes con título pequeño y ancla para enlazarla (#id). */
export function SettingsSection({
  id,
  icon,
  title,
  children,
}: {
  id: string;
  icon: ReactNode;
  title: string;
  children: ReactNode;
}) {
  return (
    <section id={id} className="space-y-3 scroll-mt-24">
      <h3 className="flex items-center gap-2 text-[11px] font-black uppercase tracking-[0.3em] text-muted-foreground">
        {icon} {title}
      </h3>
      {children}
    </section>
  );
}

/** Fila de ajuste: etiqueta + descripción a la izquierda y el control a la derecha. */
export function SettingRow({
  label,
  description,
  children,
  stacked = false,
}: {
  label: string;
  description?: string;
  children: ReactNode;
  /** En pantallas chicas el control va debajo de la etiqueta. */
  stacked?: boolean;
}) {
  return (
    <div className={cn("flex gap-3 p-4", stacked ? "flex-col sm:flex-row sm:items-center sm:justify-between" : "items-center justify-between")}>
      <div className="min-w-0 space-y-0.5">
        <p className="text-sm font-semibold">{label}</p>
        {description && <p className="text-[11px] text-muted-foreground">{description}</p>}
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  );
}

export function SettingSwitch({
  label,
  description,
  checked,
  onCheckedChange,
}: {
  label: string;
  description?: string;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
}) {
  return (
    <SettingRow label={label} description={description}>
      <Switch checked={checked} onCheckedChange={onCheckedChange} aria-label={label} />
    </SettingRow>
  );
}

/** Control segmentado (varias opciones excluyentes en una píldora). */
export function Segmented<T extends string | number>({
  value,
  options,
  onChange,
  ariaLabel,
}: {
  value: T;
  options: { value: T; label: ReactNode }[];
  onChange: (value: T) => void;
  ariaLabel: string;
}) {
  return (
    <div role="radiogroup" aria-label={ariaLabel} className="flex rounded-xl border border-border bg-muted/30 p-1">
      {options.map((option) => (
        <button
          key={String(option.value)}
          type="button"
          role="radio"
          aria-checked={value === option.value}
          onClick={() => onChange(option.value)}
          className={cn(
            "flex min-w-[3rem] flex-1 items-center justify-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors",
            value === option.value ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
          )}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
