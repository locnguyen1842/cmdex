---
phase: 260413-gac
plan: 01
subsystem: settings-persistence
tags: [settings, sqlite, localstorage-migration, go, react, typescript]
dependency_graph:
  requires: []
  provides: [settings-in-sqlite]
  affects: [app.go, db.go, models.go, App.tsx, SettingsDialog.tsx]
tech_stack:
  added: []
  patterns: [settingsRef + flushSettings pattern for DB-backed settings persistence]
key_files:
  created: []
  modified:
    - models.go
    - db.go
    - app.go
    - frontend/wailsjs/go/main/App.js
    - frontend/wailsjs/go/main/App.d.ts
    - frontend/wailsjs/go/models.ts
    - frontend/src/App.tsx
    - frontend/src/components/SettingsDialog.tsx
decisions:
  - settingsRef pattern chosen over passing full settings as args at every call site to avoid stale closures
  - flushSettings() is a plain function (not useCallback) so it always reads from settingsRef without closure capture
  - SettingsDialog.handleSave calls GetSettings() first then merges to preserve non-locale/terminal fields without requiring App to pass down the full settings state
  - One-time migration: migrateField() prefers localStorage value over DB default on first run, then clears all 7 keys
metrics:
  duration: ~10 minutes
  completed: 2026-04-13
  tasks_completed: 2
  files_changed: 8
---

# Phase 260413-gac Plan 01: Migrate Settings from localStorage to SQLite Summary

Settings (theme, fonts, density, custom themes, last dark/light theme) migrated from localStorage to SQLite app_settings table. DB-backed persistence via settingsRef + flushSettings pattern; one-time localStorage migration on first run.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Extend AppSettings in Go and add DB migration v8 | 49166f9 | models.go, db.go, app.go, wailsjs bindings |
| 2 | Migrate frontend from localStorage to GetSettings/SetSettings | 71cd27a | App.tsx, SettingsDialog.tsx |

## What Was Built

**Task 1 — Go backend:**
- Extended `AppSettings` struct with 7 new fields: `Theme`, `LastDarkTheme`, `LastLightTheme`, `CustomThemes`, `UIFont`, `MonoFont`, `Density`
- Bumped `schemaVersion` from 7 to 8
- Added migration v8 using `ALTER TABLE ADD COLUMN` for all 7 new columns with sensible defaults
- Updated `GetSettings` and `SetSettings` in `db.go` to read/write all 9 fields
- Updated `ResetAll` default INSERT to include all 9 new columns
- Changed `SetSettings` bound method in `app.go` to accept 9 string parameters
- Regenerated TypeScript bindings — `SetSettings` now 9-arg, `AppSettings` model has all fields

**Task 2 — Frontend:**
- Changed theme/font/density/customThemes state initializers from localStorage reads to static defaults
- Added `settingsLoadedRef` (prevents premature DB writes before load) and `settingsRef` (latest values without stale closures)
- Added `flushSettings()` plain function that calls `SetSettings` with all 9 values from `settingsRef.current`
- Startup `useEffect` now calls `GetSettings()` and applies all 9 fields with one-time localStorage→DB migration, then clears localStorage keys
- Replaced all `localStorage.setItem` calls for the 7 migrated keys with `settingsRef` mutations + `flushSettings()`
- OS dark-mode media query handler now reads `lastDarkTheme`/`lastLightTheme` from `settingsRef` instead of localStorage
- `SettingsDialog.handleSave` fetches current DB state then calls `SetSettings` with all 9 args

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

None.

## Threat Flags

None — no new network endpoints, auth paths, or trust boundary changes introduced. The `customThemes` JSON field already wraps `JSON.parse` in try/catch per T-gac-03 in the plan's threat model.

## Self-Check: PASSED

- models.go modified: AppSettings has 9 fields — verified
- db.go schemaVersion = 8 — verified
- app.go SetSettings accepts 9 string params — verified
- frontend/wailsjs/go/main/App.d.ts SetSettings has 9 string args — verified
- frontend/src/App.tsx has 0 localStorage.setItem calls — verified
- frontend/src/components/SettingsDialog.tsx has 0 localStorage.setItem calls — verified
- Commits 49166f9 and 71cd27a exist — verified
- `go build ./...` passes — verified
- `pnpm tsc --noEmit` passes — verified
