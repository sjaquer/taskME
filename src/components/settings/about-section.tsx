"use client";

import { useEffect, useState } from "react";
import { getDocs, collection } from "firebase/firestore";
import { useFirestore, useUser } from "@/firebase/provider";
import { getVoiceSource } from "@/lib/native-features";
import { isNativeAndroidContainer } from "@/lib/native-bridge";

interface Diagnostics {
  environment: string;
  online: boolean;
  notifications: string;
  voice: string;
  devices: number | null;
}

/** Versión y estado del dispositivo, útil para revisar la integración con la APK. */
export function AboutSection() {
  const firestore = useFirestore();
  const { user } = useUser();
  const [diagnostics, setDiagnostics] = useState<Diagnostics | null>(null);

  useEffect(() => {
    const environment = !isNativeAndroidContainer()
      ? "Navegador"
      : typeof window.AndroidBridge?.postMessage === "function"
        ? "App Android (puente completo)"
        : "App Android (AndroidNative)";
    const notifications = !("Notification" in window)
      ? "No disponibles en este entorno"
      : Notification.permission === "granted"
        ? "Permitidas"
        : Notification.permission === "denied"
          ? "Bloqueadas"
          : "Sin decidir";
    const voiceSource = getVoiceSource();
    const voice = voiceSource === "native" ? "Micrófono de la app" : voiceSource === "web" ? "Navegador" : "No disponible";

    setDiagnostics({ environment, online: navigator.onLine, notifications, voice, devices: null });

    if (!user) return;
    getDocs(collection(firestore, "users", user.uid, "devices"))
      .then((snapshot) => setDiagnostics((current) => (current ? { ...current, devices: snapshot.size } : current)))
      .catch((error) => console.warn("No se pudieron leer los dispositivos:", error));
  }, [firestore, user]);

  const rows: [string, string][] = diagnostics
    ? [
        ["Versión", process.env.NEXT_PUBLIC_APP_VERSION ?? "—"],
        ["Entorno", diagnostics.environment],
        ["Conexión", diagnostics.online ? "En línea" : "Sin conexión"],
        ["Notificaciones del navegador", diagnostics.notifications],
        ["Dictado por voz", diagnostics.voice],
        ["Dispositivos con push registrados", diagnostics.devices === null ? "…" : String(diagnostics.devices)],
      ]
    : [];

  return (
    <dl className="glass-card divide-y divide-border">
      {rows.map(([label, value]) => (
        <div key={label} className="flex items-center justify-between gap-3 px-4 py-3 text-sm">
          <dt className="text-muted-foreground">{label}</dt>
          <dd className="text-right font-medium">{value}</dd>
        </div>
      ))}
    </dl>
  );
}
