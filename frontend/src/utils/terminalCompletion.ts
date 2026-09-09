import type { ArgsKind, CommandSpec, CompletionSpecs, OptionSpec, SubcommandSpec } from '../lib/completionSpecs';
import { charCount, type RankedSuggestion } from './terminalSuggest';

/**
 * Warp-style tab completion for the terminal prompt: a small POSIX-ish
 * tokenizer, context resolution against the static spec table
 * (lib/completionSpecs.ts), and builders that turn a completion result
 * (a path listing, a command list, or a spec lookup) into menu rows with an
 * insert/erase plan. Pure and side effect-free — Terminal.tsx owns the xterm
 * wiring, the debounced SuggestionService calls, and rendering.
 *
 * The prompt input Terminal.tsx hands in is always everything typed up to
 * the cursor (see lib/terminalInputTracker.ts), so there is no "cursor in
 * the middle of the line" case to handle here — the token being completed is
 * always the last one.
 */

// ── Tokenizer ────────────────────────────────────────────────────────────

export interface Token {
  /** Unescaped/unquoted value. */
  value: string;
  /** Verbatim source text for this token, quotes and escapes included. */
  raw: string;
  /** Offset of the token's first character in the source string. */
  start: number;
  /** Offset one past the token's last character. */
  end: number;
}

export interface ParsedCommandLine {
  tokens: Token[];
  /** Index into `tokens` of the token being completed. Equal to
   *  `tokens.length` when the line ends in unquoted whitespace — the next
   *  token hasn't started yet. */
  currentIndex: number;
  /** Text of the token being completed; '' when it hasn't started yet. */
  currentToken: string;
}

/**
 * Splits a shell-ish command line into tokens, honoring single quotes (fully
 * literal), double quotes (backslash escapes `"`, `\`, `$`, and backtick),
 * and unquoted backslash escapes. Unterminated quotes/escapes at the end of
 * the string are simply included in the final token — the line is a prefix
 * of what the user is still typing, not a program to validate.
 */
export function parseCommandLine(text: string): ParsedCommandLine {
  const tokens: Token[] = [];
  const n = text.length;
  let i = 0;
  let value = '';
  let tokenStart = -1;
  let inToken = false;
  let quote: '"' | "'" | null = null;
  let endedOnSeparator = n === 0;

  const flush = (end: number) => {
    if (!inToken) return;
    tokens.push({ value, raw: text.slice(tokenStart, end), start: tokenStart, end });
    value = '';
    inToken = false;
    tokenStart = -1;
  };

  while (i < n) {
    const ch = text[i];
    endedOnSeparator = false;

    if (quote === "'") {
      if (ch === "'") quote = null;
      else value += ch;
      i++;
      continue;
    }

    if (quote === '"') {
      if (ch === '"') {
        quote = null;
        i++;
      } else if (ch === '\\' && i + 1 < n && '"\\$`'.includes(text[i + 1])) {
        value += text[i + 1];
        i += 2;
      } else {
        value += ch;
        i++;
      }
      continue;
    }

    if (ch === ' ' || ch === '\t') {
      flush(i);
      endedOnSeparator = true;
      i++;
      continue;
    }

    if (!inToken) {
      inToken = true;
      tokenStart = i;
    }

    if (ch === "'" || ch === '"') {
      quote = ch;
      i++;
    } else if (ch === '\\') {
      if (i + 1 < n) {
        value += text[i + 1];
        i += 2;
      } else {
        i++; // trailing backslash: dropped, nothing left to escape
      }
    } else {
      value += ch;
      i++;
    }
  }
  flush(n);

  if (endedOnSeparator || tokens.length === 0) {
    return { tokens, currentIndex: tokens.length, currentToken: '' };
  }
  const last = tokens[tokens.length - 1];
  return { tokens, currentIndex: tokens.length - 1, currentToken: last.value };
}

// ── Completion context ───────────────────────────────────────────────────

export type CompletionContext =
  | { kind: 'command'; prefix: string }
  | { kind: 'subcommand'; command: string; prefix: string }
  | { kind: 'option'; command: string; subcommand?: string; prefix: string }
  | { kind: 'path'; prefix: string; dirsOnly: boolean }
  | { kind: 'none' };

function matchSubcommand(spec: CommandSpec | undefined, tokens: Token[]): SubcommandSpec | undefined {
  if (!spec?.subcommands?.length || tokens.length < 2) return undefined;
  return spec.subcommands.find((sc) => sc.name === tokens[1].value);
}

function optionsFor(spec: CommandSpec | undefined, sub: SubcommandSpec | undefined): OptionSpec[] {
  return sub?.options ?? spec?.options ?? [];
}

/** Resolves what a partially-typed command line is asking to complete. */
export function completionContext(text: string, specs: CompletionSpecs): CompletionContext {
  const { tokens, currentIndex, currentToken } = parseCommandLine(text);
  if (currentIndex === 0) return { kind: 'command', prefix: currentToken };

  const commandName = tokens[0].value;
  const spec = specs[commandName.toLowerCase()];
  const sub = matchSubcommand(spec, tokens);

  if (currentToken.startsWith('-')) {
    return { kind: 'option', command: commandName, subcommand: sub?.name, prefix: currentToken };
  }

  if (currentIndex === 1 && spec?.subcommands?.length) {
    return { kind: 'subcommand', command: commandName, prefix: currentToken };
  }

  // A value belonging to the option right before this token (e.g. the file
  // after "kubectl apply -f") takes priority over the subcommand/command's
  // own positional args.
  const prevToken = tokens[currentIndex - 1];
  const prevOption = prevToken?.value.startsWith('-')
    ? optionsFor(spec, sub).find((op) => op.name === prevToken.value)
    : undefined;

  const argsKind: ArgsKind | undefined = prevOption?.args ?? sub?.args ?? spec?.args;

  if (argsKind === 'none') return { kind: 'none' };
  if (argsKind === 'command') return { kind: 'command', prefix: currentToken };
  if (argsKind === 'path' || argsKind === 'dir') {
    return { kind: 'path', prefix: currentToken, dirsOnly: argsKind === 'dir' };
  }
  // No spec info for this position: an unknown command (or a known one with
  // no declared args) falls back to path completion, but only once the user
  // has actually started typing something — an empty trailing token with no
  // evidence it wants a path shows nothing, per completionContext's contract.
  if (currentToken === '') return { kind: 'none' };
  return { kind: 'path', prefix: currentToken, dirsOnly: false };
}

// ── Menu item builders ───────────────────────────────────────────────────

export type TokenGroup = 'directories' | 'files' | 'commands' | 'subcommands' | 'options';
export type TokenIcon = 'folder' | 'file' | 'terminal' | 'flag' | 'subcommand';

export interface TokenCompletionItem {
  kind: 'token';
  id: string;
  group: TokenGroup;
  icon: TokenIcon;
  /** Primary label shown in the menu row. */
  label: string;
  description?: string;
  /** Backspace (DEL) bytes to send before `text`, erasing the current token. */
  backspaces: number;
  /** Bytes to send after the backspaces to complete the token. */
  text: string;
  /** Whether accepting this item completed a directory (no trailing space —
   *  the user is expected to keep drilling into it). */
  isDir: boolean;
}

export interface PathCompletionLike {
  name: string;
  insert: string;
  isDir: boolean;
}

/**
 * One row of the terminal's merged suggestion menu: a contextual token
 * completion from this module, or a whole-line suggestion from
 * terminalSuggest.ts (tagged 'line' by the caller when merging). Defined
 * here — rather than in Terminal.tsx, which imports both this module and
 * TerminalSuggestionMenu.tsx — so neither Terminal.tsx nor
 * TerminalSuggestionMenu.tsx needs to import a type back out of the other.
 */
export type MenuRow = TokenCompletionItem | (RankedSuggestion & { kind: 'line' });

/** A completed command/subcommand/option/file gets one trailing space so the
 *  next token starts clean; a directory gets none, so the user can keep
 *  typing straight into it. */
function tokenText(insert: string, isDir: boolean): string {
  return insert + (isDir ? '' : ' ');
}

export function pathCompletionItems(
  entries: readonly PathCompletionLike[],
  currentToken: string,
): TokenCompletionItem[] {
  const backspaces = charCount(currentToken);
  return entries.map((entry) => ({
    kind: 'token',
    id: `path:${entry.insert}`,
    group: entry.isDir ? 'directories' : 'files',
    icon: entry.isDir ? 'folder' : 'file',
    label: entry.name,
    backspaces,
    text: tokenText(entry.insert, entry.isDir),
    isDir: entry.isDir,
  }));
}

export function commandCompletionItems(names: readonly string[], currentToken: string): TokenCompletionItem[] {
  const backspaces = charCount(currentToken);
  // An entry identical to what's already typed has nothing left to
  // complete but a trailing space — not worth a row, same as an exact match
  // is hidden from the whole-line suggestions (see terminalSuggest.ts).
  return names.filter((name) => name !== currentToken).map((name) => ({
    kind: 'token',
    id: `cmd:${name}`,
    group: 'commands',
    icon: 'terminal',
    label: name,
    backspaces,
    text: tokenText(name, false),
    isDir: false,
  }));
}

export function subcommandCompletionItems(
  spec: CommandSpec | undefined,
  currentToken: string,
): TokenCompletionItem[] {
  const backspaces = charCount(currentToken);
  return (spec?.subcommands ?? [])
    .filter((sc) => sc.name.startsWith(currentToken) && sc.name !== currentToken)
    .map((sc) => ({
      kind: 'token' as const,
      id: `sub:${sc.name}`,
      group: 'subcommands' as const,
      icon: 'subcommand' as const,
      label: sc.name,
      description: sc.description,
      backspaces,
      text: tokenText(sc.name, false),
      isDir: false,
    }));
}

export function optionCompletionItems(
  spec: CommandSpec | undefined,
  subcommand: string | undefined,
  currentToken: string,
): TokenCompletionItem[] {
  const backspaces = charCount(currentToken);
  const sub = subcommand ? spec?.subcommands?.find((sc) => sc.name === subcommand) : undefined;
  return optionsFor(spec, sub)
    .filter((op) => op.name.startsWith(currentToken) && op.name !== currentToken)
    .map((op) => ({
      kind: 'token' as const,
      id: `opt:${subcommand ?? ''}:${op.name}`,
      group: 'options' as const,
      icon: 'flag' as const,
      label: op.name,
      description: op.description,
      backspaces,
      text: tokenText(op.name, false),
      isDir: false,
    }));
}
