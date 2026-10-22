"use client";

import Link from "next/link";
import { Check, ChevronDown, Settings2 } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useActiveContext, useContexts } from "@/firebase/user-data";
import { getContextIcon } from "@/lib/contexts";
import { useAppContextStore } from "@/lib/store";

/** Selector del contexto activo: filtra tareas, notas, rutinas y proyectos en toda la app. */
export function ContextSwitcher() {
  const setContext = useAppContextStore((state) => state.setContext);
  const { data: contexts } = useContexts();
  const active = useActiveContext();
  const ActiveIcon = getContextIcon(active.icon);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className="flex items-center gap-2 rounded-full border border-border bg-muted/30 py-1.5 pl-2.5 pr-2 text-xs font-semibold text-foreground transition-colors hover:bg-muted/50 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring max-w-[11rem]"
        aria-label={`Contexto: ${active.name}. Cambiar contexto`}
      >
        <ActiveIcon className="h-3.5 w-3.5 shrink-0" style={{ color: active.color }} />
        <span className="truncate">{active.name}</span>
        <ChevronDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56 rounded-2xl border-border bg-card p-1.5">
        <DropdownMenuLabel className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
          Contexto
        </DropdownMenuLabel>
        {contexts.map((item) => {
          const Icon = getContextIcon(item.icon);
          return (
            <DropdownMenuItem
              key={item.id}
              onSelect={() => setContext(item.id)}
              className="flex items-center gap-2.5 rounded-xl py-2.5"
            >
              <Icon className="h-4 w-4 shrink-0" style={{ color: item.color }} />
              <span className="flex-1 truncate">{item.name}</span>
              {item.id === active.id && <Check className="h-4 w-4 text-primary" />}
            </DropdownMenuItem>
          );
        })}
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild className="rounded-xl py-2.5 text-muted-foreground">
          <Link href="/settings#contextos" className="flex items-center gap-2.5">
            <Settings2 className="h-4 w-4" />
            Gestionar contextos
          </Link>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
