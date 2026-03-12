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
    toast({ title: editingEvent ? "Evento actualizado" : gcalConnected ? "Evento creado + Google" : "Evento creado" });
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
    toast({ title: "Evento eliminado", variant: "destructive" });
  };

  return (
    <div className="max-w-7xl mx-auto space-y-8 pb-24 px-0">
      {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <h2 className="text-2xl md:text-4xl font-black tracking-tighter uppercase">
              Eventos <span className="text-primary italic glow-text">{context}</span>
            </h2>
            <Badge variant="outline" className="h-5 rounded-full border-primary/20 text-primary bg-primary/5 px-2 font-black text-[11px] font-data">
              {events?.length || 0} TOTAL
            </Badge>
          </div>
          <p className="text-[9px] text-muted-foreground font-black uppercase tracking-[0.4em] flex items-center gap-2">
            <CalendarIcon className="w-3 h-3 text-primary/40" /> Eventos Puntuales
          </p>
        </div>

        <div className="flex items-center gap-2 w-full md:w-auto">
          {gcalConnected ? (
            <button
              onClick={gcalSync}
              disabled={gcalSyncing}
              className="h-10 px-3 rounded-xl border border-blue-500/30 bg-blue-500/5 text-blue-400 text-[11px] font-black uppercase tracking-widest flex items-center gap-2 hover:bg-blue-500/10 transition-all disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${gcalSyncing ? "animate-spin" : ""}`} />
              {gcalSyncing ? "Sincronizando..." : "Google Sync"}
            </button>
          ) : (
            <button
              onClick={gcalConnect}
              className="h-10 px-3 rounded-xl border border-white/[0.08] bg-white/[0.02] text-white/40 text-[11px] font-black uppercase tracking-widest flex items-center gap-2 hover:border-blue-500/30 hover:text-blue-400 transition-all"
            >
              <Link className="w-3.5 h-3.5" />
              Conectar Google
            </button>
          )}
          <Dialog open={isDialogOpen} onOpenChange={(open) => { if (!open) resetForm(); setIsDialogOpen(open); }}>
            <DialogTrigger asChild>
              <TacticalButton className="w-full md:w-auto"><Plus className="w-4 h-4 mr-2" /> Nuevo Evento</TacticalButton>
            </DialogTrigger>
            <DialogContent className="glass-card-elevated border-white/[0.08] bg-[#050505]/95 sm:max-w-[500px] p-5 sm:p-6 md:p-8">
              <DialogHeader>
                <DialogTitle className="text-xl font-black uppercase flex items-center gap-3">
                  <div className={cn("w-4 h-4 rounded-full", getColorClasses(formData.color))} />
                  {editingEvent ? "Editar Evento" : "Nuevo Evento"}
                </DialogTitle>
              </DialogHeader>
              <div className="space-y-4 py-2">
                {/* Title — large like GCal */}
                <div className="space-y-1.5">
                  <Input
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    placeholder="Agregar título"
                    className="bg-transparent border-0 border-b border-white/[0.08] rounded-none h-12 text-lg font-bold px-0 focus-visible:ring-0 focus-visible:border-primary placeholder:text-white/20"
                  />
                </div>

                {/* All Day toggle */}
                <div className="flex items-center justify-between">
                  <Label className="text-[11px] uppercase font-black tracking-widest flex items-center gap-2">
                    <Clock className="w-3.5 h-3.5 text-primary/60" /> Todo el día
                  </Label>
                  <Switch checked={formData.allDay} onCheckedChange={(val) => setFormData({ ...formData, allDay: val })} />
                </div>

                {/* Date & Time — GCal style */}
                <div className="space-y-3 p-3 glass-card border-white/[0.06] rounded-xl">
                  <div className="flex items-center gap-3">
                    <span className="text-[9px] font-black text-primary uppercase w-12">Inicio</span>
                    <Input type="date" value={formData.startDate} onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                      className="bg-white/[0.03] border-white/[0.08] h-10 rounded-lg font-data flex-1" />
                    {!formData.allDay && (
                      <Input type="time" value={formData.startTime} onChange={(e) => setFormData({ ...formData, startTime: e.target.value })}
                        className="bg-white/[0.03] border-white/[0.08] h-10 rounded-lg font-data w-28" />
                    )}
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-[9px] font-black text-white/40 uppercase w-12">Fin</span>
                    <Input type="date" value={formData.endDate} onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
                      className="bg-white/[0.03] border-white/[0.08] h-10 rounded-lg font-data flex-1" />
                    {!formData.allDay && (
                      <Input type="time" value={formData.endTime} onChange={(e) => setFormData({ ...formData, endTime: e.target.value })}
                        className="bg-white/[0.03] border-white/[0.08] h-10 rounded-lg font-data w-28" />
                    )}
                  </div>
                </div>

                {/* Location */}
                <div className="space-y-1.5">
                  <Label className="text-[9px] uppercase font-black tracking-widest flex items-center gap-1.5">
                    <MapPin className="w-3 h-3 text-primary/60" /> Ubicación
                  </Label>
                  <Input
                    placeholder="Agregar ubicación"
                    value={formData.location}
                    onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                    className="bg-white/[0.03] border-white/[0.08] h-10 rounded-lg"
                  />
                </div>

                {/* Description */}
                <div className="space-y-1.5">
                  <Label className="text-[9px] uppercase font-black tracking-widest flex items-center gap-1.5">
                    <AlignLeft className="w-3 h-3 text-primary/60" /> Descripción
                  </Label>
                  <Textarea
                    placeholder="Agregar descripción o notas"
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    className="bg-white/[0.03] border-white/[0.08] min-h-[60px] rounded-lg resize-none"
                  />
                </div>

                {/* Color picker — GCal style dots */}
                <div className="space-y-1.5">
                  <Label className="text-[9px] uppercase font-black tracking-widest">Color</Label>
                  <div className="flex gap-2 flex-wrap">
                    {EVENT_COLORS.map((c) => (
                      <button key={c.value} onClick={() => setFormData({ ...formData, color: c.value })}
                        className={cn(
                          "w-6 h-6 rounded-full transition-all border-2",
                          c.bg,
                          formData.color === c.value ? "border-white scale-125 ring-2 ring-white/20" : "border-transparent opacity-60 hover:opacity-100"
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
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        <div className="lg:col-span-5 space-y-4">
          <Card className="glass-card bg-[#050505]/40 p-4 md:p-6 flex justify-center">
            <Calendar
                mode="single" selected={date} onSelect={setDate} locale={es} className="rounded-2xl border-none p-0 w-full max-w-xs"
                classNames={{
                  day_today: "bg-primary/10 text-primary border border-primary/20 font-black",
                  day_selected: "bg-primary text-primary-foreground neon-glow hover:bg-primary font-black",
                  day: "h-9 w-9 p-0 font-bold transition-all hover:bg-white/[0.03] rounded-lg relative font-data",
                }}
                modifiers={{ hasEvent: daysWithEvents }}
                modifiersClassNames={{ hasEvent: "after:content-[''] after:absolute after:bottom-1 after:left-1/2 after:-translate-x-1/2 after:w-1.5 after:h-1.5 after:bg-primary after:rounded-full" }}
              />
          </Card>
          {/* Google Calendar status */}
          <div className="glass-card p-4 flex items-center justify-between gap-3">
            {gcalConnected ? (
              <>
                <div className="flex items-center gap-2 min-w-0">
                  <div className="w-2 h-2 rounded-full bg-blue-500 flex-shrink-0 animate-pulse" />
                  <span className="text-[11px] font-black text-blue-400 uppercase tracking-widest truncate">
                    {googleEvents.length} eventos de Google
                  </span>
                </div>
                <button
                  onClick={gcalDisconnect}
                  className="text-[10px] font-black text-white/20 uppercase tracking-widest hover:text-red-400 transition-all flex items-center gap-1 flex-shrink-0"
                >
                  <Link2Off className="w-3 h-3" /> Desconectar
                </button>
              </>
            ) : (
              <>
                <span className="text-[11px] font-black text-white/20 uppercase tracking-widest">Google Calendar</span>
                <button
                  onClick={gcalConnect}
                  className="h-7 px-2.5 rounded-lg border border-white/[0.06] text-white/30 text-[10px] font-black uppercase flex items-center gap-1.5 hover:border-blue-500/30 hover:text-blue-400 transition-all"
                >
                  <Link className="w-3 h-3" /> Conectar
                </button>
              </>
            )}
          </div>
        </div>

        <div className="lg:col-span-7 space-y-6">
          <div className="flex items-center justify-between px-2">
            <h3 className="text-[9px] font-black uppercase tracking-[0.3em] flex items-center gap-3">
              <Clock className="w-3.5 h-3.5 text-primary" />
              <span className="font-data">{date ? format(date, "EEEE, d 'de' MMMM", { locale: es }) : "Fecha"}</span>
            </h3>
            <Badge variant="outline" className="rounded-full border-primary/20 text-primary bg-primary/5 h-6 font-black text-[11px] font-data">
              {totalEventsCount} EVENTOS
            </Badge>
          </div>

          <div className="space-y-4 max-h-[600px] overflow-y-auto pr-1 scrollbar-hide px-2">
            <AnimatePresence mode="popLayout">
              {(selectedDayEvents.length > 0 || selectedDayGoogleEvents.length > 0) ? (
                <>
                  {selectedDayEvents.map((ev, idx) => (
                    <CalendarEventCard key={ev.id} event={ev} index={idx} onEdit={openEditDialog} onDelete={handleDeleteEvent} />
                  ))}
                  {selectedDayGoogleEvents.map((gev, idx) => (
                    <motion.div
                      key={gev.id}
                      initial={{ opacity: 0, x: 10 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -10 }}
                      transition={{ delay: (selectedDayEvents.length + idx) * 0.05 }}
                      className="glass-card p-4 md:p-6 relative overflow-hidden border-white/[0.05]"
                    >
                      <div className="absolute top-0 left-0 w-1 h-full bg-blue-500" />
                      <div className="flex flex-col gap-2 pl-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-[10px] font-black px-2 py-0.5 rounded-full uppercase border border-blue-500/20 bg-blue-500/10 text-blue-400 font-mono">
                            Google
                          </span>
                          {gev.start.dateTime && (
                            <span className="text-[10px] text-white/30 font-data">
                              {format(parseISO(gev.start.dateTime), "HH:mm")}
                            </span>
                          )}
                        </div>
                        <h4 className="font-black text-lg md:text-xl leading-tight">{gev.summary}</h4>
                        {gev.location && (
                          <p className="text-[11px] font-black text-muted-foreground uppercase flex items-center gap-2">
                            <MapPin className="w-3 h-3" /> {gev.location}
                          </p>
                        )}
                      </div>
                    </motion.div>
                  ))}
                </>
              ) : (
                <div className="flex flex-col items-center justify-center py-24 opacity-[0.04]">
                  <Inbox className="w-12 h-12 mb-2" />
                  <p className="text-[11px] font-black uppercase tracking-[0.4em]">Sin Eventos</p>
                </div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>
    </div>
  );
}
