import * as React from "react"

import { cn } from "@/lib/utils"

function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return (
    <textarea
      data-slot="textarea"
      autoComplete="off"
      autoCorrect="off"
      spellCheck={false}
      className={cn(
        "border-[var(--border)] placeholder:text-[var(--fg-faint)] focus-visible:border-[var(--brand)] focus-visible:ring-[var(--brand-soft)] aria-invalid:ring-destructive/20 aria-invalid:border-destructive flex field-sizing-content min-h-16 w-full rounded-[var(--r)] border bg-[var(--surface)] px-3 py-2 text-[12.5px] text-[var(--fg)] shadow-none transition-[color,box-shadow,border-color] outline-none focus-visible:ring-[3px] disabled:cursor-not-allowed disabled:opacity-50",
        className
      )}
      {...props}
    />
  )
}

export { Textarea }
