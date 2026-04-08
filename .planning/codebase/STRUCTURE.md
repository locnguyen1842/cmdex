# Codebase Structure

**Analysis Date:** 2026-04-08

## Directory Layout

```
commamer/
├── main.go                 # Wails entry: embed dist, menus, wails.Run
├── app.go                  # Wails-bound App methods (CRUD, run, settings, search)
├── db.go                   # SQLite schema, migrations, queries, FTS5
├── models.go               # Go domain types for Wails + SQL
├── script.go               # Shebang + {{var}} parse/replace/merge
├── executor.go             # Subprocess execution, CEL defaults, terminals
├── go.mod / go.sum         # Go module (module path: cmdex)
├── wails.json              # Wails project + frontend build commands
├── Makefile                # dev/build/check/clean targets (if present)
├── build/                  # Platform assets (Info.plist, Windows manifest, installer)
├── docs/                   # Project docs, plans, logos
├── frontend/
│   ├── index.html
│   ├── package.json        # pnpm; Vite + React
│   ├── vite.config.ts
│   ├── tsconfig.json       # path alias @/* -> src/*
│   ├── components.json     # shadcn/ui config
│   ├── dist/               # Production build output (embedded by Go)
│   ├── wailsjs/            # Generated Wails bindings + runtime (do not treat as hand-authored)
│   └── src/
│       ├── main.tsx        # React bootstrap
│       ├── App.tsx         # Root state, tabs, modals, bindings
│       ├── types.ts        # TS mirrors of Go models + tab helpers
│       ├── i18n.ts
│       ├── style.css       # Tailwind v4 / theme variables
│       ├── locales/        # e.g. en.json
│       ├── components/     # Feature + ui/
│       ├── hooks/
│       ├── lib/            # e.g. utils.ts, shortcuts.ts
│       └── utils/
├── .claude/                # Claude Code / GSD workflows (not app runtime)
└── .planning/              # Planning artifacts (this folder)
```

## Directory Purposes

**Repository root (`*.go`):**

- Purpose: Entire Go backend and Wails binding surface in one module.
- Contains: Six Go source files only — no `internal/` or `pkg/` split.
- Key files: `main.go`, `app.go`, `db.go`, `executor.go`, `script.go`, `models.go`

**`build/`:**

- Purpose: OS-specific packaging assets for Wails (macOS plist, Windows manifest, NSIS installer project).
- Contains: `build/darwin/`, `build/windows/`, etc.

**`frontend/`:**

- Purpose: Vite + React + TypeScript UI; output in `frontend/dist` consumed by `//go:embed` in `main.go`.
- Contains: Source under `src/`, tooling config, `wailsjs` generated output.
- Key files: `frontend/src/App.tsx`, `frontend/src/main.tsx`, `frontend/vite.config.ts`, `frontend/package.json`

**`frontend/src/components/`:**

- Purpose: Screen-level feature components and shared UI primitives.
- Contains: `Sidebar.tsx`, `CommandDetail.tsx`, `TabBar.tsx`, `OutputPane.tsx`, `SettingsDialog.tsx`, `CommandPalette.tsx`, etc., plus `ui/` (Radix-based shadcn-style components).

**`frontend/src/components/ui/`:**

- Purpose: Reusable primitives (button, dialog, input, scroll-area, tooltip, kbd, etc.).
- Contains: One component per file, CVA + Radix patterns.

**`frontend/wailsjs/`:**

- Purpose: Auto-generated bridge to Go (`go/main/App`) and Wails runtime (`runtime`).
- Generated: Yes — regenerate after Go API changes.

**`docs/`:**

- Purpose: Human-written documentation and design plans; not imported by the app binary.

## Key File Locations

**Entry Points:**

- `main.go`: Desktop process and Wails configuration.
- `frontend/src/main.tsx`: React DOM root.

**Configuration:**

- `wails.json`: Wails CLI integration (pnpm install/build/dev).
- `frontend/tsconfig.json`: TypeScript + `@/*` paths.
- `frontend/components.json`: shadcn/ui paths and style.

**Core Logic:**

- `app.go`: All methods exposed to the frontend.
- `db.go`: Persistence and search.
- `executor.go`: Running scripts and evaluating variable defaults.
- `script.go`: Template variable mechanics.

**Frontend orchestration:**

- `frontend/src/App.tsx`: Tabs, data loading, execution flow, `EventsOn` subscriptions.
- `frontend/src/hooks/useKeyboardShortcuts.ts`: Global shortcuts (uses `lib/shortcuts.ts`).

**Shared TS utilities:**

- `frontend/src/utils/tabDraft.ts`: Tab draft/baseline for commands.
- `frontend/src/utils/templateVars.ts`: Variable merging for UI.

**Testing:**

- Not detected in application source — no `*_test.go` or `*.test.ts` in the mapped tree (per project docs).

## Naming Conventions

**Files:**

- Go: `lowercase.go` for multi-word concepts (`app.go`, `db.go`, not `App.go`).
- React components: `PascalCase.tsx` (`CommandDetail.tsx`, `Sidebar.tsx`).
- UI primitives: `kebab-case` or single word matching shadcn (`alert-dialog.tsx`, `scroll-area.tsx`).

**Directories:**

- `frontend/src/components/ui/`: lowercase folder for design-system subset.
- `utils/`, `hooks/`, `lib/`: lowercase plural or conventional singleton (`lib`).

**Symbols:**

- Go exported types: `PascalCase` (`Category`, `VariableDefinition`).
- Wails-bound methods: `PascalCase` matching generated TS (`GetCategories`, `RunCommand`).
- React components: `PascalCase` function components.

## Where to Add New Code

**New Wails API or backend behavior:**

- Add method on `App` in `app.go`; implement persistence in `db.go` if needed; extend `models.go`.
- Run `wails generate module` (or `wails dev`) and update `frontend/src/types.ts` + call sites in `App.tsx` or components.

**New UI screen or major section:**

- Primary component: `frontend/src/components/<Name>.tsx`
- Wire state and handlers: `frontend/src/App.tsx` (or lift props from `App.tsx` if keeping pattern).

**New script/template helper (no I/O):**

- `script.go` (pure functions) or `executor.go` if tied to execution/CEL.

**Shared frontend helper:**

- Cross-cutting hooks: `frontend/src/hooks/`
- Non-React helpers: `frontend/src/utils/` or `frontend/src/lib/` (match existing import style: `@/components/...` vs relative `../wailsjs/...`)

**Database schema change:**

- `db.go`: bump `schemaVersion`, add transactional migration, rebuild FTS if `commands` changes (see `CLAUDE.md` migration pattern).

## Special Directories

**`frontend/dist/`:**

- Purpose: Vite production build consumed by Go embed.
- Generated: Yes (via `pnpm run build`).
- Committed: Typically no — build artifact; required before `wails build` if not using pipeline that builds it.

**`frontend/wailsjs/`:**

- Purpose: Generated bindings.
- Generated: Yes.
- Committed: Often yes in Wails projects for CI; treat as derived from `app.go`.

**`.planning/`:**

- Purpose: Planning and codebase map docs for GSD / agents.
- Generated: Partially (by workflows).
- Committed: Per team preference.

---

*Structure analysis: 2026-04-08*
