import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { Slot } from "radix-ui"

import { cn } from "@/lib/utils"

const badgeVariants = cva(
  "inline-flex items-center justify-center rounded-full border border-transparent px-2 py-0.5 text-xs font-medium w-fit whitespace-nowrap shrink-0 [&>svg]:size-3 gap-1 [&>svg]:pointer-events-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive transition-[color,box-shadow] overflow-hidden",
  {
    variants: {
      variant: {
        default: "bg-[var(--brand)] text-[var(--brand-fg)] [a&]:hover:brightness-110",
        secondary:
          "bg-[var(--surface-2)] text-[var(--fg)] [a&]:hover:brightness-95",
        destructive:
          "bg-[var(--danger)] text-white [a&]:hover:brightness-110 focus-visible:ring-destructive/20",
        success:
          "bg-success text-success-foreground [a&]:hover:bg-success/90",
        outline:
          "border-[var(--border)] text-[var(--fg)] [a&]:hover:bg-[var(--surface-2)]",
        ghost: "[a&]:hover:bg-[var(--surface-2)]",
        link: "text-[var(--brand)] underline-offset-4 [a&]:hover:underline",
        "outline-default":
          "border-[var(--border)] text-[var(--brand)] [a&]:hover:bg-[var(--surface-2)]",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

function Badge({
  className,
  variant = "default",
  asChild = false,
  ...props
}: React.ComponentProps<"span"> &
  VariantProps<typeof badgeVariants> & { asChild?: boolean }) {
  const Comp = asChild ? Slot.Root : "span"

  return (
    <Comp
      data-slot="badge"
      data-variant={variant}
      className={cn(badgeVariants({ variant }), className)}
      {...props}
    />
  )
}

export { Badge, badgeVariants }
