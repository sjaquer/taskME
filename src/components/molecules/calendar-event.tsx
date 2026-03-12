'use client';

import { motion } from 'framer-motion';
import { format, parseISO } from 'date-fns';
import { Edit3, Trash2, MapPin, Clock } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { CalendarEvent, EventColor } from '@/types/task';

interface CalendarEventCardProps {
  event: CalendarEvent;
  index: number;
  onEdit: (event: CalendarEvent) => void;
  onDelete: (eventId: string) => void;
}

const COLOR_MAP: Record<EventColor, string> = {
  tomato: 'bg-red-500',
  flamingo: 'bg-pink-400',
  tangerine: 'bg-orange-500',
  banana: 'bg-yellow-400',
  sage: 'bg-emerald-400',
  basil: 'bg-green-600',
  peacock: 'bg-cyan-500',
  blueberry: 'bg-blue-600',
  lavender: 'bg-violet-400',
  grape: 'bg-purple-600',
  graphite: 'bg-zinc-500',
};

export function CalendarEventCard({ event, index, onEdit, onDelete }: CalendarEventCardProps) {
  const colorClass = COLOR_MAP[event.color] ?? 'bg-blue-600';
  const start = parseISO(event.startDate);
  const end = parseISO(event.endDate);

  return (
    <motion.div
      key={event.id}
      initial={{ opacity: 0, x: 10 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.05 }}
      className="glass-card p-4 md:p-6 hover:border-primary/30 transition-all group relative overflow-hidden"
    >
      <div className={cn('absolute top-0 left-0 w-1 h-full', colorClass)} />
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-3 pl-1">
          <div className="flex items-center gap-2 flex-wrap">
            <div className={cn('w-3 h-3 rounded-full', colorClass)} />
            {!event.allDay && (
              <span className="text-[10px] text-white/30 font-data flex items-center gap-1">
                <Clock className="w-3 h-3" />
                {format(start, 'HH:mm')} — {format(end, 'HH:mm')}
              </span>
            )}
            {event.allDay && (
              <Badge className="bg-white/[0.03] text-white/40 border-white/[0.06] text-[10px] px-1.5">
                Todo el día
              </Badge>
            )}
          </div>
          <h4 className="font-black text-lg md:text-xl leading-tight pr-10">
            {event.title}
          </h4>
          {event.description && (
            <p className="text-[11px] text-muted-foreground line-clamp-2">{event.description}</p>
          )}
          {event.location && (
            <p className="text-[11px] font-black text-muted-foreground uppercase flex items-center gap-2">
              <MapPin className="w-3 h-3" /> {event.location}
            </p>
          )}
        </div>
        <div className="flex items-center gap-2 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-all">
          <Button variant="ghost" size="icon" onClick={() => onEdit(event)} className="h-9 w-9 rounded-lg bg-[#050505]/60">
            <Edit3 className="w-4 h-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => onDelete(event.id)}
            className="h-9 w-9 rounded-lg hover:text-red-500 bg-[#050505]/60"
          >
            <Trash2 className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </motion.div>
  );
}
