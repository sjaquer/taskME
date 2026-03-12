"use client"

import * as React from "react"
import * as ToastPrimitives from "@radix-ui/react-toast"
import { cva, type VariantProps } from "class-variance-authority"
import { X } from "lucide-react"

import { cn } from "@/lib/utils"

const ToastProvider = ToastPrimitives.Provider

const ToastViewport = React.forwardRef<
  React.ElementRef<typeof ToastPrimitives.Viewport>,
  React.ComponentPropsWithoutRef<typeof ToastPrimitives.Viewport>
>(({ className, ...props }, ref) => (
  <ToastPrimitives.Viewport
    ref={ref}
    className={cn(
      // Mobile: fixed bottom, full-width — no depende de dvh/vw (WebView-safe)
      // pb-20 = espacio para bottom-nav; left-0 right-0 bottom-0 explícito
      "fixed left-0 right-0 bottom-0 z-[100] flex w-full flex-col gap-2 p-3 pb-20",
      // Desktop (sm+): esquina inferior derecha, ancho limitado
      "sm:left-auto sm:right-0 sm:bottom-0 sm:w-auto sm:max-w-[420px] sm:p-4 sm:pb-4",
      className
    )}
    style={{ WebkitOverflowScrolling: "touch" } as React.CSSProperties}
    {...props}
  />
))
ToastViewport.displayName = ToastPrimitives.Viewport.displayName

const toastVariants = cva(
  [
    // Base: full-width card fijada al bottom — WebView-safe (no translate centering)
    "group pointer-events-auto relative flex w-full items-center gap-3 overflow-hidden border shadow-2xl backdrop-blur-xl transition-all",
    // Mobile: rounded-xl con padding generoso y touch-friendly
    "rounded-xl p-4 pr-10",
    // Swipe down to dismiss (vertical, no horizontal — patrón nativo Android/iOS)
    "data-[swipe=cancel]:translate-y-0 data-[swipe=end]:translate-y-[var(--radix-toast-swipe-end-y)] data-[swipe=move]:translate-y-[var(--radix-toast-swipe-move-y)] data-[swipe=move]:transition-none",
    // Animations: slide-up desde bottom (fixed bottom:0 safe)
    "data-[state=open]:animate-in data-[state=closed]:animate-out data-[swipe=end]:animate-out",
    "data-[state=closed]:fade-out-0 data-[state=closed]:slide-out-to-bottom-full",
    "data-[state=open]:slide-in-from-bottom-full data-[state=open]:fade-in-0",
  ].join(" "),
  {
    variants: {
      variant: {
        default:
          "border-white/[0.08] bg-[#0a0a0a]/90 text-white shadow-[0_0_20px_rgba(57,255,20,0.08)]",
        success:
          "border-primary/20 bg-[#0a0a0a]/90 text-white shadow-[0_0_20px_rgba(57,255,20,0.15)]",
        destructive:
          "destructive border-red-500/20 bg-[#0a0a0a]/90 text-white shadow-[0_0_20px_rgba(239,68,68,0.15)]",
        warning:
          "border-yellow-500/20 bg-[#0a0a0a]/90 text-white shadow-[0_0_20px_rgba(234,179,8,0.15)]",
        info:
          "border-blue-500/20 bg-[#0a0a0a]/90 text-white shadow-[0_0_20px_rgba(59,130,246,0.15)]",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

const Toast = React.forwardRef<
  React.ElementRef<typeof ToastPrimitives.Root>,
  React.ComponentPropsWithoutRef<typeof ToastPrimitives.Root> &
    VariantProps<typeof toastVariants>
>(({ className, variant, ...props }, ref) => {
  return (
    <ToastPrimitives.Root
      ref={ref}
      className={cn(toastVariants({ variant }), className)}
      {...props}
    />
  )
})
Toast.displayName = ToastPrimitives.Root.displayName

const ToastAction = React.forwardRef<
  React.ElementRef<typeof ToastPrimitives.Action>,
  React.ComponentPropsWithoutRef<typeof ToastPrimitives.Action>
>(({ className, ...props }, ref) => (
  <ToastPrimitives.Action
    ref={ref}
    className={cn(
      "inline-flex h-9 shrink-0 items-center justify-center rounded-xl border border-white/[0.08] bg-white/[0.05] px-4 text-xs font-black uppercase tracking-widest text-white/70 ring-offset-background transition-colors hover:bg-white/[0.1] hover:text-white focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 group-[.destructive]:border-red-500/20 group-[.destructive]:hover:border-red-500/30 group-[.destructive]:hover:bg-red-500/10 group-[.destructive]:hover:text-red-400 group-[.destructive]:focus:ring-red-500",
      className
    )}
    {...props}
  />
))
ToastAction.displayName = ToastPrimitives.Action.displayName

const ToastClose = React.forwardRef<
  React.ElementRef<typeof ToastPrimitives.Close>,
  React.ComponentPropsWithoutRef<typeof ToastPrimitives.Close>
>(({ className, ...props }, ref) => (
  <ToastPrimitives.Close
    ref={ref}
    className={cn(
      "absolute right-3 top-3 rounded-full p-1.5 bg-white/[0.05] text-white/40 transition-all hover:bg-white/[0.1] hover:text-white focus:outline-none focus:ring-2 focus:ring-ring",
      "group-[.destructive]:text-red-400/60 group-[.destructive]:hover:text-red-300",
      className
    )}
    toast-close=""
    {...props}
  >
    <X className="h-4 w-4" />
  </ToastPrimitives.Close>
))
ToastClose.displayName = ToastPrimitives.Close.displayName

const ToastTitle = React.forwardRef<
  React.ElementRef<typeof ToastPrimitives.Title>,
  React.ComponentPropsWithoutRef<typeof ToastPrimitives.Title>
>(({ className, ...props }, ref) => (
  <ToastPrimitives.Title
    ref={ref}
    className={cn("text-sm font-black tracking-tight", className)}
    {...props}
  />
))
ToastTitle.displayName = ToastPrimitives.Title.displayName

const ToastDescription = React.forwardRef<
  React.ElementRef<typeof ToastPrimitives.Description>,
  React.ComponentPropsWithoutRef<typeof ToastPrimitives.Description>
>(({ className, ...props }, ref) => (
  <ToastPrimitives.Description
    ref={ref}
    className={cn("text-xs text-white/50 leading-relaxed", className)}
    {...props}
  />
))
ToastDescription.displayName = ToastPrimitives.Description.displayName

type ToastProps = React.ComponentPropsWithoutRef<typeof Toast>

type ToastActionElement = React.ReactElement<typeof ToastAction>

export {
  type ToastProps,
  type ToastActionElement,
  ToastProvider,
  ToastViewport,
  Toast,
  ToastTitle,
  ToastDescription,
  ToastClose,
  ToastAction,
}
