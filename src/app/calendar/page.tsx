"use client";

import { useState, useEffect } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useFirestore, useUser, useCollection, useMemoFirebase } from "@/firebase";
import { Calendar } from "@/components/ui/calendar";
import { Card } from "@/components/ui/card";
import { format, isSameDay, parseISO, addHours } from "date-fns";
import { es } from "date-fns/locale";
import { Calendar as CalendarIcon, Clock, Plus, Inbox, RefreshCw, Link, Link2Off, MapPin, AlignLeft } from "lucide-react";
import { useGoogleCalendar } from "@/hooks/use-google-calendar";
import { Badge } from "@/components/ui/badge";
import { useRouter } from "next/navigation";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useAppContextStore } from "@/lib/store";
import { toast } from "@/hooks/use-toast";
import { Skeleton } from "@/components/ui/skeleton";
import { TacticalButton } from "@/components/atoms";
import { CalendarEventCard } from "@/components/molecules";
import { buildEventsQuery, createEvent, updateEvent, deleteEvent } from "@/services/task-service";
import type { CalendarEvent, EventColor, CalendarEventFormData } from "@/types/task";
import { cn } from "@/lib/utils";

const EVENT_COLORS: { value: EventColor; bg: string; label: string }[] = [
  { value: "tomato", bg: "bg-red-500", label: "Tomate" },
  { value: "flamingo", bg: "bg-pink-400", label: "Flamingo" },
  { value: "tangerine", bg: "bg-orange-500", label: "Mandarina" },
  { value: "banana", bg: "bg-yellow-400", label: "Banana" },
  { value: "sage", bg: "bg-emerald-400", label: "Salvia" },
  { value: "basil", bg: "bg-green-600", label: "Albahaca" },
  { value: "peacock", bg: "bg-cyan-500", label: "Pavo real" },
  { value: "blueberry", bg: "bg-blue-600", label: "Arándano" },
  { value: "lavender", bg: "bg-violet-400", label: "Lavanda" },
  { value: "grape", bg: "bg-purple-600", label: "Uva" },
  { value: "graphite", bg: "bg-zinc-500", label: "Grafito" },
];

function getColorClasses(color: EventColor): string {
  return EVENT_COLORS.find((c) => c.value === color)?.bg ?? "bg-blue-600";
}

function todayStr() { return format(new Date(), "yyyy-MM-dd"); }
function nowTimeStr() { return format(new Date(), "HH:mm"); }
function oneHourLaterStr() { return format(addHours(new Date(), 1), "HH:mm"); }

const INITIAL_FORM: CalendarEventFormData = {
  title: "", description: "", startDate: todayStr(), startTime: nowTimeStr(),
  endDate: todayStr(), endTime: oneHourLaterStr(), allDay: false,
  location: "", color: "blueberry",
};

export default function CalendarPage() {
  const { context } = useAppContextStore();
  const { user, isUserLoading } = useUser();
  const firestore = useFirestore();
  const router = useRouter();
  const { isConnected: gcalConnected, isSyncing: gcalSyncing, googleEvents, getEventsForDay, connect: gcalConnect, pushEvent: gcalPush, disconnect: gcalDisconnect, syncNow: gcalSync } = useGoogleCalendar();

  const [mounted, setMounted] = useState(false);
  const [date, setDate] = useState<Date | undefined>(undefined);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState<CalendarEvent | null>(null);
  const [formData, setFormData] = useState<CalendarEventFormData>(INITIAL_FORM);

  useEffect(() => { setMounted(true); setDate(new Date()); }, []);

  useEffect(() => {
    setFormData(INITIAL_FORM);
    setEditingEvent(null);
    setIsDialogOpen(false);
  }, [context]);

  // When user selects a date in the calendar picker, update the form dates
  useEffect(() => {
    if (date && !isDialogOpen) {
      const dateStr = format(date, "yyyy-MM-dd");
      setFormData((prev) => ({ ...prev, startDate: dateStr, endDate: dateStr }));
    }
  }, [date, isDialogOpen]);

  const eventsQuery = useMemoFirebase(() => {
    if (!firestore || !user) return null;
    return buildEventsQuery(firestore, user.uid, context);
  }, [firestore, user, context]);

  const { data: events, isLoading: isEventsLoading } = useCollection<CalendarEvent>(eventsQuery);

  useEffect(() => {
    if (!isUserLoading && !user) router.push("/login");
  }, [user, isUserLoading, router]);

  if (!mounted || isUserLoading || !user) return (
    <div className="max-w-7xl mx-auto space-y-8 p-4">
      <Skeleton className="h-16 w-1/2 bg-white/[0.03] rounded-2xl" />
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        <Skeleton className="lg:col-span-5 h-[400px] bg-white/[0.03] rounded-2xl" />
        <Skeleton className="lg:col-span-7 h-[400px] bg-white/[0.03] rounded-2xl" />
      </div>
    </div>
  );

  const selectedDayEvents = events?.filter((ev) => {
    if (!date || ev.context !== context) return false;
    const start = parseISO(ev.startDate);
    const end = parseISO(ev.endDate);
    // Event spans this day
    return (isSameDay(start, date) || isSameDay(end, date) || (start < date && end > date));
  }).sort((a, b) => a.startDate.localeCompare(b.startDate)) || [];

  const daysWithEvents = events?.filter((e) => e.context === context && e.startDate)
    .map((e) => parseISO(e.startDate)) || [];

  const selectedDayGoogleEvents = date ? getEventsForDay(date) : [];
  const totalEventsCount = selectedDayEvents.length + selectedDayGoogleEvents.length;

  const handleSaveEvent = () => {
    if (!formData.title.trim()) return;

    let startDate: string;
    let endDate: string;

    if (formData.allDay) {
      startDate = new Date(formData.startDate + "T00:00:00").toISOString();
      endDate = new Date(formData.endDate + "T23:59:59").toISOString();
    } else {
      startDate = new Date(formData.startDate + "T" + formData.startTime + ":00").toISOString();
      endDate = new Date(formData.endDate + "T" + formData.endTime + ":00").toISOString();
    }

    const eventData = {
      title: formData.title,
      description: formData.description || undefined,
      startDate,
      endDate,
      allDay: formData.allDay,
      location: formData.location || undefined,
      color: formData.color,
      context,
    };

    if (editingEvent) {
      updateEvent(firestore, user.uid, editingEvent.id, eventData);
    } else {
      createEvent(firestore, user.uid, eventData);
      if (gcalConnected) {
        gcalPush({ title: formData.title, startISO: startDate, location: formData.location || undefined });
      }
    }

    resetForm();
    setIsDialogOpen(false);
    toast({ variant: "success", title: editingEvent ? "Evento actualizado" : gcalConnected ? "Evento creado + Google" : "Evento creado" });
  };

  const resetForm = () => {
    const dateStr = date ? format(date, "yyyy-MM-dd") : todayStr();
    setFormData({ ...INITIAL_FORM, startDate: dateStr, endDate: dateStr, startTime: nowTimeStr(), endTime: oneHourLaterStr() });
    setEditingEvent(null);
  };

  const openEditDialog = (ev: CalendarEvent) => {
    setEditingEvent(ev);
    const start = parseISO(ev.startDate);
    const end = parseISO(ev.endDate);
    setFormData({
      title: ev.title,
      description: ev.description || "",
      startDate: format(start, "yyyy-MM-dd"),
      startTime: format(start, "HH:mm"),
      endDate: format(end, "yyyy-MM-dd"),
      endTime: format(end, "HH:mm"),
      allDay: ev.allDay,
      location: ev.location || "",
      color: ev.color || "blueberry",
    });
    setIsDialogOpen(true);
  };

  const handleDeleteEvent = (eventId: string) => {
    deleteEvent(firestore, user.uid, eventId);
    toast({ title: "Evento eliminado", variant: "warning" });
  };

  return (
    <div className="max-w-5xl mx-auto pb-24 px-4 sm:px-6">
      {/* Header compacto mobile-first */}
      <div className="flex items-center justify-between gap-4 py-4 sticky top-0 z-10 bg-[#050505]/95 backdrop-blur-xl -mx-4 px-4 sm:-mx-6 sm:px-6 border-b border-white/[0.04]">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-10 h-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center flex-shrink-0">
            <CalendarIcon className="w-5 h-5 text-primary" />
          </div>
          <div className="min-w-0">
            <h1 className="text-lg sm:text-xl font-black tracking-tight uppercase truncate">
              Eventos <span className="text-primary">{context}</span>
            </h1>
            <p className="text-[10px] text-white/40 font-bold uppercase tracking-widest">
              {events?.length || 0} registrados
            </p>
          </div>
        </div>
        
        <Dialog open={isDialogOpen} onOpenChange={(open) => { if (!open) resetForm(); setIsDialogOpen(open); }}>
          <DialogTrigger asChild>
            <button className="h-11 w-11 sm:h-10 sm:w-auto sm:px-4 rounded-xl bg-primary text-primary-foreground font-black text-xs uppercase tracking-wider flex items-center justify-center gap-2 shadow-[0_0_20px_rgba(57,255,20,0.3)] active:scale-95 transition-transform">
              <Plus className="w-5 h-5" />
              <span className="hidden sm:inline">Nuevo</span>
            </button>
          </DialogTrigger>
          <DialogContent className="glass-card-elevated border-white/[0.08] bg-[#050505]/98 sm:max-w-[500px] p-5 sm:p-6 md:p-8">
            <DialogHeader>
              <DialogTitle className="text-xl font-black uppercase flex items-center gap-3">
                <div className={cn("w-4 h-4 rounded-full", getColorClasses(formData.color))} />
                {editingEvent ? "Editar Evento" : "Nuevo Evento"}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-6 py-2">
              {/* Title — large like GCal */}
              <div className="space-y-1.5 focus-within:ring-0">
                <Input
                  value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    placeholder="Agregar título"
                    className="bg-transparent border-0 border-b-2 border-white/[0.08] rounded-none h-14 text-2xl md:text-3xl font-black px-1 focus-visible:ring-0 focus-visible:border-primary placeholder:text-white/20 transition-all font-sans"
                  />
                </div>

                {/* All Day toggle */}
                <div className="flex items-center justify-between glass-card border-white/[0.04] p-4 rounded-2xl">
                  <Label className="text-[11px] uppercase font-black tracking-widest flex items-center gap-2 text-white/80">
                    <Clock className="w-4 h-4 text-primary" /> Todo el día
                  </Label>
                  <Switch checked={formData.allDay} onCheckedChange={(val) => setFormData({ ...formData, allDay: val })} />
                </div>

                {/* Date & Time — GCal style */}
                <div className="space-y-4 p-4 glass-card border-white/[0.08] bg-white/[0.01] rounded-2xl shadow-inner">
                  <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                    <span className="text-[10px] font-black text-primary uppercase w-12 shrink-0">Inicio</span>
                    <div className="flex items-center gap-2 flex-1">
                      <Input type="date" value={formData.startDate} onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                        className="bg-white/[0.03] border-white/[0.08] h-11 rounded-xl font-data flex-1 px-3" />
                      {!formData.allDay && (
                        <Input type="time" value={formData.startTime} onChange={(e) => setFormData({ ...formData, startTime: e.target.value })}
                          className="bg-white/[0.03] border-white/[0.08] h-11 rounded-xl font-data w-28 px-3 shrink-0" />
                      )}
                    </div>
                  </div>
                  <div className="w-full h-px bg-white/[0.05]" />
                  <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                    <span className="text-[10px] font-black text-white/40 uppercase w-12 shrink-0">Fin</span>
                    <div className="flex items-center gap-2 flex-1">
                      <Input type="date" value={formData.endDate} onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
                        className="bg-white/[0.03] border-white/[0.08] h-11 rounded-xl font-data flex-1 px-3" />
                      {!formData.allDay && (
                        <Input type="time" value={formData.endTime} onChange={(e) => setFormData({ ...formData, endTime: e.target.value })}
                          className="bg-white/[0.03] border-white/[0.08] h-11 rounded-xl font-data w-28 px-3 shrink-0" />
                      )}
                    </div>
                  </div>
                </div>

                {/* Location */}
                <div className="space-y-2 pt-2">
                  <Label className="text-[10px] uppercase font-black tracking-widest flex items-center gap-1.5 text-white/70">
                    <MapPin className="w-4 h-4 text-primary" /> Ubicación
                  </Label>
                  <Input
                    placeholder="Agregar ubicación"
                    value={formData.location}
                    onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                    className="bg-white/[0.03] border-white/[0.08] h-12 rounded-xl focus-visible:ring-1 focus-visible:ring-primary/50 px-4"
                  />
                </div>

                {/* Description */}
                <div className="space-y-2">
                  <Label className="text-[10px] uppercase font-black tracking-widest flex items-center gap-1.5 text-white/70">
                    <AlignLeft className="w-4 h-4 text-primary" /> Descripción
                  </Label>
                  <Textarea
                    placeholder="Agregar descripción o notas"
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    className="bg-white/[0.03] border-white/[0.08] min-h-[100px] rounded-xl resize-none focus-visible:ring-1 focus-visible:ring-primary/50 p-4"
                  />
                </div>

                {/* Color picker — GCal style dots */}
                <div className="space-y-3 pt-2">
                  <Label className="text-[10px] uppercase font-black tracking-widest text-white/70">Color Hex</Label>
                  <div className="flex gap-3 flex-wrap">
                    {EVENT_COLORS.map((c) => (
                      <button key={c.value} onClick={() => setFormData({ ...formData, color: c.value })}
                        className={cn(
                          "w-8 h-8 rounded-full transition-all border-2",
                          c.bg,
                          formData.color === c.value ? "border-white scale-110 shadow-[0_0_15px_rgba(255,255,255,0.3)]" : "border-transparent opacity-50 hover:opacity-100 hover:scale-105"
                        )}
                        title={c.label}
                      />
                    ))}
                  </div>
                </div>
              </div>
              <DialogFooter>
                <TacticalButton onClick={handleSaveEvent} className="w-full">
                  {editingEvent ? "Guardar cambios" : gcalConnected ? "Crear evento + Google" : "Crear evento"}
                </TacticalButton>
              </DialogFooter>
            </DialogContent>
          </Dialog>
      </div>

      {/* Layout principal — mobile-first, calendario como hero */}
      <div className="space-y-6 mt-6">
        {/* Calendario Hero Card */}
        <div className="rounded-2xl border border-white/[0.08] bg-[#0a0a0a]/80 p-4 sm:p-6 shadow-2xl">
          <Calendar
            mode="single"
            selected={date}
            onSelect={setDate}
            locale={es}
            className="w-full"
            modifiers={{ hasEvent: daysWithEvents }}
            modifiersClassNames={{
              hasEvent: cn(
                "after:content-[''] after:absolute after:bottom-1.5 after:left-1/2 after:-translate-x-1/2",
                "after:w-1.5 after:h-1.5 after:bg-primary after:rounded-full",
                "after:shadow-[0_0_6px_rgba(57,255,20,0.9)]"
              )
            }}
          />
        </div>

        {/* Google Calendar conexión — touch-friendly */}
        <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4 flex items-center justify-between gap-4">
          {gcalConnected ? (
            <>
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-3 h-3 rounded-full bg-blue-500 animate-pulse flex-shrink-0" />
                <span className="text-xs font-bold text-blue-400 truncate">
                  {googleEvents.length} eventos de Google
                </span>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <button
                  onClick={gcalSync}
                  disabled={gcalSyncing}
                  className="h-10 w-10 rounded-xl border border-blue-500/30 bg-blue-500/10 text-blue-400 flex items-center justify-center active:scale-95 transition-transform disabled:opacity-50"
                >
                  <RefreshCw className={cn("w-4 h-4", gcalSyncing && "animate-spin")} />
                </button>
                <button
                  onClick={gcalDisconnect}
                  className="h-10 w-10 rounded-xl border border-white/[0.08] text-white/30 flex items-center justify-center hover:text-red-400 hover:border-red-500/30 active:scale-95 transition-all"
                >
                  <Link2Off className="w-4 h-4" />
                </button>
              </div>
            </>
          ) : (
            <>
              <span className="text-xs font-bold text-white/30 uppercase tracking-wider">Google Calendar</span>
              <button
                onClick={gcalConnect}
                className="h-10 px-4 rounded-xl border border-white/[0.08] bg-white/[0.02] text-white/50 text-xs font-bold uppercase flex items-center gap-2 hover:border-blue-500/30 hover:text-blue-400 active:scale-95 transition-all"
              >
                <Link className="w-4 h-4" /> Conectar
              </button>
            </>
          )}
        </div>

        {/* Fecha seleccionada y eventos */}
        <div className="space-y-4">
          <div className="flex items-center justify-between px-1">
            <h3 className="text-sm sm:text-base font-black uppercase tracking-wide flex items-center gap-3">
              <Clock className="w-4 h-4 text-primary" />
              <span>{date ? format(date, "EEEE d", { locale: es }) : "Selecciona"}</span>
            </h3>
            <Badge variant="outline" className="rounded-full border-primary/30 text-primary bg-primary/10 h-7 px-3 font-black text-xs">
              {totalEventsCount}
            </Badge>
          </div>

          {/* Lista de eventos — scroll natural sin max-height fijo que falla en WebView */}
          <div className="space-y-3">
            <AnimatePresence mode="popLayout">
              {(selectedDayEvents.length > 0 || selectedDayGoogleEvents.length > 0) ? (
                <>
                  {selectedDayEvents.map((ev, idx) => (
                    <CalendarEventCard key={ev.id} event={ev} index={idx} onEdit={openEditDialog} onDelete={handleDeleteEvent} />
                  ))}
                  {selectedDayGoogleEvents.map((gev, idx) => (
                    <motion.div
                      key={gev.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      transition={{ delay: (selectedDayEvents.length + idx) * 0.05 }}
                      className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4 relative overflow-hidden active:scale-[0.98] transition-transform"
                    >
                      <div className="absolute top-0 left-0 w-1 h-full bg-blue-500 rounded-l-xl" />
                      <div className="flex flex-col gap-2 pl-2">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-[10px] font-bold px-2 py-1 rounded-lg uppercase border border-blue-500/30 bg-blue-500/10 text-blue-400">
                            Google
                          </span>
                          {gev.start.dateTime && (
                            <span className="text-xs text-white/40 font-mono">
                              {format(parseISO(gev.start.dateTime), "HH:mm")}
                            </span>
                          )}
                        </div>
                        <h4 className="font-black text-base sm:text-lg leading-tight">{gev.summary}</h4>
                        {gev.location && (
                          <p className="text-xs text-white/50 flex items-center gap-2">
                            <MapPin className="w-3.5 h-3.5" /> {gev.location}
                          </p>
                        )}
                      </div>
                    </motion.div>
                  ))}
                </>
              ) : (
                <motion.div 
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="flex flex-col items-center justify-center py-16 rounded-xl border border-dashed border-white/[0.06]"
                >
                  <Inbox className="w-10 h-10 mb-3 text-white/10" />
                  <p className="text-xs font-bold uppercase tracking-wider text-white/20">Sin eventos este día</p>
                  <p className="text-[10px] text-white/10 mt-1">Toca + para crear uno</p>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>
    </div>
  );
}
