"use client";

import { useState, useEffect } from "react";
import { AnimatePresence } from "framer-motion";
import { format, addDays, startOfWeek, isSameDay, getDay } from "date-fns";
import { es } from "date-fns/locale";
import { ChevronLeft, ChevronRight, Inbox } from "lucide-react";
import { useAppContextStore } from "@/lib/store";
import { haptic } from "@/lib/native-features";
import { cn } from "@/lib/utils";
import { routineSchema } from "@/lib/schemas";
import { findOverlappingRoutines } from "@/lib/tasks";
import { useFirestore, useUser } from "@/firebase/provider";
import { useActiveContext, useRoutines } from "@/firebase/user-data";
import { Input } from "@/components/ui/input";
import { Field, FormPanel, PrioritySelect, SubmitButton, fieldInputClassName } from "@/components/forms/form-fields";
import { toast } from "@/hooks/use-toast";
import { Skeleton } from "@/components/ui/skeleton";
import { ScheduleItem } from "@/components/molecules";
import { PageHeader } from "@/components/layout/page-header";
import { createRoutine, updateRoutine, deleteRoutine } from "@/services/routine-service";
import { restoreUserDocument } from "@/services/restore-service";
import { toastWithUndo } from "@/components/undo-toast";
import type { Routine, Priority, RoutineFormData } from "@/types/task";

const WEEK_DAYS = [
  { label: "L", value: 1 }, { label: "M", value: 2 }, { label: "X", value: 3 },
  { label: "J", value: 4 }, { label: "V", value: 5 }, { label: "S", value: 6 }, { label: "D", value: 0 },
];

const ROUTINE_COLORS = [
  { value: "#39FF14", label: "Verde" },
  { value: "#3B82F6", label: "Azul" },
  { value: "#A855F7", label: "Morado" },
  { value: "#F97316", label: "Naranja" },
  { value: "#EF4444", label: "Rojo" },
  { value: "#EC4899", label: "Rosa" },
  { value: "#EAB308", label: "Amarillo" },
];

const INITIAL_FORM: RoutineFormData = {
  title: "", startTime: "09:00", endTime: "10:00", priority: "media",
  recurringDays: [], color: "#39FF14",
};

export default function SchedulePage() {
  const { context } = useAppContextStore();
  const activeContext = useActiveContext();
  const { user, isUserLoading } = useUser();
  const firestore = useFirestore();

  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [currentTime, setCurrentTime] = useState(new Date());
  const [formOpen, setFormOpen] = useState(false);
  const [editingRoutine, setEditingRoutine] = useState<Routine | null>(null);
  const [formData, setFormData] = useState<RoutineFormData>(INITIAL_FORM);

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 30000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    setFormData(INITIAL_FORM);
    setEditingRoutine(null);
    setFormOpen(false);
  }, [context]);

  const weekStart = startOfWeek(selectedDate, { weekStartsOn: 1 });
  const days = [...Array(7)].map((_, i) => addDays(weekStart, i));
  const isCurrentWeek = isSameDay(weekStart, startOfWeek(new Date(), { weekStartsOn: 1 }));

  const { data: routines } = useRoutines(context);


  if (isUserLoading || !user) return (
    <div className="max-w-2xl mx-auto space-y-6 py-4 px-0">
      <Skeleton className="h-14 w-1/2 bg-muted/30 rounded-2xl" />
      <Skeleton className="h-20 bg-muted/30 rounded-2xl" />
      <Skeleton className="h-64 bg-muted/30 rounded-2xl" />
    </div>
  );

  const selectedDayNum = getDay(selectedDate);
  const dailyRoutines = routines
    .filter((r) => r.recurringDays?.includes(selectedDayNum))
    .sort((a, b) => (a.startTime ?? "").localeCompare(b.startTime ?? ""));

  const resetForm = () => { setFormData(INITIAL_FORM); setEditingRoutine(null); };

  const handleSaveRoutine = () => {
    const result = routineSchema.safeParse(formData);
    if (!result.success) {
      toast({ variant: "destructive", title: "Error", description: result.error.errors[0].message });
      return;
    }

    const routineData = {
      title: result.data.title,
      startTime: result.data.startTime,
      endTime: result.data.endTime,
      priority: result.data.priority as Priority,
      recurringDays: result.data.recurringDays,
      color: result.data.color,
      context,
    };

    if (editingRoutine) {
      updateRoutine(firestore, user.uid, editingRoutine.id, routineData);
    } else {
      createRoutine(firestore, user.uid, routineData);
    }

    // Se guarda igual, pero se avisa si choca con otra rutina del mismo contexto.
    const overlapping = findOverlappingRoutines({ ...routineData, id: editingRoutine?.id }, routines);
    resetForm();
    setFormOpen(false);
    if (overlapping.length > 0) {
      toast({
        variant: "warning",
        title: editingRoutine ? "Rutina actualizada, con choque de horario" : "Rutina creada, con choque de horario",
        description: `Se superpone con: ${overlapping.map((routine) => routine.title).join(", ")}.`,
      });
    } else {
      toast({ variant: "success", title: editingRoutine ? "Rutina actualizada" : "Rutina creada" });
    }
  };

  const openCreateForm = () => {
    resetForm();
    setFormOpen(true);
  };

  const openEditForm = (routine: Routine) => {
    setEditingRoutine(routine);
    setFormData({
      title: routine.title,
      startTime: routine.startTime || "09:00",
      endTime: routine.endTime || "10:00",
      priority: routine.priority || "media",
      recurringDays: routine.recurringDays || [],
      color: routine.color || "#39FF14",
    });
    setFormOpen(true);
  };

  const closeForm = () => {
    resetForm();
    setFormOpen(false);
  };

  const handleDeleteRoutine = (routineId: string) => {
    const deletedRoutine = routines.find((routine) => routine.id === routineId);
    haptic(25);
    deleteRoutine(firestore, user.uid, routineId);
    if (!deletedRoutine) {
      toast({ title: "Rutina eliminada", variant: "warning" });
      return;
    }
    toastWithUndo({
      title: "Rutina eliminada",
      description: deletedRoutine.title,
      onUndo: () => restoreUserDocument(firestore, user.uid, "routines", deletedRoutine),
    });
  };

  return (
    <div className="flex flex-col gap-6 max-w-2xl mx-auto pb-12 w-full">
      <PageHeader
        title="Horario"
        summary={`${dailyRoutines.length} ${dailyRoutines.length === 1 ? "bloque" : "bloques"} el ${format(selectedDate, "EEEE", { locale: es })} · ${activeContext.name}`}
        actionLabel={formOpen ? undefined : "Nueva"}
        onAction={openCreateForm}
      />

      {/* Formulario embebido (crear/editar) — sin modal */}
      {formOpen && (
        <FormPanel title={editingRoutine ? "Editar Rutina" : "Nueva Rutina"} onClose={closeForm}>
          <Field label="Nombre">
            <Input
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              placeholder="Ej: Gimnasio, Estudio, Reunión..."
              className={fieldInputClassName}
            />
          </Field>

          <Field label="Días de la semana">
            <div className="flex justify-between gap-1">
              {WEEK_DAYS.map((day) => (
                <button
                  key={day.value}
                  type="button"
                  aria-pressed={formData.recurringDays.includes(day.value)}
                  onClick={() => setFormData((prev) => ({
                    ...prev,
                    recurringDays: prev.recurringDays.includes(day.value)
                      ? prev.recurringDays.filter((d) => d !== day.value)
                      : [...prev.recurringDays, day.value],
                  }))}
                  className={cn(
                    "w-9 h-9 rounded-lg text-[11px] font-black transition-all border",
                    formData.recurringDays.includes(day.value)
                      ? "bg-primary text-primary-foreground border-primary"
                      : "bg-muted/30 border-border text-muted-foreground"
                  )}
                >
                  {day.label}
                </button>
              ))}
            </div>
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Inicio">
              <Input type="time" value={formData.startTime} onChange={(e) => setFormData({ ...formData, startTime: e.target.value })} className={cn(fieldInputClassName, "font-data")} />
            </Field>
            <Field label="Fin">
              <Input type="time" value={formData.endTime} onChange={(e) => setFormData({ ...formData, endTime: e.target.value })} className={cn(fieldInputClassName, "font-data")} />
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Prioridad">
              <PrioritySelect value={formData.priority} onChange={(priority) => setFormData({ ...formData, priority })} />
            </Field>
            <Field label="Color">
              <div className="flex gap-1.5 flex-wrap pt-1">
                {ROUTINE_COLORS.map((c) => (
                  <button
                    key={c.value}
                    type="button"
                    aria-label={c.label}
                    aria-pressed={formData.color === c.value}
                    onClick={() => setFormData({ ...formData, color: c.value })}
                    className={cn("w-7 h-7 rounded-full border-2 transition-all", formData.color === c.value ? "border-foreground scale-110" : "border-transparent opacity-60 hover:opacity-100")}
                    style={{ backgroundColor: c.value }}
                  />
                ))}
              </div>
            </Field>
          </div>

          <SubmitButton onClick={handleSaveRoutine}>
            {editingRoutine ? "Actualizar Rutina" : "Crear Rutina"}
          </SubmitButton>
        </FormPanel>
      )}

      {/* Semana */}
      <div className="flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={() => setSelectedDate((date) => addDays(date, -7))}
          aria-label="Semana anterior"
          className="flex h-9 w-9 items-center justify-center rounded-xl border border-border text-muted-foreground hover:text-foreground"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <div className="flex items-center gap-2 text-sm font-semibold">
          {format(weekStart, "d MMM", { locale: es })} – {format(addDays(weekStart, 6), "d MMM", { locale: es })}
          {!isCurrentWeek && (
            <button
              type="button"
              onClick={() => setSelectedDate(new Date())}
              className="rounded-lg px-2 py-1 text-xs font-semibold text-primary hover:bg-primary/10"
            >
              Hoy
            </button>
          )}
        </div>
        <button
          type="button"
          onClick={() => setSelectedDate((date) => addDays(date, 7))}
          aria-label="Semana siguiente"
          className="flex h-9 w-9 items-center justify-center rounded-xl border border-border text-muted-foreground hover:text-foreground"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>

      {/* Day Selector */}
      <div className="grid grid-cols-7 gap-1.5">
        {days.map((day) => {
          const isSelected = isSameDay(day, selectedDate);
          return (
            <button key={day.toString()} type="button" aria-pressed={isSelected} onClick={() => setSelectedDate(day)} className={cn(
              "py-2.5 rounded-2xl flex flex-col items-center gap-0.5 transition-colors border",
              isSelected
                ? "bg-primary/15 text-primary border-primary/50"
                : "border-border text-foreground hover:bg-muted/30"
            )}>
              <span className={cn("text-[10px] uppercase font-bold tracking-wide", isSelected ? "text-primary/80" : "text-muted-foreground/60")}>
                {format(day, "EEE", { locale: es })}
              </span>
              <span className={cn("text-lg font-black font-data", isSameDay(day, new Date()) && !isSelected && "text-primary")}>{format(day, "d")}</span>
            </button>
          );
        })}
      </div>

      {/* Lista vertical de bloques del día */}
      <div className="flex flex-col gap-4 w-full">
        <AnimatePresence mode="popLayout">
          {dailyRoutines.length > 0 ? (
            dailyRoutines.map((routine, idx) => (
              <ScheduleItem
                key={routine.id}
                routine={routine}
                selectedDate={selectedDate}
                currentTime={currentTime}
                index={idx}
                onEdit={openEditForm}
                onDelete={handleDeleteRoutine}
              />
            ))
          ) : (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <Inbox className="mb-2 h-8 w-8 text-muted-foreground/40" />
              <p className="text-sm text-muted-foreground">No hay rutinas este día.</p>
            </div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
