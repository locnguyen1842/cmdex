export const isMac =
  typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.userAgent);

export const cmdSymbol = isMac ? '⌘' : 'Ctrl';

/** Platform-aware check: Cmd on macOS, Ctrl elsewhere */
export function isCmdOrCtrl(e: KeyboardEvent | React.KeyboardEvent): boolean {
  return isMac ? e.metaKey : e.ctrlKey;
}

/** Modifier key string for useKeyboardShortcuts hook registration */
export const cmdOrCtrl = isMac ? 'meta' : 'ctrl';

/**
 * Human-readable label parts for a shortcut combo.
 * Accepted tokens: 'cmd' | 'ctrl' | 'alt' | 'shift' | 'enter' | 'tab' |
 * 'escape' | 'backspace' | 'delete' | arrow keys | any single char
 */
export function shortcutLabelParts(parts: readonly string[]): string[] {
  return parts.map((p) => {
    switch (p) {
      case 'cmd':        return isMac ? '⌘' : 'Ctrl';
      case 'ctrl':       return isMac ? '^'  : 'Ctrl';
      case 'alt':        return isMac ? '⌥'  : 'Alt';
      case 'shift':      return '⇧';
      case 'enter':      return '↩';
      case 'tab':        return 'Tab';
      case 'escape':     return 'Esc';
      case 'backspace':  return '⌫';
      case 'delete':     return '⌦';
      case 'arrowup':    return '↑';
      case 'arrowdown':  return '↓';
      case 'arrowleft':  return '←';
      case 'arrowright': return '→';
      default:           return p.length === 1 ? p.toUpperCase() : p;
    }
  });
}

export function shortcutLabelString(parts: readonly string[]): string {
  const labels = shortcutLabelParts(parts);
  return isMac ? labels.join(' ') : labels.join('+');
}

// ---------------------------------------------------------------------------
// Central shortcut registry
// Keys use abstract tokens: 'cmd' = Cmd on Mac / Ctrl on other platforms.
// 'ctrl' always means the physical Ctrl key on every platform.
// ---------------------------------------------------------------------------

export const SHORTCUTS = {
  execute:        { keys: ['cmd', 'enter'] },
  save:           { keys: ['cmd', 's'] },
  newCommand:     { keys: ['cmd', 'n'] },
  newTab:         { keys: ['cmd', 't'] },
  closeTab:       { keys: ['cmd', 'w'] },
  palette:        { keys: ['cmd', 'p'] },
  search:         { keys: ['cmd', 'f'] },
  settings:       { keys: ['cmd', ','] },
  shortcuts:      { keys: ['cmd', 'shift', '?'] },
  toggleOutput:   { keys: ['ctrl', '`'] },
  escape:         { keys: ['escape'] },
  discardScript:  { keys: ['cmd', 'shift', 'backspace'] },
  scriptNewLine:  { keys: ['shift', 'enter'] },
  scriptSave:     { keys: ['enter'] },
  switchTab:      { keys: ['cmd', '1-6'] },
  prevOpenedTab:  { keys: ['cmd', '9'] },
  lastTab:        { keys: ['cmd', '0'] },
  nextTab:        { keys: ['ctrl', 'tab'] },
  prevTab:        { keys: ['ctrl', 'shift', 'tab'] },
} as const satisfies Record<string, { keys: readonly string[] }>;

export type ShortcutId = keyof typeof SHORTCUTS;

/** Convenience: get the rendered label string for a registered shortcut */
export function shortcutLabel(id: ShortcutId): string {
  return shortcutLabelString(SHORTCUTS[id].keys);
}
