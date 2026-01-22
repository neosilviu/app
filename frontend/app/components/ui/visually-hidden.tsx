import * as React from "react"

/**
 * VisuallyHidden component - Hides content from view but keeps it accessible to screen readers.
 * Useful for hiding DialogTitle or DialogDescription while maintaining accessibility compliance.
 */
export const VisuallyHidden = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={`sr-only absolute w-px h-px p-0 m-[-1px] overflow-hidden clip-rect-[rect(0,0,0,0)] whitespace-nowrap border-0 ${
      className || ""
    }`.trim()}
    {...props}
  />
))

VisuallyHidden.displayName = "VisuallyHidden"
