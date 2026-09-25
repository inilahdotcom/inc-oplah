import { Button as ButtonPrimitive } from "@base-ui/react/button"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"

// Pill button Stripi (DESIGN.md "Buttons", docs/design/ds_reference/Button.jsx).
const buttonVariants = cva(
  "inline-flex shrink-0 items-center justify-center gap-1.5 rounded-full border border-transparent font-normal leading-none whitespace-nowrap transition-colors duration-[120ms] ease-standard outline-none select-none focus-visible:shadow-focus disabled:pointer-events-none disabled:opacity-40 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-3.5",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground hover:bg-primary-deep active:bg-primary-press",
        secondary: "border-primary bg-background text-primary hover:bg-[#f2f0ff] active:bg-[#e6e2ff]",
        "on-dark": "bg-brand-dark text-white hover:bg-[#2a2d6e] active:bg-[#12143a]",
        outline: "border-hairline bg-background text-ink hover:bg-canvas-soft",
        ghost: "text-primary hover:text-primary-deep active:text-primary-press",
        destructive: "text-ruby hover:text-danger-text",
      },
      size: {
        default: "min-h-9 px-4 py-2 text-base",
        sm: "min-h-8 px-4 py-2 text-sm",
        lg: "min-h-11 px-5 py-3 text-base",
        icon: "size-9",
      },
    },
    compoundVariants: [
      { variant: ["ghost", "destructive"], className: "min-h-0 px-0 py-0" },
    ],
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

function Button({
  className,
  variant = "default",
  size = "default",
  ...props
}: ButtonPrimitive.Props & VariantProps<typeof buttonVariants>) {
  return (
    <ButtonPrimitive
      data-slot="button"
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  )
}

export { Button, buttonVariants }
