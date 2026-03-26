import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"
import type { HourFormat } from "./store"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatTime(time: string | undefined, format: HourFormat): string {
  if (!time) return '--:--';
  
  const [hours, minutes] = time.split(':').map(Number);
  
  if (format === '24h') {
    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
  }
  
  // Formato 12h con AM/PM
  const ampm = hours >= 12 ? 'PM' : 'AM';
  const hours12 = hours % 12 || 12;
  return `${String(hours12).padStart(2, '0')}:${String(minutes).padStart(2, '0')} ${ampm}`;
}
