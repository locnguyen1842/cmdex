# Cmdex design system — implementation brief

Source of truth: the design export in `/Users/ton.nguyen/Desktop/Cmdex design update/`
(`uploads/*.html` are per-screen mockups with inline CSS; `cmdex-ui/` is a working
HTML/CSS/JS prototype of the main window whose `styles.css` is the cleanest token +
component reference). Rendered screenshots of every screen live in
`/private/tmp/claude-502/-Users-ton-nguyen-Documents-cmdex/15ff2796-2133-4b90-aa7a-ec4d939dcbb1/scratchpad/design/*.png`
(`main`, `main-light`, `welcome`, `settings`, `palette`, `variable-prompt`,
`launcher`, `launcher-running`, `proto`). Match those pixels; keep the app's
functionality, keyboard shortcuts, testids and i18n keys intact.

## Tokens (defined in `src/style.css`, use them — never hardcode colors)

| Design (mockup CSS) | App token | Notes |
|---|---|---|
| `--bg` | `--bg` | editor / main background |
| `--bg-2` | `--bg-2` | chrome: sidebar, tab bars, terminal panel, status bar |
| `--surface` | `--surface` | cards, inputs, popovers, code block |
| `--surface-2` | `--surface-2` | segmented control track, kbd chips, badges |
| `--border` | `--border` | hairlines |
| `--border-strong` | `--border-strong` | floating bars, dialogs, hover borders |
| `--fg` | `--fg` | primary text |
| `--fg-muted` | `--fg-muted` | secondary text |
| `--fg-faint` | `--fg-faint` | labels, placeholders, icons |
| `--accent` (purple) | **`--brand`** | the brand purple. NOT `--accent` — that is shadcn's hover surface |
| `--accent-2` | `--brand-2` | second gradient stop (logo / welcome mark) |
| `--accent-fg` | `--brand-fg` | text on a brand-filled button |
| `--accent-soft` | `--brand-soft` | selected row / chip background, focus ring (`0 0 0 3px`) |
| `--accent-soft-strong` | `--brand-soft-strong` | variable chip background |
| `--success` | `--ok` | |
| `--danger` | `--danger` | |
| `--cyan` / `--orange` / `--green` | same names | category dot palette |
| `--shadow` | `--shadow-pop` | floating save bar, toast, palette, menus |
| `--radius-sm` 6px / `--radius` 8px / `--radius-lg` 10px / 12px | `--r-sm` / `--r` / `--r-lg` / `--r-xl` | |
| `--font` Manrope | `--font-sans` | already the default (bundled, weights 200–800) |
| `--mono` JetBrains Mono | `--font-mono` | |
| `--dur` .12s / `--ease` | `--dur` / `--ease` | hover/focus transitions |

The shadcn palette (`--background`, `--primary`, `--muted`, `--accent`, …) still
exists and every theme defines it; Tailwind utilities (`bg-muted`,
`text-muted-foreground`, …) keep working. Prefer the design tokens in component CSS;
Tailwind utilities are fine inside `components/ui/*` and Settings.

All 10 built-in themes plus custom themes must look right: the design tokens are
derived from each theme's palette in `:root`, and pinned to the exact design values
for `classic` (default, dark) and `classic-light`. Check your surface in at least
`classic`, `classic-light` and `vscode-dark` (Settings → Appearance, or set
`document.documentElement.dataset.theme`).

## Type scale & geometry (from the mockups)

- Base 13px Manrope; sidebar rows 12–12.5px/600; section labels 10–10.5px, 700,
  uppercase, letter-spacing .06–.07em, `--fg-faint`; page title 22–24px/700,
  letter-spacing -0.015em; mono code 12–13px.
- Sidebar 264px (`--sidebar-width`), header 52px (`--header-height`), tab bar 40px
  (`--tab-bar-height`), terminal session tab bar 34px, status bar 24px, rows 28px,
  buttons 30px (26px compact `btn-run`), inputs 32–34px.
- Cards/inputs: `background: var(--surface); border: 1px solid var(--border);
  border-radius: var(--r)`; focus: `border-color: var(--brand); box-shadow: 0 0 0 3px
  var(--brand-soft)`.
- Selected/active row: `background: var(--brand-soft); color: var(--fg)` with a 2px
  `--brand` bar on the left (sidebar) or top (tabs).
- Variable chips inside scripts: pill, `background: var(--brand-soft-strong); color:
  var(--brand); border-radius: 999px; padding: 1px 9px; font-weight: 600`.
- Floating surfaces (save bar, palette, dialogs, launcher, suggestion menu):
  `background: var(--surface); border: 1px solid var(--border-strong); border-radius:
  var(--r-lg)` (12px for palette/dialog/launcher); `box-shadow: var(--shadow-pop)`.
- Density (`[data-density]`) must still scale paddings/font sizes — keep using the
  `--density-*` variables where the old CSS did.

## Rules for every surface

- Own only the files assigned to you; put CSS in your `src/styles/<surface>.css`
  (already imported from `style.css`; it holds the legacy rules for that surface —
  rewrite it freely, delete what the design no longer needs). Do not edit
  `src/style.css` or another surface's files.
- Keep every `data-testid`, ARIA role/label, and CSS class an e2e spec relies on
  (`frontend/e2e/utils/selectors.ts` and `frontend/e2e/tests/*.spec.ts`); keep all
  behavior (drag & drop, context menus, keyboard shortcuts, inline editing).
- Icons: lucide-react, 13–16px, stroke 1.8.
- Light theme must be checked, not assumed.
- Verify: `cd frontend && pnpm tsc --noEmit && pnpm lint && pnpm test`, then the e2e
  specs for your surface: `pnpm exec playwright test --config e2e/playwright.config.ts
  e2e/tests/<spec>.spec.ts`. The dev app is running (`wails3 dev`, Vite on :9245) and
  hot-reloads; you may screenshot `http://127.0.0.1:9246` (the e2e mock app; start it
  with `pnpm vite --config e2e/vite.config.ts --port 9246` if nothing listens) with
  Playwright to compare against the mockups.
