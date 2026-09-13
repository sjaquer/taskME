"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { z } from "zod";
import { NotebookText, Plus, Pencil, Trash2, Inbox, X, Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAppContextStore } from "@/lib/store";
import { useFirestore, useMemoFirebase, useUser } from "@/firebase/provider";
import { useCollection } from "@/firebase/firestore/use-collection";
import { toast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { buildNotesQuery, createNote, updateNote, deleteNote } from "@/services/note-service";
import type { Note, NoteCategory } from "@/types/task";

const CATEGORIES: NoteCategory[] = ["Clases", "Tareas", "Grupos", "Trabajo", "Tickets", "Otro"];

const NoteSchema = z.object({
  title: z.string().trim().min(1, "El título es requerido").max(140),
  content: z.string().trim().min(1, "Escribe el contenido de la nota").max(5000),
  category: z.enum(["Clases", "Tareas", "Grupos", "Trabajo", "Tickets", "Otro"]),
});

interface NoteFormState {
  title: string;
  content: string;
  category: NoteCategory;
}

const INITIAL_FORM: NoteFormState = { title: "", content: "", category: "Otro" };

export default function NotesPage() {
  const { context } = useAppContextStore();
  const { user, isUserLoading } = useUser();
  const firestore = useFirestore();
  const router = useRouter();
  const formRef = useRef<HTMLDivElement>(null);

  const [form, setForm] = useState<NoteFormState>(INITIAL_FORM);
  const [editingNote, setEditingNote] = useState<Note | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [categoryFilter, setCategoryFilter] = useState<NoteCategory | "all">("all");

  useEffect(() => {
    if (!isUserLoading && !user) router.push("/login");
  }, [user, isUserLoading, router]);

  const notesQuery = useMemoFirebase(() => {
    if (!firestore || !user) return null;
    return buildNotesQuery(firestore, user.uid, context);
  }, [firestore, user, context]);

  const { data: notes, isLoading } = useCollection<Note>(notesQuery);

  const visibleNotes = useMemo(() => {
    const list = notes || [];
    if (categoryFilter === "all") return list;
    return list.filter((note) => note.category === categoryFilter);
  }, [notes, categoryFilter]);

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

    const result = NoteSchema.safeParse(form);
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
    deleteNote(firestore, user.uid, noteId);
    toast({ variant: "warning", title: "Nota eliminada" });
  };

  if (isUserLoading || !user) return null;

  return (
    <div className="flex flex-col gap-6 max-w-3xl mx-auto pb-12 w-full">
      {/* Header */}
      <div className="space-y-1">
        <h1 className="text-2xl md:text-4xl font-black tracking-tighter uppercase flex items-center gap-2">
          <NotebookText className="w-6 h-6 text-primary" /> Notas <span className="text-primary italic glow-text">{context}</span>
        </h1>
        <p className="text-[9px] text-muted-foreground font-black uppercase tracking-[0.4em]">
          Recordatorios y apuntes rápidos
        </p>
      </div>

      {!formOpen && (
        <Button
          type="button"
          onClick={openCreateForm}
          className="h-12 w-full rounded-2xl bg-primary text-xs font-black uppercase tracking-widest text-primary-foreground hover:bg-primary/95"
        >
          <Plus className="mr-2 h-4 w-4" /> Nueva Nota
        </Button>
      )}

      {/* Formulario embebido — sin modal */}
      {formOpen && (
        <div ref={formRef} className="glass-card-elevated border border-border rounded-3xl p-5 sm:p-6 space-y-4 w-full">
          <div className="flex items-center justify-between border-b border-border/40 pb-3">
            <h3 className="text-lg font-black uppercase tracking-tighter text-foreground">
              {editingNote ? "Editar Nota" : "Nueva Nota"}
            </h3>
            <button type="button" onClick={closeForm} className="h-8 w-8 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted/40">
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="space-y-2">
            <Label className="text-[10px] font-black uppercase tracking-[0.3em] text-muted-foreground">Título</Label>
            <Input
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              placeholder="Ej. Apuntes de la clase de hoy"
              className="h-11 rounded-2xl border-border bg-muted/20"
            />
          </div>

          <div className="space-y-2">
            <Label className="text-[10px] font-black uppercase tracking-[0.3em] text-muted-foreground">Categoría</Label>
            <Select value={form.category} onValueChange={(v) => setForm({ ...form, category: v as NoteCategory })}>
              <SelectTrigger className="h-11 rounded-2xl border-border bg-muted/20">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="border-border bg-card">
                {CATEGORIES.map((cat) => (
                  <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label className="text-[10px] font-black uppercase tracking-[0.3em] text-muted-foreground">Contenido</Label>
            <Textarea
              value={form.content}
              onChange={(e) => setForm({ ...form, content: e.target.value })}
              placeholder="Escribe tu recordatorio o apunte..."
              className="min-h-[140px] rounded-2xl border-border bg-muted/20"
            />
          </div>

          <div className="pt-2 border-t border-border/40">
            <Button
              type="button"
              onClick={handleSubmit}
              disabled={isSaving}
              className="h-11 w-full rounded-2xl bg-primary text-[10px] font-black uppercase tracking-[0.3em] text-primary-foreground"
            >
              {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />}
              {editingNote ? "Guardar cambios" : "Crear nota"}
            </Button>
          </div>
        </div>
      )}

      {/* Filtro por categoría */}
      <div className="flex items-center gap-1 flex-wrap bg-muted/30 p-1 rounded-2xl border border-border">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => setCategoryFilter("all")}
          className={cn(
            "h-9 rounded-xl text-[10px] font-black uppercase tracking-wider px-3 transition-all",
            categoryFilter === "all" ? "bg-primary/20 text-primary border border-primary/30" : "text-muted-foreground hover:text-foreground"
          )}
        >
          Todas
        </Button>
        {CATEGORIES.map((cat) => (
          <Button
            key={cat}
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setCategoryFilter(cat)}
            className={cn(
              "h-9 rounded-xl text-[10px] font-black uppercase tracking-wider px-3 transition-all",
              categoryFilter === cat ? "bg-primary/20 text-primary border border-primary/30" : "text-muted-foreground hover:text-foreground"
            )}
          >
            {cat}
          </Button>
        ))}
      </div>

      {/* Lista de notas */}
      <div className="space-y-3">
        {isLoading ? (
          <div className="space-y-3">
            {[0, 1, 2].map((i) => <div key={i} className="h-24 animate-pulse rounded-2xl border border-border bg-muted/15" />)}
          </div>
        ) : visibleNotes.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border bg-muted/10 px-6 py-12 text-center">
            <Inbox className="mx-auto w-10 h-10 text-muted-foreground/30" />
            <p className="mt-3 text-sm font-bold text-foreground">No hay notas en esta categoría.</p>
          </div>
        ) : (
          visibleNotes.map((note) => (
            <div key={note.id} className="rounded-2xl border border-border bg-card/70 p-4 space-y-2">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 space-y-1">
                  <Badge variant="outline" className="rounded-full text-[10px] font-black uppercase tracking-widest border-border bg-muted/40 text-muted-foreground">
                    {note.category}
                  </Badge>
                  <h4 className="text-[15px] font-black leading-tight text-foreground">{note.title}</h4>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Button type="button" variant="ghost" size="icon" onClick={() => openEditForm(note)} className="h-9 w-9 rounded-xl border border-border bg-muted/20 text-muted-foreground hover:text-primary">
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button type="button" variant="ghost" size="icon" onClick={() => handleDelete(note.id)} className="h-9 w-9 rounded-xl border border-border bg-muted/20 text-muted-foreground hover:text-red-400">
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              <p className="text-sm text-muted-foreground whitespace-pre-wrap leading-relaxed">{note.content}</p>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
