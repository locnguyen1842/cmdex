import * as React from "react"

import { cn } from "@/lib/utils"

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      type={type}
      data-slot="input"
      autoComplete="off"
      autoCorrect="off"
      spellCheck={false}
      className={cn(
        "file:text-foreground placeholder:text-[var(--fg-faint)] selection:bg-[var(--brand)] selection:text-[var(--brand-fg)] h-[34px] w-full min-w-0 rounded-[var(--r)] border border-[var(--border)] bg-[var(--surface)] px-3 py-1 text-[12.5px] text-[var(--fg)] shadow-none transition-[color,box-shadow,border-color] outline-none file:inline-flex file:h-7 file:border-0 file:bg-transparent file:text-sm file:font-medium disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50",
        "focus-visible:border-[var(--brand)] focus-visible:ring-[var(--brand-soft)] focus-visible:ring-[3px]",
        "aria-invalid:ring-destructive/20 aria-invalid:border-destructive",
        className
      )}
      {...props}
    />
  )
}

export { Input }
