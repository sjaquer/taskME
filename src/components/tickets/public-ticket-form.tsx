"use client";

import { useState } from "react";
import { CalendarCheck, Link as LinkIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Field, PrioritySelect, SubmitButton, fieldInputClassName } from "@/components/forms/form-fields";
import { AttachmentPicker } from "@/components/attachments/attachment-picker";
import { MAX_PUBLIC_ATTACHMENTS, type CompressedImage } from "@/lib/images";
import type { AttachmentDraft } from "@/services/attachment-service";
import { toast } from "@/hooks/use-toast";
import { publicTicketFormSchema } from "@/lib/schemas";
import type { Priority } from "@/types/task";

const PUBLIC_INITIAL_FORM = {
  title: "",
  requestedAction: "",
  description: "",
  requesterName: "",
  dueDate: "",
  referenceUrl: "",
  priority: "media" as Priority,
  attachments: [] as AttachmentDraft[],
  website: "",
};

/** Formulario público: cualquiera con el enlace /tickets puede enviarte una solicitud. */
export function PublicTicketForm() {
  const [form, setForm] = useState(PUBLIC_INITIAL_FORM);
  const [isSaving, setIsSaving] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = async () => {
    const preparedAttachments = form.attachments.map((att) => ({
      name: att.name,
      mime: att.mime,
      size: att.size,
      width: att.width,
      height: att.height,
      thumb: att.thumb,
      dataUrl: att.dataUrl ?? "",
    }));
    const result = publicTicketFormSchema.safeParse({
      ...form,
      attachments: preparedAttachments.length > 0 ? preparedAttachments : undefined,
    });
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
          attachments: result.data.attachments,
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
        <h1 className="text-xl font-black tracking-tight">Solicitud enviada</h1>
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
        <h1 className="text-2xl font-black tracking-tight">Enviar una solicitud</h1>
        <p className="text-sm text-muted-foreground">Describe lo que necesitas y te responderé en cuanto lo revise.</p>
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

        <Field label="Imágenes (opcional)">
          <AttachmentPicker
            value={form.attachments}
            onChange={(attachments) => setForm({ ...form, attachments })}
            toDraft={(image: CompressedImage): AttachmentDraft => ({
              id: typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : `pub-${Date.now()}-${Math.random().toString(36).slice(2)}`,
              name: image.name,
              mime: image.mime,
              size: image.size,
              width: image.width,
              height: image.height,
              thumb: image.thumb,
              dataUrl: image.dataUrl,
            })}
            max={MAX_PUBLIC_ATTACHMENTS}
          />
        </Field>

        <SubmitButton onClick={handleSubmit} isSaving={isSaving}>
          Crear ticket
        </SubmitButton>
      </div>
    </div>
  );
}
