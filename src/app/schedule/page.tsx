"use client";

import { useState, useEffect } from "react";
import { AnimatePresence } from "framer-motion";
import { format, addDays, startOfWeek, isSameDay, getDay } from "date-fns";
import { es } from "date-fns/locale";
import { Plus, Inbox, CalendarDays, X } from "lucide-react";
import { useAppContextStore } from "@/lib/store";
import { cn } from "@/lib/utils";
import { useFirestore, useUser, useMemoFirebase } from "@/firebase/provider";
import { useCollection } from "@/firebase/firestore/use-collection";
import { useRouter } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { z } from "zod";
import { toast } from "@/hooks/use-toast";
import { Skeleton } from "@/components/ui/skeleton";
import { TacticalButton } from "@/components/atoms";
import { ScheduleItem } from "@/components/molecules";
import { buildRoutinesQuery, createRoutine, updateRoutine, deleteRoutine } from "@/services/routine-service";
import type { Routine, Priority, RoutineFormData } from "@/types/task";

const RoutineSchema = z.object({
  title: z.string().min(1, "El nombre es requerido").max(100),
  startTime: z.string().min(1),
  endTime: z.string().min(1),
  priority: z.enum(["baja", "media", "alta"]),
  recurringDays: z.array(z.number()).min(1, "Selecciona al menos un día"),
  color: z.string(),
});

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
  const { user, isUserLoading } = useUser();
  const firestore = useFirestore();
  const router = useRouter();

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

  const startDate = startOfWeek(new Date(), { weekStartsOn: 1 });
  const days = [...Array(14)].map((_, i) => addDays(startDate, i));

  const routinesQuery = useMemoFirebase(() => {
    if (!firestore || !user) return null;
    return buildRoutinesQuery(firestore, user.uid, context);
  }, [firestore, user, context]);

  const { data: routines } = useCollection<Routine>(routinesQuery);

  useEffect(() => {
    if (!isUserLoading && !user) router.push("/login");
  }, [user, isUserLoading, router]);

  if (isUserLoading || !user) return (
    <div className="max-w-2xl mx-auto space-y-6 py-4 px-0">
      <Skeleton className="h-14 w-1/2 bg-muted/30 rounded-2xl" />
      <Skeleton className="h-20 bg-muted/30 rounded-2xl" />
      <Skeleton className="h-64 bg-muted/30 rounded-2xl" />
    </div>
  );

  const selectedDayNum = getDay(selectedDate);
  const dailyRoutines = routines?.filter((r) => {
    if (r.context !== context) return false;
    return r.recurringDays?.includes(selectedDayNum);
  }).sort((a, b) => (a.startTime ?? "").localeCompare(b.startTime ?? "")) || [];

  const resetForm = () => { setFormData(INITIAL_FORM); setEditingRoutine(null); };

  const handleSaveRoutine = () => {
    const result = RoutineSchema.safeParse(formData);
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

    resetForm();
    setFormOpen(false);
    toast({ variant: "success", title: editingRoutine ? "Rutina actualizada" : "Rutina creada" });
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
    deleteRoutine(firestore, user.uid, routineId);
    toast({ title: "Rutina eliminada", variant: "warning" });
  };

  return (
    <div className="flex flex-col gap-6 max-w-2xl mx-auto pb-12 w-full">
      {/* Header */}
      <div className="flex flex-col gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <h2 className="text-2xl md:text-4xl font-black tracking-tighter uppercase">
              Horario <span className="text-primary italic glow-text">{context}</span>
            </h2>
            <Badge variant="outline" className="h-5 rounded-full border-primary/20 text-primary bg-primary/5 px-2 font-black text-[11px] font-data">
              {dailyRoutines.length} BLOQUES
            </Badge>
          </div>
          <p className="text-[9px] text-muted-foreground font-black uppercase tracking-[0.4em] flex items-center gap-2">
            <CalendarDays className="w-3 h-3 text-primary/40" /> Rutinas Semanales
          </p>
        </div>

        {!formOpen && (
          <TacticalButton className="w-full" onClick={openCreateForm}>
            <Plus className="w-4 h-4 mr-2" /> Nueva Rutina
          </TacticalButton>
        )}
      </div>

      {/* Formulario embebido (crear/editar) — sin modal */}
      {formOpen && (
        <div className="glass-card-elevated border border-border rounded-2xl p-5 sm:p-6 space-y-4 w-full">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-black uppercase tracking-tighter">
              {editingRoutine ? "Editar Rutina" : "Nueva Rutina"}
            </h3>
            <button
              type="button"
              onClick={closeForm}
              className="h-8 w-8 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted/40 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="space-y-1.5">
            <Label className="text-[9px] uppercase font-black text-primary tracking-widest">Nombre</Label>
            <Input value={formData.title} onChange={(e) => setFormData({ ...formData, title: e.target.value })} placeholder="Ej: Gimnasio, Estudio, Reunión..." className="bg-muted/30 border-border h-11 rounded-lg" />
          </div>

          <div className="space-y-1.5">
            <Label className="text-[9px] uppercase font-black tracking-widest">Días de la semana</Label>
            <div className="flex justify-between gap-1">
              {WEEK_DAYS.map((day) => (
                <button key={day.value} onClick={() => setFormData((prev) => ({
                  ...prev,
                  recurringDays: prev.recurringDays.includes(day.value)
                    ? prev.recurringDays.filter((d) => d !== day.value)
                    : [...prev.recurringDays, day.value],
                }))} className={cn(
                  "w-9 h-9 rounded-lg text-[11px] font-black transition-all border",
                  formData.recurringDays.includes(day.value)
                    ? "bg-primary text-primary-foreground border-primary"
                    : "bg-muted/30 border-border text-muted-foreground"
                )}>
                  {day.label}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-[9px] uppercase font-black tracking-widest">Inicio</Label>
              <Input type="time" value={formData.startTime} onChange={(e) => setFormData({ ...formData, startTime: e.target.value })} className="bg-muted/30 border-border h-11 rounded-lg font-data" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-[9px] uppercase font-black tracking-widest">Fin</Label>
              <Input type="time" value={formData.endTime} onChange={(e) => setFormData({ ...formData, endTime: e.target.value })} className="bg-muted/30 border-border h-11 rounded-lg font-data" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-[9px] uppercase font-black tracking-widest">Prioridad</Label>
              <Select value={formData.priority} onValueChange={(v) => setFormData({ ...formData, priority: v as Priority })}>
                <SelectTrigger className="bg-muted/30 border-border h-11 rounded-lg"><SelectValue /></SelectTrigger>
                <SelectContent className="bg-card border-border">
                  <SelectItem value="baja">Baja</SelectItem>
                  <SelectItem value="media">Media</SelectItem>
                  <SelectItem value="alta">Alta</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-[9px] uppercase font-black tracking-widest">Color</Label>
              <div className="flex gap-1.5 flex-wrap pt-1">
                {ROUTINE_COLORS.map((c) => (
                  <button key={c.value} onClick={() => setFormData({ ...formData, color: c.value })}
                    className={cn("w-7 h-7 rounded-full border-2 transition-all", formData.color === c.value ? "border-white scale-110" : "border-transparent opacity-60 hover:opacity-100")}
                    style={{ backgroundColor: c.value }}
                  />
                ))}
              </div>
            </div>
          </div>

          <div className="flex gap-3 pt-2">
            <TacticalButton onClick={handleSaveRoutine} className="w-full">
              {editingRoutine ? "Actualizar Rutina" : "Crear Rutina"}
            </TacticalButton>
          </div>
        </div>
      )}

      {/* Day Selector */}
      <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
        {days.map((day) => {
          const isSelected = isSameDay(day, selectedDate);
          return (
            <button key={day.toString()} onClick={() => setSelectedDate(day)} className={cn(
              "flex-shrink-0 w-16 py-3 rounded-2xl flex flex-col items-center gap-1 transition-all border",
              isSelected
                ? "bg-primary text-primary-foreground border-primary scale-105 shadow-lg"
                : "glass-card border-border"
            )}>
              <span className={cn("text-[10px] uppercase font-black tracking-widest", isSelected ? "text-black/60" : "text-muted-foreground/50")}>
                {format(day, "EEE", { locale: es })}
              </span>
              <span className="text-lg font-black font-data">{format(day, "d")}</span>
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
            <div className="flex flex-col items-center justify-center py-20 opacity-[0.15]">
              <Inbox className="w-12 h-12 mb-2" />
              <p className="text-[11px] font-black uppercase tracking-[0.4em]">Sin Rutinas</p>
            </div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
