---
phase: 08-migration-package
plan: "03"
subsystem: migrations
tags:
  - go
  - sqlite
  - migrations
  - schema
  - json
  - app_settings
  - executions

dependency_graph:
  requires:
    - phase: 08-02
      provides: migrations/migration.go (5-entry Migrations registry: 0001, 0002, 0003, 0005, 0006)
  provides:
    - migrations/0007_exec_workdir.go (executions.working_dir ADD/DROP COLUMN)
    - migrations/0008_settings_cols.go (app_settings 7-column addition/removal)
    - migrations/0009_settings_json.go (app_settings columnar-to-JSON with local settingsV9 struct)
    - migrations/migration.go (complete 8-entry registry: 0001, 0002, 0003, 0005, 0006, 0007, 0008, 0009)
  affects:
    - phase 09 (runner reads complete Migrations slice to apply all 8 migrations)

tech-stack:
  added: []
  patterns:
    - Local struct to avoid circular import (settingsV9 in 0009_settings_json.go; no import of package main)
    - columnar-to-JSON table recreation pattern (DROP + CREATE + INSERT marshalled JSON)
    - json.Marshal/Unmarshal for settings preservation across schema transforms
    - Single-statement tx.Exec for simple ADD COLUMN (0007)
    - stmts []string + for-range loop for batched DDL (0008, 0009 Down recreation)

key-files:
  created:
    - migrations/0007_exec_workdir.go
    - migrations/0008_settings_cols.go
    - migrations/0009_settings_json.go
  modified:
    - migrations/migration.go

key-decisions:
  - "settingsV9 is defined locally in 0009_settings_json.go — importing package main would be a circular import"
  - "WindowX/Y/Width/Height excluded from settingsV9 — those fields were added to AppSettings after the v9 migration point"
  - "0007 uses tx.Exec (not db.conn.Exec) — the monolith ran v7 directly on conn with no tx; new design correctly wraps in runner-provided transaction"
  - "Down for 0009 recreates full columnar v8 schema (CREATE + 7 ALTER + INSERT) to match the state migration0008 would have left"
  - "PRAGMA comment in migration.go struct doc is not SQL — no PRAGMA appears in any migration body"

metrics:
  duration: "~2.5 min"
  completed: "2026-04-23"
  tasks: 3
  files_created: 3
  files_modified: 1
---

# Phase 08 Plan 03: Final Migration Files (0007, 0008, 0009) Summary

**Three migration files porting v7/v8/v9 schema changes from db.go monolith; Migrations registry complete with all 8 entries; local settingsV9 struct avoids circular import in the most complex migration.**

## Performance

- **Duration:** ~2.5 min
- **Started:** 2026-04-23T07:17:04Z
- **Completed:** 2026-04-23T07:19:25Z
- **Tasks:** 3
- **Files created:** 3
- **Files modified:** 1

## Accomplishments

- `migrations/0007_exec_workdir.go`: Up adds `executions.working_dir TEXT DEFAULT ''` via `tx.Exec`; Down drops it. Monolith ran v7 directly on `db.conn` with no transaction — new design correctly uses the runner-provided `*sql.Tx`.
- `migrations/0008_settings_cols.go`: Up adds 7 `app_settings` columns (theme, last_dark_theme, last_light_theme, custom_themes, ui_font, mono_font, density) with proper defaults; Down drops all 7.
- `migrations/0009_settings_json.go`: Up reads 9 columnar fields, drops the table, recreates with single `data TEXT` column, marshals existing (or default) values to JSON and inserts. Down reads JSON, unmarshals, drops table, recreates columnar v8 schema via CREATE + 7 ALTER statements, and inserts the row. Local `settingsV9` struct (9 fields) avoids circular import with package main; WindowX/Y/Width/Height excluded (added post-v9).
- `migrations/migration.go`: Migrations slice extended from 5 to 8 entries: migration0001, migration0002, migration0003, migration0005, migration0006, migration0007, migration0008, migration0009.

## Task Commits

Each task was committed atomically:

1. **Task 1: Create migrations/0007_exec_workdir.go and migrations/0008_settings_cols.go** - `625463e` (feat)
2. **Task 2: Create migrations/0009_settings_json.go — columnar to JSON with local settingsV9 struct** - `1e93321` (feat)
3. **Task 3: Update migrations/migration.go registry** - `ac5ad83` (feat)

## Files Created/Modified

- `migrations/0007_exec_workdir.go` - executions.working_dir ADD COLUMN (Up) / DROP COLUMN (Down)
- `migrations/0008_settings_cols.go` - app_settings 7 ADD COLUMN (Up) / 7 DROP COLUMN (Down)
- `migrations/0009_settings_json.go` - app_settings columnar-to-JSON; local settingsV9 struct; json.Marshal/Unmarshal
- `migrations/migration.go` - Migrations slice extended to 8 entries

## Decisions Made

- `settingsV9` is defined locally in `0009_settings_json.go` because importing `package main` from `package migrations` would create a circular dependency. The struct duplicates exactly the 9 fields present at v8 schema.
- WindowX, WindowY, WindowWidth, WindowHeight were excluded from `settingsV9` — these fields were added to `AppSettings` in `models.go` after the v9 migration, so they were not part of the columnar schema being transformed.
- Migration 0007 now uses `tx.Exec` (runner-provided transaction) instead of `db.conn.Exec` (monolith's direct connection). This is a correctness improvement — the monolith had no transaction wrapping for v7.
- Down for migration 0009 recreates the full columnar v8 schema (CREATE TABLE + 7 ALTER TABLE statements + INSERT) matching exactly what migration0008 Up would have produced.

## Deviations from Plan

None — plan executed exactly as written.

## Phase 8 Completion Gate

All success criteria verified:

| Check | Result |
|-------|--------|
| `go build ./migrations/...` | PASS |
| 9 files in migrations/ | PASS (migration.go + 0001..0009, no 0004) |
| All 8 migration files have Up and Down | PASS |
| Only 0005_nullable.go has DisableFKDuringMigration: true | PASS |
| No `"cmdex"` import in any migration file | PASS |
| No `UPDATE schema_version` in any migration file | PASS |
| No PRAGMA SQL in any migration body | PASS |
| 0009 defines settingsV9 locally | PASS |
| 0009 excludes WindowX/Y/Width/Height | PASS |
| Migrations registry has 8 entries | PASS |

## Known Stubs

None — pure Go migration package files with no UI surface or data rendering.

## Threat Flags

None — pure internal Go package; no external input, no user-facing surface, no new network endpoints.

## Self-Check: PASSED

- migrations/0007_exec_workdir.go: FOUND
- migrations/0008_settings_cols.go: FOUND
- migrations/0009_settings_json.go: FOUND
- migrations/migration.go (updated to 8 entries): FOUND
- Commit 625463e (Task 1 — 0007 + 0008): FOUND
- Commit 1e93321 (Task 2 — 0009): FOUND
- Commit ac5ad83 (Task 3 — registry update): FOUND
- go build ./migrations/...: PASS
- No "cmdex" import: CONFIRMED
- No UPDATE schema_version: CONFIRMED
- No PRAGMA SQL in migration bodies: CONFIRMED
- DisableFKDuringMigration: true only in 0005_nullable.go: CONFIRMED
- settingsV9 has no WindowX/Y/Width/Height fields: CONFIRMED
- Migrations registry has 8 entries: CONFIRMED
