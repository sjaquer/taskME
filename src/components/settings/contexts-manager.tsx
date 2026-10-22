"use client";

import { useMemo, useState } from "react";
import { ArrowDown, ArrowUp, Pencil, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Field, FormPanel, SubmitButton, fieldInputClassName } from "@/components/forms/form-fields";
import { toastWithUndo } from "@/components/undo-toast";
import { useFirestore, useUser } from "@/firebase/provider";
import { useContexts, useHasStoredContexts, useNotes, useProjects, useRoutines, useTasks } from "@/firebase/user-data";
import { toast } from "@/hooks/use-toast";
import { CONTEXT_COLORS, CONTEXT_ICONS, MAX_CONTEXTS, getContextIcon } from "@/lib/contexts";
import { contextDefSchema } from "@/lib/schemas";
import { useAppContextStore } from "@/lib/store";
import { cn } from "@/lib/utils";
import { createContext, deleteContext, persistContexts, updateContext } from "@/services/context-service";
import type { ContextDef } from "@/types/task";

interface ContextForm {
  name: string;
  color: string;
  icon: string;
}

const INITIAL_FORM: ContextForm = { name: "", color: CONTEXT_COLORS[2], icon: "sparkles" };

/** Crear, editar, ordenar y borrar contextos, y elegir dónde caen los tickets. */
export function ContextsManager() {
  const firestore = useFirestore();
  const { user } = useUser();
  const { data: contexts } = useContexts();
  const isStored = useHasStoredContexts();
  const { context: activeContextId, setContext, ticketsContext, setTicketsContext } = useAppContextStore();

  const { data: tasks } = useTasks();
  const { data: notes } = useNotes();
  const { data: routines } = useRoutines();
  const { data: projects } = useProjects();

  const [form, setForm] = useState<ContextForm>(INITIAL_FORM);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);

  // Cantidad de elementos por contexto: un contexto con datos no se puede borrar.
  const usage = useMemo(() => {
    const counts = new Map<string, number>();
    [...tasks, ...notes, ...routines, ...projects].forEach((item) => {
      counts.set(item.context, (counts.get(item.context) ?? 0) + 1);
    });
    return counts;
  }, [tasks, notes, routines, projects]);

  if (!user) return null;

  // Mientras solo existan los contextos de fábrica en memoria, cualquier cambio
  // guarda la lista completa para no perder ninguno.
  const saveList = (list: ContextDef[]) =>
    persistContexts(firestore, user.uid, list.map((item, index) => ({ ...item, order: index }))).catch((error) => {
      console.error("Error al guardar contextos:", error);
      toast({ variant: "destructive", title: "Error", description: "No se pudieron guardar los contextos." });
    });

  const openCreate = () => {
    setEditingId(null);
    setForm(INITIAL_FORM);
    setFormOpen(true);
  };

  const openEdit = (item: ContextDef) => {
    setEditingId(item.id);
    setForm({ name: item.name, color: item.color, icon: item.icon });
    setFormOpen(true);
  };

  const closeForm = () => {
    setFormOpen(false);
    setEditingId(null);
    setForm(INITIAL_FORM);
  };

  const handleSubmit = async () => {
    const result = contextDefSchema.safeParse(form);
    if (!result.success) {
      toast({ variant: "destructive", title: "Error", description: result.error.errors[0].message });
      return;
    }
    const duplicate = contexts.some(
      (item) => item.id !== editingId && item.name.toLowerCase() === result.data.name.toLowerCase()
    );
    if (duplicate) {
      toast({ variant: "destructive", title: "Nombre repetido", description: "Ya tienes un contexto con ese nombre." });
      return;
    }

    if (editingId) {
      if (isStored) {
        updateContext(firestore, user.uid, editingId, result.data);
      } else {
        await saveList(contexts.map((item) => (item.id === editingId ? { ...item, ...result.data } : item)));
      }
      toast({ variant: "success", title: "Contexto actualizado" });
    } else {
      if (contexts.length >= MAX_CONTEXTS) {
        toast({ variant: "destructive", title: "Límite alcanzado", description: `Puedes tener hasta ${MAX_CONTEXTS} contextos.` });
        return;
      }
      if (!isStored) await saveList(contexts);
      createContext(firestore, user.uid, { ...result.data, order: contexts.length });
      toast({ variant: "success", title: "Contexto creado", description: "Elígelo desde el selector de la cabecera." });
    }
    closeForm();
  };

  const handleMove = (index: number, direction: -1 | 1) => {
    const target = index + direction;
    if (target < 0 || target >= contexts.length) return;
    const reordered = [...contexts];
    [reordered[index], reordered[target]] = [reordered[target], reordered[index]];

    if (!isStored) {
      saveList(reordered);
      return;
    }
    reordered.forEach((item, order) => {
      if (item.order !== order) updateContext(firestore, user.uid, item.id, { order });
    });
  };

  const getDeleteBlocker = (item: ContextDef): string | null => {
    if (contexts.length <= 1) return "Debe quedar al menos un contexto.";
    if (item.id === ticketsContext) return "Es el contexto donde llegan los tickets.";
    const count = usage.get(item.id) ?? 0;
    if (count > 0) return `Tiene ${count} elemento(s). Muévelos o bórralos primero.`;
    return null;
  };

  const handleDelete = (item: ContextDef) => {
    const blocker = getDeleteBlocker(item);
    if (blocker) {
      toast({ variant: "warning", title: "No se puede borrar", description: blocker });
      return;
    }

    const remaining = contexts.filter((other) => other.id !== item.id);
    if (activeContextId === item.id) setContext(remaining[0].id);

    if (!isStored) {
      saveList(remaining);
    } else {
      deleteContext(firestore, user.uid, item.id);
    }
    toastWithUndo({
      title: "Contexto eliminado",
      description: item.name,
      onUndo: () => updateContext(firestore, user.uid, item.id, { name: item.name, color: item.color, icon: item.icon, order: item.order }),
    });
  };

  return (
    <div className="space-y-4">
      <div className="glass-card divide-y divide-border">
        {contexts.map((item, index) => {
          const Icon = getContextIcon(item.icon);
          const count = usage.get(item.id) ?? 0;
          return (
            <div key={item.id} className="flex items-center gap-3 p-3 sm:p-4">
              <span
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-border"
                style={{ backgroundColor: `${item.color}1a` }}
              >
                <Icon className="h-4 w-4" style={{ color: item.color }} />
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-bold">{item.name}</p>
                <p className="text-[11px] text-muted-foreground">
                  {count === 0 ? "Sin elementos" : `${count} elemento(s)`}
                  {item.id === ticketsContext && " · recibe tickets"}
                </p>
              </div>
              <div className="flex items-center gap-1">
                <IconButton label={`Subir ${item.name}`} onClick={() => handleMove(index, -1)} disabled={index === 0}>
                  <ArrowUp className="h-3.5 w-3.5" />
                </IconButton>
                <IconButton label={`Bajar ${item.name}`} onClick={() => handleMove(index, 1)} disabled={index === contexts.length - 1}>
                  <ArrowDown className="h-3.5 w-3.5" />
                </IconButton>
                <IconButton label={`Editar ${item.name}`} onClick={() => openEdit(item)}>
                  <Pencil className="h-3.5 w-3.5" />
                </IconButton>
                <IconButton label={`Borrar ${item.name}`} onClick={() => handleDelete(item)} className="hover:text-red-400">
                  <Trash2 className="h-3.5 w-3.5" />
                </IconButton>
              </div>
            </div>
          );
        })}
      </div>

      {formOpen ? (
        <FormPanel title={editingId ? "Editar contexto" : "Nuevo contexto"} onClose={closeForm}>
          <Field label="Nombre">
            <Input
              value={form.name}
              onChange={(event) => setForm({ ...form, name: event.target.value })}
              placeholder="Ej. Personal, Gimnasio, Freelance..."
              maxLength={40}
              className={fieldInputClassName}
            />
          </Field>
          <Field label="Color">
            <div className="flex flex-wrap gap-2">
              {CONTEXT_COLORS.map((color) => (
                <button
                  key={color}
                  type="button"
                  aria-label={`Color ${color}`}
                  aria-pressed={form.color === color}
                  onClick={() => setForm({ ...form, color })}
                  className={cn(
                    "h-8 w-8 rounded-full border-2 transition-all",
                    form.color === color ? "border-foreground scale-110" : "border-transparent opacity-70 hover:opacity-100"
                  )}
                  style={{ backgroundColor: color }}
                />
              ))}
            </div>
          </Field>
          <Field label="Icono">
            <div className="grid grid-cols-6 gap-2">
              {Object.entries(CONTEXT_ICONS).map(([key, Icon]) => (
                <button
                  key={key}
                  type="button"
                  aria-label={`Icono ${key}`}
                  aria-pressed={form.icon === key}
                  onClick={() => setForm({ ...form, icon: key })}
                  className={cn(
                    "flex h-10 items-center justify-center rounded-xl border transition-colors",
                    form.icon === key ? "border-primary bg-primary/10" : "border-border bg-muted/20 hover:bg-muted/40"
                  )}
                >
                  <Icon className="h-4 w-4" style={{ color: form.icon === key ? form.color : undefined }} />
                </button>
              ))}
            </div>
          </Field>
          <SubmitButton onClick={handleSubmit}>{editingId ? "Guardar cambios" : "Crear contexto"}</SubmitButton>
        </FormPanel>
      ) : (
        <Button
          type="button"
          variant="outline"
          onClick={openCreate}
          disabled={contexts.length >= MAX_CONTEXTS}
          className="h-11 w-full rounded-xl border-dashed border-border bg-transparent text-xs font-bold"
        >
          <Plus className="mr-2 h-4 w-4" /> Nuevo contexto
        </Button>
      )}

      <div className="glass-card flex flex-col gap-2 p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-0.5">
          <p className="text-xs font-bold">Contexto de los tickets</p>
          <p className="text-[11px] text-muted-foreground">Dónde se guardan los tickets, también los del formulario público.</p>
        </div>
        <Select value={ticketsContext} onValueChange={setTicketsContext}>
          <SelectTrigger className="h-10 w-full rounded-xl border-border bg-muted/30 sm:w-48">
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="border-border bg-card">
            {contexts.map((item) => (
              <SelectItem key={item.id} value={item.id}>
                {item.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}

function IconButton({
  label,
  onClick,
  disabled,
  className,
  children,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted/40 hover:text-foreground disabled:pointer-events-none disabled:opacity-30",
        className
      )}
    >
      {children}
    </button>
  );
}
