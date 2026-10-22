'use client';

import { useState } from 'react';
import { Check, Plus, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { ChecklistItem } from '@/types/task';

const MAX_ITEMS = 30;

function newItemId() {
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID().slice(0, 12)
    : `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}

/** Lista de subtareas editable: marcar, renombrar, quitar y agregar con Enter. */
export function ChecklistEditor({ value, onChange }: { value: ChecklistItem[]; onChange: (items: ChecklistItem[]) => void }) {
  const [draft, setDraft] = useState('');

  const add = () => {
    const text = draft.trim();
    if (!text || value.length >= MAX_ITEMS) return;
    onChange([...value, { id: newItemId(), text, done: false }]);
    setDraft('');
  };

  return (
    <div className="space-y-1.5">
      {value.map((item) => (
        <div key={item.id} className="flex items-center gap-2">
          <button
            type="button"
            aria-label={item.done ? `Desmarcar "${item.text}"` : `Marcar "${item.text}"`}
            onClick={() => onChange(value.map((other) => (other.id === item.id ? { ...other, done: !other.done } : other)))}
            className={cn(
              'flex h-5 w-5 shrink-0 items-center justify-center rounded-md border-2',
              item.done ? 'border-primary bg-primary text-primary-foreground' : 'border-muted-foreground/40'
            )}
          >
            {item.done && <Check className="h-3 w-3" strokeWidth={3} />}
          </button>
          <input
            value={item.text}
            onChange={(event) => onChange(value.map((other) => (other.id === item.id ? { ...other, text: event.target.value } : other)))}
            aria-label="Texto de la subtarea"
            maxLength={200}
            className={cn('h-9 min-w-0 flex-1 bg-transparent text-sm outline-none', item.done && 'text-muted-foreground line-through')}
          />
          <button
            type="button"
            aria-label={`Quitar "${item.text}"`}
            onClick={() => onChange(value.filter((other) => other.id !== item.id))}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted/40 hover:text-red-400"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      ))}
      {value.length < MAX_ITEMS && (
        <div className="flex items-center gap-2">
          <Plus className="ml-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
          <input
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault();
                add();
              }
            }}
            onBlur={add}
            placeholder="Agregar subtarea"
            aria-label="Nueva subtarea"
            maxLength={200}
            className="h-9 min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground/70"
          />
        </div>
      )}
    </div>
  );
}
