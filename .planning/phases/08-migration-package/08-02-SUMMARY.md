---
phase: 08-migration-package
plan: "02"
subsystem: migrations
tags:
  - go
  - sqlite
  - migrations
  - schema
  - nullable
  - fk

dependency_graph:
  requires:
    - phase: 08-01
      provides: migrations/migration.go (Migration struct, Migrations registry seeded with 0001, 0002)
  provides:
    - migrations/0003_position.go (commands.position ADD/DROP COLUMN)
    - migrations/0005_nullable.go (commands table recreation; nullable title/description; DisableFKDuringMigration: true)
    - migrations/0006_preset_pos.go (variable_presets.position ADD/DROP COLUMN)
    - migrations/migration.go (Migrations registry extended to 5 entries: 0001, 0002, 0003, 0005, 0006)
  affects:
    - 08-03 (adds migrations 0007, 0008, 0009 to the same registry)
    - phase 09 (runner reads Migrations slice and DisableFKDuringMigration flag)

tech-stack:
  added: []
  patterns:
    - DisableFKDuringMigration flag pattern (only migration0005; runner issues PRAGMA FK OFF before tx)
    - COALESCE trigger form for nullable title/description columns
    - DROP COLUMN in Down for SQLite 3.35+ (modernc.org/sqlite v1.47.0 bundles 3.48.x)
    - stmts []string + for-range loop for batched SQL execution (same as 08-01)

key-files:
  created:
    - migrations/0003_position.go
    - migrations/0005_nullable.go
    - migrations/0006_preset_pos.go
  modified:
    - migrations/migration.go

key-decisions:
  - "No PRAGMA statements inside any migration file — runner acts on DisableFKDuringMigration flag"
  - "PRAGMA comment in migration.go struct doc is acceptable; only SQL PRAGMA in migration bodies is forbidden"
  - "Down for migration0005 uses COALESCE triggers (same as Up) for defensive correctness even though columns are NOT NULL in pre-v5 schema"
  - "go build ./... fails only due to pre-existing missing frontend/dist embed — migrations package itself compiles cleanly"

patterns-established:
  - "Pattern: FK-disabled table recreation — set DisableFKDuringMigration: true; no PRAGMA in migration body; runner owns PRAGMA lifecycle"
  - "Pattern: Version skip is explicit — Migrations slice jumps from 0003 to 0005; comment in migration.go explains the skip"

requirements-completed:
  - MIGR-02
  - MIGR-03
  - MIGR-04
  - ROLL-01

duration: 8min
completed: "2026-04-23"
---

# Phase 08 Plan 02: Position Columns and Nullable Commands Migration Summary

**Three migration files ported from db.go covering commands.position (v3), nullable title/description with FK-disabled table recreation (v5), and variable_presets.position (v6); Migrations registry extended to 5 entries.**

## Performance

- **Duration:** ~8 min
- **Started:** 2026-04-23T07:06:00Z
- **Completed:** 2026-04-23T07:14:07Z
- **Tasks:** 3
- **Files modified:** 4

## Accomplishments

- migrations/0003_position.go: Up adds `commands.position INTEGER NOT NULL DEFAULT 0` and initializes from rowid; Down uses `ALTER TABLE commands DROP COLUMN position` (SQLite 3.35+)
- migrations/0005_nullable.go: Up recreates commands with `title TEXT`, `description TEXT` (nullable), transforms empty description to NULL via CASE WHEN, rebuilds FTS, recreates all three FTS triggers with COALESCE; Down reverses to NOT NULL DEFAULT '' via COALESCE in INSERT SELECT; `DisableFKDuringMigration: true` signals Phase 9 runner to issue PRAGMA foreign_keys = OFF before the transaction
- migrations/0006_preset_pos.go: Up adds `variable_presets.position INTEGER NOT NULL DEFAULT 0` and initializes from rowid; Down uses DROP COLUMN
- migrations/migration.go: Migrations slice extended from 2 entries to 5 (migration0001, migration0002, migration0003, migration0005, migration0006) with comment explaining the version 4 skip

## Task Commits

Each task was committed atomically:

1. **Task 1: Create migrations/0003_position.go and migrations/0006_preset_pos.go** - `a06885c` (feat)
2. **Task 2: Create migrations/0005_nullable.go — FK-disabled table recreation** - `ee52913` (feat)
3. **Task 3: Update migrations/migration.go registry** - `b45a13a` (feat)

## Files Created/Modified

- `migrations/0003_position.go` - commands.position ADD COLUMN (Up) / DROP COLUMN (Down)
- `migrations/0005_nullable.go` - commands table recreation with nullable columns; DisableFKDuringMigration: true; COALESCE FTS triggers
- `migrations/0006_preset_pos.go` - variable_presets.position ADD COLUMN (Up) / DROP COLUMN (Down)
- `migrations/migration.go` - Migrations slice extended to 5 entries; version-skip comment added

## Decisions Made

- No PRAGMA statements in any migration body — the Phase 9 runner owns the PRAGMA foreign_keys lifecycle based on the `DisableFKDuringMigration` flag on `migration0005`.
- The comment `// PRAGMA foreign_keys = OFF on the raw connection` in `migration.go` (struct doc) is documentation, not SQL — acceptable per plan rule.
- Down for migration0005 uses COALESCE triggers (same as Up) for defensive correctness even when reverting to NOT NULL columns, following PATTERNS.md exactly.

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

None — this plan creates pure Go migration package files with no UI surface or data rendering.

## Threat Flags

None — pure internal Go package creation with no external input, no user-facing surface area, and no new network endpoints or trust boundaries.

## Issues Encountered

- `go build ./...` fails due to pre-existing `//go:embed all:frontend/dist` in main.go with missing frontend/dist directory. This is unrelated to migrations/. Verified with `go build ./migrations/...` which exits 0. Noted in plan acceptance criteria which specifies `go build ./migrations/...` for per-task verification and `go build ./...` for the overall check (the latter is pre-broken in this worktree).

## Next Phase Readiness

- Migrations 0001 through 0006 are all defined. Plan 08-03 adds migrations 0007, 0008, 0009 (working_dir, app_settings, executions schema changes).
- Phase 9 runner can begin consuming the `migrations.Migrations` slice and `DisableFKDuringMigration` flag once 08-03 completes.

---
*Phase: 08-migration-package*
*Completed: 2026-04-23*

## Self-Check: PASSED

- migrations/0003_position.go: FOUND
- migrations/0005_nullable.go: FOUND
- migrations/0006_preset_pos.go: FOUND
- migrations/migration.go (updated): FOUND
- Commit a06885c (Task 1 — 0003 + 0006): FOUND
- Commit ee52913 (Task 2 — 0005): FOUND
- Commit b45a13a (Task 3 — registry update): FOUND
- go build ./migrations/...: OK
- No PRAGMA SQL in migration files: CONFIRMED (comment in migration.go doc is not SQL)
- No UPDATE schema_version in migrations/: CONFIRMED
- DisableFKDuringMigration: true only in 0005_nullable.go: CONFIRMED
- Migrations registry has 5 entries: CONFIRMED (migration0001, 0002, 0003, 0005, 0006)
