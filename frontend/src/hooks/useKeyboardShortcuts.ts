import { useEffect, useRef } from 'react';

type Handler = (e: KeyboardEvent) => void;
export type ShortcutMap = Record<string, Handler>;

function buildKey(e: KeyboardEvent): string {
  const mods: string[] = [];
  if (e.metaKey) mods.push('meta');
  if (e.ctrlKey) mods.push('ctrl');
  if (e.altKey) mods.push('alt');
  if (e.shiftKey) mods.push('shift');
  mods.push(e.key.toLowerCase());
  return mods.join('+');
}

export const isMac =
  typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.userAgent);

/** Human-readable label for a shortcut combo.
 *  Parts: 'cmd' | 'ctrl' | 'alt' | 'shift' | 'enter' | 'tab' | 'escape' | any char
 */
export function shortcutLabel(parts: string[]): string {
  return parts
    .map((p) => {
      switch (p) {
        case 'cmd':    return isMac ? '⌘' : 'Ctrl';
        case 'ctrl':   return isMac ? '^'  : 'Ctrl';
        case 'alt':    return isMac ? '⌥'  : 'Alt';
        case 'shift':  return '⇧';
        case 'enter':  return '↩';
        case 'tab':    return 'Tab';
        case 'escape': return 'Esc';
        case 'arrowup':    return '↑';
        case 'arrowdown':  return '↓';
        case 'arrowleft':  return '←';
        case 'arrowright': return '→';
        default:       return p.length === 1 ? p.toUpperCase() : p;
      }
    })
    .join('');
}

/**
 * Register global keyboard shortcuts. Pass a stable object (or let the hook
 * track the latest via ref so callers don't need to memoize).
 *
 * Modifier combos fire even when focus is inside an input.
 * Bare keys (e.g. '?') only fire when focus is NOT in an editable element.
 */
export function useKeyboardShortcuts(shortcuts: ShortcutMap): void {
  const ref = useRef<ShortcutMap>(shortcuts);
  // Always keep ref in sync without re-registering the listener
  useEffect(() => { ref.current = shortcuts; });

  useEffect(() => {
    const handle = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      const isEditing =
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.isContentEditable;

      const key = buildKey(e);
      const fn = ref.current[key];
      if (!fn) return;

      const hasModifier = e.metaKey || e.ctrlKey || e.altKey;
      if (hasModifier || !isEditing) {
        e.preventDefault();
        e.stopPropagation();
        fn(e);
      }
    };

    // capture phase: fires before React synthetic events (lets us intercept Cmd+W etc.)
    window.addEventListener('keydown', handle, { capture: true });
    return () => window.removeEventListener('keydown', handle, { capture: true });
  }, []);
}
