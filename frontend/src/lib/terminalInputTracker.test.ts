import { describe, it, expect } from 'vitest';
import { TerminalInputTracker, type InputAnchor, type TrackedBuffer, type TrackedLine } from './terminalInputTracker';

class FakeAnchor implements InputAnchor {
  isDisposed = false;
  constructor(public line: number) {}
  dispose() { this.isDisposed = true; }
}

class FakeLine implements TrackedLine {
  constructor(private readonly content: string, public readonly isWrapped = false, private readonly cols = 80) {}
  translateToString(trimRight = false, startColumn = 0, endColumn = this.cols): string {
    const padded = this.content.padEnd(this.cols, ' ');
    const slice = padded.slice(startColumn, endColumn);
    return trimRight ? slice.replace(/\s+$/, '') : slice;
  }
}

function buffer(lines: FakeLine[], cursorY: number, cursorX: number, opts: Partial<TrackedBuffer> = {}): TrackedBuffer {
  return {
    type: 'normal',
    baseY: 0,
    cursorY,
    cursorX,
    getLine: (y) => lines[y],
    ...opts,
  };
}

function tracker(cursorX: () => number, anchorLine = 0) {
  const anchors: FakeAnchor[] = [];
  const t = new TerminalInputTracker(() => {
    const a = new FakeAnchor(anchorLine);
    anchors.push(a);
    return a;
  }, cursorX);
  return { t, anchors };
}

describe('TerminalInputTracker phases', () => {
  it('anchors the input at the first keystroke after a prompt', () => {
    const { t, anchors } = tracker(() => 2);
    expect(t.phase).toBe('prompt');
    t.onUserInput('g');
    expect(t.phase).toBe('input');
    expect(anchors).toHaveLength(1);
    t.onUserInput('i');
    expect(anchors).toHaveLength(1);
  });

  it('returns to the prompt phase on Enter, Ctrl+C, Ctrl+D and Ctrl+L', () => {
    for (const key of ['\r', '\n', '\x03', '\x04', '\x0c']) {
      const { t, anchors } = tracker(() => 0);
      t.onUserInput('l');
      t.onUserInput(key);
      expect(t.phase).toBe('prompt');
      expect(anchors[0].isDisposed).toBe(true);
    }
  });

  it('ignores keystrokes while a command runs and re-arms on the D marker', () => {
    const { t, anchors } = tracker(() => 0);
    t.onUserInput('l');
    t.onUserInput('\r');
    t.onShellMarker('C');
    expect(t.phase).toBe('running');
    t.onUserInput('y');
    expect(t.phase).toBe('running');
    expect(anchors).toHaveLength(1);
    t.onShellMarker('D');
    expect(t.phase).toBe('prompt');
    t.onUserInput('x');
    expect(t.phase).toBe('input');
    expect(anchors).toHaveLength(2);
  });

  it('stays in the prompt phase when no anchor can be created', () => {
    const t = new TerminalInputTracker(() => undefined, () => 0);
    t.onUserInput('a');
    expect(t.phase).toBe('prompt');
  });

  it('reset() disposes the anchor and forgets the last input', () => {
    const { t, anchors } = tracker(() => 0);
    t.onUserInput('a');
    t.readInput(buffer([new FakeLine('a')], 0, 1), 80);
    expect(t.lastInput).not.toBeNull();
    t.reset();
    expect(t.phase).toBe('prompt');
    expect(t.lastInput).toBeNull();
    expect(anchors[0].isDisposed).toBe(true);
  });
});

describe('TerminalInputTracker.readInput', () => {
  it('reads the text between the anchor column and the cursor', () => {
    const { t } = tracker(() => 2);
    t.onUserInput('g');
    const input = t.readInput(buffer([new FakeLine('$ git st')], 0, 8), 80);
    expect(input).toEqual({ text: 'git st', atEnd: true, startRow: 0, startCol: 2, cursorRow: 0, cursorCol: 8 });
    expect(t.lastInput).toBe(input);
  });

  it('joins soft-wrapped continuation rows and rejects hard line breaks', () => {
    const { t } = tracker(() => 2);
    t.onUserInput('e');
    const wrapped = buffer([new FakeLine('$ echo aaaa', false, 11), new FakeLine('bbbb', true, 11)], 1, 4);
    expect(t.readInput(wrapped, 11)?.text).toBe('echo aaaabbbb');

    const broken = buffer([new FakeLine('$ echo aaaa', false, 11), new FakeLine('output', false, 11)], 1, 4);
    expect(t.readInput(broken, 11)).toBeNull();
  });

  it('reports atEnd=false when the cursor moved back into the input', () => {
    const { t } = tracker(() => 2);
    t.onUserInput('g');
    expect(t.readInput(buffer([new FakeLine('$ git status')], 0, 8), 80)?.atEnd).toBe(false);
  });

  it('treats a right-side prompt separated by a wide gap as still at the end', () => {
    const { t } = tracker(() => 2);
    t.onUserInput('g');
    const withRprompt = buffer([new FakeLine('$ git st' + ' '.repeat(20) + '(main)')], 0, 8);
    expect(t.readInput(withRprompt, 80)?.atEnd).toBe(true);
  });

  it('reports atEnd=false when a wrapped row after the cursor still has content', () => {
    const { t } = tracker(() => 2);
    t.onUserInput('g');
    const b = buffer([new FakeLine('$ git st', false, 8), new FakeLine('atus', true, 8)], 0, 8);
    expect(t.readInput(b, 8)?.atEnd).toBe(false);
  });

  it('returns null outside the input phase, on the alternate screen, or with a disposed anchor', () => {
    const { t, anchors } = tracker(() => 2);
    expect(t.readInput(buffer([new FakeLine('$ ')], 0, 2), 80)).toBeNull();
    t.onUserInput('g');
    expect(t.readInput(buffer([new FakeLine('$ g')], 0, 3, { type: 'alternate' }), 80)).toBeNull();
    anchors[0].isDisposed = true;
    expect(t.readInput(buffer([new FakeLine('$ g')], 0, 3), 80)).toBeNull();
  });

  it('returns null when the cursor is above the anchor or before its column', () => {
    const { t } = tracker(() => 2, 3);
    t.onUserInput('g');
    const lines = [new FakeLine(''), new FakeLine(''), new FakeLine(''), new FakeLine('$ g')];
    expect(t.readInput(buffer(lines, 1, 0), 80)).toBeNull();
    expect(t.readInput(buffer(lines, 3, 1), 80)).toBeNull();
  });

  it('accounts for scrollback via baseY when computing viewport rows', () => {
    const { t } = tracker(() => 2, 105);
    t.onUserInput('l');
    const lines: FakeLine[] = [];
    lines[105] = new FakeLine('$ ls');
    const input = t.readInput(buffer(lines, 5, 4, { baseY: 100 }), 80);
    expect(input).toMatchObject({ text: 'ls', startRow: 5, cursorRow: 5 });
  });
});
