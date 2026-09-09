import React, { useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Bookmark, History, Folder, File, TerminalSquare, Flag, CornerDownRight } from 'lucide-react';
import type { MenuRow, TokenGroup } from '../utils/terminalCompletion';

/** Where the menu sits inside the terminal container, in CSS pixels. */
export interface SuggestionMenuPlacement {
  left: number;
  /** Set when the menu opens below the cursor row. */
  top?: number;
  /** Set when the menu opens above the cursor row (distance from the bottom edge). */
  bottom?: number;
  above: boolean;
  maxHeight: number;
}

interface TerminalSuggestionMenuProps {
  items: MenuRow[];
  /** Highlighted row, or -1 when nothing is selected and keys pass through to the shell. */
  activeIndex: number;
  placement: SuggestionMenuPlacement;
  onHover: (index: number) => void;
  onPick: (item: MenuRow) => void;
}

/** Wraps the matched characters of `text` in a highlight mark. */
function Highlighted({ text, indices }: { text: string; indices: number[] }) {
  if (indices.length === 0) return <>{text}</>;
  const set = new Set(indices);
  const parts: React.ReactNode[] = [];
  let run = '';
  let runMatched = set.has(0);
  const flush = (key: number) => {
    if (!run) return;
    parts.push(runMatched ? <mark key={key} className="palette-match">{run}</mark> : <React.Fragment key={key}>{run}</React.Fragment>);
    run = '';
  };
  for (let i = 0; i < text.length; i++) {
    const matched = set.has(i);
    if (matched !== runMatched) {
      flush(i);
      runMatched = matched;
    }
    run += text[i];
  }
  flush(text.length);
  return <>{parts}</>;
}

const TOKEN_ICONS: Record<Extract<MenuRow, { kind: 'token' }>['icon'], React.ComponentType<{ size?: number }>> = {
  folder: Folder,
  file: File,
  terminal: TerminalSquare,
  flag: Flag,
  subcommand: CornerDownRight,
};

/** Group a row belongs to, for the section label above it. */
function rowGroup(item: MenuRow): TokenGroup | 'history' | 'saved' {
  if (item.kind === 'token') return item.group;
  return item.source === 'command' ? 'saved' : 'history';
}

/**
 * The Warp-style completion menu under the prompt: contextual token
 * completions (paths, commands, subcommands, options — computed in
 * utils/terminalCompletion.ts) first, then matching shell history and saved
 * commands. Purely presentational — every keyboard interaction lives in
 * Terminal.tsx, which owns the xterm instance.
 */
const TerminalSuggestionMenu: React.FC<TerminalSuggestionMenuProps> = ({
  items,
  activeIndex,
  placement,
  onHover,
  onPick,
}) => {
  const { t } = useTranslation();
  // Browsers fire mouse events when an element appears under a stationary
  // pointer (the menu pops up right at the prompt, where the user just
  // clicked to focus the terminal). Only genuine movement may highlight a
  // row, or a stray Enter would accept a suggestion the user never chose.
  const lastPointerRef = useRef<{ x: number; y: number } | null>(null);
  // Keep the keyboard-highlighted row in view when the list is taller than
  // the menu (Warp scrolls its completion list along with ↑/↓).
  const listRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (activeIndex < 0) return;
    const row = listRef.current?.querySelector<HTMLElement>('.terminal-suggest-item.active');
    row?.scrollIntoView({ block: 'nearest' });
  }, [activeIndex]);
  const style: React.CSSProperties = {
    left: placement.left,
    maxHeight: placement.maxHeight,
    ...(placement.above ? { bottom: placement.bottom } : { top: placement.top }),
  };

  const groupLabels: Record<TokenGroup | 'history' | 'saved', string> = {
    directories: t('terminalSuggest.groupDirectories'),
    files: t('terminalSuggest.groupFiles'),
    commands: t('terminalSuggest.groupCommands'),
    subcommands: t('terminalSuggest.groupSubcommands'),
    options: t('terminalSuggest.groupOptions'),
    history: t('terminalSuggest.groupHistory'),
    saved: t('terminalSuggest.groupSaved'),
  };

  const hasTokenFirst = items[0]?.kind === 'token';

  return (
    <div
      className={`terminal-suggest ${placement.above ? 'above' : 'below'}`}
      style={style}
      role="listbox"
      aria-label={t('terminalSuggest.label')}
      data-testid="terminal-suggest-menu"
      // Keep focus in the terminal: a mousedown on the menu must not blur
      // xterm's textarea, or the menu would close before the click lands.
      onMouseDown={(e) => e.preventDefault()}
    >
      <div className="terminal-suggest-list" ref={listRef}>
        {items.map((item, idx) => {
          const group = rowGroup(item);
          const showLabel = idx === 0 || rowGroup(items[idx - 1]) !== group;

          const row = item.kind === 'token' ? (
            <TokenRow key={item.id} item={item} active={idx === activeIndex} onHover={() => onHover(idx)} onPick={() => onPick(item)} lastPointerRef={lastPointerRef} />
          ) : (
            <LineRow key={item.id} item={item} active={idx === activeIndex} onHover={() => onHover(idx)} onPick={() => onPick(item)} lastPointerRef={lastPointerRef} t={t} />
          );

          if (!showLabel) return row;
          return (
            <React.Fragment key={`group-${item.id}`}>
              <div className="terminal-suggest-group-label" aria-hidden="true">{groupLabels[group]}</div>
              {row}
            </React.Fragment>
          );
        })}
      </div>
      <div className="terminal-suggest-footer" aria-hidden="true">
        <span><kbd>↑↓</kbd> {t('terminalSuggest.hintNavigate')}</span>
        {activeIndex >= 0 ? (
          <span><kbd>⇥</kbd> {t('terminalSuggest.hintInsert')}</span>
        ) : hasTokenFirst ? (
          <span><kbd>⇥</kbd> {t('terminalSuggest.hintComplete')}</span>
        ) : null}
        <span><kbd>↵</kbd> {t('terminalSuggest.hintRun')}</span>
        <span><kbd>→</kbd> {t('terminalSuggest.hintAccept')}</span>
        <span><kbd>esc</kbd> {t('terminalSuggest.hintDismiss')}</span>
      </div>
    </div>
  );
};

interface RowProps<T> {
  item: T;
  active: boolean;
  onHover: () => void;
  onPick: () => void;
  lastPointerRef: React.MutableRefObject<{ x: number; y: number } | null>;
}

/** A token completion row: an icon for its group, the label, and an optional
 * description in `--fg-faint` at the right (no History/Saved badge — that's
 * only meaningful for whole-line rows). */
function TokenRow({ item, active, onHover, onPick, lastPointerRef }: RowProps<Extract<MenuRow, { kind: 'token' }>>) {
  const Icon = TOKEN_ICONS[item.icon];
  return (
    <div
      className={`terminal-suggest-item ${active ? 'active' : ''}`}
      role="option"
      aria-selected={active}
      data-testid="terminal-suggest-item"
      data-kind="token"
      data-source={item.group}
      data-group={item.group}
      onMouseMove={(e) => {
        const last = lastPointerRef.current;
        if (last && last.x === e.clientX && last.y === e.clientY) return;
        lastPointerRef.current = { x: e.clientX, y: e.clientY };
        if (!active) onHover();
      }}
      onClick={onPick}
    >
      <span className="terminal-suggest-icon" aria-hidden="true">
        <Icon size={13} />
      </span>
      <span className="terminal-suggest-body">
        <span className="terminal-suggest-primary mono">{item.label}</span>
      </span>
      {item.description && <span className="terminal-suggest-description">{item.description}</span>}
    </div>
  );
}

/** A whole-line history/saved-command row — unchanged from before the
 * completion feature, just typed against the merged MenuRow union. */
function LineRow({
  item,
  active,
  onHover,
  onPick,
  lastPointerRef,
  t,
}: RowProps<Extract<MenuRow, { kind: 'line' }>> & { t: (key: string) => string }) {
  const isCommand = item.source === 'command';
  const title = item.title;
  const primary = title ?? item.text;
  const primaryIndices = item.matchedField === 'title' || !title ? item.matchIndices : [];
  const secondaryIndices = title && item.matchedField === 'text' ? item.matchIndices : [];
  return (
    <div
      className={`terminal-suggest-item ${active ? 'active' : ''}`}
      role="option"
      aria-selected={active}
      data-testid="terminal-suggest-item"
      data-kind="line"
      data-source={item.source}
      data-group={isCommand ? 'saved' : 'history'}
      onMouseMove={(e) => {
        const last = lastPointerRef.current;
        if (last && last.x === e.clientX && last.y === e.clientY) return;
        lastPointerRef.current = { x: e.clientX, y: e.clientY };
        if (!active) onHover();
      }}
      onClick={onPick}
    >
      <span className="terminal-suggest-icon" aria-hidden="true">
        {isCommand ? <Bookmark size={13} /> : <History size={13} />}
      </span>
      <span className="terminal-suggest-body">
        <span className={`terminal-suggest-primary ${title ? '' : 'mono'}`}>
          <Highlighted text={primary} indices={primaryIndices} />
        </span>
        {title && (
          <span className="terminal-suggest-secondary">
            <Highlighted text={item.text} indices={secondaryIndices} />
          </span>
        )}
      </span>
      <span className="terminal-suggest-badge">
        {isCommand ? t('terminalSuggest.command') : t('terminalSuggest.history')}
      </span>
    </div>
  );
}

export default TerminalSuggestionMenu;
