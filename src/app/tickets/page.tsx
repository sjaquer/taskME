"use client";

import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Ticket as TicketIcon,
  Plus,
  Pencil,
  Trash2,
  Link as LinkIcon,
  CalendarClock,
  CalendarCheck,
  UserRound,
  Inbox,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Field, FormPanel, PrioritySelect, ProjectSelect, SubmitButton, fieldInputClassName } from "@/components/forms/form-fields";
import { useFirestore, useUser } from "@/firebase/provider";
import { useContexts, useProjects, useTasks } from "@/firebase/user-data";
import { useAppContextStore } from "@/lib/store";
import { toast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { getDueMeta, isTaskStatus, parseTagInput, toInputDateValue } from "@/lib/tasks";
import { publicTicketFormSchema, ticketFormSchema } from "@/lib/schemas";
import { createTask, deleteTask, updateTask } from "@/services/task-service";
import { restoreUserDocument } from "@/services/restore-service";
import { toastWithUndo } from "@/components/undo-toast";
import type { Priority, Task } from "@/types/task";

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

  // Los tickets viven en el contexto elegido en Ajustes (por defecto, Trabajo).
  const ticketsContext = useAppContextStore((state) => state.ticketsContext);
  const { data: contexts } = useContexts();
  const ticketsContextName = contexts.find((item) => item.id === ticketsContext)?.name ?? ticketsContext;
  const { data: tasks, isLoading } = useTasks(ticketsContext);
  const { data: projects } = useProjects(ticketsContext);
  const activeProjects = useMemo(() => projects.filter((p) => !p.archived), [projects]);

  const tickets = useMemo(() => tasks.filter((task) => task.isTicket), [tasks]);
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

  const overdueCount = pendingTickets.filter((t) => getDueMeta(typeof t.dueDate === "string" ? t.dueDate : undefined)?.isOverdue).length;
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
    if (!editId || loadedEditId.current === editId) return;
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

    const result = ticketFormSchema.safeParse(form);
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
        context: ticketsContext,
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
        toast({ variant: "success", title: "Ticket creado", description: `Se agregó a tu tablero de ${ticketsContextName}.` });
      }

      closeForm();
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = (ticketId: string) => {
    if (!user || !firestore) return;
    const deletedTicket = tickets.find((ticket) => ticket.id === ticketId);
    deleteTask(firestore, user.uid, ticketId);
    if (!deletedTicket) {
      toast({ variant: "warning", title: "Ticket eliminado" });
      return;
    }
    toastWithUndo({
      title: "Ticket eliminado",
      description: deletedTicket.title,
      onUndo: () => restoreUserDocument(firestore, user.uid, "tasks", deletedTicket),
    });
  };

  const handleMove = (ticketId: string, status: string) => {
    if (!user || !firestore || !isTaskStatus(status)) return;
    updateTask(firestore, user.uid, ticketId, { status });
    toast({ variant: "success", title: "Estado actualizado" });
  };

  if (isUserLoading) return null;

  if (!user) return <PublicTicketForm />;

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
        <FormPanel ref={formRef} title={editingTicket ? "Editar Ticket" : "Nuevo Ticket"} onClose={closeForm}>
          <Field label="Título corto">
            <Input
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              placeholder="Ej. Ajustar reporte mensual"
              className={fieldInputClassName}
            />
          </Field>

          <Field label="Acción que se solicita">
            <Textarea
              value={form.requestedAction}
              onChange={(e) => setForm({ ...form, requestedAction: e.target.value })}
              placeholder="¿Qué necesitas que se haga exactamente?"
              className="min-h-[80px] rounded-2xl border-border bg-muted/20"
            />
          </Field>

          <Field label="Descripción">
            <Textarea
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              placeholder="Contexto adicional de la tarea"
              className="min-h-[80px] rounded-2xl border-border bg-muted/20"
            />
          </Field>

          <Field label="Nombre de quien lo pide">
            <Input
              value={form.requesterName}
              onChange={(e) => setForm({ ...form, requesterName: e.target.value })}
              placeholder="Ej. María, equipo de marketing..."
              className={fieldInputClassName}
            />
          </Field>

          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Fecha límite">
              <Input
                type="date"
                value={form.dueDate}
                onChange={(e) => setForm({ ...form, dueDate: e.target.value })}
                className={fieldInputClassName}
              />
            </Field>
            <Field label="Fecha de revisión">
              <Input
                type="date"
                value={form.reviewDate}
                onChange={(e) => setForm({ ...form, reviewDate: e.target.value })}
                className={fieldInputClassName}
              />
            </Field>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Prioridad">
              <PrioritySelect value={form.priority} onChange={(priority) => setForm({ ...form, priority })} />
            </Field>
            <Field label="Proyecto">
              <ProjectSelect value={form.projectId} onChange={(projectId) => setForm({ ...form, projectId })} projects={activeProjects} />
            </Field>
          </div>

          <Field label="Etiquetas">
            <Input
              value={form.tags}
              onChange={(e) => setForm({ ...form, tags: e.target.value })}
              placeholder="cliente, urgente, diseño"
              className={fieldInputClassName}
            />
          </Field>

          <Field
            label={
              <span className="flex items-center gap-1.5">
                <LinkIcon className="h-3.5 w-3.5 text-primary" /> Link de referencia (opcional)
              </span>
            }
          >
            <Input
              value={form.referenceUrl}
              onChange={(e) => setForm({ ...form, referenceUrl: e.target.value })}
              placeholder="https://drive.google.com/..."
              className={fieldInputClassName}
            />
            <p className="text-[10px] text-muted-foreground/70">
              Adjuntar múltiples documentos con comentario llega en una futura iteración. Por ahora puedes dejar aquí un único link de referencia.
            </p>
          </Field>

          <SubmitButton onClick={handleSubmit} isSaving={isSaving}>
            {editingTicket ? "Guardar cambios" : "Crear ticket"}
          </SubmitButton>
        </FormPanel>
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
            const dueMeta = getDueMeta(typeof ticket.dueDate === "string" ? ticket.dueDate : undefined);
            const reviewMeta = getDueMeta(ticket.reviewDate);
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

const PUBLIC_INITIAL_FORM = {
  title: "",
  requestedAction: "",
  description: "",
  requesterName: "",
  dueDate: "",
  referenceUrl: "",
  priority: "media" as Priority,
  website: "",
};

function PublicTicketForm() {
  const [form, setForm] = useState(PUBLIC_INITIAL_FORM);
  const [isSaving, setIsSaving] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = async () => {
    const result = publicTicketFormSchema.safeParse(form);
    if (!result.success) {
      toast({ variant: "destructive", title: "Error", description: result.error.errors[0].message });
      return;
    }

    setIsSaving(true);
    try {
      const response = await fetch("/api/tickets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: result.data.title,
          requestedAction: result.data.requestedAction,
          description: result.data.description || undefined,
          requesterName: result.data.requesterName,
          priority: result.data.priority,
          dueDate: result.data.dueDate || undefined,
          referenceUrl: result.data.referenceUrl || undefined,
          website: form.website || undefined,
        }),
      });

      if (!response.ok) {
        const body = await response.json().catch(() => null);
        throw new Error(typeof body?.error === "string" ? body.error : "No se pudo enviar el ticket. Intenta de nuevo.");
      }

      setSubmitted(true);
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Error",
        description: error instanceof Error && error.message ? error.message : "No se pudo enviar el ticket. Intenta de nuevo.",
      });
    } finally {
      setIsSaving(false);
    }
  };

  if (submitted) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 max-w-md mx-auto py-24 text-center">
        <CalendarCheck className="w-12 h-12 text-primary" />
        <h1 className="text-xl font-black uppercase tracking-tight">Ticket enviado</h1>
        <p className="text-sm text-muted-foreground">Tu solicitud fue recibida. Te contactarán cuando sea revisada.</p>
        <Button onClick={() => { setForm(PUBLIC_INITIAL_FORM); setSubmitted(false); }} variant="outline" className="rounded-xl">
          Enviar otro ticket
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 max-w-lg mx-auto pb-12 w-full">
      <div className="space-y-1">
        <h1 className="text-2xl md:text-3xl font-black tracking-tighter uppercase flex items-center gap-2">
          <TicketIcon className="w-6 h-6 text-primary" /> Nuevo Ticket
        </h1>
        <p className="text-[9px] text-muted-foreground font-black uppercase tracking-[0.4em]">
          Solicita una tarea de trabajo
        </p>
      </div>

      <div className="glass-card-elevated border border-border rounded-3xl p-5 sm:p-6 space-y-4 w-full">
        {/* Campo trampa anti-spam: invisible para personas */}
        <input
          type="text"
          name="website"
          tabIndex={-1}
          autoComplete="off"
          aria-hidden="true"
          value={form.website}
          onChange={(e) => setForm({ ...form, website: e.target.value })}
          className="absolute -left-[9999px] h-0 w-0 opacity-0"
        />
        <Field label="Título corto">
          <Input
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
            placeholder="Ej. Ajustar reporte mensual"
            className={fieldInputClassName}
          />
        </Field>

        <Field label="Acción que se solicita">
          <Textarea
            value={form.requestedAction}
            onChange={(e) => setForm({ ...form, requestedAction: e.target.value })}
            placeholder="¿Qué necesitas que se haga exactamente?"
            className="min-h-[80px] rounded-2xl border-border bg-muted/20"
          />
        </Field>

        <Field label="Descripción">
          <Textarea
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            placeholder="Contexto adicional de la tarea"
            className="min-h-[80px] rounded-2xl border-border bg-muted/20"
          />
        </Field>

        <Field label="Tu nombre">
          <Input
            value={form.requesterName}
            onChange={(e) => setForm({ ...form, requesterName: e.target.value })}
            placeholder="Ej. María, equipo de marketing..."
            className={fieldInputClassName}
          />
        </Field>

        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Fecha límite">
            <Input
              type="date"
              value={form.dueDate}
              onChange={(e) => setForm({ ...form, dueDate: e.target.value })}
              className={fieldInputClassName}
            />
          </Field>
          <Field label="Prioridad">
            <PrioritySelect value={form.priority} onChange={(priority) => setForm({ ...form, priority })} />
          </Field>
        </div>

        <Field
          label={
            <span className="flex items-center gap-1.5">
              <LinkIcon className="h-3.5 w-3.5 text-primary" /> Link de referencia (opcional)
            </span>
          }
        >
          <Input
            value={form.referenceUrl}
            onChange={(e) => setForm({ ...form, referenceUrl: e.target.value })}
            placeholder="https://drive.google.com/..."
            className={fieldInputClassName}
          />
        </Field>

        <SubmitButton onClick={handleSubmit} isSaving={isSaving}>
          Crear ticket
        </SubmitButton>
      </div>
    </div>
  );
}
