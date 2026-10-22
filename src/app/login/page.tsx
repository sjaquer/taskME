"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { Loader2, LockKeyhole } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth, useUser } from "@/firebase";
import { unlockWithPin } from "@/firebase/pin-unlock";

/**
 * App personal (una sola persona, sin cuentas): se desbloquea con un PIN la
 * primera vez en cada dispositivo y la sesión queda recordada.
 */
export default function UnlockPage() {
  const auth = useAuth();
  const { user, isUserLoading } = useUser();
  const router = useRouter();
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");
  const [isUnlocking, setIsUnlocking] = useState(false);

  // Ya desbloqueada en este dispositivo: directo a la app.
  useEffect(() => {
    if (!isUserLoading && user && !user.isAnonymous) router.replace("/");
  }, [user, isUserLoading, router]);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!pin.trim()) return;
    setError("");
    setIsUnlocking(true);
    try {
      await unlockWithPin(auth, pin.trim());
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo desbloquear.");
      setPin("");
    } finally {
      setIsUnlocking(false);
    }
  };

  return (
    <main className="flex min-h-[100dvh] items-center justify-center px-6 pb-[env(safe-area-inset-bottom)] pt-[env(safe-area-inset-top)]">
      <form onSubmit={handleSubmit} className="w-full max-w-xs space-y-6 text-center">
        <div className="space-y-3">
          <Image src="/isotipo.svg" alt="TaskMe" width={56} height={56} className="mx-auto" priority />
          <h1 className="text-2xl font-black tracking-tight">TaskMe</h1>
          <p className="text-sm text-muted-foreground">Escribe tu PIN para usar la app en este dispositivo.</p>
        </div>

        <div className="space-y-2">
          <label htmlFor="pin" className="sr-only">
            PIN
          </label>
          <input
            id="pin"
            type="password"
            inputMode="numeric"
            autoComplete="current-password"
            autoFocus
            value={pin}
            onChange={(event) => setPin(event.target.value)}
            placeholder="PIN"
            aria-invalid={Boolean(error)}
            aria-describedby={error ? "pin-error" : undefined}
            className="h-14 w-full rounded-2xl border border-border bg-muted/20 text-center font-data text-2xl tracking-[0.5em] outline-none placeholder:tracking-normal placeholder:text-muted-foreground/60 focus:border-primary/60"
          />
          {error && (
            <p id="pin-error" role="alert" className="text-sm text-red-400">
              {error}
            </p>
          )}
        </div>

        <Button type="submit" disabled={isUnlocking || !pin.trim()} className="h-12 w-full gap-2 rounded-2xl text-sm font-bold">
          {isUnlocking ? <Loader2 className="h-4 w-4 animate-spin" /> : <LockKeyhole className="h-4 w-4" />}
          Desbloquear
        </Button>
      </form>
    </main>
  );
}
