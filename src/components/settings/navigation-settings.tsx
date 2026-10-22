"use client";

import { ArrowDown, ArrowUp } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { NAV_MODULES, normalizeNavOrder } from "@/lib/navigation";
import { useAppContextStore } from "@/lib/store";

/** Qué secciones aparecen en la barra de navegación y en qué orden. */
export function NavigationSettings() {
  const { activeModules, toggleModule, navOrder, setNavOrder } = useAppContextStore();
  const order = normalizeNavOrder(navOrder);

  const move = (index: number, direction: -1 | 1) => {
    const target = index + direction;
    if (target < 0 || target >= order.length) return;
    const next = [...order];
    [next[index], next[target]] = [next[target], next[index]];
    setNavOrder(next);
  };

  return (
    <div className="glass-card divide-y divide-border">
      {order.map((key, index) => {
        const item = NAV_MODULES[key];
        return (
          <div key={key} className="flex items-center gap-3 px-4 py-3">
            <item.icon className="h-4 w-4 shrink-0 text-muted-foreground" />
            <span className="flex-1 text-sm font-semibold">{item.label}</span>
            <button
              type="button"
              aria-label={`Subir ${item.label}`}
              onClick={() => move(index, -1)}
              disabled={index === 0}
              className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted/40 disabled:opacity-30"
            >
              <ArrowUp className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              aria-label={`Bajar ${item.label}`}
              onClick={() => move(index, 1)}
              disabled={index === order.length - 1}
              className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted/40 disabled:opacity-30"
            >
              <ArrowDown className="h-3.5 w-3.5" />
            </button>
            <Switch
              checked={activeModules[key]}
              onCheckedChange={() => toggleModule(key)}
              aria-label={`Mostrar ${item.label}`}
            />
          </div>
        );
      })}
      <p className="px-4 py-3 text-[11px] text-muted-foreground">Ajustes siempre aparece al final.</p>
    </div>
  );
}
