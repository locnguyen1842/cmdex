---
phase: 08-migration-package
plan: "01"
subsystem: migrations
tags:
  - go
  - sqlite
  - migrations
  - schema

dependency_graph:
  requires: []
  provides:
    - migrations/migration.go (Migration struct, Migrations registry)
    - migrations/0001_initial.go (full initial schema Up/Down)
    - migrations/0002_commands_fk.go (category_id SET NULL FK Up/Down)
  affects:
    - db.go (future: Phase 9 runner will integrate migrations/ package)

tech_stack:
  added:
    - migrations/ package (package migrations, Go stdlib only)
  patterns:
    - Registry slice pattern (var Migrations []Migration at package level)
    - stmts []string + for-range loop for batched SQL execution
    - Reverse FK-dependency ordering for Down teardown

key_files:
  created:
    - migrations/migration.go
    - migrations/0001_initial.go
    - migrations/0002_commands_fk.go
  modified: []

decisions:
  - "Used DisableFKDuringMigration (not RequiresFK) per plan frontmatter — PATTERNS.md used RequiresFK in one section but RESEARCH.md resolved it as DisableFKDuringMigration"
  - "0001_initial.go Up uses final schema (nullable title/description, position column) per plan instruction — captures the end-state schema, not the v1 schema"
  - "0002_commands_fk.go triggers use no COALESCE (v2-era schema had NOT NULL columns)"
  - "Migrations slice in migration.go contains only migration0001 and migration0002 — plans 08-02 and 08-03 add the remaining migrations"

metrics:
  duration: "2m"
  completed: "2026-04-23"
  tasks_completed: 3
  tasks_total: 3
  files_created: 3
  files_modified: 0
---

# Phase 08 Plan 01: migrations/ Package Foundation Summary

**One-liner:** `migrations/` Go package created with Migration struct, partial Migrations registry, and the first two migration files covering full initial schema and the v1→v2 FK change.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Create migrations/migration.go — type definition and partial registry | 8ad14dc | migrations/migration.go |
| 2 | Create migrations/0001_initial.go — full initial schema Up/Down | 6b069ee | migrations/0001_initial.go |
| 3 | Create migrations/0002_commands_fk.go — category_id SET NULL + FTS rebuild | 68763c9 | migrations/0002_commands_fk.go |

## What Was Built

**migrations/migration.go** — Defines the `Migration` struct with five fields (`Version int`, `Description string`, `DisableFKDuringMigration bool`, `Up func(tx *sql.Tx) error`, `Down func(tx *sql.Tx) error`) and the `Migrations []Migration` registry slice seeded with `migration0001` and `migration0002`. No imports from `package main` — standalone, importable package.

**migrations/0001_initial.go** — `Up` creates all 14 schema objects in order: `schema_version`, `categories`, `commands` (final schema with nullable title/description and position column), `tags`, `command_tags`, `variable_definitions`, `variable_presets` (with position), `preset_values`, `executions` (with working_dir), `app_settings`, `commands_fts` virtual table, and three FTS triggers (`commands_ai`, `commands_ad`, `commands_au`) with COALESCE for nullable columns. `Down` drops all 14 objects in reverse FK dependency order (triggers first, then FTS virtual table, then leaf tables, then commands, then categories, then schema_version).

**migrations/0002_commands_fk.go** — `Up` recreates the commands table with `category_id ON DELETE SET NULL`, NULLs empty category_id strings, rebuilds FTS index, then recreates all three FTS triggers without COALESCE (v2-era schema had NOT NULL title/description). `Down` reverts by recreating commands with `ON DELETE CASCADE` NOT NULL category_id, mapping NULL back to empty string via COALESCE in the INSERT SELECT, then rebuilding FTS and triggers.

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

None — this plan creates pure Go package infrastructure with no UI surface or data rendering.

## Threat Flags

None — pure internal Go package creation with no external input, no user-facing surface area, and no new network endpoints or trust boundaries.

## Self-Check: PASSED

- migrations/migration.go: FOUND
- migrations/0001_initial.go: FOUND
- migrations/0002_commands_fk.go: FOUND
- Commit 8ad14dc (migration.go): FOUND
- Commit 6b069ee (0001_initial.go): FOUND
- Commit 68763c9 (0002_commands_fk.go): FOUND
- go build ./migrations/...: OK
- No circular import (import cmdex): CONFIRMED
- No UPDATE schema_version in migrations/: CONFIRMED
