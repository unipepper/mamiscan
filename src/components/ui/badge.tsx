import * as React from "react"
import { cn } from "@/lib/utils"

export interface BadgeProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: "success" | "caution" | "danger" | "neutral" | "default" | "solid-success" | "solid-caution" | "solid-danger" | "solid-neutral"
  size?: "sm" | "md" | "lg"
  className?: string
}

function Badge({ className, variant = "default", size = "md", ...props }: BadgeProps) {
  return (
    <div
      className={cn(
        "inline-flex items-center rounded-full leading-none transition-colors",
        size === "sm" ? "px-2.5 py-0.5 text-xs font-medium" : size === "md" ? "px-2.5 py-0.5 text-[13px] font-semibold" : "px-3.5 py-1 text-sm font-medium",
        {
          "bg-success-bg text-success-fg": variant === "success",
          "bg-caution-bg text-caution-fg": variant === "caution",
          "bg-danger-bg text-danger-fg": variant === "danger",
          "bg-neutral-bg text-neutral-fg": variant === "neutral",
          "bg-bg-surface text-text-primary border border-border-subtle": variant === "default",
          "bg-success-fg text-white": variant === "solid-success",
          "bg-caution-fg text-white": variant === "solid-caution",
          "bg-danger-fg text-white": variant === "solid-danger",
          "bg-neutral-fg text-white": variant === "solid-neutral",
        },
        className
      )}
      {...props}
    />
  )
}

export { Badge }
