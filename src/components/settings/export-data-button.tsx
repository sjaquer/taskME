"use client";

import { useState } from "react";
import { Download, Loader2 } from "lucide-react";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { useContexts, useNotes, useProjects, useRoutines, useTasks } from "@/firebase/user-data";
import { toast } from "@/hooks/use-toast";
import { isNativeAndroidContainer } from "@/lib/native-bridge";

function isTimestampLike(value: unknown): value is { seconds: number; nanoseconds: number } {
  return (
    !!value &&
    typeof value === "object" &&
    typeof (value as { seconds?: unknown }).seconds === "number" &&
    typeof (value as { nanoseconds?: unknown }).nanoseconds === "number"
  );
}

// Los Timestamp de Firestore se exportan como fecha ISO legible. (JSON.stringify
// aplica su toJSON antes del replacer, por eso llegan como { seconds, nanoseconds }.)
function serialize(value: unknown): string {
  return JSON.stringify(
    value,
    (_key, current) =>
      isTimestampLike(current) ? new Date(current.seconds * 1000 + current.nanoseconds / 1e6).toISOString() : current,
    2
  );
}

/** Descarga una copia de seguridad JSON con todos los datos del usuario. */
export function ExportDataButton() {
  const { data: tasks, isLoading: tasksLoading } = useTasks();
  const { data: notes, isLoading: notesLoading } = useNotes();
  const { data: routines, isLoading: routinesLoading } = useRoutines();
  const { data: projects, isLoading: projectsLoading } = useProjects();
  const { data: contexts, isLoading: contextsLoading } = useContexts();
  const [isExporting, setIsExporting] = useState(false);
  // No exportar hasta tener todas las colecciones: el respaldo saldría incompleto.
  const isLoadingData = tasksLoading || notesLoading || routinesLoading || projectsLoading || contextsLoading;

  const handleExport = async () => {
    setIsExporting(true);
    try {
      const fileName = `taskme-respaldo-${format(new Date(), "yyyy-MM-dd")}.json`;
      const content = serialize({
        app: "TaskMe",
        exportedAt: new Date().toISOString(),
        version: process.env.NEXT_PUBLIC_APP_VERSION,
        contexts,
        tasks,
        projects,
        notes,
        routines,
      });
      const file = new File([content], fileName, { type: "application/json" });

      // En el teléfono, compartir permite guardarlo en Drive/archivos o enviarlo.
      if (typeof navigator.canShare === "function" && navigator.canShare({ files: [file] })) {
        await navigator.share({ files: [file], title: fileName });
      } else {
        const url = URL.createObjectURL(file);
        const link = document.createElement("a");
        link.href = url;
        link.download = fileName;
        link.click();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
      }
      toast({
        variant: "success",
        title: "Respaldo generado",
        description: isNativeAndroidContainer()
          ? `${tasks.length} tareas y ${notes.length} notas. Si la app no lo guardó, expórtalo desde el navegador.`
          : `${tasks.length} tareas, ${notes.length} notas y ${routines.length} rutinas.`,
      });
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
      console.error("Error al exportar los datos:", error);
      toast({ variant: "destructive", title: "Error", description: "No se pudo generar el respaldo." });
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <Button onClick={handleExport} disabled={isExporting || isLoadingData} variant="outline" className="h-10 w-full gap-2 rounded-xl text-xs font-bold">
      {isExporting || isLoadingData ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
      {isLoadingData ? "Cargando datos…" : "Exportar mis datos (JSON)"}
    </Button>
  );
}
