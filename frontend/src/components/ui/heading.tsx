import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const headingVariants = cva("font-semibold tracking-tight text-foreground", {
  variants: {
    level: {
      1: "text-2xl scroll-m-20",
      2: "text-xl border-border border-b pb-2 scroll-m-20",
      3: "text-lg scroll-m-20",
      4: "text-base scroll-m-20",
      5: "text-sm scroll-m-20",
      6: "text-xs scroll-m-20",
    },
  },
  defaultVariants: {
    level: 1,
  },
})

const TAG_BY_LEVEL = {
  1: "h1",
  2: "h2",
  3: "h3",
  4: "h4",
  5: "h5",
  6: "h6",
} as const

export interface HeadingProps
  extends Omit<React.HTMLAttributes<HTMLHeadingElement>, "children">,
    VariantProps<typeof headingVariants> {}

const Heading = React.forwardRef<HTMLHeadingElement, HeadingProps>(
  ({ className, level = 1, ...props }, ref) => {
    const Comp = TAG_BY_LEVEL[level as keyof typeof TAG_BY_LEVEL]
    return (
      <Comp
        ref={ref}
        data-slot="heading"
        className={cn(headingVariants({ level }), className)}
        {...props}
      />
    )
  },
)
Heading.displayName = "Heading"

export { Heading, headingVariants }
