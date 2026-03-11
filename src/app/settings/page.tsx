
"use client";

import { motion } from "framer-motion";
import { User, Bell, Lock, Shield, LogOut, ChevronRight, Moon, Zap } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";

export default function SettingsPage() {
  const sections = [
    {
      title: "Cuenta",
      items: [
        { icon: User, label: "Información de Perfil", detail: "Alex Rivera" },
        { icon: Shield, label: "Privacidad y Seguridad", detail: "Activo" },
        { icon: Bell, label: "Notificaciones", detail: "Gestionar alertas" },
      ]
    },
    {
      title: "Experiencia",
      items: [
        { icon: Moon, label: "Modo Oscuro", type: "switch", value: true },
        { icon: Zap, label: "Modo Alto Rendimiento", type: "switch", value: false },
        { icon: Lock, label: "Desbloqueo Biométrico", type: "switch", value: true },
      ]
    }
  ];

  return (
    <div className="space-y-10 max-w-2xl mx-auto py-4">
      <div className="flex flex-col items-center text-center space-y-6">
        <div className="relative group">
          <Avatar className="w-32 h-32 border-4 border-primary neon-glow transition-transform group-hover:scale-105">
            <AvatarImage src="https://picsum.photos/seed/taskme/200" />
            <AvatarFallback>AR</AvatarFallback>
          </Avatar>
          <div className="absolute bottom-1 right-1 bg-primary p-2 rounded-2xl border-4 border-background neon-glow">
            <Zap className="w-4 h-4 text-primary-foreground" />
          </div>
        </div>
        <div>
          <h2 className="text-3xl font-black tracking-tighter">Alex Rivera</h2>
          <p className="text-xs text-muted-foreground font-bold uppercase tracking-[0.2em] mt-1">Arquitecto de Producto • Plan Pro</p>
        </div>
      </div>

      <div className="space-y-8">
        {sections.map((section, idx) => (
          <div key={idx} className="space-y-4">
            <h3 className="text-[10px] uppercase font-black text-muted-foreground tracking-[0.3em] ml-4">
              {section.title}
            </h3>
            <div className="glass rounded-[2.5rem] overflow-hidden divide-y divide-white/5 border border-white/5">
              {section.items.map((item, i) => (
                <div key={i} className="flex items-center justify-between p-6 hover:bg-white/[0.02] transition-all cursor-pointer group">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-2xl bg-white/5 flex items-center justify-center group-hover:bg-primary/10 transition-colors">
                      <item.icon className="w-5 h-5 text-muted-foreground group-hover:text-primary transition-colors" />
                    </div>
                    <span className="text-sm font-bold tracking-tight">{item.label}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    {item.type === 'switch' ? (
                      <Switch checked={item.value} />
                    ) : (
                      <>
                        <span className="text-xs text-muted-foreground font-medium">{item.detail}</span>
                        <ChevronRight className="w-5 h-5 text-muted-foreground/20" />
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      <Button variant="destructive" className="w-full h-16 rounded-[2rem] font-black uppercase tracking-widest text-xs gap-3 shadow-2xl hover:shadow-destructive/20 transition-all">
        <LogOut className="w-5 h-5" />
        Desconectar del Sistema
      </Button>
    </div>
  );
}
