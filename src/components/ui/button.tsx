import * as React from "react"
import { cn } from "@/lib/utils"

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "tertiary" | "outline" | "ghost"
  size?: "default" | "sm" | "lg" | "icon"
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "primary", size = "default", ...props }, ref) => {
    return (
      <button
        ref={ref}
        className={cn(
          "inline-flex items-center justify-center whitespace-nowrap rounded-2xl text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary disabled:pointer-events-none disabled:opacity-50",
          {
            "bg-primary text-white hover:bg-primary-strong shadow-sm": variant === "primary",
            "bg-white text-text-primary border border-border-subtle hover:bg-bg-canvas shadow-sm": variant === "secondary",
            "bg-transparent text-text-secondary hover:bg-bg-canvas": variant === "tertiary",
            "border border-border-subtle bg-transparent hover:bg-bg-canvas text-text-primary": variant === "outline",
            "hover:bg-bg-canvas text-text-primary": variant === "ghost",
            "h-12 px-4 py-2": size === "default",
            "h-9 px-3 text-xs rounded-xl": size === "sm",
            "h-14 px-8 text-base font-semibold shadow-lg": size === "lg",
            "h-10 w-10": size === "icon",
          },
          className
        )}
        {...props}
      />
    )
  }
)
Button.displayName = "Button"

export { Button }
