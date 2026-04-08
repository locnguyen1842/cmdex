# Technology Stack

**Analysis Date:** 2026-04-08

## Languages

**Primary:**

- **Go** (toolchain `1.25.0` per `go.mod`) — Wails backend, SQLite access, script execution, CEL evaluation, OS terminal integration (`main.go`, `app.go`, `db.go`, `executor.go`, `script.go`, `models.go`).
- **TypeScript** (`typescript` `^5.9.3` in `frontend/package.json`) — React UI and Wails-generated bindings under `frontend/wailsjs/`.
- **JSON** — i18n resources (`frontend/src/locales/en.json`).

**Secondary:**

- **CSS** — Tailwind v4–driven styling via `frontend/src/style.css` and `@tailwindcss/vite`.

## Runtime

**Environment:**

- **Go** `1.25.0` — declared in `go.mod`; CI pins `go-version: '1.25'` in `.github/workflows/ci.yml` and `.github/workflows/release.yml`.
- **Node.js** — CI uses Node `25` / `25.x` (see `.github/workflows/ci.yml`, `.github/workflows/release.yml`); no `.nvmrc` in repo.

**Package Manager:**

- **pnpm** — frontend installs and Wails hooks (`wails.json`: `frontend:install`: `pnpm install`).
- Lockfile: `frontend/pnpm-lock.yaml` (present).

## Frameworks

**Core:**

- **Wails v2** (`github.com/wailsapp/wails/v2` `v2.11.0` in `go.mod`) — desktop shell, asset server embedding `frontend/dist` (`//go:embed all:frontend/dist` in `main.go`), Go↔JS bindings (`wails generate module` → `frontend/wailsjs/go/main/App.ts`).
- **React** `^19.2.4` + **React DOM** `^19.2.4` — UI in `frontend/src/` (entry `frontend/src/main.tsx`, root `frontend/src/App.tsx`).
- **Vite** `^7.3.1` with `@vitejs/plugin-react` `^5.1.4` — dev server and production bundle (`frontend/vite.config.ts`).

**Testing:**

- Not applicable — no Go test files or frontend `*.test.*` / `*.spec.*` files; `Makefile` `check` runs `go build ./...` and `pnpm tsc --noEmit` only.

**Build/Dev:**

- **Wails CLI** — `wails dev`, `wails build`, `wails generate module` (documented in `Makefile`, `CLAUDE.md`).
- **TypeScript compiler** — `frontend` build script: `tsc && vite build` (`frontend/package.json`).
- **GitHub Actions** — `dAppCore/build/actions/build/wails2@v4.0.0` for matrix desktop builds (`.github/workflows/ci.yml`, `.github/workflows/release.yml`).

## Key Dependencies

**Critical (Go, direct `require` in `go.mod`):**

- `github.com/wailsapp/wails/v2` `v2.11.0` — application framework and desktop integration.
- `modernc.org/sqlite` `v1.47.0` — pure-Go SQLite driver (imported in `db.go` as `_ "modernc.org/sqlite"`).
- `github.com/google/cel-go` `v0.27.0` — CEL for variable default expressions in `executor.go`.
- `github.com/google/uuid` `v1.6.0` — ID generation for domain entities.

**Critical (frontend, `dependencies` in `frontend/package.json`):**

- `radix-ui` / `@radix-ui/react-slot` — accessible primitives (shadcn-style components under `frontend/src/components/ui/`).
- `@tailwindcss/vite` + `tailwindcss` `^4.2.1` — styling pipeline.
- `i18next` + `react-i18next` — localization wired in `frontend/src/i18n.ts`.
- `@dnd-kit/core`, `@dnd-kit/sortable`, `@dnd-kit/utilities` — drag-and-drop in the UI.
- `cmdk` — command palette patterns.
- `sonner` — toasts.
- `lucide-react` — icons (aligned with `frontend/components.json` `iconLibrary`).

**Infrastructure (indirect, notable):**

- Wails pulls **Echo**, **go-webview2** (Windows), **godbus** (Linux), **gorilla/websocket**, and other platform helpers — transitive in `go.mod`, not referenced directly from app packages.

## Configuration

**Environment:**

- No `VITE_*` or `process.env` usage detected in `frontend/src` TypeScript/TSX.
- Runtime data path is derived from `os.UserHomeDir()` in `db.go` (not environment variables).

**Build:**

- **Wails:** `wails.json` — app name `cmdex`, output `cmdex`, pnpm frontend scripts.
- **Vite:** `frontend/vite.config.ts` — React + Tailwind plugins, path alias `@` → `frontend/src`.
- **TypeScript:** `frontend/tsconfig.json` — `strict: false`, `paths` `@/*` → `./src/*`; `frontend/tsconfig.node.json` for tooling.
- **UI generator metadata:** `frontend/components.json` — shadcn schema, New York style, aliases for `@/components`, `@/lib`.

**Go module:** `go.mod` / `go.sum` at repo root (`module cmdex`).

## Platform Requirements

**Development:**

- Go matching `go.mod` (1.25.x).
- Wails v2 CLI (see project docs in `CLAUDE.md`).
- Node.js compatible with CI (25.x) and pnpm.
- macOS / Linux / Windows for full parity with terminal-launch paths in `executor.go`.

**Production:**

- Desktop targets built via Wails; artifacts produced by local `wails build` or GitHub Actions release workflow (`.github/workflows/release.yml`).

---

*Stack analysis: 2026-04-08*
