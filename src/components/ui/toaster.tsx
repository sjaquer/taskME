"use client"

import { useToast } from "@/hooks/use-toast"
import {
  Toast,
  ToastClose,
  ToastDescription,
  ToastProvider,
  ToastTitle,
  ToastViewport,
} from "@/components/ui/toast"
import { CheckCircle2, XCircle, AlertTriangle, Info, Terminal } from "lucide-react"

const variantIcons = {
  default: <Terminal className="h-5 w-5 shrink-0 text-primary" />,
  success: <CheckCircle2 className="h-5 w-5 shrink-0 text-primary" />,
  destructive: <XCircle className="h-5 w-5 shrink-0 text-red-500" />,
  warning: <AlertTriangle className="h-5 w-5 shrink-0 text-yellow-500" />,
  info: <Info className="h-5 w-5 shrink-0 text-blue-500" />,
} as const;

const variantAccent = {
  default: "bg-primary/20",
  success: "bg-primary/20",
  destructive: "bg-red-500/20",
  warning: "bg-yellow-500/20",
  info: "bg-blue-500/20",
} as const;

export function Toaster() {
  const { toasts } = useToast()

  return (
    <ToastProvider swipeDirection="down">
      {toasts.map(function ({ id, title, description, action, variant, ...props }) {
        const v = variant ?? "default";
        return (
          <Toast key={id} variant={variant} {...props}>
            {/* Accent stripe */}
            <div className={`absolute left-0 top-0 bottom-0 w-1 rounded-l-2xl ${variantAccent[v]}`} />
            {/* Icon */}
            <div className="ml-1">{variantIcons[v]}</div>
            {/* Content */}
            <div className="grid gap-0.5 flex-1 min-w-0">
              {title && <ToastTitle>{title}</ToastTitle>}
              {description && (
                <ToastDescription>{description}</ToastDescription>
              )}
            </div>
            {action}
            <ToastClose />
          </Toast>
        )
      })}
      <ToastViewport />
    </ToastProvider>
  )
}
