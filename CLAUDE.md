# CLAUDE.md

## Project Overview

Commamer is a cross-platform desktop app for saving, organizing, and executing CLI commands with dynamic variable placeholders (`${varName}`). Built with Go + Wails v2 (backend/desktop) and React + TypeScript + Vite (frontend).

Data is stored locally in `~/.commamer/data.json` (categories/commands/settings) and `~/.commamer/executions.json` (execution history, capped at 100 records).

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
- **`models.go`** - Data types: `Category`, `Command`, `VariableDefinition`, `VariablePreset`, `ExecutionRecord`, `AppSettings`, `AppData`
- **`store.go`** - JSON file persistence with `sync.Mutex` thread safety
- **`executor.go`** - Command execution (`os/exec`), variable parsing (`${var}` regex), streaming output via Wails events (`cmd-output`), terminal emulator detection/launch, CEL expression evaluation for variable defaults (supports `now()`, `env()`, `date()`)

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
2. Update method signatures in `app.go`
3. Update TypeScript interfaces in `frontend/src/types.ts`
4. Update the relevant editor component (`CommandEditor.tsx` or `CategoryEditor.tsx`)
5. Update calls in `App.tsx`

## Key Design Decisions

- Variable placeholders use `${varName}` syntax (regex: `\$\{(\w+)\}`)
- Variable defaults support CEL expressions (Google Common Expression Language) with custom functions: `now()`, `env("KEY")`, `date("2006-01-02")`
- Commands can have named presets (saved sets of variable values)
- Theme colors use CSS variables - modify those rather than hardcoding colors
- The output panel does not support interactive shells or full ANSI color rendering
