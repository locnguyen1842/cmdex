---
phase: 15-cross-platform-execution
plan: 03
subsystem: execution-engine
tags: [tests, shebang, script-parsing, backward-compat, template-vars]
requires: [15-01, 15-02]
provides: [script-test-coverage, full-build-verification]
affects: [script_test.go, script.go]
tech-stack:
  added: []
  patterns: [table-driven-edge-case-testing, shebang-only-parse-fix]
key-files:
  created:
    - script_test.go (5 test functions)
  modified:
    - script.go (ParseScriptBody shebang-only edge case fix)
decisions:
  - "ParseScriptBody now returns empty string for shebang-only inputs (no body present)"
completed: 2026-05-04T08:05:33Z
duration: 185s
---

# Phase 15 Plan 03: Add Tests & Run Full Project Checks

**One-liner:** Created `script_test.go` with 5 comprehensive test functions covering script generation, shebang parsing (including backward compat), template variable extraction/replacement, and variable merging — plus fixed a `ParseScriptBody` edge case for shebang-only inputs.

## Tasks Completed

| Task | Name | Commit | Key Changes |
|------|------|--------|-------------|
| 1 | Create script_test.go with comprehensive tests | `d64aa54` | Created `script_test.go` with 5 test functions; fixed `ParseScriptBody` shebang-only edge case in `script.go` |
| 2 | Run full project checks (make check) | N/A (verification) | `go build ./...` + `pnpm tsc --noEmit` pass; all 8 Go tests pass |
| 3 | Verify Wails bindings are up to date | N/A (verification) | No service method signatures changed; bindings up to date |

## Tests Summary

### Test Coverage (8 tests total — 3 pre-existing + 5 new)

| Test Function | Package | Coverage |
|---------------|---------|----------|
| `TestFreshDBMigrations` | main (db_test.go) | Migration runner on fresh DB |
| `TestExistingDBIdempotent` | main (db_test.go) | Migration runner on existing DB |
| `TestRollbackTo` | main (db_test.go) | Rollback to specific version |
| **`TestGenerateScript`** | main (script_test.go) | No shebang prefix; empty/whitespace/multi-line bodies |
| **`TestParseScriptBody`** | main (script_test.go) | Backward compat with `#!/bin/bash`, `#!/usr/bin/env bash`, no-shebang format, empty, shebang-only |
| **`TestExtractTemplateVars`** | main (script_test.go) | Variable extraction and deduplication |
| **`TestReplaceTemplateVars`** | main (script_test.go) | Template substitution with known and unknown vars |
| **`TestMergeDetectedVars`** | main (script_test.go) | Merge order: detected vars first, then manual-only |

### Test Details

**TestGenerateScript** — verifies that `GenerateScript()` never adds a shebang to stored scripts:
- Basic body: `"echo hello"` → `"echo hello\n"`
- Empty body: `""` → `""`
- Whitespace-only: `"  \n  "` → `""`
- Multi-line: `"echo one\necho two"` → `"echo one\necho two\n"`
- Shebang assertion: output must not start with `#!`

**TestParseScriptBody** — verifies backward compatibility with scripts stored under the old `#!/bin/bash` format:
- Old format `#!/bin/bash`: strips shebang, returns body
- Old format `#!/usr/bin/env bash`: strips shebang, returns body
- New format (no shebang): returns body as-is
- Empty content: returns empty string
- **Shebang-only** (no body): returns empty string

**TestExtractTemplateVars** — verifies `{{var}}` extraction:
- Multiple vars: extracts in order of first appearance
- Duplicate vars: deduplicated
- No vars: returns empty slice

**TestReplaceTemplateVars** — verifies template substitution:
- Known vars: replaced with values
- Unknown vars: left as-is (`{{unknown}}`)
- Empty values map: content unchanged

**TestMergeDetectedVars** — verifies variable merge logic:
- Detected vars appear first in detection order
- Manual-only vars follow, sorted by their original SortOrder

### Build & Type Checks

| Check | Result |
|-------|--------|
| `go build ./...` | ✅ PASS — compiles with zero errors |
| `pnpm tsc --noEmit` | ✅ PASS — type checks with zero errors |
| `go test ./...` | ✅ PASS — 8/8 tests pass in 2 packages |
| Wails bindings | ✅ Up to date — no service method signatures changed |

## Changes Summary

### script_test.go (created)

135 lines of comprehensive test coverage across 5 test functions. All tests pass on the first run after the edge case fix.

### script.go — ParseScriptBody edge case fix

**Before:** `ParseScriptBody("#!/bin/bash\n")` returned `"#!/bin/bash"` — the shebang-only case wasn't handled because `TrimSpace` removed the trailing newline, making `strings.Index(s, "\n")` return -1.

**After:** When the content starts with `#!` and has no newline (meaning the entire content is just a shebang line), the function returns `""` — there is no script body to return.

```go
// Added else branch:
if strings.HasPrefix(s, "#!") {
    if idx := strings.Index(s, "\n"); idx != -1 {
        s = s[idx+1:]
    } else {
        // Entire content is just a shebang line — no body
        return ""
    }
}
```

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] ParseScriptBody shebang-only edge case**

- **Found during:** Task 1 — writing tests
- **Issue:** The test expected `ParseScriptBody("#!/bin/bash\n")` to return `""`, but the function returned `"#!/bin/bash"`. The `TrimSpace` call removed the trailing newline, preventing the newline-index-based body extraction from triggering.
- **Fix:** Added an `else` branch in `ParseScriptBody`: when the content starts with `#!` but contains no newline (shebang-only, no body), return `""`.
- **Files modified:** `script.go` (line 25-33)
- **Commit:** `d64aa54`

## Verification

| Criterion | Status |
|-----------|--------|
| `script_test.go` exists with 5 test functions | ✅ |
| All tests pass via `go test ./... -v` | ✅ (8/8) |
| `make check` passes (go build + pnpm tsc) | ✅ |
| No Wails binding regeneration needed | ✅ |

## Known Stubs

None — all test functions are concrete with real inputs and assertions.

## Self-Check: PASSED

- ✅ `script_test.go` — created, 5 test functions, all pass (commit `d64aa54`)
- ✅ `script.go` — `ParseScriptBody` edge case fixed, all other behavior unchanged
- ✅ `go build ./...` — succeeds with zero errors
- ✅ `pnpm tsc --noEmit` — succeeds with zero errors
- ✅ `go test ./... -v` — 8/8 tests pass (3 migration + 5 script)
- ✅ `execution_service.go` — no service method signatures changed
- ✅ Wails bindings — confirmed up to date, no regeneration needed
