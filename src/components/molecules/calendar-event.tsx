'use client';

import { motion } from 'framer-motion';
import { format, parseISO } from 'date-fns';
import { Edit3, Trash2, MapPin, Clock } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn, formatTime } from '@/lib/utils';
import { useAppContextStore } from '@/lib/store';
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
  const { hourFormat } = useAppContextStore();

  // Convertir las fechas a formato "HH:mm" para formatTime
  const startTimeString = format(start, 'HH:mm');
  const endTimeString = format(end, 'HH:mm');

  return (
    <motion.div
      key={event.id}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05 }}
      className="rounded-xl border border-border bg-muted/20 p-4 group relative overflow-hidden active:scale-[0.98] transition-transform"
    >
      <div className={cn('absolute top-0 left-0 w-1 h-full rounded-l-xl', colorClass)} />
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-2 pl-2 flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <div className={cn('w-2.5 h-2.5 rounded-full flex-shrink-0', colorClass)} />
            {!event.allDay && (
              <span className="text-xs text-muted-foreground/60 font-mono flex items-center gap-1">
                <Clock className="w-3 h-3" />
                {formatTime(startTimeString, hourFormat)} — {formatTime(endTimeString, hourFormat)}
              </span>
            )}
            {event.allDay && (
              <Badge className="bg-muted/30 text-muted-foreground/80 border-border text-[10px] px-2 py-0.5 rounded-md">
                Todo el día
              </Badge>
            )}
          </div>
          <h4 className="font-black text-base sm:text-lg leading-tight">
            {event.title}
          </h4>
          {event.description && (
            <p className="text-xs text-muted-foreground/70 line-clamp-2">{event.description}</p>
          )}
          {event.location && (
            <p className="text-xs text-muted-foreground/80 flex items-center gap-2">
              <MapPin className="w-3.5 h-3.5" /> {event.location}
            </p>
          )}
        </div>
        {/* Botones siempre visibles en móvil, touch-friendly */}
        <div className="flex items-center gap-1 flex-shrink-0">
          <Button variant="ghost" size="icon" onClick={() => onEdit(event)} className="h-10 w-10 rounded-xl bg-muted/30 hover:bg-muted/50 border border-border">
            <Edit3 className="w-4 h-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => onDelete(event.id)}
            className="h-10 w-10 rounded-xl bg-muted/30 hover:bg-red-500/10 hover:text-red-500 border border-border"
          >
            <Trash2 className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </motion.div>
  );
}
