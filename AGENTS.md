# Agents documentation

**Cmdex** — cross-platform desktop app for saving and executing CLI commands with `{{variable}}` placeholders.

Stack: Go + Wails **v3** + React 19 + Vite + TypeScript + SQLite (`modernc.org/sqlite`).

## Essential Commands

```bash
# Development (auto-restarts on Go changes, HMR on frontend)
wails3 dev                              # or: make dev  or: task dev

# Regen frontend bindings after Go service changes
wails3 generate build-assets

# Production build
wails3 build                            # or: make build  or: task build

# Full checks (run before committing)
make check                              # go build ./... && cd frontend && pnpm tsc --noEmit

# Frontend lint + fix
cd frontend && pnpm lint                # pnpm lint:fix for auto-fix

# Go tests (db_test.go only, no frontend tests yet)
go test ./...                           # go test -run TestFreshDBMigrations -v ./...
```

**Note:** The Makefile targets `make dev/build/check` exist. The Taskfile (`task dev`, `task build`) provides more options (Docker cross-compile, server mode). Both call `wails3` under the hood.

## Architecture (Wails v3)

### Service registration (not the old v2 single-App pattern)

In `main.go`, six services are registered as `application.Service`:

| Service struct | File | Frontend binding import |
|---|---|---|
| `App` | `app.go` | `../bindings/cmdex/app` |
| `CommandService` | `command_service.go` | `../bindings/cmdex/commandservice` |
| `ExecutionService` | `execution_service.go` | `../bindings/cmdex/executionservice` |
| `SettingsService` | `settings_service.go` | `../bindings/cmdex/settingsservice` |
| `ImportExportService` | `importexport_service.go` | `../bindings/cmdex/importexportservice` |
| `EventService` | `event_service.go` | `../bindings/cmdex/eventservice` |

Each service is a struct implementing `ServiceStartup(ctx, options) error`. Wails generates TypeScript bindings from exported methods into `frontend/bindings/cmdex/<servicename>/`. **Never hand-edit `frontend/bindings/`** — it's generated output.

### Adding a new feature

1. Add/update the method on the relevant service struct (or create a new service).
2. If a new service, register it in `main.go` `Services` slice.
3. Run `wails3 dev` (or `wails3 generate build-assets`) to regenerate `frontend/bindings/`.
4. Import the generated function in your React code:
   ```ts
   import { SomeMethod } from '../bindings/cmdex/servicename';
   ```
5. Update TS types in `frontend/src/types.ts` and call sites in `App.tsx` or components.

### Adding a new field to Command or Category

1. Update the struct in `models.go`.
2. Update SQL schema (add migration in `migrations/` package if persistent; or bump version + update `db.go` schema DDL).
3. Update `db.go` CRUD queries and scan helpers.
4. Update the service method signatures in the relevant `*_service.go` file.
5. Run `wails3 dev` to regenerate bindings.
6. Update TypeScript types in `frontend/src/types.ts`.
7. Update `CommandDetail.tsx` / `CommandDetailTab.tsx` or `CategoryEditor.tsx`.
8. Update `App.tsx` where the create/update calls are made.

### Event system

Events bridge Go and the frontend. Event names are defined in `event_service.go` (`EventNames` struct) and consumed in the frontend via `@wailsio/runtime`:

```ts
import { Events } from '@wailsio/runtime';
Events.On('cmd-output', handler);
```

Frontend fallback/initialization in `frontend/src/wails/events.ts`. Streaming execution output uses `cmd-output` events batched with `requestAnimationFrame`.

## Key Files & Responsibilities

| File | Purpose |
|---|---|
| `main.go` | Entry point, service registration, native menus, window config |
| `app.go` | App lifecycle (`ServiceStartup`/`Shutdown`), settings window management; `db` and `executor` are package-level vars initialized here |
| `command_service.go` | Category + Command CRUD bound methods |
| `execution_service.go` | `RunCommand`, `RunInTerminal`, `GetVariables`, execution history |
| `settings_service.go` | `GetSettings`, `SetSettings` |
| `importexport_service.go` | Import/export commands, theme templates |
| `event_service.go` | `GetEventNames` — exposes event name strings to frontend |
| `db.go` | SQLite access, schema DDL, migrations runner, FTS5 search, all SQL queries |
| `models.go` | Go domain types for Wails/JSON and SQL scanning |
| `script.go` | `{{var}}` parsing, shebang wrapping, template substitution (pure functions) |
| `executor.go` | Subprocess execution, temp scripts, CEL default evaluation, terminal detection/launch |
| `migrations/` | Versioned migration files (`0001_initial.go` … `0010_working_dir.go`), `migration.go` defines the ordered `Migrations` slice |
| `frontend/src/App.tsx` | Central state: tabs, modals (discriminated union `ModalState`), data loading, event subscriptions |
| `frontend/src/types.ts` | TS mirrors of Go domain types |
| `frontend/src/utils/tabDraft.ts` | Tab draft/baseline state and dirty comparison |
| `frontend/src/utils/templateVars.ts` | Variable detection and merging for UI |
| `frontend/src/hooks/useKeyboardShortcuts.ts` | Global keyboard shortcuts |

## Data & Storage

- SQLite at `~/.cmdex/cmdex.db`, opened with WAL + foreign keys enabled.
- Commands use `{{variableName}}` template syntax (double braces).
- Variables auto-detected from `{{var}}` patterns; can also be added manually.
- Variable defaults support CEL expressions: `now()`, `env("KEY")`, `date("2006-01-02")`.
- Scripts stored with `#!/bin/bash` shebang; editor shows the body without it.
- `commands.category_id` is nullable + `ON DELETE SET NULL` (deleting a category uncategorizes its commands).

## Schema Migrations

- `migrations/` package contains versioned migration files.
- `db.go` runs migrations via `migrations.Migrations` slice (version order matters — version 4 was intentionally merged into 5).
- Adding a migration: create `migrations/NNNN_description.go`, define a `Migration` struct, append to `Migrations` slice in `migration.go`.
- After changing schema, delete `~/.cmdex/cmdex.db` during dev (or the migration handles the upgrade if you wrote it).

## Gotchas

- `wails3 generate build-assets` replaces the old `wails generate module` — if you don't see new methods, make sure you ran this.
- `category_id` in commands is nullable — use `sql.NullString` for Go scanning; `NULL` means uncategorized.
- `frontend/tsconfig.json` has `strict: false`. Don't assume strict-mode enforcement.
- Mixed punctuation in frontend: `App.tsx` and most components use semicolons + single quotes; `ui/` components use double quotes + no semicolons. Match the file you're editing.
- Per-tab execution output is stored in refs (`tabOutputRef`, `tabPaneStateRef`) not React state — using state causes re-render loops. Restore with `applyPaneState(tabId)` on tab switch.
- Themes use CSS variables in `frontend/src/style.css` — modify variables, not hardcoded colors.
- The output pane does not support interactive shells or full ANSI rendering.

## Tests

- Go: `db_test.go` — three migration tests (`TestFreshDBMigrations`, `TestExistingDBIdempotent`, `TestRollbackTo`). Run with `go test ./...`.
- No frontend tests exist yet.
- `make check` and CI run `go build ./...` + `pnpm tsc --noEmit` only.

## References

- `docs/` — Human-authored docs: GETTING-STARTED.md, DEVELOPMENT.md, ARCHITECTURE.md, CONFIGURATION.md, DEPLOYMENT.md, TESTING.md, API.md
- `.planning/codebase/` — Auto-generated analysis: ARCHITECTURE.md, STACK.md, CONVENTIONS.md, CONCERNS.md, INTEGRATIONS.md, STRUCTURE.md, TESTING.md
- `CLAUDE.md` — Additional agent context (some sections may lag behind Wails v3 migration)
