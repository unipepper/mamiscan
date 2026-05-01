import * as React from "react"
import { cn } from "@/lib/utils"

interface NotificationDotProps {
  className?: string
}

function NotificationDot({ className }: NotificationDotProps) {
  return (
    <span
      className={cn(
        "absolute top-0 -right-2 w-1.5 h-1.5 rounded-full bg-danger-fg",
        className
      )}
    />
  )
}

export { NotificationDot }
