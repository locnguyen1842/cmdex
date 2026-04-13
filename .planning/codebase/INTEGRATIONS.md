# External Integrations

**Analysis Date:** 2026-04-08

## APIs & External Services

**Third-party HTTP / SaaS APIs:**

- Not detected — the application does not call remote REST/GraphQL APIs from application code under review. There is no `fetch` usage in `frontend/src`; generated `frontend/wailsjs/runtime/runtime.d.ts` exposes `BrowserOpenURL`, but usage in `frontend/src` is limited to Wails `EventsOn` from `frontend/wailsjs/runtime/runtime` (see `frontend/src/App.tsx`).

**Local / in-process:**

- **Wails runtime events** — Go emits and frontend subscribes (e.g. `wailsruntime.EventsEmit` in `main.go` for `open-settings`; streaming execution uses patterns in `app.go` / `executor.go` with frontend listeners). This is the primary app “integration surface” between layers, not an external network service.

## Data Storage

**Databases:**

- **SQLite** (file-backed, local only)
  - Driver: `modernc.org/sqlite` (pure Go), opened in `db.go` via `sql.Open("sqlite", ...)`.
  - Path: `~/.cmdex/cmdex.db` inside directory `~/.cmdex/` created in `NewDB()` (`db.go`).
  - Connection string enables foreign keys and WAL: `_pragma=foreign_keys(1)&_pragma=journal_mode(wal)` (`db.go`).
  - **FTS5** virtual table `commands_fts` and sync triggers defined in `db.go` schema for full-text search on commands.

**File Storage:**

- Local filesystem only — user home `.cmdex/` for the database; temporary script files from `os.CreateTemp` in `executor.go` (`writeTempScript`).

**Caching:**

- None as a separate service — SQLite WAL and in-memory app state only.

## Authentication & Identity

**Auth Provider:**

- Not applicable — single-user desktop app with no login, OAuth, or session store. No auth-related dependencies in `go.mod` or `frontend/package.json`.

## Monitoring & Observability

**Error Tracking:**

- None detected (no Sentry, Rollbar, etc. in manifests or imports).

**Logs:**

- Standard output / Wails behavior; `main.go` prints fatal Wails errors with `println`. No structured logging package in direct `go.mod` requires.

## CI/CD & Deployment

**Hosting:**

- Not a hosted web app — desktop binaries built in CI and (on tag) released via `.github/workflows/release.yml`.

**CI Pipeline:**

- **GitHub Actions** — `.github/workflows/ci.yml` (typecheck + multi-OS Wails build check), `.github/workflows/release.yml` (tag or manual dispatch builds).
- **Reusable build action:** `dAppCore/build/actions/build/wails2@v4.0.0` with `wails-version: 'v2.11.0'`, `build-name: cmdex`, matrix OS/platform.

## Environment Configuration

**Required env vars:**

- None for core app operation — database path is derived from the user home directory (`db.go`).

**Secrets location:**

- Not applicable for runtime; GitHub Actions uses default `GITHUB_TOKEN` for release permissions (`permissions: contents: write` in `.github/workflows/release.yml`). No `.env` pattern in application source.

## Webhooks & Callbacks

**Incoming:**

- None — not a network server product.

**Outgoing:**

- None for HTTP webhooks. **OS subprocess integration** is used instead: `os/exec` runs `bash` for scripts (`executor.go`), `cmd` on Windows, and launches terminal emulators (e.g. `osascript` on macOS, `gnome-terminal` / `wt` etc. per `executor.go`).

## Expression & Template Engine (local)

**CEL (Common Expression Language):**

- `github.com/google/cel-go` evaluates variable default expressions locally in `executor.go` (no external CEL service).

**Command templates:**

- `{{var}}` placeholder handling in `script.go` (`ExtractTemplateVars`, `ReplaceTemplateVars`, etc.) — purely local string processing.

---

*Integration audit: 2026-04-08*
