/**
 * Tracks what the user has typed at the shell prompt of an xterm.js terminal,
 * for the Warp-style autosuggestions in Terminal.tsx.
 *
 * The shell owns the line editor, so the frontend can't know the prompt
 * contents directly. Instead this combines two signals:
 *
 *  - The OSC 133 markers emitted by shell integration (`C` = a command started
 *    running, `D` = it finished and a fresh prompt is about to be drawn), which
 *    say whether keystrokes are going to a prompt or to a running program.
 *  - The first keystroke after a prompt appears, at which point the cursor sits
 *    exactly where the input begins. An xterm marker pinned to that line (so it
 *    follows scrolling) plus the column let the current input be read straight
 *    out of the screen buffer afterwards — including text the shell put there
 *    itself via history navigation or tab completion.
 *
 * Without shell integration only the keystroke signal exists (Enter resets to
 * "prompt"), which is right whenever the shell is idle and wrong while typing
 * into a running program — an accepted limitation, documented in
 * docs/CONFIGURATION.md.
 */

export type PromptPhase = 'prompt' | 'input' | 'running';

/** The subset of xterm's IMarker the tracker relies on. */
export interface InputAnchor {
  readonly line: number;
  readonly isDisposed: boolean;
  dispose(): void;
}

/** The subset of xterm's IBufferLine the tracker relies on. */
export interface TrackedLine {
  readonly isWrapped: boolean;
  translateToString(trimRight?: boolean, startColumn?: number, endColumn?: number): string;
}

/** The subset of xterm's IBuffer the tracker relies on. */
export interface TrackedBuffer {
  readonly type: 'normal' | 'alternate';
  readonly baseY: number;
  readonly cursorX: number;
  readonly cursorY: number;
  getLine(y: number): TrackedLine | undefined;
}

export interface PromptInput {
  /** Everything between the input start and the cursor, verbatim. */
  text: string;
  /** Whether the cursor sits at the end of the input (suggestions need that). */
  atEnd: boolean;
  /** Viewport row of the input's first character. */
  startRow: number;
  /** Column of the input's first character on `startRow`. */
  startCol: number;
  /** Viewport row / column of the cursor. */
  cursorRow: number;
  cursorCol: number;
}

/** Bytes that end or reset the current prompt line: Enter, ^C, ^D, ^L. */
// eslint-disable-next-line no-control-regex
const RESET_INPUT_RE = /[\r\n\x03\x04\x0c]/;

/**
 * Text after the cursor that still counts as "at the end": nothing, or a gap
 * of two or more spaces — which is how a right-side prompt (zsh RPROMPT,
 * powerlevel10k) is separated from the input, whereas a cursor moved back
 * into the input has a single character or a single space right after it.
 */
const RIGHT_PROMPT_GAP = '  ';

export class TerminalInputTracker {
  phase: PromptPhase = 'prompt';
  /** The last successful readInput result, for callers reacting to keystrokes. */
  lastInput: PromptInput | null = null;

  private anchor: InputAnchor | null = null;
  private anchorCol = 0;

  constructor(
    private readonly createAnchor: () => InputAnchor | undefined,
    private readonly cursorX: () => number,
  ) {}

  /** Feed an OSC 133 marker kind ("C", "D", …) as parsed from the PTY stream. */
  onShellMarker(kind: string): void {
    switch (kind) {
      case 'C':
        this.phase = 'running';
        this.clearAnchor();
        break;
      case 'D':
        this.phase = 'prompt';
        this.clearAnchor();
        break;
      default:
        break;
    }
  }

  /** Feed bytes the user sent to the PTY, before they are written. */
  onUserInput(data: string): void {
    if (this.phase === 'running') return;
    if (RESET_INPUT_RE.test(data)) {
      this.phase = 'prompt';
      this.clearAnchor();
      return;
    }
    if (this.phase === 'prompt') {
      this.anchor = this.createAnchor() ?? null;
      this.anchorCol = this.cursorX();
      this.phase = this.anchor ? 'input' : 'prompt';
    }
  }

  /**
   * Reads the current prompt input out of the buffer, or null when there is
   * no trackable input (not in the input phase, the anchor line is gone, the
   * alternate screen is active, or the cursor left the input's line run).
   */
  readInput(buffer: TrackedBuffer, cols: number): PromptInput | null {
    this.lastInput = null;
    if (this.phase !== 'input' || !this.anchor || this.anchor.isDisposed) return null;
    if (buffer.type !== 'normal') return null;

    const start = this.anchor.line;
    const cursorLine = buffer.baseY + buffer.cursorY;
    if (start < 0 || cursorLine < start) return null;

    let text = '';
    for (let y = start; y <= cursorLine; y++) {
      const line = buffer.getLine(y);
      if (!line) return null;
      // Every row after the first must be a soft-wrapped continuation of the
      // input; a hard line break means output was printed in between.
      if (y > start && !line.isWrapped) return null;
      const from = y === start ? this.anchorCol : 0;
      const to = y === cursorLine ? buffer.cursorX : cols;
      if (to < from) return null;
      text += line.translateToString(false, from, to);
    }

    const cursorRowLine = buffer.getLine(cursorLine);
    const rest = cursorRowLine ? cursorRowLine.translateToString(true, buffer.cursorX) : '';
    let atEnd = rest === '' || rest.startsWith(RIGHT_PROMPT_GAP);
    const next = buffer.getLine(cursorLine + 1);
    if (next?.isWrapped && next.translateToString(true).length > 0) atEnd = false;

    this.lastInput = {
      text,
      atEnd,
      startRow: start - buffer.baseY,
      startCol: this.anchorCol,
      cursorRow: buffer.cursorY,
      cursorCol: buffer.cursorX,
    };
    return this.lastInput;
  }

  /** Forget everything; used when the terminal is cleared or disposed. */
  reset(): void {
    this.phase = 'prompt';
    this.clearAnchor();
    this.lastInput = null;
  }

  private clearAnchor(): void {
    this.anchor?.dispose();
    this.anchor = null;
    this.anchorCol = 0;
  }
}
