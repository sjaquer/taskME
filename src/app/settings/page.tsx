"use client";

import { useState, useEffect } from "react";
import {
  Shield, LogOut, Zap, Layout, Check, RefreshCcw, KeyRound, Eye, EyeOff, Fingerprint,
  Download, Trash2, Mail, Palette, Bell,
} from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useUser, useAuth, useFirestore } from "@/firebase";
import { useAppContextStore } from "@/lib/store";
import type { AppTheme, HourFormat } from "@/lib/store";
import { toast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { TacticalButton } from "@/components/atoms";
import {
  updateUserProfile,
  updateUserEmail,
  changeUserPassword,
  logoutUser,
  deleteUserAccount,
  exportUserData,
  saveSettingsToCloud,
} from "@/services/user-service";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { NotificationSetup } from "@/components/notification-setup";

const THEME_OPTIONS: { value: AppTheme; label: string; hint: string }[] = [
  { value: "neon", label: "Neon Verde", hint: "Modo original" },
  { value: "cyan", label: "Cyan", hint: "Frío y técnico" },
  { value: "amber", label: "Amber", hint: "Cálido y enfocado" },
  { value: "rose", label: "Rose", hint: "Alto contraste" },
  { value: "violet", label: "Violet", hint: "Profundo y suave" },
];

export default function SettingsPage() {
  const { user } = useUser();
  const auth = useAuth();
  const firestore = useFirestore();
  const { activeModules, toggleModule, theme, setTheme, hourFormat, setHourFormat } = useAppContextStore();

  const [newName, setNewName] = useState(user?.displayName || "");
  const [isUpdatingName, setIsUpdatingName] = useState(false);

  // Email change
  const [emailData, setEmailData] = useState({ newEmail: "", password: "" });
  const [isUpdatingEmail, setIsUpdatingEmail] = useState(false);
  const [emailDialogOpen, setEmailDialogOpen] = useState(false);

  // Password change
  const [passwords, setPasswords] = useState({ current: "", new: "", confirm: "" });
  const [showPass, setShowPass] = useState(false);
  const [passwordDialogOpen, setPasswordDialogOpen] = useState(false);

  // Delete account
  const [deletePassword, setDeletePassword] = useState("");
  const [deleteConfirmText, setDeleteConfirmText] = useState("");
  const [isDeletingAccount, setIsDeletingAccount] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

  // Export
  const [isExporting, setIsExporting] = useState(false);

  const isEmailUser = !!user?.email && !user.isAnonymous;

  useEffect(() => {
    if (user?.displayName) setNewName(user.displayName);
  }, [user]);

  const handleUpdateName = async () => {
    if (!user || !firestore || !newName.trim()) return;
    setIsUpdatingName(true);
    try {
      await updateUserProfile(user, firestore, newName.trim());
      toast({ variant: "success", title: "Perfil actualizado" });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Error desconocido";
      toast({ variant: "destructive", title: "Error", description: message });
    } finally {
      setIsUpdatingName(false);
    }
  };

  const handleUpdateEmail = async () => {
    if (!user || !firestore || !emailData.newEmail.trim() || !emailData.password) return;
    setIsUpdatingEmail(true);
    try {
      await updateUserEmail(user, firestore, emailData.newEmail.trim(), emailData.password);
      toast({ variant: "success", title: "Email actualizado" });
      setEmailData({ newEmail: "", password: "" });
      setEmailDialogOpen(false);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Re-autenticación necesaria o email inválido.";
      toast({ variant: "destructive", title: "Error", description: message });
    } finally {
      setIsUpdatingEmail(false);
    }
  };

  const handleChangePassword = async () => {
    if (!user) return;
    if (passwords.new.length < 6) {
      toast({ variant: "destructive", title: "Error", description: "La contraseña debe tener al menos 6 caracteres." });
      return;
    }
    if (passwords.new !== passwords.confirm) {
      toast({ variant: "destructive", title: "Error", description: "Las contraseñas no coinciden." });
      return;
    }
    try {
      await changeUserPassword(user, passwords.new, isEmailUser ? passwords.current : undefined);
      toast({ variant: "success", title: "Clave actualizada" });
      setPasswords({ current: "", new: "", confirm: "" });
      setPasswordDialogOpen(false);
    } catch {
      toast({ variant: "destructive", title: "Acción Denegada", description: "Contraseña actual incorrecta o re-autenticación necesaria." });
    }
  };

  const handleExportData = async () => {
    if (!firestore || !user) return;
    setIsExporting(true);
    try {
      const data = await exportUserData(firestore, user.uid);
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `taskme-backup-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      toast({ variant: "success", title: "Datos exportados" });
    } catch {
      toast({ variant: "destructive", title: "Error", description: "No se pudieron exportar los datos." });
    } finally {
      setIsExporting(false);
    }
  };

  const handleDeleteAccount = async () => {
    if (!user || !firestore || deleteConfirmText !== "ELIMINAR") return;
    setIsDeletingAccount(true);
    try {
      await deleteUserAccount(user, firestore, isEmailUser ? deletePassword : undefined);
      window.location.href = "/login";
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Re-autenticación necesaria.";
      toast({ variant: "destructive", title: "Error al eliminar cuenta", description: message });
    } finally {
      setIsDeletingAccount(false);
    }
  };

  const handleLogout = async () => {
    await logoutUser(auth);
    window.location.href = "/login";
  };

  const handleToggleModule = (module: keyof typeof activeModules) => {
    toggleModule(module);
    if (firestore && user) {
      saveSettingsToCloud(firestore, user.uid, {
        activeModules: { ...activeModules, [module]: !activeModules[module] },
      });
    }
  };

  return (
    <div className="space-y-8 max-w-4xl mx-auto py-4 px-2 md:px-0">
      {/* Profile Header */}
      <div className="flex flex-col md:flex-row items-center md:items-center gap-6 md:gap-8">
        <div className="relative group">
          <Avatar className="w-24 h-24 md:w-32 md:h-32 border-2 border-primary neon-glow transition-transform group-hover:scale-105">
            <AvatarImage src={`https://picsum.photos/seed/${user?.uid}/400`} />
            <AvatarFallback className="text-2xl font-black bg-white/[0.03]">
              {user?.displayName?.slice(0, 2).toUpperCase() || "OP"}
            </AvatarFallback>
          </Avatar>
          <div className="absolute bottom-1 right-1 bg-primary p-1.5 rounded-lg border-2 border-background">
            <Zap className="w-3.5 h-3.5 text-primary-foreground" />
          </div>
        </div>

        <div className="flex-1 space-y-3 text-center md:text-left w-full">
          <div className="space-y-1">
            <h2 className="text-2xl md:text-4xl font-black tracking-tighter uppercase">
              Configuraciones
            </h2>
            <p className="text-[11px] text-muted-foreground font-black uppercase tracking-[0.4em] flex items-center justify-center md:justify-start gap-2">
              <Fingerprint className="w-3 h-3 text-primary/40" />
              <span className="font-data">ID: {user?.uid.slice(0, 8)}...</span>
              {user?.isAnonymous && <span className="text-yellow-500/70 ml-1">(Invitado)</span>}
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-[11px] uppercase font-black text-primary">Nombre</Label>
              <div className="flex gap-2">
                <Input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Tu nombre" className="bg-white/[0.03] border-white/[0.08] h-10 rounded-lg" />
                <Button onClick={handleUpdateName} disabled={isUpdatingName || !newName.trim()} className="h-10 w-10 rounded-lg bg-primary/10 text-primary hover:bg-primary/20">
                  {isUpdatingName ? <RefreshCcw className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-4 h-4" />}
                </Button>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-[11px] uppercase font-black text-white/20">Email</Label>
              <div className="flex gap-2">
                <Input value={user?.email || "Anónimo"} disabled className="bg-white/[0.03] border-white/[0.08] h-10 rounded-lg opacity-40 font-data" />
                {isEmailUser && (
                  <Dialog open={emailDialogOpen} onOpenChange={setEmailDialogOpen}>
                    <DialogTrigger asChild>
                      <Button className="h-10 w-10 rounded-lg bg-white/[0.03] text-white/30 hover:bg-white/[0.06] hover:text-primary">
                        <Mail className="w-4 h-4" />
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="glass-card-elevated border-white/[0.08] bg-[#050505]/95 sm:max-w-[420px] sm:max-h-[92dvh] overflow-y-auto p-6 sm:p-5 md:p-8">
                      <DialogHeader><DialogTitle className="text-lg font-black uppercase">Cambiar Email</DialogTitle></DialogHeader>
                      <div className="space-y-4 py-4">
                        <div className="space-y-1.5">
                          <Label className="text-[11px] uppercase font-black">Nuevo Email</Label>
                          <Input type="email" value={emailData.newEmail} onChange={(e) => setEmailData({ ...emailData, newEmail: e.target.value })} placeholder="nuevo@email.com" className="bg-white/[0.03] border-white/[0.08] h-11 rounded-lg" />
                        </div>
                        <div className="space-y-1.5">
                          <Label className="text-[11px] uppercase font-black">Contraseña Actual</Label>
                          <Input type="password" value={emailData.password} onChange={(e) => setEmailData({ ...emailData, password: e.target.value })} className="bg-white/[0.03] border-white/[0.08] h-11 rounded-lg" />
                        </div>
                      </div>
                      <DialogFooter>
                        <TacticalButton onClick={handleUpdateEmail} disabled={isUpdatingEmail || !emailData.newEmail.trim() || !emailData.password} className="w-full">
                          {isUpdatingEmail ? <RefreshCcw className="w-3.5 h-3.5 animate-spin mr-2" /> : null}
                          Confirmar
                        </TacticalButton>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Modules */}
        <section className="space-y-3">
          <h3 className="text-[11px] uppercase font-black text-muted-foreground tracking-[0.3em] flex items-center gap-2">
            <Layout className="w-3.5 h-3.5 text-primary" /> Módulos del Sistema
          </h3>
          <div className="glass-card p-5 space-y-4">
            <ModuleToggle label="Terminal" active={activeModules.dashboard} onToggle={() => handleToggleModule("dashboard")} />
            <ModuleToggle label="Tablero" active={activeModules.kanban} onToggle={() => handleToggleModule("kanban")} />
            <ModuleToggle label="Horario" active={activeModules.schedule} onToggle={() => handleToggleModule("schedule")} />
            <ModuleToggle label="Calendario" active={activeModules.calendar} onToggle={() => handleToggleModule("calendar")} />
          </div>
        </section>

        {/* Security */}
        <section className="space-y-3">
          <h3 className="text-[11px] uppercase font-black text-muted-foreground tracking-[0.3em] flex items-center gap-2">
            <Shield className="w-3.5 h-3.5 text-primary" /> Seguridad
          </h3>
          <div className="glass-card p-5 space-y-4">
            {/* Change Password */}
            <Dialog open={passwordDialogOpen} onOpenChange={setPasswordDialogOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" className="w-full h-11 rounded-xl border-white/[0.06] bg-white/[0.03] text-[9px] font-black uppercase tracking-widest gap-2 hover:bg-white/[0.05]">
                  <KeyRound className="w-4 h-4 text-primary" /> Nueva Clave
                </Button>
              </DialogTrigger>
              <DialogContent className="glass-card-elevated border-white/[0.08] bg-[#050505]/95 sm:max-w-[420px] sm:max-h-[92dvh] overflow-y-auto p-6 sm:p-5 md:p-8">
                <DialogHeader><DialogTitle className="text-lg font-black uppercase">Cambiar Password</DialogTitle></DialogHeader>
                <div className="space-y-4 py-4">
                  {isEmailUser && (
                    <div className="space-y-1.5">
                      <Label className="text-[11px] uppercase font-black">Contraseña Actual</Label>
                      <Input type="password" value={passwords.current} onChange={(e) => setPasswords({ ...passwords, current: e.target.value })} className="bg-white/[0.03] border-white/[0.08] h-11 rounded-lg" />
                    </div>
                  )}
                  <div className="space-y-1.5">
                    <Label className="text-[11px] uppercase font-black">Nueva Contraseña</Label>
                    <div className="relative">
                      <Input type={showPass ? "text" : "password"} value={passwords.new} onChange={(e) => setPasswords({ ...passwords, new: e.target.value })} className="bg-white/[0.03] border-white/[0.08] h-11 pr-10 rounded-lg" />
                      <button type="button" onClick={() => setShowPass(!showPass)} className="absolute right-3 top-1/2 -translate-y-1/2 text-white/20">
                        {showPass ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                    {passwords.new.length > 0 && passwords.new.length < 6 && (
                      <p className="text-[10px] text-red-400">Mínimo 6 caracteres</p>
                    )}
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-[11px] uppercase font-black">Confirmar</Label>
                    <Input type="password" value={passwords.confirm} onChange={(e) => setPasswords({ ...passwords, confirm: e.target.value })} className="bg-white/[0.03] border-white/[0.08] h-11 rounded-lg" />
                    {passwords.confirm.length > 0 && passwords.new !== passwords.confirm && (
                      <p className="text-[10px] text-red-400">Las contraseñas no coinciden</p>
                    )}
                  </div>
                </div>
                <DialogFooter>
                  <TacticalButton onClick={handleChangePassword} disabled={passwords.new.length < 6 || passwords.new !== passwords.confirm} className="w-full">
                    Confirmar Cambio
                  </TacticalButton>
                </DialogFooter>
              </DialogContent>
            </Dialog>

            {/* Export Data */}
            <Button onClick={handleExportData} disabled={isExporting} variant="outline" className="w-full h-11 rounded-xl border-white/[0.06] bg-white/[0.03] text-[9px] font-black uppercase tracking-widest gap-2 hover:bg-white/[0.05]">
              {isExporting ? <RefreshCcw className="w-4 h-4 animate-spin text-primary" /> : <Download className="w-4 h-4 text-primary" />}
              Exportar Datos
            </Button>

            {/* Logout */}
            <Button onClick={handleLogout} variant="destructive" className="w-full h-11 rounded-xl font-black uppercase text-[9px] tracking-widest gap-2">
              <LogOut className="w-4 h-4" /> Terminar Sesión
            </Button>
          </div>
        </section>
      </div>

      <section className="space-y-3">
        <h3 className="text-[11px] uppercase font-black text-muted-foreground tracking-[0.3em] flex items-center gap-2">
          <Palette className="w-3.5 h-3.5 text-primary" /> Apariencia
        </h3>
        <div className="glass-card p-5 space-y-6">
          <div className="space-y-1.5">
            <Label className="text-[11px] uppercase font-black text-primary">Tema de Color</Label>
            <Select value={theme} onValueChange={(value) => setTheme(value as AppTheme)}>
              <SelectTrigger className="bg-white/[0.03] border-white/[0.08] h-11 rounded-lg text-[11px] font-black uppercase tracking-wider">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-[#0a0a0a] border-white/[0.08]">
                {THEME_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value} className="text-[11px] font-black uppercase tracking-wider">
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
            {THEME_OPTIONS.map((option) => (
              <button
                key={option.value}
                onClick={() => setTheme(option.value)}
                className={`rounded-xl border p-3 text-left transition-all ${theme === option.value ? "border-primary/50 bg-primary/[0.08]" : "border-white/[0.08] bg-white/[0.02] hover:bg-white/[0.04]"}`}
              >
                <p className="text-[10px] font-black uppercase tracking-widest text-white/80">{option.label}</p>
                <p className="text-[10px] text-white/40 mt-1">{option.hint}</p>
              </button>
            ))}
          </div>

          <div className="border-t border-white/[0.06] pt-4">
            <div className="space-y-1.5">
              <Label className="text-[11px] uppercase font-black text-primary">Formato de Hora</Label>
              <Select value={hourFormat} onValueChange={(value) => setHourFormat(value as any)}>
                <SelectTrigger className="bg-white/[0.03] border-white/[0.08] h-11 rounded-lg text-[11px] font-black uppercase tracking-wider">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-[#0a0a0a] border-white/[0.08]">
                  <SelectItem value="24h" className="text-[11px] font-black uppercase tracking-wider">
                    24 Horas
                  </SelectItem>
                  <SelectItem value="12h" className="text-[11px] font-black uppercase tracking-wider">
                    12 Horas (AM/PM)
                  </SelectItem>
                </SelectContent>
              </Select>
              <p className="text-[10px] text-white/40 mt-2">
                {hourFormat === '24h' ? 'Formato: 14:30' : 'Formato: 02:30 PM'}
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="space-y-3">
        <h3 className="text-[11px] uppercase font-black text-muted-foreground tracking-[0.3em] flex items-center gap-2">
          <Bell className="w-3.5 h-3.5 text-primary" /> Notificaciones
        </h3>
        <div className="glass-card p-5 space-y-3">
          <p className="text-[11px] text-muted-foreground">
            Configura aqui los permisos para alertas del navegador y la integracion con la app Android.
          </p>
          <NotificationSetup className="h-11 rounded-xl text-[10px] tracking-[0.2em]" />
        </div>
      </section>

      {/* Danger Zone */}
      <section className="space-y-3">
        <h3 className="text-[11px] uppercase font-black text-red-500/60 tracking-[0.3em] flex items-center gap-2">
          <Trash2 className="w-3.5 h-3.5" /> Zona de Peligro
        </h3>
        <div className="glass-card p-5 border border-red-500/10">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="space-y-1">
              <p className="text-xs font-bold text-red-400/80">Eliminar Cuenta</p>
              <p className="text-[11px] text-muted-foreground">Se eliminarán todas tus tareas, configuraciones y datos de forma permanente.</p>
            </div>
            <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
              <DialogTrigger asChild>
                <Button variant="destructive" size="sm" className="rounded-xl text-[9px] font-black uppercase tracking-widest gap-1.5 shrink-0">
                  <Trash2 className="w-3.5 h-3.5" /> Eliminar
                </Button>
              </DialogTrigger>
              <DialogContent className="glass-card-elevated border-red-500/20 bg-[#050505]/95 sm:max-w-[420px] sm:max-h-[92dvh] overflow-y-auto p-6 sm:p-5 md:p-8">
                <DialogHeader><DialogTitle className="text-lg font-black uppercase text-red-400">Eliminar Cuenta</DialogTitle></DialogHeader>
                <div className="space-y-4 py-4">
                  <p className="text-[11px] text-muted-foreground">Esta acción es <span className="text-red-400 font-bold">irreversible</span>. Se eliminarán permanentemente:</p>
                  <ul className="text-[11px] text-muted-foreground space-y-1 list-disc pl-4">
                    <li>Todas tus tareas</li>
                    <li>Configuraciones guardadas</li>
                    <li>Tu cuenta de usuario</li>
                  </ul>
                  {isEmailUser && (
                    <div className="space-y-1.5">
                      <Label className="text-[11px] uppercase font-black">Contraseña</Label>
                      <Input type="password" value={deletePassword} onChange={(e) => setDeletePassword(e.target.value)} className="bg-white/[0.03] border-red-500/20 h-11 rounded-lg" />
                    </div>
                  )}
                  <div className="space-y-1.5">
                    <Label className="text-[11px] uppercase font-black">Escribe ELIMINAR para confirmar</Label>
                    <Input value={deleteConfirmText} onChange={(e) => setDeleteConfirmText(e.target.value)} placeholder="ELIMINAR" className="bg-white/[0.03] border-red-500/20 h-11 rounded-lg" />
                  </div>
                </div>
                <DialogFooter>
                  <Button onClick={handleDeleteAccount} disabled={isDeletingAccount || deleteConfirmText !== "ELIMINAR" || (isEmailUser && !deletePassword)} variant="destructive" className="w-full h-12 rounded-xl font-black uppercase tracking-widest text-[10px]">
                    {isDeletingAccount ? <RefreshCcw className="w-3.5 h-3.5 animate-spin mr-2" /> : <Trash2 className="w-4 h-4 mr-2" />}
                    Confirmar Eliminación
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </div>
      </section>
    </div>
  );
}

function ModuleToggle({ label, active, onToggle }: { label: string; active: boolean; onToggle: () => void }) {
  return (
    <div className="flex items-center justify-between group">
      <div className="space-y-0.5">
        <p className="text-xs font-bold group-hover:text-primary transition-colors">{label}</p>
        <p className="text-[11px] text-muted-foreground uppercase font-data">{active ? "En línea" : "Desconectado"}</p>
      </div>
      <Switch checked={active} onCheckedChange={onToggle} className="scale-75" />
    </div>
  );
}
