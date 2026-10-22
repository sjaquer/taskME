"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Pencil, Pin, PinOff, Search, Trash2, Inbox } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PageHeader } from "@/components/layout/page-header";
import { VoiceButton } from "@/components/forms/voice-button";
import { Field, FormPanel, SubmitButton, fieldInputClassName } from "@/components/forms/form-fields";
import { useAppContextStore } from "@/lib/store";
import { useFirestore, useUser } from "@/firebase/provider";
import { useActiveContext, useNotes } from "@/firebase/user-data";
import { toast } from "@/hooks/use-toast";
import { haptic } from "@/lib/native-features";
import { cn } from "@/lib/utils";
import { noteSchema } from "@/lib/schemas";
import { getTimestampMillis } from "@/lib/tasks";
import { createNote, updateNote, deleteNote } from "@/services/note-service";
import { restoreUserDocument } from "@/services/restore-service";
import { toastWithUndo } from "@/components/undo-toast";
import type { Note, NoteCategory } from "@/types/task";

const CATEGORIES: NoteCategory[] = ["Clases", "Tareas", "Grupos", "Trabajo", "Tickets", "Otro"];

interface NoteFormState {
  title: string;
  content: string;
  category: NoteCategory;
}

const INITIAL_FORM: NoteFormState = { title: "", content: "", category: "Otro" };

export default function NotesPage() {
  const { context } = useAppContextStore();
  const activeContext = useActiveContext();
  const { user, isUserLoading } = useUser();
  const firestore = useFirestore();
  const formRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  const [form, setForm] = useState<NoteFormState>(INITIAL_FORM);
  const [editingNote, setEditingNote] = useState<Note | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [categoryFilter, setCategoryFilter] = useState<NoteCategory | "all">("all");


  const { data: notes, isLoading } = useNotes(context);

  const [searchQuery, setSearchQuery] = useState("");

  // Fijadas primero; luego la última editada arriba.
  const visibleNotes = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    return notes
      .filter((note) => categoryFilter === "all" || note.category === categoryFilter)
      .filter((note) => !query || note.title.toLowerCase().includes(query) || note.content.toLowerCase().includes(query))
      .sort(
        (a, b) =>
          Number(Boolean(b.pinned)) - Number(Boolean(a.pinned)) ||
          getTimestampMillis(b.updatedAt) - getTimestampMillis(a.updatedAt)
      );
  }, [notes, categoryFilter, searchQuery]);

  const togglePin = (note: Note) => {
    if (!user) return;
    haptic();
    updateNote(firestore, user.uid, note.id, { pinned: !note.pinned });
  };

  const openCreateForm = () => {
    setEditingNote(null);
    setForm(INITIAL_FORM);
    setFormOpen(true);
    requestAnimationFrame(() => formRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }));
  };

  const openEditForm = (note: Note) => {
    setEditingNote(note);
    setForm({ title: note.title, content: note.content, category: note.category });
    setFormOpen(true);
    requestAnimationFrame(() => formRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }));
  };

  const closeForm = () => {
    setEditingNote(null);
    setForm(INITIAL_FORM);
    setFormOpen(false);
  };

  const handleSubmit = async () => {
    if (!user || !firestore) return;

    const result = noteSchema.safeParse(form);
    if (!result.success) {
      toast({ variant: "destructive", title: "Error", description: result.error.errors[0].message });
      return;
    }

    setIsSaving(true);
    try {
      if (editingNote) {
        updateNote(firestore, user.uid, editingNote.id, result.data);
        toast({ variant: "success", title: "Nota actualizada" });
      } else {
        createNote(firestore, user.uid, { ...result.data, context });
        toast({ variant: "success", title: "Nota creada" });
      }
      closeForm();
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = (noteId: string) => {
    if (!user || !firestore) return;
    const deletedNote = notes.find((note) => note.id === noteId);
    haptic(25);
    deleteNote(firestore, user.uid, noteId);
    if (!deletedNote) {
      toast({ variant: "warning", title: "Nota eliminada" });
      return;
    }
    toastWithUndo({
      title: "Nota eliminada",
      description: deletedNote.title,
      onUndo: () => restoreUserDocument(firestore, user.uid, "notes", deletedNote),
    });
  };

  // Enlace directo (atajo "Nueva nota"): /notes?new=1
  useEffect(() => {
    if (!user || !new URLSearchParams(window.location.search).has("new")) return;
    openCreateForm();
    router.replace("/notes");
    // openCreateForm solo cambia estado local; basta con ejecutarlo al tener sesión.
  }, [user, router]);

  if (isUserLoading || !user) return null;

  return (
    <div className="flex flex-col gap-6 max-w-3xl mx-auto pb-12 w-full">
      <PageHeader
        title="Notas"
        summary={`${notes.length} ${notes.length === 1 ? "nota" : "notas"} en ${activeContext.name}`}
        actionLabel={formOpen ? undefined : "Nueva"}
        onAction={openCreateForm}
      />

      {/* Formulario embebido — sin modal */}
      {formOpen && (
        <FormPanel ref={formRef} title={editingNote ? "Editar Nota" : "Nueva Nota"} onClose={closeForm}>
          <Field label="Título">
            <Input
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              placeholder="Ej. Apuntes de la clase de hoy"
              className={fieldInputClassName}
            />
          </Field>

          <Field label="Categoría">
            <Select value={form.category} onValueChange={(v) => setForm({ ...form, category: v as NoteCategory })}>
              <SelectTrigger className={fieldInputClassName}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="border-border bg-card">
                {CATEGORIES.map((cat) => (
                  <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>

          <Field
            label={
              <span className="flex items-center justify-between">
                Contenido
                <VoiceButton
                  onText={(text) => setForm((current) => ({ ...current, content: current.content ? `${current.content} ${text}` : text }))}
                  className="h-7 w-7"
                />
              </span>
            }
          >
            <Textarea
              value={form.content}
              onChange={(e) => setForm({ ...form, content: e.target.value })}
              placeholder="Escribe tu recordatorio o apunte..."
              className="min-h-[140px] rounded-2xl border-border bg-muted/20"
            />
          </Field>

          <SubmitButton onClick={handleSubmit} isSaving={isSaving}>
            {editingNote ? "Guardar cambios" : "Crear nota"}
          </SubmitButton>
        </FormPanel>
      )}

      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground/60" />
        <input
          value={searchQuery}
          onChange={(event) => setSearchQuery(event.target.value)}
          placeholder="Buscar en notas"
          aria-label="Buscar notas"
          className="h-10 w-full rounded-xl border border-border bg-transparent pl-9 pr-3 text-sm outline-none placeholder:text-muted-foreground/70 focus:border-primary/50"
        />
      </div>

      {/* Filtro por categoría */}
      <div className="flex gap-1.5 overflow-x-auto scrollbar-hide" role="group" aria-label="Filtrar por categoría">
        {(["all", ...CATEGORIES] as const).map((cat) => (
          <button
            key={cat}
            type="button"
            aria-pressed={categoryFilter === cat}
            onClick={() => setCategoryFilter(cat)}
            className={cn(
              "flex h-8 shrink-0 items-center rounded-full border px-3 text-xs font-medium transition-colors",
              categoryFilter === cat ? "border-primary/40 bg-primary/10 text-primary" : "border-border text-muted-foreground hover:text-foreground"
            )}
          >
            {cat === "all" ? "Todas" : cat}
          </button>
        ))}
      </div>

      {/* Lista de notas */}
      <div className="space-y-3">
        {isLoading ? (
          <div className="space-y-3">
            {[0, 1, 2].map((i) => <div key={i} className="h-24 animate-pulse rounded-2xl border border-border bg-muted/15" />)}
          </div>
        ) : visibleNotes.length === 0 ? (
          <div className="px-6 py-12 text-center">
            <Inbox className="mx-auto h-8 w-8 text-muted-foreground/40" />
            <p className="mt-3 text-sm text-muted-foreground">
              {searchQuery.trim() ? "Ninguna nota coincide con la búsqueda." : "No hay notas en esta categoría."}
            </p>
          </div>
        ) : (
          visibleNotes.map((note) => (
            <article key={note.id} className="group rounded-2xl border border-border p-4 transition-colors hover:border-primary/30">
              <div className="flex items-start gap-2">
                <button type="button" onClick={() => openEditForm(note)} className="min-w-0 flex-1 text-left">
                  <p className="text-[11px] text-muted-foreground">{note.category}</p>
                  <h4 className="mt-0.5 font-semibold leading-snug">{note.title}</h4>
                </button>
                <div className="flex shrink-0 items-center">
                  <IconAction
                    label={note.pinned ? `Desfijar "${note.title}"` : `Fijar "${note.title}"`}
                    onClick={() => togglePin(note)}
                    className={note.pinned ? "text-primary" : undefined}
                  >
                    {note.pinned ? <PinOff className="h-4 w-4" /> : <Pin className="h-4 w-4" />}
                  </IconAction>
                  <IconAction label={`Editar "${note.title}"`} onClick={() => openEditForm(note)}>
                    <Pencil className="h-4 w-4" />
                  </IconAction>
                  <IconAction label={`Eliminar "${note.title}"`} onClick={() => handleDelete(note.id)} className="hover:text-red-400">
                    <Trash2 className="h-4 w-4" />
                  </IconAction>
                </div>
              </div>
              <p className="mt-2 line-clamp-6 whitespace-pre-wrap text-sm leading-relaxed text-muted-foreground">{note.content}</p>
            </article>
          ))
        )}
      </div>
    </div>
  );
}

function IconAction({
  label,
  onClick,
  className,
  children,
}: {
  label: string;
  onClick: () => void;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      className={cn(
        "flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted/40 hover:text-foreground",
        className
      )}
    >
      {children}
    </button>
  );
}
