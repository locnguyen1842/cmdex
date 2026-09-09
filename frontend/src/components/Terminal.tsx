import React, { useEffect, useRef, useState, useMemo, useCallback, forwardRef, useImperativeHandle } from 'react';
import { Terminal, type IDecoration } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { WebglAddon } from '@xterm/addon-webgl';
import { WebLinksAddon } from '@xterm/addon-web-links';
import '@xterm/xterm/css/xterm.css';
import { Events } from '@wailsio/runtime';
import { Write, Resize, Start, Clear } from '../../bindings/cmdex/terminalservice';
import { GetShellHistory, CompletePath, CompleteCommands } from '../../bindings/cmdex/suggestionservice';
import { toast } from 'sonner';
import type { Command } from '../types';
import { TerminalInputTracker, type PromptInput } from '../lib/terminalInputTracker';
import {
  commandSuggestions,
  historySuggestions,
  rankSuggestions,
  menuItems,
  ghostFor,
  nextGhostWord,
  planInsertion,
  charCount,
  displayWidth,
  cellWidth,
  type TerminalSuggestion,
} from '../utils/terminalSuggest';
import { completionSpecs } from '../lib/completionSpecs';
import {
  completionContext,
  pathCompletionItems,
  commandCompletionItems,
  subcommandCompletionItems,
  optionCompletionItems,
  type TokenCompletionItem,
  type PathCompletionLike,
  type MenuRow,
} from '../utils/terminalCompletion';
import TerminalSuggestionMenu, { type SuggestionMenuPlacement } from './TerminalSuggestionMenu';

interface TerminalComponentProps {
  isVisible: boolean;
  theme: string;
  sessionId: string;
  // Whether the backend already reports this session's shell as running at
  // mount time (e.g. the session TerminalService.ServiceStartup or
  // CreateSession already spawned). Only consulted once, on mount — see the
  // startCalledRef effect below. Without this, every mount unconditionally
  // called Start() even for an already-running session, which tears down
  // the healthy PTY (startSessionLocked has no "already running" guard, only
  // a re-entrant "already starting" one) and spawns a brand new shell,
  // producing a spurious extra shell/prompt on every session mount.
  initiallyRunning?: boolean;
  onShellExit?: () => void;
  // Warp-style autosuggestions: ghost text after the cursor plus a menu of
  // matching shell history and saved commands. Off unless explicitly
  // enabled (the launcher's terminal leaves all three unset).
  suggestionsEnabled?: boolean;
  suggestionCommands?: Command[];
  // Called when an accepted saved command can't be typed onto the prompt
  // verbatim ({{variables}} / multi-line); the typed text is already erased.
  onRunSavedCommand?: (commandId: string) => void;
}

export interface TerminalHandle {
    clear: () => void;
    getSelection: () => string;
    getLastOutput: () => string;
    focus: () => void;
}

/** Everything the suggestion UI renders; mirrored into a ref for key handlers. */
interface SuggestState {
  items: MenuRow[];
  /** Highlighted menu row; -1 = nothing selected, so Tab/Enter/↑ reach the shell. */
  active: number;
  /** The prompt input these suggestions were computed for. */
  typed: string;
  ghost: string;
  placement: SuggestionMenuPlacement | null;
}

const EMPTY_SUGGEST: SuggestState = { items: [], active: -1, typed: '', ghost: '', placement: null };

function sameSuggest(a: SuggestState, b: SuggestState): boolean {
  if (a === b) return true;
  if (a.typed !== b.typed || a.ghost !== b.ghost || a.active !== b.active) return false;
  if (a.items.length !== b.items.length) return false;
  for (let i = 0; i < a.items.length; i++) {
    if (a.items[i].id !== b.items[i].id) return false;
  }
  const pa = a.placement;
  const pb = b.placement;
  if (!pa || !pb) return pa === pb;
  return pa.left === pb.left && pa.top === pb.top && pa.bottom === pb.bottom
    && pa.above === pb.above && pa.maxHeight === pb.maxHeight;
}

/** How many history entries to pull from the shell's history file. */
const HISTORY_FETCH_LIMIT = 2000;
/** Wait after a command finishes before re-reading the history file. */
const HISTORY_RELOAD_DELAY_MS = 1500;
/** Commands submitted in this session, remembered even before the shell flushes them. */
const LOCAL_HISTORY_LIMIT = 200;
/** Backspace as xterm sends it — erases one character in every shell. */
const DEL = '\x7f';
/** Keys that submit the prompt line. */
const SUBMIT_RE = /[\r\n]/;
/** Keys that end the prompt line without running it: Ctrl+C, Ctrl+D, Ctrl+L. */
// eslint-disable-next-line no-control-regex
const ABORT_RE = /[\x03\x04\x0c]/;
const MENU_WIDTH = 520;
const MENU_GAP = 4;
const MENU_MIN_HEIGHT = 84;
const MENU_MAX_HEIGHT = 300;
/** How long to wait, after the typed token last changed, before asking the
 * backend for path/command completions — short enough to feel instant,
 * long enough that a fast typist doesn't fire one request per keystroke. */
const TOKEN_FETCH_DEBOUNCE_MS = 40;

// ── xterm theme, derived from the app's design tokens ──────────────────────
// The design tokens (src/style.css) are authored per-theme in whatever color
// space is convenient (oklch(), color-mix(), color(srgb …), hex, …), but
// xterm's WebGL renderer only understands plain rgb()/rgba()/hex strings.
// getComputedStyle() is *not* a reliable way to normalize this: modern
// browsers can echo a custom property's value back in its original color
// function (e.g. "oklch(12% …)") rather than resolving it to rgb(), which
// also breaks naively reading off the first few numbers for a luminance
// check (oklch's lightness channel is 0-1, not 0-255). Rasterizing onto a
// 1x1 canvas and reading the pixel back is the one universal way to resolve
// *any* valid CSS color to concrete 0-255 RGBA, regardless of the space it
// was authored in.
let colorProbeCtx: CanvasRenderingContext2D | null | undefined;
function resolveRgba(colorStr: string): { r: number; g: number; b: number; a: number } | null {
  if (!colorStr || typeof document === 'undefined') return null;
  if (colorProbeCtx === undefined) {
    const canvas = document.createElement('canvas');
    canvas.width = 1;
    canvas.height = 1;
    colorProbeCtx = canvas.getContext('2d', { willReadFrequently: true });
  }
  const ctx = colorProbeCtx;
  if (!ctx) return null;
  ctx.clearRect(0, 0, 1, 1);
  ctx.fillStyle = colorStr;
  ctx.fillRect(0, 0, 1, 1);
  const [r, g, b, a] = ctx.getImageData(0, 0, 1, 1).data;
  return { r, g, b, a: a / 255 };
}

function resolveCssColor(colorStr: string, fallback: string): string {
  const rgba = resolveRgba(colorStr);
  return rgba ? `rgba(${rgba.r}, ${rgba.g}, ${rgba.b}, ${rgba.a})` : fallback;
}

/** Perceived (not relative) luminance, 0-1. */
function perceivedLuminance(rgba: { r: number; g: number; b: number }): number {
  return (0.299 * rgba.r + 0.587 * rgba.g + 0.114 * rgba.b) / 255;
}

/** VS Code's own dark ANSI ramp — readable on a near-black background. */
const ANSI_DARK = {
  black: '#000000', red: '#cd3131', green: '#0dbc79', yellow: '#e5e510',
  blue: '#2472c8', magenta: '#bc3fbc', cyan: '#11a8cd', white: '#e5e5e5',
  brightBlack: '#666666', brightRed: '#f44747', brightGreen: '#4ec9b0',
  brightYellow: '#d7ba7d', brightBlue: '#569cd6', brightMagenta: '#c586c0',
  brightCyan: '#4ec9b0', brightWhite: '#ffffff',
};

/** VS Code's own light ANSI ramp — darker/more saturated so text stays
 * legible on a near-white background (the dark ramp's yellows/whites vanish
 * there). Swapped in automatically when the resolved terminal background is
 * light, e.g. the `classic-light` theme. */
const ANSI_LIGHT = {
  black: '#000000', red: '#cd3131', green: '#00bc00', yellow: '#949800',
  blue: '#0451a5', magenta: '#bc05bc', cyan: '#0598bc', white: '#555555',
  brightBlack: '#666666', brightRed: '#cd3131', brightGreen: '#14ce14',
  brightYellow: '#b5ba00', brightBlue: '#0451a5', brightMagenta: '#bc05bc',
  brightCyan: '#0598bc', brightWhite: '#a5a5a5',
};

/** Builds an xterm `ITheme` from the current design tokens: `--bg-2` for the
 * pane background, `--fg` foreground, `--brand` cursor, and `--brand-soft-strong`
 * for the selection wash — with an ANSI ramp picked for light vs. dark. */
function computeXtermTheme() {
  const styles = getComputedStyle(document.documentElement);
  const bgRgba = resolveRgba(styles.getPropertyValue('--bg-2').trim());
  const background = bgRgba ? `rgba(${bgRgba.r}, ${bgRgba.g}, ${bgRgba.b}, ${bgRgba.a})` : '#1e1e1e';
  const foreground = resolveCssColor(styles.getPropertyValue('--fg').trim(), '#d4d4d4');
  const cursor = resolveCssColor(styles.getPropertyValue('--brand').trim(), '#569cd6');
  const selectionBackground = resolveCssColor(
    styles.getPropertyValue('--brand-soft-strong').trim(),
    'rgba(38, 79, 120, 0.4)'
  );
  const ansi = bgRgba && perceivedLuminance(bgRgba) > 0.5 ? ANSI_LIGHT : ANSI_DARK;
  return {
    background,
    foreground,
    cursor,
    cursorAccent: background,
    selectionBackground,
    ...ansi,
  };
}

const TerminalComponent = forwardRef<TerminalHandle, TerminalComponentProps>(
    ({
      isVisible,
      theme,
      sessionId,
      initiallyRunning,
      onShellExit,
      suggestionsEnabled,
      suggestionCommands,
      onRunSavedCommand,
    }, ref) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const terminalRef = useRef<Terminal | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const isFirstMountRef = useRef(true);
  const backendAvailableRef = useRef(true);
  const startCalledRef = useRef(false);
  const sessionIdRef = useRef(sessionId);
  const onShellExitRef = useRef(onShellExit);
  const initiallyRunningRef = useRef(initiallyRunning);
  useEffect(() => {
    sessionIdRef.current = sessionId;
  }, [sessionId]);
  useEffect(() => {
    onShellExitRef.current = onShellExit;
  }, [onShellExit]);
  useEffect(() => {
    initiallyRunningRef.current = initiallyRunning;
  }, [initiallyRunning]);

  // ── Autosuggestions ──────────────────────────────────────────────────────
  // The shell owns the line editor, so the prompt input is recovered from the
  // screen buffer (lib/terminalInputTracker.ts) and re-ranked on every parsed
  // write. Everything the key handler needs lives in refs, since xterm's
  // handlers are attached once at mount.
  const suggestionsEnabledRef = useRef(!!suggestionsEnabled);
  const onRunSavedCommandRef = useRef(onRunSavedCommand);
  const isVisibleRef = useRef(isVisible);
  const trackerRef = useRef<TerminalInputTracker | null>(null);
  const localHistoryRef = useRef<string[]>([]);
  const fileHistoryRef = useRef<TerminalSuggestion[]>([]);
  const commandCandidatesRef = useRef<TerminalSuggestion[]>([]);
  const candidatesRef = useRef<TerminalSuggestion[]>([]);
  const ghostDecorationRef = useRef<IDecoration | null>(null);
  const dismissedForRef = useRef<string | null>(null);
  const focusedRef = useRef(false);
  const consumedKeyRef = useRef<string | null>(null);
  const skipSubmitRecordRef = useRef(false);
  const historyReloadTimerRef = useRef<number | null>(null);
  const refreshFrameRef = useRef<number | null>(null);
  const suggestRef = useRef<SuggestState>(EMPTY_SUGGEST);
  const [suggest, setSuggestState] = useState<SuggestState>(EMPTY_SUGGEST);
  // ── Token completion (path/command halves are async; subcommand/option
  // halves are synchronous lookups against completionSpecs) ────────────────
  // Cached per (prefix, dirsOnly) / prefix so repeatedly-visited directories
  // and prefixes don't re-hit the backend; the path cache is cleared on a
  // cwd change or a fresh prompt (OSC 133 "D"), since a directory's listing
  // can only go stale that way — the command cache never needs it.
  const pathCacheRef = useRef<Map<string, PathCompletionLike[]>>(new Map());
  const commandCacheRef = useRef<Map<string, string[]>>(new Map());
  const fetchTimerRef = useRef<number | null>(null);
  /** The exact prompt text a debounced fetch was scheduled for; the fetch is
   * dropped if the input has moved on by the time the timer fires. */
  const fetchForTextRef = useRef<string>('');
  /** Set right after inserting a directory (Tab/click, not Enter) so the very
   * next path fetch for the deeper prefix skips the debounce. */
  const forceImmediateFetchRef = useRef(false);
  /** Latest `refresh`, so a fetch resolving later can re-run it without
   * needing `refresh` (defined further down) in its own dependency array. */
  const refreshRef = useRef<() => void>(() => {});
  useEffect(() => {
    onRunSavedCommandRef.current = onRunSavedCommand;
  }, [onRunSavedCommand]);

  const commitSuggest = useCallback((next: SuggestState) => {
    if (sameSuggest(suggestRef.current, next)) return;
    suggestRef.current = next;
    setSuggestState(next);
  }, []);

  const clearGhost = useCallback(() => {
    ghostDecorationRef.current?.dispose();
    ghostDecorationRef.current = null;
  }, []);

  const clearSuggest = useCallback(() => {
    clearGhost();
    commitSuggest(EMPTY_SUGGEST);
  }, [clearGhost, commitSuggest]);

  // Candidate order matters: ties in ranking keep it, so what ran in this
  // session comes first, then the shell's history file (newest first), then
  // the saved-command library.
  const rebuildCandidates = useCallback(() => {
    const local = historySuggestions(localHistoryRef.current);
    const localIds = new Set(local.map((s) => s.id));
    candidatesRef.current = [
      ...local,
      ...fileHistoryRef.current.filter((s) => !localIds.has(s.id)),
      ...commandCandidatesRef.current,
    ];
  }, []);

  // The ghost is an xterm decoration on the cursor row, so it scrolls with the
  // buffer and disappears with it; each glyph is boxed to one terminal cell so
  // it sits on xterm's own grid rather than drifting with font metrics.
  const renderGhost = useCallback((term: Terminal, ghost: string, input: PromptInput) => {
    clearGhost();
    if (!ghost) return;
    const width = Math.min(displayWidth(ghost), term.cols - input.cursorCol);
    if (width <= 0) return;
    const marker = term.registerMarker(0);
    if (!marker) return;
    const decoration = term.registerDecoration({ marker, x: input.cursorCol, width, layer: 'top' });
    if (!decoration) {
      marker.dispose();
      return;
    }
    decoration.onRender((el) => {
      const cellPx = parseFloat(el.style.width) / width;
      if (el.dataset.ghost === ghost && el.dataset.cell === String(cellPx)) return;
      el.dataset.ghost = ghost;
      el.dataset.cell = String(cellPx);
      el.classList.add('terminal-ghost');
      el.style.fontFamily = term.options.fontFamily ?? '';
      el.style.fontSize = `${term.options.fontSize ?? 14}px`;
      const frag = document.createDocumentFragment();
      let used = 0;
      for (const ch of ghost) {
        const w = cellWidth(ch);
        if (used + w > width) break;
        const span = document.createElement('span');
        span.textContent = ch;
        span.style.width = `${w * cellPx}px`;
        frag.appendChild(span);
        used += w;
      }
      el.replaceChildren(frag);
    });
    decoration.onDispose(() => marker.dispose());
    ghostDecorationRef.current = decoration;
  }, [clearGhost]);

  // Debounced, cached, self-cancelling backend lookups behind the 'path' and
  // 'command' completion contexts. Both write their result into the shared
  // cache and re-run the latest refresh() (via refreshRef, to avoid a
  // dependency cycle with refresh itself) rather than touching component
  // state directly, so refresh() stays the single place that turns "what's
  // typed now" into menu rows.
  const fetchPathCompletions = useCallback((prefix: string, dirsOnly: boolean, forText: string) => {
    const key = `${dirsOnly ? '1' : '0'} ${prefix}`;
    if (pathCacheRef.current.has(key)) return;
    const sid = sessionIdRef.current;
    const run = () => {
      fetchTimerRef.current = null;
      if (fetchForTextRef.current !== forText) return; // superseded by newer input
      CompletePath(sid, prefix, dirsOnly)
        .then((result) => {
          if (sessionIdRef.current !== sid) return;
          pathCacheRef.current.set(key, (result ?? []) as PathCompletionLike[]);
          refreshRef.current();
        })
        .catch((err) => console.debug('CompletePath failed:', err));
    };
    if (fetchTimerRef.current !== null) {
      window.clearTimeout(fetchTimerRef.current);
      fetchTimerRef.current = null;
    }
    if (forceImmediateFetchRef.current) {
      forceImmediateFetchRef.current = false;
      run();
    } else {
      fetchTimerRef.current = window.setTimeout(run, TOKEN_FETCH_DEBOUNCE_MS);
    }
  }, []);

  const fetchCommandCompletions = useCallback((prefix: string, forText: string) => {
    if (commandCacheRef.current.has(prefix)) return;
    const sid = sessionIdRef.current;
    const run = () => {
      fetchTimerRef.current = null;
      if (fetchForTextRef.current !== forText) return; // superseded by newer input
      CompleteCommands(sid, prefix)
        .then((result) => {
          if (sessionIdRef.current !== sid) return;
          commandCacheRef.current.set(prefix, result ?? []);
          refreshRef.current();
        })
        .catch((err) => console.debug('CompleteCommands failed:', err));
    };
    if (fetchTimerRef.current !== null) {
      window.clearTimeout(fetchTimerRef.current);
      fetchTimerRef.current = null;
    }
    fetchTimerRef.current = window.setTimeout(run, TOKEN_FETCH_DEBOUNCE_MS);
  }, []);

  // Synchronous half: subcommand/option completions come straight out of the
  // static spec table, no backend round-trip needed.
  const tokenCompletionsFor = useCallback((typed: string, forText: string): TokenCompletionItem[] => {
    const ctx = completionContext(typed, completionSpecs);
    switch (ctx.kind) {
      case 'subcommand':
        return subcommandCompletionItems(completionSpecs[ctx.command.toLowerCase()], ctx.prefix);
      case 'option':
        return optionCompletionItems(completionSpecs[ctx.command.toLowerCase()], ctx.subcommand, ctx.prefix);
      case 'path': {
        const key = `${ctx.dirsOnly ? '1' : '0'} ${ctx.prefix}`;
        const cached = pathCacheRef.current.get(key);
        if (cached) return pathCompletionItems(cached, ctx.prefix);
        fetchPathCompletions(ctx.prefix, ctx.dirsOnly, forText);
        return [];
      }
      case 'command': {
        const cached = commandCacheRef.current.get(ctx.prefix);
        if (cached) return commandCompletionItems(cached, ctx.prefix);
        if (ctx.prefix) fetchCommandCompletions(ctx.prefix, forText);
        return [];
      }
      default:
        return [];
    }
  }, [fetchPathCompletions, fetchCommandCompletions]);

  // Anchor the menu under the start of the input (or above it when the prompt
  // sits near the bottom of the pane, as it usually does).
  const computePlacement = useCallback((term: Terminal, input: PromptInput): SuggestionMenuPlacement | null => {
    const wrap = wrapRef.current;
    const screen = term.element?.querySelector<HTMLElement>('.xterm-screen');
    if (!wrap || !screen || term.rows === 0 || term.cols === 0) return null;
    const wrapRect = wrap.getBoundingClientRect();
    const screenRect = screen.getBoundingClientRect();
    if (wrapRect.height === 0 || screenRect.height === 0) return null;
    const cellW = screenRect.width / term.cols;
    const cellH = screenRect.height / term.rows;
    const anchorCol = input.startRow === input.cursorRow ? input.startCol : 0;
    const rawLeft = screenRect.left - wrapRect.left + anchorCol * cellW;
    const left = Math.max(0, Math.min(rawLeft, wrapRect.width - MENU_WIDTH - MENU_GAP));
    const rowTop = screenRect.top - wrapRect.top + input.cursorRow * cellH;
    const rowBottom = rowTop + cellH;
    const spaceBelow = wrapRect.height - rowBottom - MENU_GAP;
    const spaceAbove = rowTop - MENU_GAP;
    const clampHeight = (space: number) => Math.max(MENU_MIN_HEIGHT, Math.min(MENU_MAX_HEIGHT, space));
    if (spaceBelow >= MENU_MIN_HEIGHT || spaceBelow >= spaceAbove) {
      return { left, top: rowBottom + MENU_GAP, above: false, maxHeight: clampHeight(spaceBelow) };
    }
    return { left, bottom: wrapRect.height - rowTop + MENU_GAP, above: true, maxHeight: clampHeight(spaceAbove) };
  }, []);

  const refresh = useCallback(() => {
    refreshFrameRef.current = null;
    const term = terminalRef.current;
    const tracker = trackerRef.current;
    // Exposed for e2e tests and debugging: which phase the input tracker is in.
    if (wrapRef.current && tracker) wrapRef.current.dataset.promptPhase = tracker.phase;
    if (!term || !tracker || !suggestionsEnabledRef.current || !isVisibleRef.current || !focusedRef.current) {
      clearSuggest();
      return;
    }
    const buffer = term.buffer.active;
    const input = tracker.readInput(buffer, term.cols);
    // Only suggest at the end of a non-empty prompt line, and only while the
    // viewport actually shows the prompt (not scrolled up into history).
    if (!input || !input.atEnd || !input.text.trim() || buffer.viewportY !== buffer.baseY) {
      clearSuggest();
      return;
    }
    if (dismissedForRef.current !== null) {
      if (dismissedForRef.current === input.text) {
        clearSuggest();
        return;
      }
      dismissedForRef.current = null;
    }
    // The latest known prompt text, so a debounced fetch scheduled from this
    // call (or an earlier one) can tell it's been superseded once the user
    // keeps typing, and skip firing.
    fetchForTextRef.current = input.text;
    const ranked = rankSuggestions(input.text, candidatesRef.current);
    const lineRows: MenuRow[] = menuItems(ranked).map((r) => ({ ...r, kind: 'line' as const }));
    // Token completions (path/subcommand/option/command) come first, like
    // Warp's contextual completions, ahead of whole-line history/saved-
    // command suggestions.
    const tokenRows = tokenCompletionsFor(input.text, input.text);
    const items: MenuRow[] = [...tokenRows, ...lineRows];
    const ghost = ghostFor(input.text, ranked);
    renderGhost(term, ghost, input);
    const prev = suggestRef.current;
    const keepActive = prev.typed === input.text && prev.active >= 0
      && items[prev.active]?.id === prev.items[prev.active]?.id;
    commitSuggest({
      items,
      active: keepActive ? prev.active : -1,
      typed: input.text,
      ghost,
      placement: items.length > 0 ? computePlacement(term, input) : null,
    });
  }, [clearSuggest, commitSuggest, computePlacement, renderGhost, tokenCompletionsFor]);
  refreshRef.current = refresh;

  // Coalesce the flood of onWriteParsed events (one per PTY chunk) into one
  // refresh per animation frame.
  const scheduleRefresh = useCallback(() => {
    if (refreshFrameRef.current !== null) return;
    refreshFrameRef.current = requestAnimationFrame(refresh);
  }, [refresh]);

  // Goes through xterm's own input path, so the tracker and Write see it
  // exactly like a keystroke.
  const sendInput = useCallback((data: string) => {
    terminalRef.current?.input(data, true);
  }, []);

  const pushLocalHistory = useCallback((text: string) => {
    const entry = text.trim();
    if (!entry) return;
    const rest = localHistoryRef.current.filter((e) => e !== entry);
    localHistoryRef.current = [entry, ...rest].slice(0, LOCAL_HISTORY_LIMIT);
    rebuildCandidates();
  }, [rebuildCandidates]);

  const loadHistory = useCallback(() => {
    if (!suggestionsEnabledRef.current || !backendAvailableRef.current) return;
    const forSession = sessionIdRef.current;
    GetShellHistory(forSession, HISTORY_FETCH_LIMIT)
      .then((entries) => {
        if (sessionIdRef.current !== forSession) return;
        fileHistoryRef.current = historySuggestions(entries ?? []);
        rebuildCandidates();
        scheduleRefresh();
      })
      .catch((err) => {
        console.debug('GetShellHistory failed:', err);
      });
  }, [rebuildCandidates, scheduleRefresh]);

  // The shell appends to its history file as commands finish, so re-read it
  // shortly after each finished command — coalesced, since a burst of quick
  // commands would otherwise re-read a multi-megabyte file for every one.
  const scheduleHistoryReload = useCallback(() => {
    if (historyReloadTimerRef.current !== null) return;
    historyReloadTimerRef.current = window.setTimeout(() => {
      historyReloadTimerRef.current = null;
      loadHistory();
    }, HISTORY_RELOAD_DELAY_MS);
  }, [loadHistory]);

  const setActive = useCallback((index: number) => {
    commitSuggest({ ...suggestRef.current, active: index });
  }, [commitSuggest]);

  // Esc hides everything for the current input; typing anything brings the
  // suggestions back.
  const dismissSuggest = useCallback(() => {
    dismissedForRef.current = suggestRef.current.typed || null;
    clearSuggest();
  }, [clearSuggest]);

  const acceptGhost = useCallback((mode: 'all' | 'word') => {
    const { ghost } = suggestRef.current;
    if (!ghost) return;
    clearGhost();
    sendInput(mode === 'word' ? nextGhostWord(ghost) : ghost);
  }, [clearGhost, sendInput]);

  const acceptItem = useCallback((item: MenuRow, mode: 'insert' | 'run') => {
    if (item.kind === 'token') {
      clearSuggest();
      if (mode === 'run') {
        // The onData handler below would otherwise record the stale typed
        // text when it sees this Enter — we don't know the full resulting
        // line here (only the token's own replacement), so there is nothing
        // correct to push into local history for a token accept.
        skipSubmitRecordRef.current = true;
      } else if (item.isDir) {
        // Warp-style drill-down: once the shell echoes the inserted
        // directory name, fetch its contents right away instead of waiting
        // out the normal debounce.
        forceImmediateFetchRef.current = true;
      }
      sendInput(DEL.repeat(item.backspaces) + item.text + (mode === 'run' ? '\r' : ''));
      return;
    }
    const { typed } = suggestRef.current;
    clearSuggest();
    if (item.needsRunFlow && item.commandId) {
      // Not typeable as-is: erase what was typed and hand the command to the
      // app's regular run flow, which prompts for variables and writes the
      // resolved script into this session itself.
      const erase = charCount(typed);
      if (erase > 0) sendInput(DEL.repeat(erase));
      trackerRef.current?.reset();
      onRunSavedCommandRef.current?.(item.commandId);
      return;
    }
    const plan = planInsertion(typed, item.text);
    if (mode === 'run') {
      pushLocalHistory(item.text);
      // The onData handler below would otherwise record the stale typed
      // text when it sees this Enter.
      skipSubmitRecordRef.current = true;
    }
    sendInput(DEL.repeat(plan.backspaces) + plan.text + (mode === 'run' ? '\r' : ''));
  }, [clearSuggest, pushLocalHistory, sendInput]);

  // Only keys that act on a visible suggestion are intercepted; with nothing
  // highlighted in the menu, ↑/Tab/Enter still reach the shell as usual, so
  // history navigation and tab completion keep working.
  const handleKey = useCallback((ev: KeyboardEvent): boolean => {
    if (ev.type !== 'keydown') {
      // Swallow the keypress/keyup that follow a keydown we consumed, or
      // xterm would still send e.g. Enter's "\r" from the keypress.
      if (consumedKeyRef.current !== null && ev.key === consumedKeyRef.current) {
        if (ev.type === 'keyup') consumedKeyRef.current = null;
        return false;
      }
      return true;
    }
    const s = suggestRef.current;
    const hasMenu = s.items.length > 0;
    const hasGhost = s.ghost.length > 0;
    if (!hasMenu && !hasGhost) return true;
    const consume = () => {
      consumedKeyRef.current = ev.key;
      ev.preventDefault();
      return false;
    };
    const unmodified = !ev.ctrlKey && !ev.metaKey && !ev.altKey;
    switch (ev.key) {
      case 'ArrowDown':
        if (hasMenu && unmodified) {
          setActive(Math.min(s.active + 1, s.items.length - 1));
          return consume();
        }
        break;
      case 'ArrowUp':
        if (hasMenu && unmodified && s.active >= 0) {
          setActive(s.active - 1);
          return consume();
        }
        break;
      case 'Tab':
        if (hasMenu && s.active >= 0 && !ev.shiftKey) {
          acceptItem(s.items[s.active], 'insert');
          return consume();
        }
        // Nothing highlighted: Warp completes the top match on Tab, but only
        // when it's a contextual token completion (path/command/subcommand/
        // option) — token rows are always listed first (see refresh()). With
        // only whole-line history/saved-command rows, Tab keeps reaching the
        // shell so its own completion still works.
        if (hasMenu && !ev.shiftKey && s.items[0]?.kind === 'token') {
          acceptItem(s.items[0], 'insert');
          return consume();
        }
        break;
      case 'Enter':
        if (hasMenu && s.active >= 0 && unmodified) {
          acceptItem(s.items[s.active], 'run');
          return consume();
        }
        break;
      case 'Escape':
        dismissSuggest();
        // With only ghost text showing, Esc still reaches the shell (vi mode).
        return hasMenu ? consume() : true;
      case 'ArrowRight':
        if (hasGhost && !ev.ctrlKey && !ev.metaKey) {
          acceptGhost(ev.altKey ? 'word' : 'all');
          return consume();
        }
        break;
      case 'End':
        if (hasGhost && unmodified) {
          acceptGhost('all');
          return consume();
        }
        break;
      case 'f':
      case 'F':
        if (hasGhost && ev.ctrlKey && !ev.metaKey && !ev.altKey) {
          acceptGhost('all');
          return consume();
        }
        break;
      default:
        break;
    }
    return true;
  }, [acceptGhost, acceptItem, dismissSuggest, setActive]);

  const resetSuggestions = useCallback(() => {
    trackerRef.current?.reset();
    dismissedForRef.current = null;
    clearSuggest();
  }, [clearSuggest]);

  useEffect(() => {
    isVisibleRef.current = isVisible;
    if (isVisible) scheduleRefresh();
    else clearSuggest();
  }, [isVisible, scheduleRefresh, clearSuggest]);

  useEffect(() => {
    suggestionsEnabledRef.current = !!suggestionsEnabled;
    if (suggestionsEnabled) loadHistory();
    else clearSuggest();
  }, [suggestionsEnabled, sessionId, loadHistory, clearSuggest]);

  const commandCandidates = useMemo(() => commandSuggestions(suggestionCommands ?? []), [suggestionCommands]);
  useEffect(() => {
    commandCandidatesRef.current = commandCandidates;
    rebuildCandidates();
    scheduleRefresh();
  }, [commandCandidates, rebuildCandidates, scheduleRefresh]);

  useImperativeHandle(ref, () => ({
      clear: () => {
        resetSuggestions();
        if (!backendAvailableRef.current) {
          terminalRef.current?.clear();
          return;
        }
        Clear(sessionIdRef.current).catch((err) => {
          console.error('clear failed:', err);
          if (backendAvailableRef.current) {
            backendAvailableRef.current = false;
          }
        });
        terminalRef.current?.clear();
      },
      getSelection: () => terminalRef.current?.getSelection() || '',
      getLastOutput: () => {
          const buffer = terminalRef.current?.buffer.active;
          if (!buffer) return '';

          const stripAnsi = (str: string) => str
              // eslint-disable-next-line no-control-regex
              .replace(/\x1B\[[0-9;]*[mGKHFJA-Za-z]/g, '')
              // eslint-disable-next-line no-control-regex
              .replace(/\x1B\][^\x07]*\x07/g, '')
              .replace(/\r/g, '');

          const promptRegex = /[$#%❯>➤λ→⟩»◇](\s|$)/;

          const isLineContent = (i: number): boolean => {
              const l = buffer.getLine(i);
              if (!l) return false;
              if (l.isWrapped) {
                  let p = i - 1;
                  while (p >= 0 && buffer.getLine(p)?.isWrapped) p--;
                  if (p >= 0) {
                      const pl = buffer.getLine(p);
                      if (pl && promptRegex.test(pl.translateToString(true).trim())) return false;
                  }
              }
              return stripAnsi(l.translateToString(true)).trim().length > 0;
          };

          const cursorPos = buffer.cursorY + buffer.baseY;
          let promptIdx = -1;
          let prevPromptIdx = -1;
          let scanFrom = cursorPos;

          while (scanFrom >= 0) {
              let found = -1;
              for (let i = scanFrom; i >= 0; i--) {
                  const line = buffer.getLine(i);
                  if (!line) continue;
                  // A wrapped row is a continuation of the row above it, never
                  // the start of a new prompt — testing it against promptRegex
                  // misfires on echoed command text that happens to wrap and
                  // end in a prompt-like character (e.g. a long script line
                  // ending in "$" or ">" when the terminal is narrow).
                  if (line.isWrapped) continue;
                  if (promptRegex.test(line.translateToString(true).trim())) {
                      found = i;
                      break;
                  }
              }

              if (found === -1) break;

              if (promptIdx === -1) {
                  promptIdx = found;
                  scanFrom = found - 1;
                  continue;
              }

              let hasContent = false;
              for (let i = found + 1; i < promptIdx; i++) {
                  if (isLineContent(i)) { hasContent = true; break; }
              }

              if (hasContent) {
                  prevPromptIdx = found;
                  break;
              }

              promptIdx = found;
              scanFrom = found - 1;
          }

          if (promptIdx === -1) return '';

          const outputStart = prevPromptIdx !== -1 ? prevPromptIdx + 1 : promptIdx + 1;
          const outputEnd = prevPromptIdx !== -1 ? promptIdx - 1 : cursorPos;

          const outputLines: string[] = [];
          for (let i = outputStart; i <= outputEnd; i++) {
              const line = buffer.getLine(i);
              if (!line) continue;
              const stripped = stripAnsi(line.translateToString(true));
              if (stripped.length === 0) continue;

              if (line.isWrapped) {
                  let parent = i - 1;
                  while (parent >= 0 && buffer.getLine(parent)?.isWrapped) parent--;
                  if (parent >= 0) {
                      const parentLine = buffer.getLine(parent);
                      if (parentLine && promptRegex.test(parentLine.translateToString(true).trim())) continue;
                  }
                  if (outputLines.length > 0) {
                      outputLines[outputLines.length - 1] += stripped;
                  }
                  continue;
              }

              outputLines.push(stripped);
          }

          return outputLines.join('\n');
      },
      focus: () => {
        terminalRef.current?.focus();
      },
  }));

  useEffect(() => {
    const skipTransition = isFirstMountRef.current;
    if (isFirstMountRef.current) {
        isFirstMountRef.current = false;
    }

    const container = containerRef.current;
    if (!skipTransition && container) {
        container.style.opacity = '0';
        container.style.transition = 'opacity var(--transition-fast)';
    }

    const term = new Terminal({
      cursorBlink: true,
      cursorStyle: 'block',
      fontSize: 12,
      // The design calls for a roomier ~1.7 line-height on the static mockup's
      // term-body text, but that's a plain HTML line, not a live terminal grid —
      // 1.7 stretched here makes an interactive xterm feel broken (huge gaps
      // between every output line). 1.4 keeps the "roomier than default"
      // intent without hurting usability.
      lineHeight: 1.4,
      fontFamily: 'JetBrains Mono, Fira Code, monospace',
      fontWeight: '400',
      scrollback: 5000,
      convertEol: true,
      allowProposedApi: true,
      allowTransparency: false,
      theme: computeXtermTheme(),
    });

    const fitAddon = new FitAddon();
    term.loadAddon(fitAddon);
    fitAddonRef.current = fitAddon;

    const webLinksAddon = new WebLinksAddon((event, uri) => {
      window.open(uri, '_blank');
    });
    term.loadAddon(webLinksAddon);

    try {
      const webglAddon = new WebglAddon();
      webglAddon.onContextLoss(() => webglAddon.dispose());
      term.loadAddon(webglAddon);
    } catch (webglErr) {
      // WebGL unavailable (e.g. headless or no GPU) — fall back to canvas renderer
      console.debug('WebGL addon not available:', webglErr);
    }

    if (containerRef.current) {
      term.open(containerRef.current);
      requestAnimationFrame(() => {
        fitAddon.fit();
        if (!skipTransition && containerRef.current) {
            containerRef.current.style.opacity = '1';
        }
      });
    }

    terminalRef.current = term;

    const tracker = new TerminalInputTracker(
      () => term.registerMarker(0),
      () => term.buffer.active.cursorX,
    );
    trackerRef.current = tracker;

    // OSC 133 markers from shell integration: "C" = command started running,
    // "D" = it finished and a fresh prompt follows. The backend already
    // authenticates them for output capture; here they only steer the UI.
    const oscDisposable = term.parser.registerOscHandler(133, (data) => {
      const kind = data.charAt(0);
      tracker.onShellMarker(kind);
      if (kind === 'C') clearSuggest();
      if (kind === 'D') {
        scheduleHistoryReload();
        // A finished command may have `cd`ed; the path cache can only go
        // stale this way (or via pty-cwd below), so drop it.
        pathCacheRef.current.clear();
      }
      scheduleRefresh();
      return true;
    });
    const writeParsedDisposable = term.onWriteParsed(() => scheduleRefresh());
    term.attachCustomKeyEventHandler(handleKey);

    const textarea = term.textarea;
    const onFocus = () => {
      focusedRef.current = true;
      scheduleRefresh();
    };
    const onBlur = () => {
      focusedRef.current = false;
      clearSuggest();
    };
    textarea?.addEventListener('focus', onFocus);
    textarea?.addEventListener('blur', onBlur);
    focusedRef.current = !!textarea && document.activeElement === textarea;

    const inputDisposable = term.onData((data) => {
      if (tracker.phase === 'input') {
        if (SUBMIT_RE.test(data)) {
          if (skipSubmitRecordRef.current) skipSubmitRecordRef.current = false;
          else if (tracker.lastInput) pushLocalHistory(tracker.lastInput.text);
          clearSuggest();
        } else if (ABORT_RE.test(data)) {
          clearSuggest();
        }
      }
      tracker.onUserInput(data);
      if (!backendAvailableRef.current) return;
      Write(sessionIdRef.current, data).catch((err) => {
        console.error('TerminalService.Write failed:', err);
        if (backendAvailableRef.current) {
          backendAvailableRef.current = false;
        }
      });
    });

    const resizeDisposable = term.onResize(({ cols, rows }) => {
      if (!backendAvailableRef.current) return;
      Resize(sessionIdRef.current, cols, rows).catch((err) => {
        console.error('resize failed:', err);
        if (backendAvailableRef.current) {
          backendAvailableRef.current = false;
        }
      });
    });

    const observer = new ResizeObserver(() => {
      fitAddonRef.current?.fit();
    });
    if (containerRef.current) {
      observer.observe(containerRef.current);
    }

    return () => {
      inputDisposable.dispose();
      resizeDisposable.dispose();
      oscDisposable.dispose();
      writeParsedDisposable.dispose();
      textarea?.removeEventListener('focus', onFocus);
      textarea?.removeEventListener('blur', onBlur);
      if (refreshFrameRef.current !== null) {
        cancelAnimationFrame(refreshFrameRef.current);
        refreshFrameRef.current = null;
      }
      if (historyReloadTimerRef.current !== null) {
        window.clearTimeout(historyReloadTimerRef.current);
        historyReloadTimerRef.current = null;
      }
      clearGhost();
      tracker.reset();
      trackerRef.current = null;
      observer.disconnect();
      if (terminalRef.current === term) {
        term.dispose();
        terminalRef.current = null;
        fitAddonRef.current = null;
      }
      startCalledRef.current = false;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps -- mount-once: every helper above is a stable useCallback over refs
  }, []);

  useEffect(() => {
    const term = terminalRef.current;
    if (!term || !sessionId) return;

    if (!startCalledRef.current) {
      startCalledRef.current = true;
      // The backend may have already started this session's shell (e.g. the
      // one TerminalService.ServiceStartup/CreateSession spawns) before this
      // component ever mounts. startSessionLocked has no "already running"
      // guard — only a re-entrant "already starting" one — so calling Start
      // again here would tear down that healthy PTY and spawn a redundant
      // second shell, showing up as an extra prompt the moment the terminal
      // tab opens.
      if (!initiallyRunningRef.current) {
        requestAnimationFrame(() => {
          const current = terminalRef.current;
          if (!current) return;
          Start(sessionId, current.cols, current.rows).catch((err) => {
            console.error('terminal start failed:', err);
            if (backendAvailableRef.current) {
              backendAvailableRef.current = false;
              toast.error('Terminal start failed');
            }
          });
        });
      }
    }

    const ptyOutputEvent = 'pty-output:' + sessionId;
    const ptyExitEvent = 'pty-exit:' + sessionId;
    const ptyClearedEvent = 'pty-cleared:' + sessionId;
    const ptyCwdEvent = 'pty-cwd:' + sessionId;

    const cleanupOutput = Events.On(ptyOutputEvent, (event: { data: { data: string } }) => {
      const output = event?.data?.data;
      if (output) {
        backendAvailableRef.current = true;
        if (process.env.NODE_ENV === 'development') {
          console.log({output});
        }
        terminalRef.current?.write(output);
      }
    });

    const cleanupExit = Events.On(ptyExitEvent, (event: { data: { exitCode: number; wasIntentional: boolean } }) => {
      const { exitCode, wasIntentional } = event?.data ?? {};
      if (process.env.NODE_ENV === 'development') {
        console.log(`Shell exited: code=${exitCode}, intentional=${wasIntentional}`);
      }
      if (wasIntentional) {
        onShellExitRef.current?.();
      }
    });

    const cleanupCleared = Events.On(ptyClearedEvent, () => {
      resetSuggestions();
      terminalRef.current?.clear();
    });

    // The shell's cwd changed (a `cd`, shell integration's OSC 7 report) —
    // any cached directory listing is now for the wrong directory.
    const cleanupCwd = Events.On(ptyCwdEvent, () => {
      pathCacheRef.current.clear();
    });

    return () => {
      cleanupOutput();
      cleanupExit();
      cleanupCleared();
      cleanupCwd();
    };
  }, [sessionId, resetSuggestions]);

  useEffect(() => {
    const term = terminalRef.current;
    if (!term) return;

    requestAnimationFrame(() => {
        const current = terminalRef.current;
        if (!current) return;

        current.options.theme = {
            ...current.options.theme,
            ...computeXtermTheme(),
        };
    });
  }, [theme]);

  return (
    <div
      ref={wrapRef}
      className="terminal-container"
      data-testid={`terminal-container-${sessionId}`}
      style={{ display: isVisible ? '' : 'none' }}
    >
      {/* xterm mounts into its own host so React never reconciles xterm's DOM. */}
      <div ref={containerRef} className="terminal-host" />
      {suggest.items.length > 0 && suggest.placement && (
        <TerminalSuggestionMenu
          items={suggest.items}
          activeIndex={suggest.active}
          placement={suggest.placement}
          onHover={setActive}
          onPick={(item) => acceptItem(item, 'insert')}
        />
      )}
    </div>
  );
  }
);

export default TerminalComponent;
