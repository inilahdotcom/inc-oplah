import * as React from "react"
import { Input as InputPrimitive } from "@base-ui/react/input"
import { cn } from "@/lib/utils"

// React 19: `ref` (mis. dari `register()` react-hook-form) ikut di `props`, tanpa forwardRef.
function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <InputPrimitive
      type={type}
      data-slot="input"
      className={cn(
        "min-h-10 w-full min-w-0 rounded-sm border border-input bg-background px-3 py-2 text-[15px] font-light text-ink transition-[border-color,box-shadow] duration-[120ms] outline-none placeholder:text-ink-mute focus-visible:border-primary focus-visible:shadow-focus disabled:cursor-not-allowed disabled:bg-canvas-soft aria-invalid:border-ruby aria-invalid:shadow-none",
        className
      )}
      {...props}
    />
  )
}

export { Input }
