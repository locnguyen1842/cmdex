---
phase: quick
plan: 260413-gib
subsystem: db
tags: [sqlite, settings, migration, json]
dependency_graph:
  requires: []
  provides: [app_settings JSON schema v9]
  affects: [db.go]
tech_stack:
  added: [encoding/json]
  patterns: [JSON blob column, schema migration]
key_files:
  modified: [db.go]
decisions:
  - Collapse 9-column app_settings to single TEXT data column holding JSON; future setting fields require no migration
metrics:
  duration: ~3min
  completed: 2026-04-13
---

# Phase quick Plan 260413-gib: Refactor app_settings to JSON Column Summary

**One-liner:** Collapsed app_settings table from 9 separate columns to a single `data TEXT` JSON column with v9 migration preserving existing values.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Migrate app_settings schema to single JSON column and update DB methods | de1eaa5 | db.go |

## Changes Made

- `schemaVersion` bumped from 8 to 9
- `encoding/json` import added
- Schema constant: `app_settings` now has single `data TEXT NOT NULL DEFAULT '{}'` column
- Migration v9: reads existing 9-column row, drops table, creates new table, re-inserts as JSON (falls back to defaults if no row)
- `GetSettings`: `SELECT data FROM app_settings LIMIT 1` + `json.Unmarshal`
- `SetSettings`: `json.Marshal` + `UPDATE app_settings SET data = ?`
- `ResetAll`: inserts JSON-encoded `AppSettings` defaults into `data` column

## Deviations from Plan

None - plan executed exactly as written.

## Self-Check: PASSED

- `go build ./...` exits 0
- `schemaVersion = 9` in db.go
- `GetSettings` uses `json.Unmarshal`
- `SetSettings` uses `json.Marshal`
- `ResetAll` inserts JSON row
- Commit de1eaa5 exists
