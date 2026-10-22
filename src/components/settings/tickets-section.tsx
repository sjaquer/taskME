"use client";

import Link from "next/link";
import { ExternalLink, Inbox, Share2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { shareTicketFormLink } from "@/components/tickets/share-ticket-link";

/** Accesos de Tickets: compartir el formulario público y administrar lo recibido. */
export function TicketsSection() {
  return (
    <div className="glass-card space-y-3 p-4">
      <p className="text-[11px] text-muted-foreground">
        Comparte el enlace del formulario: quien lo abra puede enviarte una solicitud sin entrar a la app. Los tickets
        llegan a tu Tablero.
      </p>
      <Button onClick={shareTicketFormLink} className="h-10 w-full gap-2 rounded-xl text-xs font-bold">
        <Share2 className="h-4 w-4" />
        Compartir enlace del formulario
      </Button>
      <div className="grid grid-cols-2 gap-2">
        <Button asChild variant="outline" className="h-10 gap-2 rounded-xl text-xs font-bold">
          <Link href="/tickets/admin">
            <Inbox className="h-4 w-4" />
            Administrar
          </Link>
        </Button>
        <Button asChild variant="outline" className="h-10 gap-2 rounded-xl text-xs font-bold">
          <Link href="/tickets">
            <ExternalLink className="h-4 w-4" />
            Ver formulario
          </Link>
        </Button>
      </div>
    </div>
  );
}
