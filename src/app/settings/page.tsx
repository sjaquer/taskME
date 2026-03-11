
"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { 
  Bell, 
  Shield, 
  LogOut, 
  Zap, 
  Layout, 
  Check, 
  RefreshCcw,
  KeyRound,
  Eye,
  EyeOff,
  Settings as SettingsIcon,
  Fingerprint
} from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useUser, useAuth, useFirestore, useDoc, useMemoFirebase } from "@/firebase";
import { updateProfile, updatePassword, signOut } from "firebase/auth";
import { doc, updateDoc, setDoc, serverTimestamp } from "firebase/firestore";
import { useAppContextStore } from "@/lib/store";
import { toast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";

export default function SettingsPage() {
  const { user } = useUser();
  const auth = useAuth();
  const firestore = useFirestore();
  const { activeModules, toggleModule } = useAppContextStore();

  const [newName, setNewName] = useState(user?.displayName || "");
  const [isUpdatingName, setIsUpdatingName] = useState(false);
  const [passwords, setPasswords] = useState({ new: "", confirm: "" });
  const [showPass, setShowPass] = useState(false);

  useEffect(() => {
    if (user?.displayName) setNewName(user.displayName);
  }, [user]);

  const settingsRef = useMemoFirebase(() => {
    if (!firestore || !user) return null;
    return doc(firestore, "users", user.uid, "settings", "app");
  }, [firestore, user]);

  const saveSettingsToCloud = (updates: Record<string, unknown>) => {
    if (!settingsRef) return;
    updateDoc(settingsRef, { ...updates, updatedAt: serverTimestamp() }).catch(() => {
      setDoc(settingsRef, { ...updates, updatedAt: serverTimestamp() }, { merge: true });
    });
  };

  const handleUpdateName = async () => {
    if (!user || !newName.trim()) return;
    setIsUpdatingName(true);
    try {
      await updateProfile(user, { displayName: newName });
      if (firestore) {
        await setDoc(doc(firestore, "users", user.uid), { displayName: newName, updatedAt: serverTimestamp() }, { merge: true });
      }
      toast({ title: "Perfil actualizado" });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Error desconocido';
      toast({ variant: "destructive", title: "Error", description: message });
    } finally {
      setIsUpdatingName(false);
    }
  };

  const handleChangePassword = async () => {
    if (!user || passwords.new !== passwords.confirm) {
      toast({ variant: "destructive", title: "Error", description: "Las contraseÃ±as no coinciden." });
      return;
    }
    try {
      await updatePassword(user, passwords.new);
      toast({ title: "Clave actualizada" });
      setPasswords({ new: "", confirm: "" });
    } catch {
      toast({ variant: "destructive", title: "AcciÃ³n Denegada", description: "Re-autenticaciÃ³n necesaria." });
    }
  };

  const handleLogout = async () => {
    await signOut(auth);
    window.location.href = "/login";
  };

  const handleToggleModule = (module: keyof typeof activeModules) => {
    toggleModule(module);
    saveSettingsToCloud({ activeModules: { ...activeModules, [module]: !activeModules[module] } });
  };

  return (
    <div className="space-y-8 max-w-4xl mx-auto py-4 px-2 md:px-0">
      {/* Optimized Profile Header */}
      <div className="flex flex-col md:flex-row items-center md:items-center gap-6 md:gap-8">
        <div className="relative group">
          <Avatar className="w-24 h-24 md:w-32 md:h-32 border-2 border-primary neon-glow transition-transform group-hover:scale-105">
            <AvatarImage src={`https://picsum.photos/seed/${user?.uid}/400`} />
            <AvatarFallback className="text-2xl font-black">{user?.displayName?.slice(0, 2).toUpperCase() || "OP"}</AvatarFallback>
          </Avatar>
          <div className="absolute bottom-1 right-1 bg-primary p-1.5 rounded-lg border-2 border-background">
            <Zap className="w-3.5 h-3.5 text-primary-foreground" />
          </div>
        </div>

        <div className="flex-1 space-y-3 text-center md:text-left w-full">
          <div className="space-y-1">
            <h2 className="text-2xl md:text-4xl font-black tracking-tighter uppercase">Ajustes <span className="text-primary italic">Operador</span></h2>
            <p className="text-[11px] text-muted-foreground font-black uppercase tracking-[0.4em] flex items-center justify-center md:justify-start gap-2">
              <Fingerprint className="w-3 h-3 text-primary/40" /> ID: {user?.uid.slice(0, 8)}...
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-[11px] uppercase font-black text-primary">Nombre</Label>
              <div className="flex gap-2">
                <Input value={newName} onChange={(e) => setNewName(e.target.value)} className="bg-white/5 border-white/10 h-10 rounded-lg" />
                <Button onClick={handleUpdateName} disabled={isUpdatingName} className="h-10 w-10 rounded-lg bg-primary/10 text-primary">
                  {isUpdatingName ? <RefreshCcw className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-4 h-4" />}
                </Button>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-[11px] uppercase font-black text-white/20">Enlace</Label>
              <Input value={user?.email || "Anon"} disabled className="bg-white/5 border-white/10 h-10 rounded-lg opacity-40" />
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <section className="space-y-3">
          <h3 className="text-[11px] uppercase font-black text-muted-foreground tracking-[0.3em] flex items-center gap-2">
            <Layout className="w-3.5 h-3.5 text-primary" /> MÃ³dulos del Sistema
          </h3>
          <div className="glass rounded-2xl p-5 space-y-4 border-white/5 bg-black/40">
            <ModuleToggle label="Terminal" active={activeModules.dashboard} onToggle={() => handleToggleModule('dashboard')} />
            <ModuleToggle label="Tablero" active={activeModules.kanban} onToggle={() => handleToggleModule('kanban')} />
            <ModuleToggle label="Horario" active={activeModules.schedule} onToggle={() => handleToggleModule('schedule')} />
            <ModuleToggle label="Calendario" active={activeModules.calendar} onToggle={() => handleToggleModule('calendar')} />
          </div>
        </section>

        <section className="space-y-3">
          <h3 className="text-[11px] uppercase font-black text-muted-foreground tracking-[0.3em] flex items-center gap-2">
            <Shield className="w-3.5 h-3.5 text-primary" /> Seguridad
          </h3>
          <div className="glass rounded-2xl p-5 space-y-4 border-white/5 bg-black/40">
            <Dialog>
              <DialogTrigger asChild>
                <Button variant="outline" className="w-full h-11 rounded-xl border-white/5 bg-white/5 text-[9px] font-black uppercase tracking-widest gap-2">
                  <KeyRound className="w-4 h-4 text-primary" /> Nueva Clave
                </Button>
              </DialogTrigger>
              <DialogContent className="glass-card border-white/10 bg-black/95">
                <DialogHeader><DialogTitle className="text-lg font-black uppercase">Cambiar Password</DialogTitle></DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="space-y-1.5">
                    <Label className="text-[11px] uppercase font-black">Nueva ContraseÃ±a</Label>
                    <div className="relative">
                      <Input type={showPass ? "text" : "password"} value={passwords.new} onChange={(e) => setPasswords({...passwords, new: e.target.value})} className="bg-white/5 border-white/10 h-11 pr-10 rounded-lg" />
                      <button onClick={() => setShowPass(!showPass)} className="absolute right-3 top-1/2 -translate-y-1/2 text-white/20">
                        {showPass ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-[11px] uppercase font-black">Confirmar</Label>
                    <Input type="password" value={passwords.confirm} onChange={(e) => setPasswords({...passwords, confirm: e.target.value})} className="bg-white/5 border-white/10 h-11 rounded-lg" />
                  </div>
                </div>
                <DialogFooter><Button onClick={handleChangePassword} className="w-full neon-glow h-11 rounded-xl font-black uppercase text-[9px]">Confirmar Cambio</Button></DialogFooter>
              </DialogContent>
            </Dialog>

            <Button onClick={handleLogout} variant="destructive" className="w-full h-11 rounded-xl font-black uppercase text-[9px] tracking-widest gap-2">
              <LogOut className="w-4 h-4" /> Terminar SesiÃ³n
            </Button>
          </div>
        </section>
      </div>
    </div>
  );
}

function ModuleToggle({ label, active, onToggle }: { label: string, active: boolean, onToggle: () => void }) {
  return (
    <div className="flex items-center justify-between group">
      <div className="space-y-0.5">
        <p className="text-xs font-bold group-hover:text-primary transition-colors">{label}</p>
        <p className="text-[11px] text-muted-foreground uppercase">{active ? "En lÃ­nea" : "Desconectado"}</p>
      </div>
      <Switch checked={active} onCheckedChange={onToggle} className="scale-75" />
    </div>
  );
}
