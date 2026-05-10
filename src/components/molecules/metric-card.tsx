'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';

interface MetricCardProps {
  label: string;
  value: string;
  icon: React.ReactNode;
  subValue: string;
  color?: string;
}

export function MetricCard({ label, value, icon, subValue, color }: MetricCardProps) {
  return (
    <Card className="glass-card hover:border-primary/30 group relative overflow-hidden p-6 transition-all duration-300 flex flex-col justify-between min-h-[120px]">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
          {icon}
          {label}
        </span>
      </div>
      <div className="space-y-1 mt-4">
        <div className={cn('text-2xl md:text-3xl font-bold tracking-tight font-sans', color)}>
          {value}
        </div>
        <p className="text-xs text-muted-foreground/70 font-medium pt-1 border-t border-white/[0.06]">
          {subValue}
        </p>
      </div>
    </Card>
  );
}

interface SystemFeatureProps {
  label: string;
  value: string;
  icon: React.ReactNode;
}

export function SystemFeature({ label, value, icon }: SystemFeatureProps) {
  return (
    <div className="flex items-center justify-between group">
      <div className="flex items-center gap-2">
        <div className="p-1.5 rounded-md bg-white/[0.03] text-primary/40 group-hover:text-primary transition-colors">
          {icon}
        </div>
        <span className="text-[9px] font-bold text-white/40 uppercase tracking-widest">{label}</span>
      </div>
      <span className="text-[9px] font-black text-white/80 font-data">{value}</span>
    </div>
  );
}
