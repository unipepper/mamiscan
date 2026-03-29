import * as React from "react"
import { cn } from "@/src/lib/utils"

export interface BadgeProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: "success" | "caution" | "danger" | "neutral" | "default"
  className?: string
}

function Badge({ className, variant = "default", ...props }: BadgeProps) {
  return (
    <div
      className={cn(
        "inline-flex items-center rounded-xs px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
        {
          "bg-success-bg text-success-fg": variant === "success",
          "bg-caution-bg text-caution-fg": variant === "caution",
          "bg-danger-bg text-danger-fg": variant === "danger",
          "bg-neutral-bg text-neutral-fg": variant === "neutral",
          "bg-bg-surface text-text-primary border border-border-subtle": variant === "default",
        },
        className
      )}
      {...props}
    />
  )
}

export { Badge }
