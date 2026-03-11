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
    <Card className="glass-card hover:border-primary/30 group relative overflow-hidden p-0 transition-all duration-300">
      <div className="absolute -right-8 -top-8 w-24 h-24 bg-primary/[0.03] rounded-full blur-[40px] group-hover:bg-primary/[0.06] transition-colors" />
      <CardHeader className="pb-2 relative px-6 pt-6">
        <CardTitle className="text-[9px] text-white/40 flex items-center gap-3 uppercase tracking-[0.3em] font-black">
          <div className="p-1.5 bg-white/[0.03] rounded-lg border border-white/[0.06] group-hover:bg-primary/10 transition-colors">
            {icon}
          </div>
          {label}
        </CardTitle>
      </CardHeader>
      <CardContent className="relative px-6 pb-6 space-y-2">
        <div className={cn('text-3xl md:text-5xl font-black tracking-tighter leading-none italic font-data', color)}>
          {value}
        </div>
        <p className="text-[11px] text-white/30 font-black uppercase tracking-[0.2em] pt-2 border-t border-white/[0.06]">
          {subValue}
        </p>
      </CardContent>
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
