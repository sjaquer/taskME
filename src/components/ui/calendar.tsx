"use client"

import * as React from "react"
import { ChevronLeft, ChevronRight } from "lucide-react"
import { DayPicker } from "react-day-picker"

import { cn } from "@/lib/utils"
import { buttonVariants } from "@/components/ui/button"

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
      className={cn("p-3 w-full max-w-full", className)}
      classNames={{
        months: "flex flex-col sm:flex-row space-y-4 sm:space-x-4 sm:space-y-0 w-full",
        month: "space-y-4 w-full",
        caption: "flex justify-center pt-1 relative items-center mb-4",
        caption_label: "text-sm font-black uppercase tracking-widest text-white/90",
        nav: "space-x-1 flex items-center",
        nav_button: cn(
          buttonVariants({ variant: "outline" }),
          "h-8 w-8 bg-transparent p-0 border-white/[0.08] text-white/50 hover:bg-white/[0.05] hover:text-white transition-all rounded-xl"
        ),
        nav_button_previous: "absolute left-1",
        nav_button_next: "absolute right-1",
        table: "w-full border-collapse space-y-1",
        head_row: "flex w-full",
        head_cell:
          "text-primary/60 rounded-md w-full font-black text-[10px] uppercase tracking-widest",
        row: "flex w-full mt-2 gap-1 justify-between",
        cell: "h-10 md:h-11 w-full flex items-center justify-center text-sm p-0 relative [&:has([aria-selected].day-range-end)]:rounded-r-md [&:has([aria-selected].day-outside)]:bg-accent/50 [&:has([aria-selected])]:bg-accent first:[&:has([aria-selected])]:rounded-l-md last:[&:has([aria-selected])]:rounded-r-md focus-within:relative focus-within:z-20",
        day: cn(
          buttonVariants({ variant: "ghost" }),
          "h-10 md:h-11 w-full p-0 font-bold transition-all hover:bg-white/[0.08] rounded-xl relative font-data aria-selected:opacity-100"
        ),
        day_range_end: "day-range-end",
        day_selected:
          "bg-primary text-primary-foreground neon-glow hover:bg-primary hover:text-primary-foreground focus:bg-primary focus:text-primary-foreground shadow-[0_0_15px_rgba(57,255,20,0.3)] font-black",
        day_today: "bg-primary/10 text-primary border border-primary/30 font-black",
        day_outside:
          "day-outside text-white/20 aria-selected:bg-accent/50 aria-selected:text-muted-foreground",
        day_disabled: "text-muted-foreground opacity-50",
        day_range_middle:
          "aria-selected:bg-accent aria-selected:text-accent-foreground",
        day_hidden: "invisible",
        ...classNames,
      }}
      components={{
        Chevron: ({ orientation, ...chevronProps }) =>
          orientation === "left" ? (
            <ChevronLeft className="h-4 w-4" {...chevronProps} />
          ) : (
            <ChevronRight className="h-4 w-4" {...chevronProps} />
          ),
      }}
      {...props}
    />
  )
}
Calendar.displayName = "Calendar"

export { Calendar }
