import { cn } from "@/lib/utils"
import { shortcutLabelParts, type ShortcutId, SHORTCUTS } from "@/lib/shortcuts"

function Kbd({ className, ...props }: React.ComponentProps<"kbd">) {
  return (
    <kbd
      data-slot="kbd"
      className={cn(
        "pointer-events-none inline-flex h-5 w-fit min-w-5 items-center justify-center gap-1 rounded-sm bg-muted px-1 font-sans text-xs font-medium text-foreground select-none",
        "[&_svg:not([class*='size-'])]:size-3",
        className
      )}
      {...props}
    />
  )
}

function KbdGroup({ className, ...props }: React.ComponentProps<"span">) {
  return (
    <span
      data-slot="kbd-group"
      className={cn("inline-flex items-center gap-1", className)}
      {...props}
    />
  )
}

/** Render a shortcut as a group of Kbd badges, either from a registered ID or raw key parts */
function ShortcutLabel({ id, keys, className }: { id?: ShortcutId; keys?: readonly string[]; className?: string }) {
  const parts = shortcutLabelParts(id ? SHORTCUTS[id].keys : keys ?? []);
  return (
    <KbdGroup className={className}>
      {parts.map((p, i) => <Kbd key={i}>{p}</Kbd>)}
    </KbdGroup>
  );
}

/** Label text + shortcut badge group, for use in tooltips */
function ShortcutHint({ label, id, keys }: { label: string; id?: ShortcutId; keys?: readonly string[] }) {
  return (
    <span className="tooltip-with-shortcut">
      {label} <ShortcutLabel id={id} keys={keys} />
    </span>
  );
}

export { Kbd, KbdGroup, ShortcutLabel, ShortcutHint }
