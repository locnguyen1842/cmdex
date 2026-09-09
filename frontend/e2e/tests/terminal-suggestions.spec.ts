import { test, expect, type Page } from '../fixtures';

// Warp-style terminal autosuggestions (Terminal.tsx + lib/terminalInputTracker.ts
// + utils/terminalSuggest.ts). The mock backend never echoes keystrokes, so
// each test simulates the shell's echo with emitPtyOutput — that echo, read
// back out of the xterm buffer, is what the suggestions are computed from.
// Assertions look at what was written to the PTY (the Write call log) rather
// than at xterm's rendered text, which is renderer-dependent in headless runs.

function seededCommand(id: string, title: string, scriptContent: string, variables: unknown[] = []) {
  const now = new Date().toISOString();
  return {
    id,
    title: { String: title, Valid: true },
    description: { String: '', Valid: false },
    scriptContent,
    tags: [],
    variables,
    presets: [],
    workingDir: {},
    categoryId: '',
    position: 0,
    createdAt: now,
    updatedAt: now,
  };
}

async function activeSessionIdFromTab(page: Page): Promise<string> {
  const testId = await page.locator('.tab-item').first().getAttribute('data-testid');
  const id = testId?.replace('terminal-tab-', '');
  if (!id) throw new Error('Could not resolve a session id from the first terminal tab');
  return id;
}

async function openPrompt(page: Page): Promise<string> {
  await expect(page.locator('.tab-item')).toHaveCount(1);
  const id = await activeSessionIdFromTab(page);
  await page.evaluate((sid) => window.__cmdexE2E!.emitPtyOutput(sid, '$ '), id);
  // xterm's textarea is 0x0 and off-screen; clicking the container delegates
  // focus to it exactly as a real click does (see palette-shortcuts.spec.ts).
  await page.locator('.terminal-container:visible').click();
  await expect(page.getByRole('textbox', { name: 'Terminal input' })).toBeFocused();
  return id;
}

async function typeAtPrompt(page: Page, sessionId: string, text: string) {
  await page.keyboard.type(text);
  await page.evaluate(([sid, echoed]) => window.__cmdexE2E!.emitPtyOutput(sid, echoed), [sessionId, text] as const);
}

function writesSince(page: Page): Promise<string[]> {
  return page.evaluate(() =>
    window.__cmdexE2E!.callLog.filter((c) => c.method === 'Write').map((c) => String(c.args[1])),
  );
}

function clearCallLog(page: Page) {
  return page.evaluate(() => window.__cmdexE2E!.clearCallLog());
}

const menu = (page: Page) => page.getByTestId('terminal-suggest-menu');
const items = (page: Page) => page.getByTestId('terminal-suggest-item');
const ghost = (page: Page) => page.locator('.terminal-ghost');

// Terminal.tsx mirrors the input tracker's phase onto the container after every
// parsed write, so a test can wait for an OSC 133 marker to be processed before
// typing — exactly the ordering a real shell guarantees.
function expectPhase(page: Page, phase: 'prompt' | 'input' | 'running') {
  return expect(page.locator('.terminal-container:visible')).toHaveAttribute('data-prompt-phase', phase);
}

test.describe('Terminal autosuggestions', () => {
  test.beforeEach(async ({ seed }) => {
    await seed({
      settings: {},
      shellHistory: ['git status', 'git stash list', 'make build'],
      commands: [
        seededCommand('c-deploy', 'Deploy API', 'kubectl rollout restart deploy/api'),
        seededCommand('c-logs', 'Tail logs', 'docker logs -f {{container}}', [
          { name: 'container', description: '', example: '', default: '', sortOrder: 0 },
        ]),
      ],
    });
  });

  test('shows ghost text plus a menu for the typed prefix, and → accepts the ghost', async ({ page, gotoApp }) => {
    await gotoApp();
    const id = await openPrompt(page);

    await typeAtPrompt(page, id, 'git st');
    await expect(menu(page)).toBeVisible();
    // git's own "status"/"stash" subcommand completions (from the static
    // spec table) surface first, ahead of the two matching history lines —
    // token completions are always listed before whole-line suggestions.
    await expect(items(page)).toHaveCount(4);
    await expect(items(page).nth(2)).toContainText('git status');
    await expect(ghost(page)).toHaveText('atus');

    await clearCallLog(page);
    await page.keyboard.press('ArrowRight');
    await expect.poll(() => writesSince(page)).toEqual(['atus']);

    // Once the shell echoes the accepted text the input equals the entry
    // itself, so there is nothing left to suggest.
    await page.evaluate((sid) => window.__cmdexE2E!.emitPtyOutput(sid, 'atus'), id);
    await expect(menu(page)).toHaveCount(0);
    await expect(ghost(page)).toHaveCount(0);
  });

  test('↓ highlights a row and ↵ inserts the remainder and submits it', async ({ page, gotoApp }) => {
    await gotoApp();
    const id = await openPrompt(page);

    await typeAtPrompt(page, id, 'ma');
    await expect(items(page)).toHaveCount(1);
    await expect(items(page).first()).toHaveAttribute('aria-selected', 'false');

    await page.keyboard.press('ArrowDown');
    await expect(items(page).first()).toHaveAttribute('aria-selected', 'true');

    await clearCallLog(page);
    await page.keyboard.press('Enter');
    await expect.poll(() => writesSince(page)).toEqual(['ke build\r']);
    await expect(menu(page)).toHaveCount(0);
  });

  test('⇥ inserts the highlighted row without submitting', async ({ page, gotoApp }) => {
    await gotoApp();
    const id = await openPrompt(page);

    await typeAtPrompt(page, id, 'git st');
    // Same 4-row layout as the ghost-text test above: git's "status"/"stash"
    // subcommands, then the two history lines. Navigate past both
    // subcommand rows to reach the "git stash list" history row.
    await expect(items(page)).toHaveCount(4);
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('ArrowDown');
    await expect(items(page).nth(3)).toHaveAttribute('aria-selected', 'true');
    await expect(items(page).nth(3)).toContainText('git stash list');

    await clearCallLog(page);
    await page.keyboard.press('Tab');
    await expect.poll(() => writesSince(page)).toEqual(['ash list']);
  });

  test('with nothing highlighted, ↵ and ↑ still reach the shell', async ({ page, gotoApp }) => {
    await gotoApp();
    const id = await openPrompt(page);

    await typeAtPrompt(page, id, 'git st');
    await expect(menu(page)).toBeVisible();

    await clearCallLog(page);
    await page.keyboard.press('ArrowUp');
    await page.keyboard.press('Enter');
    await expect.poll(() => writesSince(page)).toEqual(['\x1b[A', '\r']);
    await expect(menu(page)).toHaveCount(0);
  });

  test('esc dismisses the suggestions until the input changes', async ({ page, gotoApp }) => {
    await gotoApp();
    const id = await openPrompt(page);

    await typeAtPrompt(page, id, 'git st');
    await expect(menu(page)).toBeVisible();
    await clearCallLog(page);
    await page.keyboard.press('Escape');
    await expect(menu(page)).toHaveCount(0);
    await expect(ghost(page)).toHaveCount(0);
    // The menu consumed Escape; the shell never saw it.
    expect(await writesSince(page)).toEqual([]);

    await typeAtPrompt(page, id, 'a');
    await expect(menu(page)).toBeVisible();
    await expect(ghost(page)).toHaveText('tus');
  });

  test('a saved command with variables erases the input and opens the variable prompt', async ({ page, gotoApp }) => {
    await gotoApp();
    const id = await openPrompt(page);

    await typeAtPrompt(page, id, 'tail');
    await expect(items(page)).toHaveCount(1);
    await expect(items(page).first()).toHaveAttribute('data-source', 'command');
    await expect(items(page).first()).toContainText('Tail logs');
    // Templated scripts are never offered as ghost text.
    await expect(ghost(page)).toHaveCount(0);

    await clearCallLog(page);
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('Enter');
    await expect.poll(() => writesSince(page)).toEqual(['\x7f\x7f\x7f\x7f']);
    await expect(page.getByTestId('fill-variables-dialog')).toBeVisible();
  });

  test('a saved command matched by title inserts its script', async ({ page, gotoApp }) => {
    await gotoApp();
    const id = await openPrompt(page);

    await typeAtPrompt(page, id, 'deploy');
    await expect(items(page)).toHaveCount(1);
    await expect(items(page).first()).toContainText('kubectl rollout restart deploy/api');

    await clearCallLog(page);
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('Tab');
    // "deploy" is not a prefix of the script, so the typed text is erased first.
    await expect.poll(() => writesSince(page)).toEqual(['\x7f\x7f\x7f\x7f\x7f\x7fkubectl rollout restart deploy/api']);
  });

  test('keystrokes sent to a running command (OSC 133 C) get no suggestions until it finishes', async ({ page, gotoApp }) => {
    await gotoApp();
    const id = await openPrompt(page);

    await typeAtPrompt(page, id, 'ma');
    await expect(menu(page)).toBeVisible();
    await page.keyboard.press('Enter');
    await expect(menu(page)).toHaveCount(0);

    await page.evaluate((sid) => window.__cmdexE2E!.emitPtyOutput(sid, '\r\n\x1b]133;C;nonce\x07building...\r\n'), id);
    await expectPhase(page, 'running');
    await clearCallLog(page);
    await typeAtPrompt(page, id, 'ma');
    await expect.poll(() => writesSince(page)).toHaveLength(2);
    await expect(menu(page)).toHaveCount(0);

    await page.evaluate((sid) => window.__cmdexE2E!.emitPtyOutput(sid, '\x1b]133;D;nonce;0\x07$ '), id);
    await expectPhase(page, 'prompt');
    await typeAtPrompt(page, id, 'ma');
    await expect(menu(page)).toBeVisible();
    await expect(items(page).first()).toContainText('make build');
  });

  test('the setting turns the feature off', async ({ page, gotoApp, seed }) => {
    await seed({ settings: { terminalSuggestions: false }, shellHistory: ['git status'] });
    await gotoApp();
    const id = await openPrompt(page);

    await clearCallLog(page);
    await typeAtPrompt(page, id, 'git st');
    await expect.poll(() => writesSince(page)).toHaveLength(6);
    await expect(menu(page)).toHaveCount(0);
    await expect(ghost(page)).toHaveCount(0);
  });
});

// Warp-style tab completion (utils/terminalCompletion.ts +
// lib/completionSpecs.ts): contextual token completions — paths from
// SuggestionService.CompletePath, executables from CompleteCommands,
// subcommands/options straight out of the static spec table — merged ahead
// of the whole-line suggestions covered above.
test.describe('Terminal tab completion', () => {
  test('typing "cd " lists the cwd\'s directories, and Tab inserts the first one', async ({ page, gotoApp, seed }) => {
    await seed({
      pathCompletions: {
        '': [
          { name: 'Desktop/', insert: 'Desktop/', isDir: true },
          { name: 'Documents/', insert: 'Documents/', isDir: true },
          { name: 'notes.txt', insert: 'notes.txt', isDir: false },
        ],
      },
    });
    await gotoApp();
    const id = await openPrompt(page);

    await typeAtPrompt(page, id, 'cd ');
    await expect(menu(page)).toBeVisible();
    const dirItems = page.locator('[data-testid="terminal-suggest-item"][data-group="directories"]');
    // dirsOnly filters out the seeded "notes.txt" file entry.
    await expect(dirItems).toHaveCount(2);
    await expect(dirItems.first()).toContainText('Desktop');

    await clearCallLog(page);
    await page.keyboard.press('Tab');
    // No row was keyboard-highlighted, but the top row is a token
    // completion, so Tab completes it — a directory, so no trailing space.
    await expect.poll(() => writesSince(page)).toEqual(['Desktop/']);
  });

  test('typing a command prefix lists matching executables from CompleteCommands', async ({ page, gotoApp, seed }) => {
    await seed({ commandCompletions: ['git', 'gitk', 'grep'] });
    await gotoApp();
    const id = await openPrompt(page);

    await typeAtPrompt(page, id, 'gi');
    const cmdItems = page.locator('[data-testid="terminal-suggest-item"][data-group="commands"]');
    await expect(cmdItems).toHaveCount(2);
    await expect(cmdItems.first()).toContainText('git');
    await expect(cmdItems.nth(1)).toContainText('gitk');
  });

  test('typing "git ch" lists checkout/cherry-pick from the static spec, with descriptions', async ({ page, gotoApp, seed }) => {
    await seed({});
    await gotoApp();
    const id = await openPrompt(page);

    await typeAtPrompt(page, id, 'git ch');
    const subItems = page.locator('[data-testid="terminal-suggest-item"][data-group="subcommands"]');
    await expect(subItems).toHaveCount(2);
    await expect(subItems.nth(0)).toContainText('checkout');
    await expect(subItems.nth(0)).toContainText('Switch branches or restore files');
    await expect(subItems.nth(1)).toContainText('cherry-pick');
    await expect(subItems.nth(1)).toContainText('Apply commits from another branch');
  });

  test('typing "git checkout -" lists checkout\'s own options', async ({ page, gotoApp, seed }) => {
    await seed({});
    await gotoApp();
    const id = await openPrompt(page);

    await typeAtPrompt(page, id, 'git checkout -');
    const optItems = page.locator('[data-testid="terminal-suggest-item"][data-group="options"]');
    await expect(optItems).toHaveCount(5);
    await expect(optItems.first()).toContainText('-b');
  });

  test('Tab with only whole-line history matches still passes through to the shell', async ({ page, gotoApp, seed }) => {
    await seed({ shellHistory: ['make build'] });
    await gotoApp();
    const id = await openPrompt(page);

    // "make" has no subcommands, and its own positional args are declared
    // 'none' (targets are dynamic and not completed), so this prefix
    // produces only the whole-line history match — no token rows, so Tab
    // must not be treated as "complete the top token match".
    await typeAtPrompt(page, id, 'make bui');
    await expect(menu(page)).toBeVisible();
    await expect(page.locator('[data-testid="terminal-suggest-item"][data-kind="token"]')).toHaveCount(0);
    await expect(items(page)).toHaveCount(1);

    await clearCallLog(page);
    await page.keyboard.press('Tab');
    await expect.poll(() => writesSince(page)).toEqual(['\t']);
  });

  test('the terminal status bar updates when the session cwd changes', async ({ page, gotoApp, seed }) => {
    await seed({});
    await gotoApp();
    await expect(page.locator('.tab-item')).toHaveCount(1);
    const id = await activeSessionIdFromTab(page);

    // App.tsx's pty-cwd:<id> subscription registers in a useEffect gated on
    // eventsInitialized — wait for it, same as terminal.spec.ts's pty-exit test.
    await expect
      .poll(() => page.evaluate((sid) => window.__cmdexE2E?.hasListener(`pty-cwd:${sid}`) ?? false, id))
      .toBe(true);

    await page.evaluate((sid) => window.__cmdexE2E!.emitPtyCwd(sid, '/Users/e2e/projects/cmdex'), id);
    await expect(page.getByTestId('terminal-status-bar').locator('.status-cwd')).toContainText('~/projects/cmdex');
  });
});
