import { describe, it, expect } from 'vitest';
import {
  parseCommandLine,
  completionContext,
  pathCompletionItems,
  commandCompletionItems,
  subcommandCompletionItems,
  optionCompletionItems,
} from './terminalCompletion';
import { completionSpecs, type CompletionSpecs } from '../lib/completionSpecs';

describe('parseCommandLine', () => {
  it('splits plain whitespace-separated tokens', () => {
    const { tokens, currentIndex, currentToken } = parseCommandLine('git checkout main');
    expect(tokens.map((t) => t.value)).toEqual(['git', 'checkout', 'main']);
    expect(currentIndex).toBe(2);
    expect(currentToken).toBe('main');
  });

  it('reports an empty current token when the line ends in whitespace', () => {
    const { tokens, currentIndex, currentToken } = parseCommandLine('cd ');
    expect(tokens.map((t) => t.value)).toEqual(['cd']);
    expect(currentIndex).toBe(1);
    expect(currentToken).toBe('');
  });

  it('collapses runs of whitespace between tokens', () => {
    const { tokens } = parseCommandLine('git   status');
    expect(tokens.map((t) => t.value)).toEqual(['git', 'status']);
  });

  it('handles a totally empty line', () => {
    const { tokens, currentIndex, currentToken } = parseCommandLine('');
    expect(tokens).toEqual([]);
    expect(currentIndex).toBe(0);
    expect(currentToken).toBe('');
  });

  it('handles a line that is only whitespace', () => {
    const { tokens, currentIndex, currentToken } = parseCommandLine('   ');
    expect(tokens).toEqual([]);
    expect(currentIndex).toBe(0);
    expect(currentToken).toBe('');
  });

  it('keeps single-quoted content literal, including spaces', () => {
    const { tokens, currentToken } = parseCommandLine("echo 'hello world'");
    expect(tokens.map((t) => t.value)).toEqual(['echo', 'hello world']);
    expect(currentToken).toBe('hello world');
  });

  it('unescapes backslash-escaped characters inside double quotes', () => {
    const { tokens } = parseCommandLine('echo "a \\"quoted\\" word"');
    expect(tokens[1].value).toBe('a "quoted" word');
  });

  it('does not process backslash escapes inside single quotes', () => {
    const { tokens } = parseCommandLine("echo 'a\\nb'");
    expect(tokens[1].value).toBe('a\\nb');
  });

  it('unescapes an unquoted backslash-escaped space', () => {
    const { tokens, currentToken } = parseCommandLine('cd My\\ Documents');
    expect(tokens[1].value).toBe('My Documents');
    expect(currentToken).toBe('My Documents');
  });

  it('joins a token split across a quote boundary', () => {
    const { tokens } = parseCommandLine('grep -r "foo"bar .');
    expect(tokens[2].value).toBe('foobar');
  });

  it('records accurate start/end offsets for the raw source text', () => {
    const { tokens } = parseCommandLine('git  checkout');
    expect(tokens[0]).toMatchObject({ raw: 'git', start: 0, end: 3 });
    expect(tokens[1]).toMatchObject({ raw: 'checkout', start: 5, end: 13 });
  });

  it('treats an unterminated quote as part of the in-progress token', () => {
    const { currentToken, currentIndex } = parseCommandLine('echo "still typing');
    expect(currentIndex).toBe(1);
    expect(currentToken).toBe('still typing');
  });
});

describe('completionContext', () => {
  const specs = completionSpecs;

  it('resolves the first token as a command prefix', () => {
    expect(completionContext('gi', specs)).toEqual({ kind: 'command', prefix: 'gi' });
    expect(completionContext('', specs)).toEqual({ kind: 'command', prefix: '' });
  });

  it('resolves the second token of a command with subcommands as a subcommand prefix', () => {
    expect(completionContext('git ch', specs)).toEqual({ kind: 'subcommand', command: 'git', prefix: 'ch' });
    expect(completionContext('git ', specs)).toEqual({ kind: 'subcommand', command: 'git', prefix: '' });
  });

  it('resolves a dash-prefixed token as an option, carrying the matched subcommand', () => {
    expect(completionContext('git checkout -', specs)).toEqual({
      kind: 'option',
      command: 'git',
      subcommand: 'checkout',
      prefix: '-',
    });
    expect(completionContext('curl -', specs)).toEqual({ kind: 'option', command: 'curl', subcommand: undefined, prefix: '-' });
  });

  it('resolves path args for a command whose spec declares them', () => {
    expect(completionContext('cat some-fi', specs)).toEqual({ kind: 'path', prefix: 'some-fi', dirsOnly: false });
    expect(completionContext('cat ', specs)).toEqual({ kind: 'path', prefix: '', dirsOnly: false });
  });

  it('resolves dir-only args for cd/rmdir/pushd', () => {
    expect(completionContext('cd ', specs)).toEqual({ kind: 'path', prefix: '', dirsOnly: true });
    expect(completionContext('rmdir old', specs)).toEqual({ kind: 'path', prefix: 'old', dirsOnly: true });
  });

  it('resolves path args for a matched subcommand (git add / checkout / diff / restore, docker build)', () => {
    expect(completionContext('git add src/', specs)).toEqual({ kind: 'path', prefix: 'src/', dirsOnly: false });
    expect(completionContext('git checkout ', specs)).toEqual({ kind: 'path', prefix: '', dirsOnly: false });
    expect(completionContext('git diff ', specs)).toEqual({ kind: 'path', prefix: '', dirsOnly: false });
    expect(completionContext('git restore ', specs)).toEqual({ kind: 'path', prefix: '', dirsOnly: false });
    expect(completionContext('docker build ', specs)).toEqual({ kind: 'path', prefix: '', dirsOnly: false });
  });

  it("resolves an option's own argument as a path (kubectl apply -f)", () => {
    expect(completionContext('kubectl apply -f ', specs)).toEqual({ kind: 'path', prefix: '', dirsOnly: false });
    expect(completionContext('kubectl apply -f man', specs)).toEqual({ kind: 'path', prefix: 'man', dirsOnly: false });
  });

  it('resolves "command" args for which', () => {
    expect(completionContext('which gi', specs)).toEqual({ kind: 'command', prefix: 'gi' });
  });

  it('shows nothing for an empty token after a command whose args are "none"', () => {
    expect(completionContext('echo ', specs)).toEqual({ kind: 'none' });
    expect(completionContext('git commit ', specs)).toEqual({ kind: 'none' });
  });

  it('falls back to path completion for a non-empty token on an unknown command', () => {
    expect(completionContext('totallyunknowncmd some/pa', specs)).toEqual({
      kind: 'path',
      prefix: 'some/pa',
      dirsOnly: false,
    });
  });

  it('shows nothing for an empty token on an unknown command', () => {
    expect(completionContext('totallyunknowncmd ', specs)).toEqual({ kind: 'none' });
  });

  it('falls back to path completion for a non-empty token on a known command with no declared args', () => {
    // git status has no `args` and no matched-option override; a non-empty
    // token still gets a generic path fallback.
    expect(completionContext('git status some/pa', specs)).toEqual({
      kind: 'path',
      prefix: 'some/pa',
      dirsOnly: false,
    });
  });
});

describe('menu item builders', () => {
  it('pathCompletionItems: directories get no trailing space, files do', () => {
    const items = pathCompletionItems(
      [
        { name: 'src/', insert: 'src/', isDir: true },
        { name: 'README.md', insert: 'README.md', isDir: false },
      ],
      'sr',
    );
    expect(items[0]).toMatchObject({ group: 'directories', icon: 'folder', backspaces: 2, text: 'src/', isDir: true });
    expect(items[1]).toMatchObject({ group: 'files', icon: 'file', backspaces: 2, text: 'README.md ', isDir: false });
  });

  it('pathCompletionItems: backspaces count code points, not JS string length', () => {
    const items = pathCompletionItems([{ name: 'a', insert: 'a', isDir: false }], '👍a');
    expect(items[0].backspaces).toBe(2);
  });

  it('commandCompletionItems: always a trailing space', () => {
    const items = commandCompletionItems(['git', 'grep'], 'gr');
    expect(items).toEqual([
      { kind: 'token', id: 'cmd:git', group: 'commands', icon: 'terminal', label: 'git', backspaces: 2, text: 'git ', isDir: false },
      { kind: 'token', id: 'cmd:grep', group: 'commands', icon: 'terminal', label: 'grep', backspaces: 2, text: 'grep ', isDir: false },
    ]);
  });

  it('subcommandCompletionItems: filters by prefix and carries the description', () => {
    const items = subcommandCompletionItems(completionSpecs.git, 'ch');
    expect(items.map((i) => i.label)).toEqual(['checkout', 'cherry-pick']);
    expect(items[0].description).toBe('Switch branches or restore files');
    expect(items[0].text).toBe('checkout ');
  });

  it('subcommandCompletionItems: empty spec/undefined yields nothing', () => {
    expect(subcommandCompletionItems(undefined, 'x')).toEqual([]);
  });

  it('subcommandCompletionItems: hides an entry identical to what is already typed', () => {
    // Nothing left to complete but a trailing space — same convention as
    // hiding an exact match from the whole-line suggestions.
    const items = subcommandCompletionItems(completionSpecs.git, 'status');
    expect(items.map((i) => i.label)).not.toContain('status');
  });

  it('commandCompletionItems: hides an entry identical to what is already typed', () => {
    const items = commandCompletionItems(['git', 'gitk'], 'git');
    expect(items.map((i) => i.label)).toEqual(['gitk']);
  });

  it('optionCompletionItems: uses the matched subcommand options over the top-level ones', () => {
    const items = optionCompletionItems(completionSpecs.git, 'checkout', '-');
    expect(items.map((i) => i.label)).toContain('-b');
    expect(items.map((i) => i.label)).not.toContain('-A'); // git add's option, not checkout's
  });

  it('optionCompletionItems: falls back to top-level options with no subcommand match', () => {
    const items = optionCompletionItems(completionSpecs.curl, undefined, '-');
    expect(items.map((i) => i.label)).toEqual(
      expect.arrayContaining(['-X', '-H', '-d', '-o', '-L', '-s', '-i', '-u']),
    );
  });

  it('optionCompletionItems: filters by the typed prefix', () => {
    const items = optionCompletionItems(completionSpecs.git, 'log', '--o');
    expect(items.map((i) => i.label)).toEqual(['--oneline']);
  });
});

describe('completionSpecs sanity', () => {
  it('has at least 30 git subcommands', () => {
    expect((completionSpecs.git.subcommands ?? []).length).toBeGreaterThanOrEqual(30);
  });

  it('marks the documented empty-token path-arg commands with explicit path/dir args', () => {
    const pathArgCommands = [
      'cd', 'ls', 'cat', 'cp', 'mv', 'rm', 'mkdir', 'open', 'code', 'vim', 'nvim', 'nano',
      'less', 'head', 'tail', 'touch', 'chmod', 'chown', 'tar', 'unzip', 'zip', 'du', 'tree',
      'stat', 'file', 'diff', 'source', 'sh', 'bash', 'python', 'node',
    ];
    const specs: CompletionSpecs = completionSpecs;
    for (const name of pathArgCommands) {
      expect(specs[name]?.args, `${name} should declare path/dir args`).toMatch(/^(path|dir)$/);
    }
    expect(specs.go.subcommands?.find((s) => s.name === 'run')?.args).toBe('path');
    expect(specs.git.subcommands?.find((s) => s.name === 'add')?.args).toBe('path');
    expect(specs.git.subcommands?.find((s) => s.name === 'checkout')?.args).toBe('path');
    expect(specs.git.subcommands?.find((s) => s.name === 'diff')?.args).toBe('path');
    expect(specs.git.subcommands?.find((s) => s.name === 'restore')?.args).toBe('path');
    expect(specs.docker.subcommands?.find((s) => s.name === 'build')?.args).toBe('path');
    expect(specs.kubectl.subcommands?.find((s) => s.name === 'apply')?.options?.find((op) => op.name === '-f')?.args).toBe(
      'path',
    );
  });
});
