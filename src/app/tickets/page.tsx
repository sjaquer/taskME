"use client";

import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { differenceInCalendarDays, format, isValid, parseISO } from "date-fns";
import { z } from "zod";
import {
  Ticket as TicketIcon,
  Plus,
  Pencil,
  Trash2,
  Link as LinkIcon,
  CalendarClock,
  CalendarCheck,
  UserRound,
  Loader2,
  Inbox,
  X,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useFirestore, useMemoFirebase, useUser } from "@/firebase/provider";
import { useCollection } from "@/firebase/firestore/use-collection";
import { toast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { buildTasksQuery, createTask, deleteTask, updateTask } from "@/services/task-service";
import { buildProjectsQuery } from "@/services/project-service";
import type { Priority, Project, Task } from "@/types/task";

const MAX_TAGS = 5;

const TicketSchema = z.object({
  title: z.string().trim().min(1, "El título es requerido").max(120),
  requestedAction: z.string().trim().min(1, "Indica la acción que se solicita"),
  description: z.string().trim().optional(),
  requesterName: z.string().trim().min(1, "Indica quién lo solicita").max(140),
  dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Fecha límite inválida").optional().or(z.literal("")),
  reviewDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Fecha de revisión inválida").optional().or(z.literal("")),
  referenceUrl: z.string().trim().url("URL inválida").optional().or(z.literal("")),
  priority: z.enum(["baja", "media", "alta"]),
  tags: z.string(),
  projectId: z.string(),
});

interface TicketFormState {
  title: string;
  requestedAction: string;
  description: string;
  requesterName: string;
  dueDate: string;
  reviewDate: string;
  referenceUrl: string;
  priority: Priority;
  tags: string;
  projectId: string;
}

const INITIAL_FORM: TicketFormState = {
  title: "",
  requestedAction: "",
  description: "",
  requesterName: "",
  dueDate: "",
  reviewDate: "",
  referenceUrl: "",
  priority: "media",
  tags: "",
  projectId: "",
};

function normalizeTag(tag: string) {
  return tag.trim().toLowerCase().replace(/\s+/g, " ");
}

function parseTagInput(input: string) {
  const uniqueTags = new Set<string>();
  input
    .split(",")
    .map(normalizeTag)
    .filter(Boolean)
    .forEach((tag) => {
      if (uniqueTags.size < MAX_TAGS) uniqueTags.add(tag);
    });
  return Array.from(uniqueTags);
}

function toInputDateValue(value: string | Date | undefined) {
  if (!value) return "";
  const parsed = typeof value === "string" ? parseISO(value) : value;
  return isValid(parsed) ? format(parsed, "yyyy-MM-dd") : "";
}

function formatDeadline(value: string | undefined) {
  if (!value) return null;
  const parsed = parseISO(value);
  if (!isValid(parsed)) return null;
  const daysLeft = differenceInCalendarDays(parsed, new Date());
  return {
    isOverdue: daysLeft < 0,
    isUrgent: daysLeft >= 0 && daysLeft <= 3,
    label: new Intl.DateTimeFormat("es-ES", { day: "2-digit", month: "short" }).format(parsed),
  };
}

export default function TicketsPage() {
  return (
    <Suspense fallback={null}>
      <TicketsPageContent />
    </Suspense>
  );
}

function TicketsPageContent() {
  const { user, isUserLoading } = useUser();
  const firestore = useFirestore();
  const router = useRouter();
  const searchParams = useSearchParams();
  const formRef = useRef<HTMLDivElement>(null);

  const [form, setForm] = useState<TicketFormState>(INITIAL_FORM);
  const [editingTicket, setEditingTicket] = useState<Task | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const loadedEditId = useRef<string | null>(null);

  useEffect(() => {
    if (!isUserLoading && !user) router.push("/login");
  }, [user, isUserLoading, router]);

  // Los tickets viven siempre en el contexto 'Trabajo'.
  const tasksQuery = useMemoFirebase(() => {
    if (!firestore || !user) return null;
    return buildTasksQuery(firestore, user.uid, "Trabajo");
  }, [firestore, user]);

  const { data: tasks, isLoading } = useCollection<Task>(tasksQuery);

  const projectsQuery = useMemoFirebase(() => {
    if (!firestore || !user) return null;
    return buildProjectsQuery(firestore, user.uid, "Trabajo");
  }, [firestore, user]);

  const { data: projects } = useCollection<Project>(projectsQuery);
  const activeProjects = useMemo(() => (projects || []).filter((p) => !p.archived), [projects]);

  const tickets = useMemo(() => (tasks || []).filter((task) => task.isTicket), [tasks]);
  const pendingTickets = useMemo(
    () =>
      tickets
        .filter((t) => t.status !== "Hecho")
        .sort((a, b) => {
          const aDate = a.reviewDate || (typeof a.dueDate === "string" ? a.dueDate : "");
          const bDate = b.reviewDate || (typeof b.dueDate === "string" ? b.dueDate : "");
          return aDate.localeCompare(bDate);
        }),
    [tickets]
  );

  const overdueCount = pendingTickets.filter((t) => formatDeadline(typeof t.dueDate === "string" ? t.dueDate : undefined)?.isOverdue).length;
  const inProgressCount = pendingTickets.filter((t) => t.status === "Haciendo").length;

  const openEditForm = (ticket: Task) => {
    setEditingTicket(ticket);
    setForm({
      title: ticket.title,
      requestedAction: ticket.requestedAction || "",
      description: ticket.description || "",
      requesterName: ticket.requesterName || "",
      dueDate: toInputDateValue(ticket.dueDate),
      reviewDate: ticket.reviewDate || "",
      referenceUrl: ticket.referenceUrl || "",
      priority: ticket.priority,
      tags: ticket.tags?.join(", ") || "",
      projectId: ticket.projectId || "",
    });
    setFormOpen(true);
    requestAnimationFrame(() => formRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }));
  };

  // Deep-link desde el Tablero: /tickets?edit=<id>
  useEffect(() => {
    const editId = searchParams.get("edit");
    if (!editId || !tasks || loadedEditId.current === editId) return;
    const ticket = tasks.find((t) => t.id === editId && t.isTicket);
    if (ticket) {
      loadedEditId.current = editId;
      openEditForm(ticket);
    }
  }, [searchParams, tasks]);

  const openCreateForm = () => {
    setEditingTicket(null);
    setForm(INITIAL_FORM);
    setFormOpen(true);
    requestAnimationFrame(() => formRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }));
  };

  const closeForm = () => {
    setEditingTicket(null);
    setForm(INITIAL_FORM);
    setFormOpen(false);
    if (searchParams.get("edit")) router.replace("/tickets");
  };

  const handleSubmit = async () => {
    if (!user || !firestore) return;

    const result = TicketSchema.safeParse(form);
    if (!result.success) {
      toast({ variant: "destructive", title: "Error", description: result.error.errors[0].message });
      return;
    }

    setIsSaving(true);
    try {
      const payload = {
        title: result.data.title,
        requestedAction: result.data.requestedAction,
        description: result.data.description || "",
        requesterName: result.data.requesterName,
        priority: result.data.priority,
        tags: parseTagInput(result.data.tags),
        context: "Trabajo" as const,
        isTicket: true,
        userId: user.uid,
        ...(result.data.dueDate ? { dueDate: result.data.dueDate } : {}),
        ...(result.data.reviewDate ? { reviewDate: result.data.reviewDate } : {}),
        ...(result.data.referenceUrl ? { referenceUrl: result.data.referenceUrl } : {}),
        ...(result.data.projectId ? { projectId: result.data.projectId } : {}),
      };

      if (editingTicket) {
        await updateTask(firestore, user.uid, editingTicket.id, { ...payload, status: editingTicket.status });
        toast({ variant: "success", title: "Ticket actualizado" });
      } else {
        await createTask(firestore, user.uid, { ...payload, status: "Pendiente" });
        toast({ variant: "success", title: "Ticket creado", description: "Se agregó a tu tablero de Trabajo." });
      }

      closeForm();
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = (ticketId: string) => {
    if (!user || !firestore) return;
    deleteTask(firestore, user.uid, ticketId);
    toast({ variant: "warning", title: "Ticket eliminado" });
  };

  const handleMove = (ticketId: string, status: string) => {
    if (!user || !firestore) return;
    updateTask(firestore, user.uid, ticketId, { status });
    toast({ variant: "success", title: "Estado actualizado" });
  };

  if (isUserLoading || !user) return null;

  return (
    <div className="flex flex-col gap-6 max-w-3xl mx-auto pb-12 w-full">
      {/* Header */}
      <div className="space-y-1">
        <div className="flex items-center gap-2">
          <h1 className="text-2xl md:text-4xl font-black tracking-tighter uppercase flex items-center gap-2">
            <TicketIcon className="w-6 h-6 text-primary" /> Tickets
          </h1>
        </div>
        <p className="text-[9px] text-muted-foreground font-black uppercase tracking-[0.4em]">
          Solicitudes de trabajo de terceros
        </p>
      </div>

      {/* Resumen de pendientes */}
      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-2xl border border-border bg-muted/20 px-4 py-4">
          <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground/60">Pendientes</p>
          <p className="mt-1 text-2xl font-black tracking-tight text-foreground">{pendingTickets.length}</p>
        </div>
        <div className="rounded-2xl border border-border bg-muted/20 px-4 py-4">
          <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground/60">En progreso</p>
          <p className="mt-1 text-2xl font-black tracking-tight text-primary">{inProgressCount}</p>
        </div>
        <div className="rounded-2xl border border-border bg-muted/20 px-4 py-4">
          <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground/60">Vencidos</p>
          <p className="mt-1 text-2xl font-black tracking-tight text-red-400">{overdueCount}</p>
        </div>
      </div>

      {!formOpen && (
        <Button
          type="button"
          onClick={openCreateForm}
          className="h-12 w-full rounded-2xl bg-primary text-xs font-black uppercase tracking-widest text-primary-foreground hover:bg-primary/95"
        >
          <Plus className="mr-2 h-4 w-4" /> Nuevo Ticket
        </Button>
      )}

      {/* Formulario embebido — sin modal */}
      {formOpen && (
        <div ref={formRef} className="glass-card-elevated border border-border rounded-3xl p-5 sm:p-6 space-y-4 w-full">
          <div className="flex items-center justify-between border-b border-border/40 pb-3">
            <h3 className="text-lg font-black uppercase tracking-tighter text-foreground">
              {editingTicket ? "Editar Ticket" : "Nuevo Ticket"}
            </h3>
            <button type="button" onClick={closeForm} className="h-8 w-8 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted/40">
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="space-y-2">
            <Label className="text-[10px] font-black uppercase tracking-[0.3em] text-muted-foreground">Título corto</Label>
            <Input
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              placeholder="Ej. Ajustar reporte mensual"
              className="h-11 rounded-2xl border-border bg-muted/20"
            />
          </div>

          <div className="space-y-2">
            <Label className="text-[10px] font-black uppercase tracking-[0.3em] text-muted-foreground">Acción que se solicita</Label>
            <Textarea
              value={form.requestedAction}
              onChange={(e) => setForm({ ...form, requestedAction: e.target.value })}
              placeholder="¿Qué necesitas que se haga exactamente?"
              className="min-h-[80px] rounded-2xl border-border bg-muted/20"
            />
          </div>

          <div className="space-y-2">
            <Label className="text-[10px] font-black uppercase tracking-[0.3em] text-muted-foreground">Descripción</Label>
            <Textarea
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              placeholder="Contexto adicional de la tarea"
              className="min-h-[80px] rounded-2xl border-border bg-muted/20"
            />
          </div>

          <div className="space-y-2">
            <Label className="text-[10px] font-black uppercase tracking-[0.3em] text-muted-foreground">Nombre de quien lo pide</Label>
            <Input
              value={form.requesterName}
              onChange={(e) => setForm({ ...form, requesterName: e.target.value })}
              placeholder="Ej. María, equipo de marketing..."
              className="h-11 rounded-2xl border-border bg-muted/20"
            />
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-2">
              <Label className="text-[10px] font-black uppercase tracking-[0.3em] text-muted-foreground">Fecha límite</Label>
              <Input
                type="date"
                value={form.dueDate}
                onChange={(e) => setForm({ ...form, dueDate: e.target.value })}
                className="h-11 rounded-2xl border-border bg-muted/20 [color-scheme:dark]"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-[10px] font-black uppercase tracking-[0.3em] text-muted-foreground">Fecha de revisión</Label>
              <Input
                type="date"
                value={form.reviewDate}
                onChange={(e) => setForm({ ...form, reviewDate: e.target.value })}
                className="h-11 rounded-2xl border-border bg-muted/20 [color-scheme:dark]"
              />
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-2">
              <Label className="text-[10px] font-black uppercase tracking-[0.3em] text-muted-foreground">Prioridad</Label>
              <Select value={form.priority} onValueChange={(v) => setForm({ ...form, priority: v as Priority })}>
                <SelectTrigger className="h-11 rounded-2xl border-border bg-muted/20">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="border-border bg-card">
                  <SelectItem value="alta">Alta</SelectItem>
                  <SelectItem value="media">Media</SelectItem>
                  <SelectItem value="baja">Baja</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label className="text-[10px] font-black uppercase tracking-[0.3em] text-muted-foreground">Proyecto</Label>
              <Select value={form.projectId || "sin-proyecto"} onValueChange={(v) => setForm({ ...form, projectId: v === "sin-proyecto" ? "" : v })}>
                <SelectTrigger className="h-11 rounded-2xl border-border bg-muted/20">
                  <SelectValue placeholder="Sin proyecto" />
                </SelectTrigger>
                <SelectContent className="border-border bg-card">
                  <SelectItem value="sin-proyecto">Sin proyecto</SelectItem>
                  {activeProjects.map((project) => (
                    <SelectItem key={project.id} value={project.id}>
                      {project.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label className="text-[10px] font-black uppercase tracking-[0.3em] text-muted-foreground">Etiquetas</Label>
            <Input
              value={form.tags}
              onChange={(e) => setForm({ ...form, tags: e.target.value })}
              placeholder="cliente, urgente, diseño"
              className="h-11 rounded-2xl border-border bg-muted/20"
            />
          </div>

          <div className="space-y-2">
            <Label className="text-[10px] font-black uppercase tracking-[0.3em] text-muted-foreground flex items-center gap-1.5">
              <LinkIcon className="h-3.5 w-3.5 text-primary" /> Link de referencia (opcional)
            </Label>
            <Input
              value={form.referenceUrl}
              onChange={(e) => setForm({ ...form, referenceUrl: e.target.value })}
              placeholder="https://drive.google.com/..."
              className="h-11 rounded-2xl border-border bg-muted/20"
            />
            <p className="text-[10px] text-muted-foreground/70">
              Adjuntar múltiples documentos con comentario llega en una futura iteración. Por ahora puedes dejar aquí un único link de referencia.
            </p>
          </div>

          <div className="pt-2 border-t border-border/40">
            <Button
              type="button"
              onClick={handleSubmit}
              disabled={isSaving}
              className="h-11 w-full rounded-2xl bg-primary text-[10px] font-black uppercase tracking-[0.3em] text-primary-foreground"
            >
              {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />}
              {editingTicket ? "Guardar cambios" : "Crear ticket"}
            </Button>
          </div>
        </div>
      )}

      {/* Lista de tickets pendientes */}
      <div className="space-y-3 border-t border-border/40 pt-6">
        <h2 className="text-sm font-black uppercase tracking-widest text-muted-foreground">Tickets pendientes</h2>
        {isLoading ? (
          <div className="space-y-3">
            {[0, 1].map((i) => <div key={i} className="h-28 animate-pulse rounded-2xl border border-border bg-muted/15" />)}
          </div>
        ) : pendingTickets.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border bg-muted/10 px-6 py-12 text-center">
            <Inbox className="mx-auto w-10 h-10 text-muted-foreground/30" />
            <p className="mt-3 text-sm font-bold text-foreground">No tienes tickets pendientes.</p>
          </div>
        ) : (
          pendingTickets.map((ticket) => {
            const dueMeta = formatDeadline(typeof ticket.dueDate === "string" ? ticket.dueDate : undefined);
            const reviewMeta = formatDeadline(ticket.reviewDate);
            return (
              <div
                key={ticket.id}
                className={cn(
                  "rounded-2xl border border-border bg-card/70 p-4 space-y-3",
                  dueMeta?.isOverdue && "border-red-500/25 bg-red-500/[0.04]"
                )}
              >
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="outline" className="rounded-full text-[10px] font-black uppercase tracking-widest border-primary/30 bg-primary/10 text-primary">
                    {ticket.priority}
                  </Badge>
                  {dueMeta && (
                    <Badge variant="outline" className={cn("rounded-full text-[10px] font-black uppercase tracking-widest", dueMeta.isOverdue ? "border-red-500/30 bg-red-500/10 text-red-300" : "border-border bg-muted/40 text-muted-foreground")}>
                      <CalendarClock className="mr-1 h-3 w-3" /> {dueMeta.label}
                    </Badge>
                  )}
                  {reviewMeta && (
                    <Badge variant="outline" className="rounded-full text-[10px] font-black uppercase tracking-widest border-border bg-muted/40 text-muted-foreground">
                      <CalendarCheck className="mr-1 h-3 w-3" /> Revisión {reviewMeta.label}
                    </Badge>
                  )}
                </div>

                <div className="space-y-1">
                  <h4 className="text-[15px] font-black leading-tight text-foreground">{ticket.title}</h4>
                  {ticket.requestedAction && <p className="text-sm text-muted-foreground">{ticket.requestedAction}</p>}
                  {ticket.requesterName && (
                    <p className="text-xs font-bold text-primary/70 flex items-center gap-1.5">
                      <UserRound className="h-3.5 w-3.5" /> {ticket.requesterName}
                    </p>
                  )}
                </div>

                <div className="flex items-center justify-between gap-2 pt-2 border-t border-border/30">
                  <Select value={ticket.status} onValueChange={(v) => handleMove(ticket.id, v)}>
                    <SelectTrigger className="h-9 w-[160px] rounded-xl border-border bg-muted/30 text-[10px] font-black uppercase tracking-widest">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="border-border bg-card">
                      <SelectItem value="Pendiente">Pendiente</SelectItem>
                      <SelectItem value="Haciendo">Haciendo</SelectItem>
                      <SelectItem value="Hecho">Hecho</SelectItem>
                    </SelectContent>
                  </Select>
                  <div className="flex items-center gap-2">
                    <Button type="button" variant="ghost" size="icon" onClick={() => openEditForm(ticket)} className="h-9 w-9 rounded-xl border border-border bg-muted/20 text-muted-foreground hover:text-primary">
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button type="button" variant="ghost" size="icon" onClick={() => handleDelete(ticket.id)} className="h-9 w-9 rounded-xl border border-border bg-muted/20 text-muted-foreground hover:text-red-400">
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
