
"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { 
  User, 
  Bell, 
  Lock, 
  Shield, 
  LogOut, 
  ChevronRight, 
  Moon, 
  Zap, 
  Layout, 
  Check, 
  RefreshCcw,
  KeyRound,
  Eye,
  EyeOff
} from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useUser, useAuth, useFirestore } from "@/firebase";
import { updateProfile, updatePassword, signOut } from "firebase/auth";
import { doc, updateDoc } from "firebase/firestore";
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
  const { activeModules, toggleModule, highPerformanceMode, setHighPerformanceMode } = useAppContextStore();

  const [newName, setNewName] = useState(user?.displayName || "");
  const [isUpdatingName, setIsUpdatingName] = useState(false);
  
  const [passwords, setPasswords] = useState({ new: "", confirm: "" });
  const [showPass, setShowPass] = useState(false);

  const handleUpdateName = async () => {
    if (!user || !newName.trim()) return;
    setIsUpdatingName(true);
    try {
      await updateProfile(user, { displayName: newName });
      const userRef = doc(firestore, "users", user.uid);
      await updateDoc(userRef, { displayName: newName });
      toast({ title: "Perfil actualizado", description: "Tu nombre ha sido cambiado con éxito." });
    } catch (error: any) {
      toast({ variant: "destructive", title: "Error", description: error.message });
    } finally {
      setIsUpdatingName(false);
    }
  };

  const handleChangePassword = async () => {
    if (!user || passwords.new !== passwords.confirm) {
      toast({ variant: "destructive", title: "Error", description: "Las contraseñas no coinciden." });
      return;
    }
    try {
      await updatePassword(user, passwords.new);
      toast({ title: "Seguridad actualizada", description: "Contraseña cambiada correctamente." });
      setPasswords({ new: "", confirm: "" });
    } catch (error: any) {
      toast({ variant: "destructive", title: "Error crítico", description: "Por seguridad, vuelve a iniciar sesión antes de cambiar la contraseña." });
    }
  };

  const handleLogout = async () => {
    await signOut(auth);
    window.location.href = "/login";
  };

  return (
    <div className="space-y-10 max-w-4xl mx-auto py-4 px-2 md:px-0">
      {/* Header Perfil */}
      <div className="flex flex-col md:flex-row items-center md:items-start gap-8 md:gap-12">
        <div className="relative group">
          <Avatar className="w-32 h-32 md:w-40 md:h-40 border-4 border-primary neon-glow transition-transform group-hover:scale-105">
            <AvatarImage src={`https://picsum.photos/seed/${user?.uid}/400`} />
            <AvatarFallback className="text-4xl font-black">
              {user?.displayName?.slice(0, 2).toUpperCase() || "US"}
            </AvatarFallback>
          </Avatar>
          <div className="absolute bottom-2 right-2 bg-primary p-2.5 rounded-2xl border-4 border-background neon-glow">
            <Zap className="w-5 h-5 text-primary-foreground" />
          </div>
        </div>

        <div className="flex-1 space-y-6 text-center md:text-left w-full">
          <div className="space-y-1">
            <h2 className="text-4xl md:text-5xl font-black tracking-tighter">Configuración</h2>
            <p className="text-[10px] text-muted-foreground font-black uppercase tracking-[0.4em] flex items-center justify-center md:justify-start gap-2">
              <span className="w-8 h-px bg-primary/40" /> ID de Usuario: {user?.uid.slice(0, 8)}...
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="text-[10px] uppercase font-black tracking-widest text-primary">Nombre de Operador</Label>
              <div className="flex gap-2">
                <Input 
                  value={newName} 
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="Tu alias cyber..."
                  className="bg-white/5 border-white/10 h-12 rounded-xl"
                />
                <Button 
                  onClick={handleUpdateName} 
                  disabled={isUpdatingName}
                  className="h-12 w-12 rounded-xl bg-primary/20 text-primary border border-primary/20 hover:bg-primary hover:text-black transition-all"
                >
                  {isUpdatingName ? <RefreshCcw className="w-4 h-4 animate-spin" /> : <Check className="w-5 h-5" />}
                </Button>
              </div>
            </div>
            <div className="space-y-2">
              <Label className="text-[10px] uppercase font-black tracking-widest text-white/40">Correo Encriptado</Label>
              <Input value={user?.email || "Anónimo"} disabled className="bg-white/5 border-white/10 h-12 rounded-xl opacity-50" />
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Columna Izquierda: Modulos y UI */}
        <div className="space-y-8">
          <section className="space-y-4">
            <h3 className="text-[10px] uppercase font-black text-muted-foreground tracking-[0.3em] flex items-center gap-2">
              <Layout className="w-4 h-4 text-primary" /> Módulos del Sistema
            </h3>
            <div className="glass rounded-[2.5rem] p-6 space-y-6 border-white/5 bg-black/40">
              <ModuleToggle label="Panel Principal (Dashboard)" active={activeModules.dashboard} onToggle={() => toggleModule('dashboard')} />
              <ModuleToggle label="Tablero Kanban de Procesos" active={activeModules.kanban} onToggle={() => toggleModule('kanban')} />
              <ModuleToggle label="Programador de Horarios" active={activeModules.schedule} onToggle={() => toggleModule('schedule')} />
              <ModuleToggle label="Calendario de Eventos" active={activeModules.calendar} onToggle={() => toggleModule('calendar')} />
            </div>
          </section>

          <section className="space-y-4">
            <h3 className="text-[10px] uppercase font-black text-muted-foreground tracking-[0.3em] flex items-center gap-2">
              <Zap className="w-4 h-4 text-primary" /> Rendimiento & UI
            </h3>
            <div className="glass rounded-[2.5rem] p-6 space-y-6 border-white/5 bg-black/40">
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <p className="text-sm font-bold">Modo Alto Rendimiento</p>
                  <p className="text-[10px] text-muted-foreground uppercase">Optimiza animaciones y consumo</p>
                </div>
                <Switch checked={highPerformanceMode} onCheckedChange={setHighPerformanceMode} />
              </div>
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <p className="text-sm font-bold">Modo Oscuro Absoluto</p>
                  <p className="text-[10px] text-muted-foreground uppercase">Fuerza negros profundos (OLED)</p>
                </div>
                <Switch checked={true} disabled />
              </div>
            </div>
          </section>
        </div>

        {/* Columna Derecha: Seguridad y Cuenta */}
        <div className="space-y-8">
          <section className="space-y-4">
            <h3 className="text-[10px] uppercase font-black text-muted-foreground tracking-[0.3em] flex items-center gap-2">
              <Shield className="w-4 h-4 text-primary" /> Seguridad de Acceso
            </h3>
            <div className="glass rounded-[2.5rem] p-6 space-y-6 border-white/5 bg-black/40">
              <Dialog>
                <DialogTrigger asChild>
                  <Button variant="outline" className="w-full h-14 rounded-2xl border-white/5 bg-white/5 hover:bg-white/10 gap-3">
                    <KeyRound className="w-5 h-5 text-primary" /> Cambiar Contraseña
                  </Button>
                </DialogTrigger>
                <DialogContent className="glass-card border-white/10 bg-black/95">
                  <DialogHeader>
                    <DialogTitle className="text-2xl font-black uppercase tracking-tighter">Actualizar Encriptación</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4 py-4">
                    <div className="space-y-2">
                      <Label className="text-[10px] uppercase font-black">Nueva Contraseña</Label>
                      <div className="relative">
                        <Input 
                          type={showPass ? "text" : "password"} 
                          value={passwords.new} 
                          onChange={(e) => setPasswords({...passwords, new: e.target.value})}
                          className="bg-white/5 border-white/10 h-12 pr-12 rounded-xl"
                        />
                        <button onClick={() => setShowPass(!showPass)} className="absolute right-4 top-1/2 -translate-y-1/2 text-white/20">
                          {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label className="text-[10px] uppercase font-black">Confirmar Nueva Contraseña</Label>
                      <Input 
                        type="password" 
                        value={passwords.confirm} 
                        onChange={(e) => setPasswords({...passwords, confirm: e.target.value})}
                        className="bg-white/5 border-white/10 h-12 rounded-xl"
                      />
                    </div>
                  </div>
                  <DialogFooter>
                    <Button onClick={handleChangePassword} className="w-full neon-glow h-14 rounded-2xl font-black uppercase text-xs">Confirmar Cambio</Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>

              <div className="flex items-center justify-between p-4 bg-white/5 rounded-2xl border border-white/5">
                <div className="flex items-center gap-3">
                  <Bell className="w-5 h-5 text-muted-foreground" />
                  <span className="text-sm font-bold">Notificaciones</span>
                </div>
                <Switch checked={true} />
              </div>
            </div>
          </section>

          <Button 
            onClick={handleLogout}
            variant="destructive" 
            className="w-full h-16 md:h-20 rounded-[2rem] font-black uppercase tracking-widest text-xs gap-3 shadow-2xl hover:shadow-destructive/20 transition-all"
          >
            <LogOut className="w-6 h-6" />
            Desconectar del Sistema
          </Button>
        </div>
      </div>
    </div>
  );
}

function ModuleToggle({ label, active, onToggle }: { label: string, active: boolean, onToggle: () => void }) {
  return (
    <div className="flex items-center justify-between group">
      <div className="space-y-1">
        <p className="text-sm font-bold group-hover:text-primary transition-colors">{label}</p>
        <p className="text-[9px] text-muted-foreground uppercase tracking-widest">{active ? "Módulo Activo" : "Módulo en Hibernación"}</p>
      </div>
      <Switch checked={active} onCheckedChange={onToggle} />
    </div>
  );
}
