
"use client";

import { motion } from "framer-motion";
import { User, Bell, Lock, Shield, LogOut, ChevronRight, Moon, Zap } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";

export default function SettingsPage() {
  const sections = [
    {
      title: "Account",
      items: [
        { icon: User, label: "Profile Information", detail: "Alex Rivera" },
        { icon: Shield, label: "Privacy & Security", detail: "Active" },
        { icon: Bell, label: "Notifications", detail: "Manage alerts" },
      ]
    },
    {
      title: "Experience",
      items: [
        { icon: Moon, label: "Dark Mode", type: "switch", value: true },
        { icon: Zap, label: "High Performance Mode", type: "switch", value: false },
        { icon: Lock, label: "Biometric Unlock", type: "switch", value: true },
      ]
    }
  ];

  return (
    <div className="space-y-8">
      <div className="flex flex-col items-center text-center space-y-4 pt-4">
        <div className="relative">
          <Avatar className="w-24 h-24 border-2 border-primary neon-glow">
            <AvatarImage src="https://picsum.photos/seed/taskme/200" />
            <AvatarFallback>AR</AvatarFallback>
          </Avatar>
          <div className="absolute bottom-0 right-0 bg-primary p-1.5 rounded-full border-2 border-background neon-glow">
            <Zap className="w-3 h-3 text-primary-foreground" />
          </div>
        </div>
        <div>
          <h2 className="text-xl font-black">Alex Rivera</h2>
          <p className="text-xs text-muted-foreground">Product Architect • Pro Plan</p>
        </div>
      </div>

      <div className="space-y-6">
        {sections.map((section, idx) => (
          <div key={idx} className="space-y-3">
            <h3 className="text-[10px] uppercase font-black text-muted-foreground tracking-[0.2em] ml-2">
              {section.title}
            </h3>
            <div className="glass rounded-3xl overflow-hidden divide-y divide-white/5">
              {section.items.map((item, i) => (
                <div key={i} className="flex items-center justify-between p-4 hover:bg-white/[0.02] transition-colors">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-xl bg-white/5 flex items-center justify-center">
                      <item.icon className="w-4 h-4 text-muted-foreground" />
                    </div>
                    <span className="text-sm font-medium">{item.label}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    {item.type === 'switch' ? (
                      <Switch checked={item.value} />
                    ) : (
                      <>
                        <span className="text-xs text-muted-foreground">{item.detail}</span>
                        <ChevronRight className="w-4 h-4 text-muted-foreground/30" />
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      <Button variant="destructive" className="w-full h-12 rounded-2xl font-bold gap-2">
        <LogOut className="w-4 h-4" />
        Sign Out System
      </Button>
    </div>
  );
}
