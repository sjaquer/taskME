"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useFirestore, useUser, useMemoFirebase } from "@/firebase/provider";
import { useCollection } from "@/firebase/firestore/use-collection";
import { 
  format, isSameDay, parseISO, addHours, startOfMonth, endOfMonth, 
  eachDayOfInterval, isSameMonth, isToday, addMonths, subMonths,
  getDay, startOfWeek, endOfWeek
} from "date-fns";
import { es } from "date-fns/locale";
import { 
  Calendar as CalendarIcon, Clock, Plus, Inbox, RefreshCw, Link, Link2Off, 
  MapPin, AlignLeft, AlertTriangle, ChevronLeft, ChevronRight, Sparkles
} from "lucide-react";
import { useGoogleCalendar } from "@/hooks/use-google-calendar";
import { Badge } from "@/components/ui/badge";
import { useRouter } from "next/navigation";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
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
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

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

const WEEKDAYS = ["L", "M", "X", "J", "V", "S", "D"];

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
  const {
    isConnected: gcalConnected,
    isSyncing: gcalSyncing,
    isConnecting: gcalConnecting,
    isReady: gcalReady,
    hasClientId: gcalHasClientId,
    error: gcalError,
    lastSyncedAt: gcalLastSyncedAt,
    googleEvents,
    getEventsForDay,
    connect: gcalConnect,
    pushEvent: gcalPush,
    disconnect: gcalDisconnect,
    syncNow: gcalSync,
  } = useGoogleCalendar();

  const [mounted, setMounted] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [currentMonth, setCurrentMonth] = useState<Date>(new Date());
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState<CalendarEvent | null>(null);
  const [formData, setFormData] = useState<CalendarEventFormData>(INITIAL_FORM);
  const [gcalExpanded, setGcalExpanded] = useState(false);
  const lastGoogleErrorRef = useRef<string | null>(null);

  useEffect(() => { setMounted(true); }, []);

  useEffect(() => {
    setFormData(INITIAL_FORM);
    setEditingEvent(null);
    setIsDialogOpen(false);
  }, [context]);

  useEffect(() => {
    if (selectedDate && !isDialogOpen) {
      const dateStr = format(selectedDate, "yyyy-MM-dd");
      setFormData((prev) => ({ ...prev, startDate: dateStr, endDate: dateStr }));
    }
  }, [selectedDate, isDialogOpen]);

  const eventsQuery = useMemoFirebase(() => {
    if (!firestore || !user) return null;
    return buildEventsQuery(firestore, user.uid, context);
  }, [firestore, user, context]);

  const { data: events, isLoading: isEventsLoading } = useCollection<CalendarEvent>(eventsQuery);

  useEffect(() => {
    if (!isUserLoading && !user) router.push("/login");
  }, [user, isUserLoading, router]);

  useEffect(() => {
    if (!gcalError || lastGoogleErrorRef.current === gcalError) return;
    lastGoogleErrorRef.current = gcalError;
    toast({
      variant: gcalHasClientId ? "warning" : "destructive",
      title: "Google Calendar",
      description: gcalError,
    });
  }, [gcalError, gcalHasClientId]);

  // Generar días del mes actual para la cuadrícula
  const calendarDays = useMemo(() => {
    const monthStart = startOfMonth(currentMonth);
    const monthEnd = endOfMonth(currentMonth);
    const calStart = startOfWeek(monthStart, { weekStartsOn: 1 });
    const calEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });
    return eachDayOfInterval({ start: calStart, end: calEnd });
  }, [currentMonth]);

  // Mapa de eventos por día para indicadores
  const eventsByDay = useMemo(() => {
    const map = new Map<string, { local: number; google: number }>();
    events?.forEach((ev) => {
      if (ev.context !== context) return;
      const key = format(parseISO(ev.startDate), "yyyy-MM-dd");
      const current = map.get(key) || { local: 0, google: 0 };
      map.set(key, { ...current, local: current.local + 1 });
    });
    googleEvents.forEach((gev) => {
      const d = gev.start.dateTime ? parseISO(gev.start.dateTime) : gev.start.date ? new Date(gev.start.date + "T00:00:00") : null;
      if (!d) return;
      const key = format(d, "yyyy-MM-dd");
      const current = map.get(key) || { local: 0, google: 0 };
      map.set(key, { ...current, google: current.google + 1 });
    });
    return map;
  }, [events, googleEvents, context]);

  if (!mounted || isUserLoading || !user) return (
    <div className="min-h-screen bg-background p-4">
      <Skeleton className="h-12 w-2/3 bg-muted/30 rounded-2xl mb-6" />
      <Skeleton className="h-80 w-full bg-muted/30 rounded-2xl mb-4" />
      <Skeleton className="h-40 w-full bg-muted/30 rounded-2xl" />
    </div>
  );

  const selectedDayEvents = events?.filter((ev) => {
    if (ev.context !== context) return false;
    const start = parseISO(ev.startDate);
    const end = parseISO(ev.endDate);
    return isSameDay(start, selectedDate) || isSameDay(end, selectedDate) || (start < selectedDate && end > selectedDate);
  }).sort((a, b) => a.startDate.localeCompare(b.startDate)) || [];

  const selectedDayGoogleEvents = getEventsForDay(selectedDate);
  const totalEventsCount = selectedDayEvents.length + selectedDayGoogleEvents.length;

  const handleSaveEvent = async () => {
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
      toast({ variant: "success", title: "Evento actualizado" });
    } else {
      createEvent(firestore, user.uid, eventData);

      if (gcalConnected) {
        const googleResult = await gcalPush({
          title: formData.title,
          description: formData.description || undefined,
          location: formData.location || undefined,
          allDay: formData.allDay,
          startISO: startDate,
          endISO: endDate,
          startDate: formData.startDate,
          endDate: formData.endDate,
        });

        if (!googleResult.ok) {
          toast({
            variant: "warning",
            title: "Evento local creado",
            description: googleResult.message || "No se pudo sincronizar con Google Calendar.",
          });
        } else {
          toast({ variant: "success", title: "Evento creado + Google Calendar" });
        }
      } else {
        toast({ variant: "success", title: "Evento creado" });
      }
    }

    resetForm();
    setIsDialogOpen(false);
  };

  const resetForm = () => {
    const dateStr = format(selectedDate, "yyyy-MM-dd");
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

  const handleGoogleConnect = async () => {
    const result = await gcalConnect();
    if (!result.ok) {
      toast({ variant: gcalHasClientId ? "warning" : "destructive", title: "Google Calendar", description: result.message });
      return;
    }
    toast({ variant: "success", title: "Google Calendar conectado" });
  };

  const handleGoogleSync = async () => {
    const result = await gcalSync();
    if (!result.ok) {
      toast({ variant: "warning", title: "No se pudo sincronizar", description: result.message });
      return;
    }
    toast({ variant: "info", title: "Google Calendar sincronizado" });
  };

  const handleGoogleDisconnect = () => {
    gcalDisconnect();
    toast({ variant: "warning", title: "Google Calendar desconectado" });
  };

  const goToPrevMonth = () => setCurrentMonth(subMonths(currentMonth, 1));
  const goToNextMonth = () => setCurrentMonth(addMonths(currentMonth, 1));
  const goToToday = () => {
    const today = new Date();
    setCurrentMonth(today);
    setSelectedDate(today);
  };

  return (
    <div className="min-h-screen bg-background pb-28">
      {/* Header con mes y navegación */}
      <div className="sticky top-0 z-20 bg-background/95 backdrop-blur-xl border-b border-border">
        <div className="px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <button
              onClick={goToPrevMonth}
              className="h-10 w-10 rounded-xl border border-border bg-muted/30 flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted/50 active:scale-95 transition-all"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <button
              onClick={goToNextMonth}
              className="h-10 w-10 rounded-xl border border-white/[0.08] bg-white/[0.02] flex items-center justify-center text-white/60 hover:text-white hover:bg-white/[0.06] active:scale-95 transition-all"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>

          <div className="text-center">
            <h1 className="text-lg font-black uppercase tracking-tight">
              {format(currentMonth, "MMMM", { locale: es })}
            </h1>
            <p className="text-[10px] text-white/40 font-bold uppercase tracking-widest">
              {format(currentMonth, "yyyy")}
            </p>
          </div>

          <button
            onClick={goToToday}
            className="h-10 px-3 rounded-xl border border-primary/30 bg-primary/10 text-primary text-xs font-black uppercase tracking-wider flex items-center gap-2 hover:bg-primary/20 active:scale-95 transition-all"
          >
            Hoy
          </button>
        </div>
      </div>

      {/* Calendario mensual compacto */}
      <div className="px-4 pt-4">
        <div className="rounded-2xl border border-border bg-card/80 backdrop-blur-sm overflow-hidden">
          {/* Header días de la semana */}
          <div className="grid grid-cols-7 border-b border-border">
            {WEEKDAYS.map((day, i) => (
              <div key={day} className={cn(
                "py-3 text-center text-[11px] font-black uppercase tracking-wider",
                i >= 5 ? "text-muted-foreground/40" : "text-primary/70"
              )}>
                {day}
              </div>
            ))}
          </div>

          {/* Cuadrícula de días */}
          <div className="grid grid-cols-7">
            {calendarDays.map((day, idx) => {
              const dayKey = format(day, "yyyy-MM-dd");
              const dayEvents = eventsByDay.get(dayKey);
              const hasLocalEvents = (dayEvents?.local || 0) > 0;
              const hasGoogleEvents = (dayEvents?.google || 0) > 0;
              const isSelected = isSameDay(day, selectedDate);
              const isCurrentMonth = isSameMonth(day, currentMonth);
              const isTodayDate = isToday(day);
              const isWeekend = getDay(day) === 0 || getDay(day) === 6;

              return (
                <button
                  key={idx}
                  onClick={() => setSelectedDate(day)}
                  className={cn(
                    "relative aspect-square flex flex-col items-center justify-center p-1 transition-all active:scale-95",
                    "border-b border-r border-border/40",
                    !isCurrentMonth && "opacity-30",
                    isWeekend && isCurrentMonth && "bg-muted/10",
                    isSelected && "bg-primary/20",
                    isTodayDate && !isSelected && "bg-primary/10"
                  )}
                >
                  <span className={cn(
                    "text-sm font-bold transition-all w-8 h-8 rounded-lg flex items-center justify-center",
                    isSelected && "bg-primary text-primary-foreground shadow-[0_0_15px_rgba(57,255,20,0.4)]",
                    isTodayDate && !isSelected && "text-primary font-black border-2 border-primary/50",
                    !isSelected && !isTodayDate && (isCurrentMonth ? "text-white/80" : "text-white/30")
                  )}>
                    {format(day, "d")}
                  </span>

                  {/* Indicadores de eventos */}
                  {(hasLocalEvents || hasGoogleEvents) && (
                    <div className="absolute bottom-1 flex items-center gap-0.5">
                      {hasLocalEvents && (
                        <span className={cn(
                          "w-1.5 h-1.5 rounded-full",
                          isSelected ? "bg-white" : "bg-primary shadow-[0_0_6px_rgba(57,255,20,0.8)]"
                        )} />
                      )}
                      {hasGoogleEvents && (
                        <span className={cn(
                          "w-1.5 h-1.5 rounded-full",
                          isSelected ? "bg-white/70" : "bg-blue-500 shadow-[0_0_6px_rgba(59,130,246,0.8)]"
                        )} />
                      )}
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Sección de día seleccionado */}
      <div className="px-4 mt-6">
        {/* Header del día */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className={cn(
              "w-14 h-14 rounded-2xl flex flex-col items-center justify-center",
              isToday(selectedDate) 
                ? "bg-primary text-primary-foreground shadow-[0_0_25px_rgba(57,255,20,0.4)]" 
                : "bg-muted/30 border border-border"
            )}>
              <span className="text-2xl font-black leading-none">{format(selectedDate, "d")}</span>
              <span className="text-[9px] font-bold uppercase tracking-wider opacity-70">
                {format(selectedDate, "EEE", { locale: es })}
              </span>
            </div>
            <div>
              <h2 className="text-lg font-black uppercase tracking-tight">
                {format(selectedDate, "EEEE", { locale: es })}
              </h2>
              <p className="text-xs text-white/40 font-medium">
                {format(selectedDate, "d 'de' MMMM, yyyy", { locale: es })}
              </p>
            </div>
          </div>
          <Badge variant="outline" className={cn(
            "rounded-full h-8 px-4 font-black text-sm",
            totalEventsCount > 0 
              ? "border-primary/30 text-primary bg-primary/10" 
              : "border-white/[0.08] text-white/40 bg-white/[0.02]"
          )}>
            {totalEventsCount}
          </Badge>
        </div>

        {/* Lista de eventos del día */}
        <div className="space-y-3">
          <AnimatePresence mode="popLayout">
            {totalEventsCount > 0 ? (
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
                    className="rounded-xl border border-border bg-muted/20 p-4 relative overflow-hidden active:scale-[0.98] transition-transform"
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
                        {gev.start.date && !gev.start.dateTime && (
                          <Badge className="bg-white/[0.05] text-white/60 border-white/[0.08] text-[10px] px-2 py-0.5 rounded-md">
                            Todo el día
                          </Badge>
                        )}
                      </div>
                      <h4 className="font-black text-base leading-tight">{gev.summary}</h4>
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
                className="flex flex-col items-center justify-center py-12 rounded-2xl border border-dashed border-white/[0.06] bg-white/[0.01]"
              >
                <div className="w-16 h-16 rounded-2xl bg-white/[0.03] border border-white/[0.06] flex items-center justify-center mb-4">
                  <Inbox className="w-7 h-7 text-white/20" />
                </div>
                <p className="text-sm font-bold text-white/30">Sin eventos</p>
                <p className="text-xs text-white/20 mt-1">Toca + para crear uno nuevo</p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Google Calendar Section - Collapsible */}
      <div className="px-4 mt-6">
        <Collapsible open={gcalExpanded} onOpenChange={setGcalExpanded}>
          <div className="rounded-2xl border border-border bg-muted/30 overflow-hidden">
            <CollapsibleTrigger asChild>
              <button className="w-full p-4 flex items-center justify-between hover:bg-white/[0.02] transition-colors">
                <div className="flex items-center gap-3">
                  <div className={cn(
                    "w-10 h-10 rounded-xl flex items-center justify-center",
                    gcalConnected ? "bg-blue-500/20 border border-blue-500/30" : "bg-white/[0.05] border border-white/[0.08]"
                  )}>
                    <Sparkles className={cn("w-5 h-5", gcalConnected ? "text-blue-400" : "text-white/40")} />
                  </div>
                  <div className="text-left">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold">Google Calendar</span>
                      {gcalConnected && (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full border border-blue-500/20 bg-blue-500/10 text-blue-300">
                          Conectado
                        </span>
                      )}
                      {!gcalHasClientId && (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full border border-red-500/20 bg-red-500/10 text-red-300">
                          Config
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-white/40">
                      {gcalConnected ? `${googleEvents.length} eventos sincronizados` : "Sincroniza tus eventos"}
                    </p>
                  </div>
                </div>
                <ChevronRight className={cn(
                  "w-5 h-5 text-white/30 transition-transform",
                  gcalExpanded && "rotate-90"
                )} />
              </button>
            </CollapsibleTrigger>

            <CollapsibleContent>
              <div className="px-4 pb-4 space-y-3 border-t border-white/[0.06] pt-3">
                {gcalConnected ? (
                  <>
                    <p className="text-xs text-white/50 leading-relaxed">
                      {gcalLastSyncedAt 
                        ? `Última sincronización: ${format(new Date(gcalLastSyncedAt), "HH:mm 'del' d MMM", { locale: es })}`
                        : "Eventos sincronizados correctamente"}
                    </p>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={handleGoogleSync}
                        disabled={gcalSyncing}
                        className="flex-1 h-11 rounded-xl border border-blue-500/30 bg-blue-500/10 text-blue-400 text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-2 active:scale-95 transition-transform disabled:opacity-50"
                      >
                        <RefreshCw className={cn("w-4 h-4", gcalSyncing && "animate-spin")} />
                        {gcalSyncing ? "Sincronizando" : "Sincronizar"}
                      </button>
                      <button
                        onClick={handleGoogleDisconnect}
                        className="h-11 px-4 rounded-xl border border-white/[0.08] text-white/50 text-xs font-bold uppercase tracking-wider flex items-center gap-2 hover:text-red-400 hover:border-red-500/30 active:scale-95 transition-all"
                      >
                        <Link2Off className="w-4 h-4" />
                        Desconectar
                      </button>
                    </div>
                  </>
                ) : (
                  <>
                    <p className="text-xs text-white/50 leading-relaxed">
                      {!gcalHasClientId
                        ? "Falta configurar NEXT_PUBLIC_GOOGLE_CLIENT_ID en las variables de entorno."
                        : !gcalReady
                        ? "Cargando cliente de Google..."
                        : "Conecta tu cuenta para ver eventos de Google Calendar y crear nuevos desde aquí."}
                    </p>
                    <button
                      onClick={handleGoogleConnect}
                      disabled={!gcalHasClientId || !gcalReady || gcalConnecting}
                      className="w-full h-11 rounded-xl border border-blue-500/30 bg-blue-500/10 text-blue-400 text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-2 hover:bg-blue-500/20 active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <Link className="w-4 h-4" />
                      {gcalConnecting ? "Conectando..." : "Conectar con Google"}
                    </button>
                  </>
                )}

                {gcalError && (
                  <div className="rounded-xl border border-yellow-500/20 bg-yellow-500/5 px-3 py-2 flex items-start gap-2">
                    <AlertTriangle className="w-4 h-4 mt-0.5 text-yellow-300 flex-shrink-0" />
                    <p className="text-xs leading-relaxed text-yellow-100/85">{gcalError}</p>
                  </div>
                )}
              </div>
            </CollapsibleContent>
          </div>
        </Collapsible>
      </div>

      {/* FAB - Floating Action Button */}
      <button
        onClick={() => setIsDialogOpen(true)}
        className="fixed bottom-24 right-4 z-30 w-14 h-14 rounded-2xl bg-primary text-primary-foreground shadow-[0_0_30px_rgba(57,255,20,0.4)] flex items-center justify-center active:scale-90 transition-transform"
      >
        <Plus className="w-7 h-7" />
      </button>

      {/* Dialog para crear/editar evento */}
      <Dialog open={isDialogOpen} onOpenChange={(open) => { if (!open) resetForm(); setIsDialogOpen(open); }}>
        <DialogContent className="glass-card-elevated border-border bg-card/98 sm:max-w-[500px] p-5 sm:p-6 sm:max-h-[92dvh] overflow-hidden">
          <DialogHeader>
            <DialogTitle className="text-xl font-black uppercase flex items-center gap-3">
              <div className={cn("w-4 h-4 rounded-full", getColorClasses(formData.color))} />
              {editingEvent ? "Editar Evento" : "Nuevo Evento"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-5 py-2 pr-1 overflow-y-auto max-h-none sm:max-h-[58dvh]">
            {/* Title */}
            <Input
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              placeholder="Agregar título"
              className="bg-transparent border-0 border-b-2 border-white/[0.08] rounded-none h-12 text-xl font-black px-1 focus-visible:ring-0 focus-visible:border-primary placeholder:text-white/20 transition-all"
            />

            {/* All Day toggle */}
            <div className="flex items-center justify-between glass-card border-white/[0.04] p-3 rounded-xl">
              <Label className="text-[11px] uppercase font-black tracking-widest flex items-center gap-2 text-white/80">
                <Clock className="w-4 h-4 text-primary" /> Todo el día
              </Label>
              <Switch checked={formData.allDay} onCheckedChange={(val) => setFormData({ ...formData, allDay: val })} />
            </div>

            {/* Date & Time */}
            <div className="space-y-3 p-3 glass-card border-white/[0.08] rounded-xl">
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-black text-primary uppercase w-10">Inicio</span>
                <Input type="date" value={formData.startDate} onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                  className="bg-white/[0.03] border-white/[0.08] h-10 rounded-xl flex-1 px-3 text-sm" />
                {!formData.allDay && (
                  <Input type="time" value={formData.startTime} onChange={(e) => setFormData({ ...formData, startTime: e.target.value })}
                    className="bg-white/[0.03] border-white/[0.08] h-10 rounded-xl w-24 px-3 text-sm" />
                )}
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-black text-white/40 uppercase w-10">Fin</span>
                <Input type="date" value={formData.endDate} onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
                  className="bg-white/[0.03] border-white/[0.08] h-10 rounded-xl flex-1 px-3 text-sm" />
                {!formData.allDay && (
                  <Input type="time" value={formData.endTime} onChange={(e) => setFormData({ ...formData, endTime: e.target.value })}
                    className="bg-white/[0.03] border-white/[0.08] h-10 rounded-xl w-24 px-3 text-sm" />
                )}
              </div>
            </div>

            {/* Location */}
            <div className="space-y-2">
              <Label className="text-[10px] uppercase font-black tracking-widest flex items-center gap-1.5 text-white/70">
                <MapPin className="w-4 h-4 text-primary" /> Ubicación
              </Label>
              <Input
                placeholder="Agregar ubicación"
                value={formData.location}
                onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                className="bg-white/[0.03] border-white/[0.08] h-11 rounded-xl px-4"
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
                className="bg-white/[0.03] border-white/[0.08] min-h-[80px] rounded-xl resize-none p-3"
              />
            </div>

            {/* Color picker */}
            <div className="space-y-2">
              <Label className="text-[10px] uppercase font-black tracking-widest text-white/70">Color</Label>
              <div className="flex gap-2 flex-wrap">
                {EVENT_COLORS.map((c) => (
                  <button key={c.value} onClick={() => setFormData({ ...formData, color: c.value })}
                    className={cn(
                      "w-8 h-8 rounded-full transition-all border-2",
                      c.bg,
                      formData.color === c.value 
                        ? "border-white scale-110 shadow-[0_0_15px_rgba(255,255,255,0.3)]" 
                        : "border-transparent opacity-50 hover:opacity-100 hover:scale-105"
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
  );
}
