# Coding Conventions

**Analysis Date:** 2026-04-08

## Naming Patterns

**Go — files and packages:**

- Application code lives in package `main` at the repo root: `app.go`, `db.go`, `executor.go`, `main.go`, `models.go`, `script.go`.
- Exported types and methods use **PascalCase** (Wails-bound API surface): e.g. `Category`, `Command`, `GetCategories`, `CreateCommand` in `app.go`.
- Unexported helpers use **camelCase**: e.g. `writeTempScript` in `executor.go`.
- JSON field names for Wails/frontend use **camelCase** struct tags on models in `models.go` (e.g. `json:"categoryId"`, `json:"scriptContent"`).

**TypeScript/React — files:**

- Root entry: `frontend/src/main.tsx`, app shell `frontend/src/App.tsx`.
- Feature components: **PascalCase** filenames under `frontend/src/components/` (e.g. `CommandDetail.tsx`, `TabBar.tsx`).
- shadcn-style UI primitives: **kebab-case** under `frontend/src/components/ui/` (e.g. `alert-dialog.tsx`, `toggle-group.tsx`).
- Hooks: **camelCase** with `use` prefix in `frontend/src/hooks/` (e.g. `useKeyboardShortcuts.ts`).
- Shared utilities: `frontend/src/utils/` (`tabDraft.ts`, `templateVars.ts`).
- Library helpers: `frontend/src/lib/` (`utils.ts`, `shortcuts.ts`).
- Global types: `frontend/src/types.ts`; i18n setup: `frontend/src/i18n.ts`.

**TypeScript — symbols:**

- Interfaces and component names: **PascalCase** (`Command`, `Category`, `ModalState` in `App.tsx`).
- Functions and variables: **camelCase** (`getCommandDisplayTitle`, `emptyDraft`, `isNewCommandTabId`).
- Constants: **SCREAMING_SNAKE_CASE** where used for shortcut registry keys in `frontend/src/lib/shortcuts.ts` (re-exported via `useKeyboardShortcuts`).

## Code Style

**Go:**

- Standard **gofmt** layout (tabs for indentation). No project-local `golangci-lint` or `.editorconfig` detected.
- Module path: `cmdex` in `go.mod`; Go **1.25.0** as declared there.

**TypeScript/JavaScript:**

- **TypeScript** with `frontend/tsconfig.json`: `strict` is **false**; `forceConsistentCasingInFileNames` is true.
- **Mixed punctuation style**: root `App.tsx` and many components use semicolons and often single quotes; `frontend/src/components/ui/button.tsx` and `frontend/src/lib/utils.ts` use double quotes and omit semicolons. New code should match the file you are editing.
- **Build**: `frontend/package.json` runs `tsc && vite build` for production; type-check only via `pnpm tsc --noEmit` (see `Makefile` `check` target).

**CSS:**

- Tailwind CSS v4 via `@tailwindcss/vite` in `frontend/vite.config.ts`; theme tokens live in `frontend/src/style.css` (CSS variables for dark theme).

## Import Organization

**Observed in `frontend/src/App.tsx` (prescriptive order for large files):**

1. React hooks from `react`
2. Third-party (e.g. `react-i18next`, `sonner`)
3. Relative imports: `./style.css`, `./components/...`, `./hooks/...`
4. Path alias `@/components/ui/...` and `@/lib/...` where applicable
5. Wails runtime: `../wailsjs/runtime/runtime`
6. Wails-generated bindings: `../wailsjs/go/main/App`
7. Local modules: `./types`, `./utils/...`, `./i18n`

**Path aliases:**

- `@/*` maps to `frontend/src/*` in both `frontend/tsconfig.json` and `frontend/vite.config.ts`.

**Go imports:**

- Standard library first, then blank line, then third-party (e.g. `github.com/google/uuid`, `github.com/wailsapp/wails/v2/...`, `modernc.org/sqlite` side-effect in `db.go`).

## Error Handling

**Go:**

- Wails startup failures: `wailsruntime.LogFatal` in `app.go` `startup` when DB init fails.
- Many read-style bound methods **log with `fmt.Println` and return empty slices** on DB error (e.g. `GetCategories`, `GetCommands` in `app.go`) instead of surfacing `error` to the frontend.
- Mutations and creates typically **return `(T, error)` or `error`** and propagate DB errors (e.g. `CreateCategory`, `DeleteCategory`).
- Executor paths: return `ExecutionResult` with `Error` string and exit code (e.g. `ExecuteScript` in `executor.go`).

**TypeScript:**

- Async Wails calls use `.then` / `.catch` or try/catch patterns in UI code; user feedback often via `toast` from `sonner` (see imports in `App.tsx`).

## Logging

**Go:** `fmt.Println` for some operational errors in `app.go`; Wails `LogFatal` for fatal startup. No structured logging package in `go.mod`.

**Frontend:** Browser console and toast notifications for user-visible outcomes; no dedicated logging library in `frontend/package.json`.

## Comments

**When to comment:**

- Section banners in `app.go` (`// ========== Category Operations ==========`) organize large binding files.
- Doc comments on exported Go symbols where relevant (e.g. `// App struct holds application state`).
- JSDoc-style blocks on non-obvious hooks (e.g. `useKeyboardShortcuts` behavior in `frontend/src/hooks/useKeyboardShortcuts.ts`).

**JSDoc/TSDoc:** Used sparingly; prefer short comments for behavior that depends on focus/capture or Wails event contracts.

## Function Design

**Go:**

- `App` methods are thin orchestration over `DB` and `Executor`; SQL and migrations concentrated in `db.go`.
- Script/template logic in `script.go`; CEL evaluation in `executor.go`.

**TypeScript:**

- Large central state and tab/modal logic in `App.tsx`; presentational and focused logic in components under `frontend/src/components/`.
- Custom hooks encapsulate keyboard and shortcut concerns (`frontend/src/hooks/useKeyboardShortcuts.ts`).

## Module Design

**Exports:**

- React components: default export for page-level components (`Sidebar`, `CommandDetail`, etc.); named exports where multiple symbols are shared (e.g. `Tab` from `TabBar.tsx`).
- `frontend/src/lib/utils.ts` exports `cn` for class merging (shadcn pattern).

**Barrel files:** Not used project-wide; import components by direct path.

---

*Convention analysis: 2026-04-08*
