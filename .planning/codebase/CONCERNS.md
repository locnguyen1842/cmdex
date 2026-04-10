# Codebase Concerns

**Analysis Date:** 2026-04-08

## Tech Debt

**Centralized React state in a single root component:**
- Issue: Most UI flow, tabs, modals, and Wails calls live in one file, making changes risky and reviews heavy.
- Files: `frontend/src/App.tsx` (~1,317 lines)
- Impact: Regressions in unrelated features when editing shared handlers; harder onboarding and refactors.
- Fix approach: Extract domain hooks (tabs, commands CRUD, execution) and thin `App.tsx` to composition only.

**Large command editor surface:**
- Issue: Command editing, presets, variables, and preview logic are concentrated in one component.
- Files: `frontend/src/components/CommandDetail.tsx` (~1,294 lines)
- Impact: Same as above for the primary editing experience.
- Fix approach: Split into subcomponents or hooks (`usePresets`, `useVariablePanel`, preview blocks) with stable props.

**Database and migrations in one package file:**
- Issue: Schema, migrations, CRUD, search, and settings share `db.go`.
- Files: `db.go` (~1,173 lines)
- Impact: Migrations are easy to get wrong (FTS triggers, rebuild); harder to test or reason about in isolation.
- Fix approach: Keep migrations in dedicated functions/files; add integration tests around migrate + FTS consistency.

**Agent-facing documentation drift:**
- Issue: `AGENTS.md` still describes JSON storage, `${var}` syntax, and `store.go`; the app uses SQLite under `~/.cmdex/`, `{{var}}` templates, and `db.go`.
- Files: `AGENTS.md`, `CLAUDE.md` (CLAUDE is largely accurate)
- Impact: Automated or human agents may apply wrong patterns when changing the app.
- Fix approach: Align `AGENTS.md` with `CLAUDE.md` and the real code paths.

## Known Bugs

**Hyper terminal launch may not run the script body:**
- Symptoms: Choosing Hyper on macOS may only open the app without injecting the resolved command/script.
- Files: `executor.go` (Hyper `LaunchFn` in `darwinTerminals()`)
- Trigger: `RunInTerminal` with terminal ID `hyper` on darwin.
- Workaround: Use another detected terminal (Terminal, iTerm2, Alacritty, etc.).

**Inline execution assumes `bash` on all platforms:**
- Symptoms: `RunCommand` fails or behaves unexpectedly on Windows if `bash` is not on `PATH` (no use of configured Windows shell for the temp script path).
- Files: `executor.go` (`ExecuteScript` uses `exec.CommandContext(ctx, "bash", tmpPath)`)
- Trigger: Run command on Windows without Git Bash or similar.
- Workaround: Install bash or use “open in terminal” paths that use `cmd`/`wt`/`pwsh`.

## Security Considerations

**Arbitrary shell execution from stored scripts:**
- Risk: Saved commands run as the current user with full host access; malicious or pasted scripts can exfiltrate data or damage the system.
- Files: `executor.go`, `app.go` (`RunCommand`, `RunInTerminal`)
- Current mitigation: Local-only desktop app; user must save and run scripts themselves.
- Recommendations: Optional confirmation for first run of a command; document threat model in user-facing help; avoid fetching remote scripts without explicit user action.

**CEL `env()` in variable defaults reads process environment:**
- Risk: Default expressions can expose environment variable values into resolved defaults and execution display if expressions are shared or exported.
- Files: `executor.go` (`EvalDefaults`, `env` CEL binding)
- Current mitigation: Data stays local; expressions are user-authored in the DB.
- Recommendations: If adding import/sharing of commands, sanitize or document that defaults can read `env("SECRET")`.

**AppleScript / GUI automation for some terminals:**
- Risk: Warp uses keystroke injection via AppleScript (`System Events`), which is brittle and can behave oddly with IME, accessibility permissions, or long payloads.
- Files: `executor.go` (`darwinTerminals`, Warp `LaunchFn`)
- Current mitigation: Other terminal backends use `do script` / `-e` style invocation.
- Recommendations: Prefer APIs that accept script text directly; warn users if Warp is experimental.

## Performance Bottlenecks

**Search loads full command graphs per hit:**
- Problem: After FTS or LIKE search, each result row triggers `loadCommandRelations` (tags, variables, presets, nested queries).
- Files: `db.go` (`SearchCommands`, `searchCommandsLike`, `loadCommandRelations`)
- Cause: Classic N+1 pattern for list/search endpoints.
- Improvement path: Batch-load relations for result IDs, or lazy-load detail when user opens a command.

**Output UI caps visible streaming lines:**
- Problem: Only the last 100 lines render in the output pane during streaming/display (`MAX_DISPLAY_LINES`).
- Files: `frontend/src/components/OutputPane.tsx`
- Cause: Deliberate limit to keep DOM light.
- Improvement path: Virtualized list or “load full output” for completed runs while keeping streaming capped.

**Persisted execution output capped at 8KB:**
- Problem: History records truncate stored stdout/stderr.
- Files: `executor.go` (`maxStoredOutputBytes`)
- Cause: Bounded memory and DB size.
- Improvement path: Configurable cap or spill large outputs to a file referenced from `executions`.

## Fragile Areas

**SQLite schema migrations and FTS:**
- Files: `db.go` (`migrate`, `schema`, `commands_fts` triggers)
- Why fragile: Table recreation must be paired with FTS rebuild and trigger recreation; omissions desync search from data.
- Safe modification: Follow the transaction + rebuild pattern documented in `CLAUDE.md`; bump `schemaVersion` and test upgrade from prior DB files.
- Test coverage: No automated migration tests detected.

**Tab + output pane state in refs:**
- Files: `frontend/src/App.tsx` (refs such as `tabOutputRef`, `tabPaneStateRef`; `applyPaneState` usage)
- Why fragile: Easy to introduce re-render loops or stale output if state is moved to React state incorrectly.
- Safe modification: Keep per-tab ephemeral output in refs; add comments when touching tab lifecycle (`finalizeCloseTab`, `handleSelectTab`).
- Test coverage: None; manual testing required.

**FTS query syntax vs user input:**
- Files: `db.go` (`SearchCommands` passes `query+"*"` into `MATCH ?`)
- Why fragile: FTS5 treats some characters as syntax; errors fall back to LIKE, which can surprise users or hide query bugs.
- Safe modification: Escape or tokenize user queries for FTS, or document supported query grammar.

## Scaling Limits

**Single local SQLite file:**
- Current capacity: Suitable for personal command libraries; WAL mode enabled in `NewDB`.
- Limit: Very large `commands`/`executions` tables slow search and UI list loads without pagination.
- Scaling path: Pagination on `GetCommands`/search, archival of old executions, optional indexes beyond FTS.

**Single-writer assumptions:**
- Current capacity: Typical desktop single-user workload.
- Limit: No explicit mutex around `*sql.DB` in application code (only internal SQLite/WAL handling); concurrent bound calls from Wails could theoretically contend.
- Scaling path: Serialize DB access in Go if concurrent bindings are added.

## Dependencies at Risk

**Wails-generated TypeScript (`wailsjs`):**
- Risk: `frontend/wailsjs/go/models.ts` and runtime typings rely heavily on `any`; refactors on the Go side can desync bindings until `wails generate module` is run.
- Impact: Weaker compile-time safety at the boundary.
- Migration plan: Regenerate after every Go API change; optionally wrap models with stricter hand-written types in `frontend/src/types.ts` (already partially mirrored).

## Missing Critical Features

**Automated tests:**
- Problem: No Go `_test.go` or frontend `*.test.ts(x)` files in the repo for core logic.
- Blocks: Safe refactors of `db.go`, `script.go`, `executor.go`, and tab logic without manual full-app testing.
- Priority: High for migrations and script/variable parsing.

**Uniform shell strategy for inline run:**
- Problem: `NewExecutor` picks `cmd` on Windows for terminal-oriented paths, but `ExecuteScript` always invokes `bash`.
- Blocks: Predictable “Run” behavior on Windows comparable to macOS/Linux.

## Test Coverage Gaps

**Database migrations and FTS:**
- What's not tested: Upgrade paths from older `schema_version` values, FTS rebuild correctness, trigger behavior after table swaps.
- Files: `db.go`
- Risk: User upgrades could corrupt search or fail mid-migration.
- Priority: High

**Script parsing and substitution:**
- What's not tested: `ExtractTemplateVars`, `ReplaceTemplateVars`, `MergeDetectedVars`, edge cases (nested braces, duplicates).
- Files: `script.go`
- Risk: Silent wrong variable sets or unreplaced `{{var}}` in edge cases.
- Priority: Medium

**Executor and terminal launchers:**
- What's not tested: Timeout behavior, stream caps, per-OS quoting, and terminal selection fallbacks.
- Files: `executor.go`
- Risk: Platform-specific regressions (especially Windows and Warp).
- Priority: Medium

**Frontend tab and shortcut flows:**
- What's not tested: Tab dirty state, prev-tab navigation, keyboard shortcuts, and output restoration.
- Files: `frontend/src/App.tsx`, `frontend/src/hooks/useKeyboardShortcuts.ts`
- Risk: Subtle UX regressions after refactors.
- Priority: Medium

---

*Concerns audit: 2026-04-08*
