import { describe, it, expect } from 'vitest';
import {
  commandSuggestions,
  historySuggestions,
  scoreMatch,
  rankSuggestions,
  menuItems,
  ghostFor,
  nextGhostWord,
  planInsertion,
  displayWidth,
  scriptBody,
  type TerminalSuggestion,
} from './terminalSuggest';
import type { Command } from '../types';

function cmd(id: string, scriptContent: string, title = ''): Command {
  return {
    id,
    title: { String: title, Valid: title !== '' },
    description: { String: '', Valid: false },
    scriptContent,
    tags: [],
    variables: [],
    presets: [],
    workingDir: {},
    categoryId: '',
    position: 0,
    createdAt: '',
    updatedAt: '',
  } as unknown as Command;
}

describe('commandSuggestions', () => {
  it('strips the shebang and marks plain single-line scripts as insertable', () => {
    const [s] = commandSuggestions([cmd('1', '#!/bin/bash\ngit status\n', 'Status')]);
    expect(s).toMatchObject({ id: 'c:1', text: 'git status', title: 'Status', commandId: '1', source: 'command' });
    expect(s.needsRunFlow).toBe(false);
  });

  it('flags templated and multi-line scripts for the run flow', () => {
    const [vars, multi] = commandSuggestions([
      cmd('v', 'docker logs {{container}}'),
      cmd('m', 'cd app\nmake build'),
    ]);
    expect(vars.needsRunFlow).toBe(true);
    expect(multi.needsRunFlow).toBe(true);
    expect(multi.text).toBe('cd app …');
  });

  it('skips empty scripts and omits an unset title', () => {
    const out = commandSuggestions([cmd('e', '   '), cmd('t', 'ls')]);
    expect(out).toHaveLength(1);
    expect(out[0].title).toBeUndefined();
  });
});

describe('historySuggestions', () => {
  it('trims, drops blanks, and dedupes while keeping newest-first order', () => {
    const out = historySuggestions(['  git status ', '', 'ls', 'git status']);
    expect(out.map((s) => s.text)).toEqual(['git status', 'ls']);
    expect(out[0].id).toBe('h:git status');
  });
});

describe('scoreMatch', () => {
  it('ranks prefix > word prefix > substring > subsequence', () => {
    const prefix = scoreMatch('git', 'git status')!;
    const word = scoreMatch('git', 'sudo git status')!;
    const sub = scoreMatch('it', 'git status')!;
    const fuzzy = scoreMatch('gtst', 'git status')!;
    expect(prefix.score).toBeGreaterThan(word.score);
    expect(word.score).toBeGreaterThan(sub.score);
    expect(sub.score).toBeGreaterThan(fuzzy.score);
    expect(prefix.indices).toEqual([0, 1, 2]);
    expect(word.indices).toEqual([5, 6, 7]);
    expect(fuzzy.indices).toEqual([0, 2, 4, 5]);
  });

  it('does not fuzzy-match queries shorter than four characters', () => {
    expect(scoreMatch('gs', 'git status')).toBeNull();
    expect(scoreMatch('gtu', 'git status')).toBeNull();
  });

  it('is case-insensitive and returns null on no match', () => {
    expect(scoreMatch('GIT', 'git status')).not.toBeNull();
    expect(scoreMatch('xyz', 'git status')).toBeNull();
    expect(scoreMatch('', 'git status')).toBeNull();
    expect(scoreMatch('longer than target', 'ls')).toBeNull();
  });

  it('scores equally good matches the same so candidate order (recency) decides', () => {
    expect(scoreMatch('git', 'git status')!.score).toBe(scoreMatch('git', 'git status --short')!.score);
  });
});

describe('rankSuggestions', () => {
  const history = historySuggestions(['make test', 'git status', 'git stash list', 'ls -la']);
  const commands = commandSuggestions([cmd('deploy', 'kubectl rollout restart deploy/api', 'Deploy API')]);
  const candidates: TerminalSuggestion[] = [...history, ...commands];

  it('keeps candidate order on ties so the most recent history entry wins', () => {
    const ranked = rankSuggestions('git st', candidates);
    expect(ranked.map((r) => r.text)).toEqual(['git status', 'git stash list']);
  });

  it('matches saved commands by title and reports the matched field', () => {
    const ranked = rankSuggestions('deploy', candidates);
    expect(ranked).toHaveLength(1);
    expect(ranked[0].matchedField).toBe('title');
    expect(ranked[0].matchIndices).toEqual([0, 1, 2, 3, 4, 5]);
  });

  it('ignores surrounding whitespace and keeps an exact match only as a flagged top entry', () => {
    const ranked = rankSuggestions('  ls -la ', candidates);
    expect(ranked).toHaveLength(1);
    expect(ranked[0].exact).toBe(true);
    expect(menuItems(ranked)).toHaveLength(0);
    expect(rankSuggestions('   ', candidates)).toHaveLength(0);
  });

  it('ranks an exact match above longer prefix matches', () => {
    const ranked = rankSuggestions('clear', historySuggestions(['clearf', 'clear']));
    expect(ranked.map((r) => r.text)).toEqual(['clear', 'clearf']);
    expect(menuItems(ranked).map((r) => r.text)).toEqual(['clearf']);
  });

  it('caps the result at the limit', () => {
    const many = historySuggestions(Array.from({ length: 20 }, (_, i) => `git cmd${i}`));
    expect(rankSuggestions('git', many, 3)).toHaveLength(3);
  });
});

describe('ghostFor', () => {
  const ranked = rankSuggestions('git s', [
    ...commandSuggestions([cmd('v', 'git show {{ref}}')]),
    ...historySuggestions(['git status']),
  ]);

  it('returns the remainder of the first insertable prefix match', () => {
    expect(ghostFor('git s', ranked)).toBe('tatus');
    expect(ghostFor('  git s', ranked)).toBe('tatus');
  });

  it('shows nothing when the typed text is itself a history entry, even if longer ones exist', () => {
    const exact = rankSuggestions('clear', historySuggestions(['clearf', 'clear']));
    expect(ghostFor('clear', exact)).toBe('');
    const noExact = rankSuggestions('clea', historySuggestions(['clearf', 'clear']));
    expect(ghostFor('clea', noExact)).toBe('rf');
  });

  it('never suggests a run-flow item, a title match, or a case-changing completion', () => {
    const onlyVars = rankSuggestions('git s', commandSuggestions([cmd('v', 'git show {{ref}}')]));
    expect(ghostFor('git s', onlyVars)).toBe('');
    const titled = rankSuggestions('dep', commandSuggestions([cmd('d', 'kubectl apply', 'Deploy')]));
    expect(ghostFor('dep', titled)).toBe('');
    expect(ghostFor('GIT S', ranked)).toBe('');
    expect(ghostFor('', ranked)).toBe('');
  });
});

describe('nextGhostWord', () => {
  it('takes the first word plus one following space', () => {
    expect(nextGhostWord('tatus --short')).toBe('tatus ');
    expect(nextGhostWord(' --short')).toBe(' --short');
    expect(nextGhostWord('')).toBe('');
  });
});

describe('planInsertion', () => {
  it('appends the remainder when the target extends the typed text', () => {
    expect(planInsertion('git s', 'git status')).toEqual({ backspaces: 0, text: 'tatus' });
    expect(planInsertion('  git s', 'git status')).toEqual({ backspaces: 0, text: 'tatus' });
  });

  it('erases the typed text first when the target does not start with it', () => {
    expect(planInsertion('stat', 'git status')).toEqual({ backspaces: 4, text: 'git status' });
    expect(planInsertion('héllo', 'ls')).toEqual({ backspaces: 5, text: 'ls' });
    expect(planInsertion('', 'ls')).toEqual({ backspaces: 0, text: 'ls' });
  });
});

describe('displayWidth', () => {
  it('counts wide glyphs as two cells', () => {
    expect(displayWidth('abc')).toBe(3);
    expect(displayWidth('日本')).toBe(4);
    expect(displayWidth('a🚀')).toBe(3);
  });
});

describe('scriptBody', () => {
  it('drops only a leading shebang line', () => {
    expect(scriptBody('#!/usr/bin/env bash\necho hi\n')).toBe('echo hi');
    expect(scriptBody('echo "#!" ok')).toBe('echo "#!" ok');
  });
});
