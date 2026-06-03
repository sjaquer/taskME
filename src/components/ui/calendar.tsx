"use client"

import * as React from "react"
import { ChevronLeft, ChevronRight } from "lucide-react"
import { DayPicker } from "react-day-picker"

import { cn } from "@/lib/utils"

export type CalendarProps = React.ComponentProps<typeof DayPicker>

function Calendar({
  className,
  classNames,
  showOutsideDays = true,
  ...props
}: CalendarProps) {
  return (
    <DayPicker
      showOutsideDays={showOutsideDays}
      className={cn("p-0 w-full", className)}
      classNames={{
        // Container principal
        months: "flex flex-col w-full",
        month: "space-y-3 w-full",
        // Header con mes y navegación — touch targets grandes
        caption: "flex justify-between items-center px-1 py-3 relative",
        caption_label: "text-base sm:text-lg font-black uppercase tracking-wide text-white",
        nav: "flex items-center gap-1",
        nav_button: cn(
          "inline-flex items-center justify-center",
          // Touch target mínimo 44px para WebView
          "h-11 w-11 sm:h-10 sm:w-10",
          "rounded-xl border border-white/[0.08] bg-white/[0.02]",
          "text-white/60 hover:bg-white/[0.08] hover:text-white active:scale-95",
          "transition-all duration-150"
        ),
        nav_button_previous: "",
        nav_button_next: "",
        // Tabla del calendario
        table: "w-full border-collapse",
        // Header con días de la semana
        head_row: "flex w-full mb-2",
        head_cell: cn(
          "flex-1 text-center",
          "text-[11px] sm:text-xs font-black uppercase tracking-wider",
          "text-primary/70 py-2"
        ),
        // Filas de días
        row: "flex w-full",
        // Celdas individuales
        cell: cn(
          "flex-1 aspect-square p-0.5 sm:p-1 relative",
          "[&:has([aria-selected])]:bg-transparent"
        ),
        // Botones de día — touch targets de 44px+
        day: cn(
          "w-full h-full min-h-[44px] sm:min-h-[48px]",
          "flex items-center justify-center",
          "rounded-xl text-sm sm:text-base font-bold",
          "text-white/80 transition-all duration-150",
          "hover:bg-white/[0.06] active:scale-95",
          "focus:outline-none focus:ring-2 focus:ring-primary/50",
          "relative font-data",
          "aria-selected:opacity-100"
        ),
        // Estados especiales
        day_range_end: "day-range-end",
        day_selected: cn(
          "bg-primary text-primary-foreground font-black",
          "hover:bg-primary hover:text-primary-foreground",
          "shadow-[0_0_20px_rgba(57,255,20,0.4),inset_0_1px_0_rgba(255,255,255,0.2)]",
          "border border-primary/50"
        ),
        day_today: cn(
          "bg-primary/15 text-primary font-black",
          "border-2 border-primary/40",
          "shadow-[0_0_10px_rgba(57,255,20,0.2)]"
        ),
        day_outside: "text-white/20 hover:text-white/30 hover:bg-white/[0.02]",
        day_disabled: "text-white/10 cursor-not-allowed hover:bg-transparent",
        day_range_middle: "aria-selected:bg-accent aria-selected:text-accent-foreground",
        day_hidden: "invisible",
        ...classNames,
      }}
      components={{
        Chevron: ({ orientation, ...chevronProps }) =>
          orientation === "left" ? (
            <ChevronLeft className="h-5 w-5" {...chevronProps} />
          ) : (
            <ChevronRight className="h-5 w-5" {...chevronProps} />
          ),
      }}
      {...props}
    />
  )
}
Calendar.displayName = "Calendar"

export { Calendar }
