import * as React from "react"
import { cn } from "@/lib/utils"

// React 19: `ref` ikut di `props`, tanpa forwardRef.
function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(
        "min-h-20 w-full rounded-sm border border-input bg-background px-3 py-2 text-[15px] font-light text-ink outline-none transition-[border-color,box-shadow] duration-[120ms] placeholder:text-ink-mute focus-visible:border-primary focus-visible:shadow-focus disabled:cursor-not-allowed disabled:bg-canvas-soft aria-invalid:border-ruby",
        className
      )}
      {...props}
    />
  )
}

export { Textarea }
