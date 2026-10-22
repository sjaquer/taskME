"use client";

import Link from "next/link";
import { Settings2 } from "lucide-react";
import { useUser } from "@/firebase/provider";
import { PublicTicketForm } from "@/components/tickets/public-ticket-form";

/**
 * Página pública: es el enlace que se comparte para que otros envíen tickets.
 * Si quien la abre es el dueño con sesión, solo ve un acceso a la administración.
 */
export default function TicketsPublicPage() {
  const { user } = useUser();
  const isOwnerSession = !!user && !user.isAnonymous;

  return (
    <div className="min-h-[100dvh] w-full px-4 pb-12 pt-[calc(2rem+env(safe-area-inset-top))]">
      {isOwnerSession && (
        <div className="mx-auto mb-6 flex max-w-lg justify-end">
          <Link
            href="/tickets/admin"
            className="flex h-9 items-center gap-1.5 rounded-xl border border-border px-3 text-xs font-semibold text-muted-foreground transition-colors hover:border-primary/40 hover:text-primary"
          >
            <Settings2 className="h-4 w-4" />
            Administrar tickets
          </Link>
        </div>
      )}
      <PublicTicketForm />
    </div>
  );
}
