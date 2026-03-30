# CLAUDE.md

## Project Overview

Cmdex is a cross-platform desktop app for saving, organizing, and executing CLI commands as bash scripts with dynamic variable arguments. Built with Go + Wails v2 (backend/desktop) and React + TypeScript + Vite (frontend).

Data is stored locally in a SQLite database at `~/.cmdex/cmdex.db` using `modernc.org/sqlite` (pure Go, no CGo).

## Prerequisites

- Go 1.23+
- [Wails v2 CLI](https://wails.io/docs/gettingstarted/installation) (`go install github.com/wailsapp/wails/v2/cmd/wails@latest`)
- Node.js with pnpm (frontend package manager, configured in `wails.json`)

## Commands

```bash
# Development (hot-reloads frontend, restart needed for Go changes)
wails dev                 # or: make dev

# Production build (output: build/bin/)
wails build               # or: make build

# Regenerate TypeScript bindings after Go changes (also happens on wails dev)
wails generate module     # or: make generate

# Type-check Go and TypeScript
make check                # runs: go build ./... && cd frontend && pnpm tsc --noEmit

# Clean build artifacts
make clean                # removes build/bin/ and frontend/dist/

# Frontend dependencies (pnpm required)
cd frontend && pnpm install
```

**No tests exist yet** — there are no Go or frontend test files in this project.

## Architecture

### Wails Bindings (Go <-> Frontend)

The `App` struct in `app.go` exposes methods to the frontend. Wails auto-generates TypeScript bindings at `frontend/wailsjs/go/main/App.ts`. To add a backend feature:
1. Add a method to `App` in `app.go`
2. Run `wails dev` or `wails generate module` to regenerate bindings
3. Import the generated function in React: `import { MyMethod } from '../wailsjs/go/main/App'`

### Backend (Go)

- **`main.go`** - Entry point, Wails window config, native menu setup
- **`app.go`** - `App` struct with all bound methods (CRUD for categories/commands/presets, execution, search, settings)
- **`models.go`** - Data types: `Category`, `Command`, `VariableDefinition`, `VariablePreset`, `ExecutionRecord`, `AppSettings`
- **`db.go`** - SQLite database layer with schema migrations, FTS5 full-text search, normalized tables (categories, commands, tags, variable_definitions, variable_presets, executions, app_settings)
- **`script.go`** - Script generation (`GenerateScript`), body extraction (`ParseScriptBody`), `{{var}}` template extraction (`ExtractTemplateVars`), replacement (`ReplaceTemplateVars`), and variable merging (`MergeDetectedVars`)
- **`executor.go`** - Script execution via temp files (`os/exec`), streaming output via Wails events (`cmd-output`), terminal emulator detection/launch, CEL expression evaluation for variable defaults (supports `now()`, `env()`, `date()`)

Scripts are stored with `{{variableName}}` template placeholders. At execution time, `{{var}}` placeholders are replaced with user-provided values, written to a temp file, and executed with `bash <tmpfile>`. Variables are auto-detected from `{{var}}` patterns in the script body and can also be added manually.

Platform-aware shell: uses `$SHELL -lc` on Unix (falls back to `/bin/sh`), `cmd /C` on Windows.

### Frontend (React + TypeScript)

- **`App.tsx`** - Central state management; all modals controlled via discriminated union `ModalState` type
- **`types.ts`** - TypeScript interfaces mirroring Go models in `models.go`
- **`i18n.ts`** - i18next setup; translations in `src/locales/en.json`
- **UI components** in `src/components/`: `Sidebar`, `CommandDetail`, `CommandEditor`, `CategoryEditor`, `VariablePrompt`, `HistoryPane`, `OutputPane`, `SettingsDialog`
- **shadcn/ui components** in `src/components/ui/` (Radix UI + Tailwind CSS + CVA)
- Styling: Tailwind CSS v4 with custom CSS variables in `style.css` for the dark theme (`--bg-primary`, `--accent-primary`, etc.)

Streaming output: Go emits `cmd-output` Wails events -> frontend buffers with `requestAnimationFrame` -> renders in `OutputPane`.

### Adding a New Field to Command or Category

1. Update struct in `models.go`
2. Update schema and queries in `db.go`
3. Update method signatures in `app.go`
4. Run `wails generate module` to regenerate bindings
5. Update TypeScript interfaces in `frontend/src/types.ts`
6. Update the relevant editor component (`CommandEditor.tsx` or `CategoryEditor.tsx`)
7. Update calls in `App.tsx`

## Key Design Decisions

- Commands use `{{variableName}}` template syntax for variables (e.g., `echo "Hello {{name}}"`)
- Variables are auto-detected from `{{var}}` patterns in the script body, and can also be added manually
- At execution time, `{{var}}` placeholders are replaced with user values via simple string substitution
- Variable defaults support CEL expressions (Google Common Expression Language) with custom functions: `now()`, `env("KEY")`, `date("2006-01-02")`
- Scripts are stored with a `#!/bin/bash` shebang; the editor shows/edits the body without the shebang
- Commands can have named presets (saved sets of variable values)
- SQLite with FTS5 for full-text search on title, description, and script content
- Foreign keys with ON DELETE CASCADE for referential integrity
- Exception: `commands.category_id` uses `ON DELETE SET NULL` (deleting a category uncategorizes its commands rather than deleting them)
- Theme colors use CSS variables - modify those rather than hardcoding colors
- The output panel does not support interactive shells or full ANSI color rendering
- `wails generate module` warnings about `Not found: time.Time` are normal and expected — Wails serializes `time.Time` as strings

## Gotchas

- `category_id` in `commands` table is nullable (`NULL` = uncategorized). Use `nullableString()` helper when inserting/updating, and `sql.NullString` when scanning.
- After changing Go structs or method signatures, delete `~/.cmdex/cmdex.db` if schema changed, or bump `schemaVersion` and add migration in `db.go`
- Schema migrations must recreate tables (SQLite doesn't support `ALTER COLUMN`) — see v1->v2 migration pattern in `db.go`
- Schema migrations must be wrapped in transactions to prevent partial failures leaving DB inconsistent
- `wails build` requires `frontend/dist` to exist — run `cd frontend && pnpm build` first, or use `wails dev` which handles it
- When changing script storage format, delete `~/.cmdex/cmdex.db` to reset
- `RenameCommand` is a separate metadata-only DB method — don't re-process scripts through `UpdateCommand` just to change the title
