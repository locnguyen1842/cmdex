import type { Command } from '../types';
import { extractTemplateVarNames } from './templateVars';

/**
 * Pure logic behind the terminal's Warp-style autosuggestions: which
 * candidates exist, how they rank against what the user has typed so far,
 * what the inline ghost text should be, and what bytes accepting a
 * suggestion must send to the shell. Terminal.tsx owns the xterm wiring and
 * rendering; keeping this side effect-free lets Vitest cover the ranking.
 */

export type SuggestionSource = 'history' | 'command';

export interface TerminalSuggestion {
  /** Stable key — `h:<text>` for history, `c:<commandId>` for saved commands. */
  id: string;
  /** Single-line text that lands on the prompt when the item is accepted. */
  text: string;
  source: SuggestionSource;
  /** Saved-command title, shown alongside the script for `command` items. */
  title?: string;
  /** Saved-command id for items that must go through the app's run flow. */
  commandId?: string;
  /**
   * True when the saved command can't simply be typed onto the prompt —
   * it still holds `{{placeholders}}` or spans several lines. Accepting such
   * an item clears the typed text and runs the command through the regular
   * variable prompt instead of inserting its script.
   */
  needsRunFlow?: boolean;
}

export type MatchedField = 'text' | 'title';

export interface RankedSuggestion extends TerminalSuggestion {
  score: number;
  /** The candidate is exactly what was typed — nothing to suggest, but it
   *  still outranks longer entries so the ghost knows to stay empty. */
  exact?: boolean;
  /** Which field produced the match, so the UI highlights the right one. */
  matchedField: MatchedField;
  /** Character indices (into the matched field) to highlight. */
  matchIndices: number[];
}

export interface MatchResult {
  score: number;
  indices: number[];
}

/** How many menu rows to show at most. */
export const SUGGESTION_MENU_LIMIT = 8;

const SCORE_PREFIX = 100;
const SCORE_WORD_PREFIX = 80;
const SCORE_SUBSTRING = 60;
const SCORE_FUZZY = 30;
/** A title match is worth slightly less than the same match on the script. */
const TITLE_PENALTY = 5;
/** Shortest query that may match as a subsequence rather than a substring. */
const FUZZY_MIN_QUERY = 4;

/** First non-empty script body with any leading shebang line removed. */
export function scriptBody(scriptContent: string): string {
  return scriptContent.replace(/^#!.*\n?/, '').trim();
}

/** Turns saved commands into suggestion candidates. Empty scripts are skipped. */
export function commandSuggestions(commands: Command[]): TerminalSuggestion[] {
  const out: TerminalSuggestion[] = [];
  for (const cmd of commands) {
    const body = scriptBody(cmd.scriptContent || '');
    if (!body) continue;
    const lines = body.split('\n').map((l) => l.trim()).filter(Boolean);
    const multiline = lines.length > 1;
    const hasVars = extractTemplateVarNames(body).length > 0;
    const title = cmd.title?.Valid ? cmd.title.String.trim() : '';
    out.push({
      id: `c:${cmd.id}`,
      text: multiline ? `${lines[0]} …` : lines[0],
      source: 'command',
      title: title || undefined,
      commandId: cmd.id,
      needsRunFlow: multiline || hasVars,
    });
  }
  return out;
}

/** Turns history entries (newest first) into candidates, keeping their order. */
export function historySuggestions(entries: readonly string[]): TerminalSuggestion[] {
  const seen = new Set<string>();
  const out: TerminalSuggestion[] = [];
  for (const raw of entries) {
    const text = raw.trim();
    if (!text || seen.has(text)) continue;
    seen.add(text);
    out.push({ id: `h:${text}`, text, source: 'history' });
  }
  return out;
}

/**
 * Scores how well `query` matches `target` (both compared case-insensitively):
 * prefix > word-boundary prefix > substring > in-order subsequence. Returns
 * null when the query doesn't match at all.
 */
export function scoreMatch(query: string, target: string): MatchResult | null {
  if (!query) return null;
  const q = query.toLowerCase();
  const t = target.toLowerCase();
  if (q.length > t.length) return null;

  // No length tie-breaker on purpose: among equally good matches the
  // candidate order (recency) decides, like fish/zsh autosuggestions.
  const lengthPenalty = 0;
  const range = (start: number) => Array.from({ length: q.length }, (_, i) => start + i);

  if (t.startsWith(q)) return { score: SCORE_PREFIX - lengthPenalty, indices: range(0) };

  const wordIdx = t.indexOf(' ' + q);
  if (wordIdx !== -1) return { score: SCORE_WORD_PREFIX - lengthPenalty, indices: range(wordIdx + 1) };

  const subIdx = t.indexOf(q);
  if (subIdx !== -1) return { score: SCORE_SUBSTRING - lengthPenalty, indices: range(subIdx) };

  // Subsequence matching only kicks in for longer queries: for a couple of
  // characters it surfaces unrelated commands that merely contain those
  // letters in order, which reads as noise at a shell prompt.
  if (q.length < FUZZY_MIN_QUERY) return null;
  const indices: number[] = [];
  let ti = 0;
  let gaps = 0;
  for (const ch of q) {
    const next = t.indexOf(ch, ti);
    if (next === -1) return null;
    if (indices.length > 0 && next > ti) gaps += next - ti;
    indices.push(next);
    ti = next + 1;
  }
  return { score: Math.max(SCORE_FUZZY - gaps, 1) - lengthPenalty, indices };
}

/**
 * Ranks candidates against the typed text. Whitespace around the query is
 * ignored and ties keep candidate order — so with history listed newest-first,
 * the most recent command wins, like fish/zsh autosuggestions. An item that is
 * exactly what was typed is kept, flagged `exact`, at the top of its tie
 * group: `menuItems` hides it, and `ghostFor` uses it to show nothing when the
 * most recent matching command is the one already on the prompt (typing
 * `clear` must not ghost `clearf` just because that was run once, too).
 */
export function rankSuggestions(
  typed: string,
  candidates: readonly TerminalSuggestion[],
  limit = SUGGESTION_MENU_LIMIT,
): RankedSuggestion[] {
  const query = typed.trim();
  if (!query) return [];

  const ranked: RankedSuggestion[] = [];
  for (const item of candidates) {
    if (item.text === query) {
      ranked.push({ ...item, score: SCORE_PREFIX + 1, matchedField: 'text', matchIndices: [], exact: true });
      continue;
    }
    let best: { result: MatchResult; field: MatchedField } | null = null;
    const textMatch = scoreMatch(query, item.text);
    if (textMatch) best = { result: textMatch, field: 'text' };
    if (item.title) {
      const titleMatch = scoreMatch(query, item.title);
      if (titleMatch) {
        const adjusted = { ...titleMatch, score: titleMatch.score - TITLE_PENALTY };
        if (!best || adjusted.score > best.result.score) best = { result: adjusted, field: 'title' };
      }
    }
    if (!best) continue;
    ranked.push({ ...item, score: best.result.score, matchedField: best.field, matchIndices: best.result.indices });
  }
  // Array.prototype.sort is stable, so equal scores preserve candidate order.
  ranked.sort((a, b) => b.score - a.score);
  return ranked.slice(0, limit);
}

/** The rows the menu shows: everything ranked except an exact match. */
export function menuItems(ranked: readonly RankedSuggestion[]): RankedSuggestion[] {
  return ranked.filter((item) => !item.exact);
}

/**
 * The inline ghost text: the remainder of the best insertable candidate whose
 * text starts with what's typed (case-sensitively, so accepting it never
 * changes the case of what the user already wrote). Leading whitespace on the
 * prompt is ignored the way shells ignore it.
 */
export function ghostFor(typed: string, ranked: readonly RankedSuggestion[]): string {
  const prefix = typed.replace(/^\s+/, '');
  if (!prefix) return '';
  for (const item of ranked) {
    // The most recent history entry that starts with the prefix decides: if
    // that is exactly what was typed, there is nothing to complete.
    if (item.exact) return '';
    if (item.needsRunFlow || item.matchedField !== 'text') continue;
    if (item.text.length > prefix.length && item.text.startsWith(prefix)) {
      return item.text.slice(prefix.length);
    }
  }
  return '';
}

/** The leading word of `ghost` plus one trailing space, for word-wise accept. */
export function nextGhostWord(ghost: string): string {
  const m = /^\s*\S+\s?/.exec(ghost);
  return m ? m[0] : ghost;
}

export interface InsertPlan {
  /** How many Backspace (DEL) bytes to send before `text`, to erase typed input. */
  backspaces: number;
  text: string;
}

/** Number of user-perceived characters, so one Backspace per code point. */
export function charCount(s: string): number {
  return Array.from(s).length;
}

/**
 * What to send so the prompt ends up holding `target`: just the remainder when
 * `target` extends what's typed, otherwise erase the typed text first. Erasing
 * with Backspace (rather than a line-kill key) works identically in every
 * shell and readline mode.
 */
export function planInsertion(typed: string, target: string): InsertPlan {
  const prefix = typed.replace(/^\s+/, '');
  if (prefix && target.startsWith(prefix)) {
    return { backspaces: 0, text: target.slice(prefix.length) };
  }
  return { backspaces: charCount(typed), text: target };
}

// East Asian Wide/Fullwidth blocks plus the common emoji ranges — enough to
// size the ghost overlay in terminal cells without a full wcwidth table.
const WIDE_CHAR_RE =
  /[ᄀ-ᅟ⺀-〾ぁ-㏿㐀-䶿一-鿿ꀀ-꓏가-힣豈-﫿︰-﹏＀-｠￠-￦\u{1F300}-\u{1F64F}\u{1F680}-\u{1F6FF}\u{1F900}-\u{1F9FF}\u{20000}-\u{3FFFD}]/u;

/** Terminal cells a single character occupies (1, or 2 for wide glyphs). */
export function cellWidth(ch: string): number {
  return WIDE_CHAR_RE.test(ch) ? 2 : 1;
}

/** Terminal cells the whole string occupies. */
export function displayWidth(s: string): number {
  let w = 0;
  for (const ch of s) w += cellWidth(ch);
  return w;
}
