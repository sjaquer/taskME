"use client";

import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Pencil,
  Trash2,
  Link as LinkIcon,
  CalendarClock,
  CalendarCheck,
  UserRound,
  Inbox,
  Search,
  Share2,
  ExternalLink,
} from "lucide-react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PageHeader } from "@/components/layout/page-header";
import { Segmented } from "@/components/forms/segmented";
import { Field, FormPanel, PrioritySelect, ProjectSelect, SubmitButton, fieldInputClassName } from "@/components/forms/form-fields";
import { useFirestore, useUser } from "@/firebase/provider";
import { useContexts, useProjects, useTasks } from "@/firebase/user-data";
import { useAppContextStore } from "@/lib/store";
import { toast } from "@/hooks/use-toast";
import { haptic } from "@/lib/native-features";
import { cn, pluralize } from "@/lib/utils";
import { getDueMeta, isTaskStatus, parseTagInput, sortTasks, toInputDateValue } from "@/lib/tasks";
import { ticketFormSchema } from "@/lib/schemas";
import { createTask, deleteTask, updateTask } from "@/services/task-service";
import { restoreUserDocument } from "@/services/restore-service";
import { toastWithUndo } from "@/components/undo-toast";
import { shareTicketFormLink } from "@/components/tickets/share-ticket-link";
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

/** Gestión de tickets (solo con sesión). El formulario público vive en /tickets. */
export default function TicketsAdminPage() {
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

  const [view, setView] = useState<"pending" | "history">("pending");
  const [searchQuery, setSearchQuery] = useState("");

  const tickets = useMemo(() => tasks.filter((task) => task.isTicket), [tasks]);
  const pendingTickets = useMemo(
    () =>
      tickets
        .filter((t) => t.status !== "Hecho")
        .sort((a, b) => {
          // Por fecha de revisión o límite; los que no tienen fecha van al final.
          const aDate = a.reviewDate || (typeof a.dueDate === "string" ? a.dueDate : "") || "9999";
          const bDate = b.reviewDate || (typeof b.dueDate === "string" ? b.dueDate : "") || "9999";
          return aDate.localeCompare(bDate);
        }),
    [tickets]
  );
  const doneTickets = useMemo(
    () => sortTasks(tickets.filter((t) => t.status === "Hecho"), "recent"),
    [tickets]
  );
  const visibleTickets = useMemo(() => {
    const list = view === "pending" ? pendingTickets : doneTickets;
    const query = searchQuery.trim().toLowerCase();
    if (!query) return list;
    return list.filter((ticket) =>
      [ticket.title, ticket.requestedAction, ticket.requesterName, ticket.description]
        .some((field) => field?.toLowerCase().includes(query))
    );
  }, [view, pendingTickets, doneTickets, searchQuery]);

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

  // Deep-link desde el Tablero: /tickets/admin?edit=<id>
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
    if (searchParams.get("edit")) router.replace("/tickets/admin");
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
    haptic(25);
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
    haptic();
    updateTask(firestore, user.uid, ticketId, { status });
    toast({ variant: "success", title: "Estado actualizado" });
  };

  if (isUserLoading) return null;

  if (!user) return null;

  return (
    <div className="flex flex-col gap-6 max-w-3xl mx-auto pb-12 w-full">
      <PageHeader
        title="Tickets"
        summary={
          <>
            {pluralize(pendingTickets.length, "pendiente")} · {inProgressCount} en curso
            {overdueCount > 0 && <span className="text-red-400"> · {pluralize(overdueCount, "vencido")}</span>}
          </>
        }
        actionLabel={formOpen ? undefined : "Nuevo"}
        onAction={openCreateForm}
      />

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

      {/* Lista de tickets */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <Segmented
            ariaLabel="Ver tickets"
            value={view}
            onChange={setView}
            options={[
              { value: "pending", label: `Pendientes (${pendingTickets.length})` },
              { value: "history", label: `Historial (${doneTickets.length})` },
            ]}
          />
          <Link
            href="/tickets"
            aria-label="Abrir el formulario público"
            title="Abrir el formulario público"
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-border text-muted-foreground hover:text-primary"
          >
            <ExternalLink className="h-4 w-4" />
          </Link>
          <button
            type="button"
            onClick={shareTicketFormLink}
            aria-label="Compartir el formulario público de tickets"
            className="flex h-10 shrink-0 items-center gap-1.5 rounded-xl border border-border px-3 text-xs font-semibold text-muted-foreground hover:text-primary"
          >
            <Share2 className="h-4 w-4" />
            Compartir
          </button>
        </div>
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground/60" />
          <input
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            placeholder="Buscar por título, acción o solicitante"
            aria-label="Buscar tickets"
            className="h-10 w-full rounded-xl border border-border bg-transparent pl-9 pr-3 text-sm outline-none placeholder:text-muted-foreground/70 focus:border-primary/50"
          />
        </div>
        {isLoading ? (
          <div className="space-y-3">
            {[0, 1].map((i) => <div key={i} className="h-28 animate-pulse rounded-2xl border border-border bg-muted/15" />)}
          </div>
        ) : visibleTickets.length === 0 ? (
          <div className="px-6 py-12 text-center">
            <Inbox className="mx-auto h-8 w-8 text-muted-foreground/40" />
            <p className="mt-3 text-sm text-muted-foreground">
              {searchQuery.trim()
                ? "Ningún ticket coincide con la búsqueda."
                : view === "pending"
                  ? "No tienes tickets pendientes."
                  : "Todavía no hay tickets completados."}
            </p>
          </div>
        ) : (
          visibleTickets.map((ticket) => {
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
