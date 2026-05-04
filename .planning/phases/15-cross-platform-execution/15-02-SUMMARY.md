---
phase: 15-cross-platform-execution
plan: 02
subsystem: execution-engine
tags: [cross-platform, display-strings, shell-name, BuildFinalCommand, dead-code]
requires: [15-01]
provides: [platform-aware-display-strings]
affects: [executor.go]
tech-stack:
  added: []
  patterns: [method-on-executor, basename-extraction, platform-aware-display]
key-files:
  created: []
  modified:
    - executor.go (BuildFinalCommand converted to *Executor method)
decisions:
  - "BuildFinalCommand now uses e.shell basename for display instead of hardcoded 'bash'"
  - "BuildFinalCommand is dead code (no callers) — kept as correct reference implementation"
  - "BuildDisplayCommand (the actual user-facing function) already shebang-agnostic, no changes needed"
completed: 2026-05-04T07:55:43Z
duration: 161s
---

# Phase 15 Plan 02: Fix User-Facing Display Strings for Platform Shell Names

**One-liner:** Converted `BuildFinalCommand` from hardcoded `"bash <script>"` to a `*Executor` method using the platform-appropriate shell basename (e.g., `"cmd <script>"` on Windows, `"sh <script>"` on Unix).

## Tasks Completed

| Task | Name | Commit | Key Changes |
|------|------|--------|-------------|
| 1 | Update BuildFinalCommand for platform-aware display | `59fff59` | Converted `BuildFinalCommand` to method on `*Executor`; uses `e.shell` basename instead of hardcoded `"bash"` |
| 2 | Update execution_service.go callers | N/A (no changes) | Verified zero callers across codebase — `BuildFinalCommand` is dead code, `BuildDisplayCommand` is the actual user-facing display function |
| 3 | Verify cross-platform display consistency | N/A (verification only) | Confirmed no remaining hardcoded `"bash"` strings in active Go source; all terminal launches use `e.shell` + `e.flag` consistently |

## Changes Summary

### executor.go — BuildFinalCommand

**Before:**
```go
func BuildFinalCommand(variables map[string]string) string {
    return "bash <script>"  // hardcoded — wrong on Windows
}
```

**After:**
```go
func (e *Executor) BuildFinalCommand(variables map[string]string) string {
    shellName := e.shell           // "cmd" on Windows, "/bin/zsh" or "/bin/sh" on Unix
    // Basename extraction: "/bin/zsh" → "zsh"
    ...
    return shellName + " <script>" // platform-appropriate display
}
```

### Display behavior by platform

| Platform | `e.shell` | `BuildFinalCommand` output |
|----------|-----------|---------------------------|
| Windows | `cmd` | `cmd <script>` |
| macOS (zsh default) | `/bin/zsh` | `zsh <script>` |
| macOS (bash) | `/bin/bash` | `bash <script>` |
| Linux | `/bin/sh` | `sh <script>` |
| Fallback (empty shell) | `""` → `"sh"` | `sh <script>` |

### No other changes needed

- **BuildDisplayCommand** (line 92): Already shebang-agnostic — strips any `#!` line, returns trimmed body. Works with both old (`#!/bin/bash\n\necho hi`) and new (no shebang) formats.
- **BuildFinalCommand callers**: Zero — the function is dead code. The actual execution-history display in `execution_service.go` uses `BuildDisplayCommand` for the `FinalCmd` field.
- **Terminal launches**: All use `e.shell` + `e.flag` consistently (verified across Darwin, Linux, Windows terminal definitions).

## Deviations from Plan

### Task 2: No callers found (dead code)

**Found during:** Task 2
**Issue:** Plan assumed `BuildFinalCommand` was called at `execution_service.go` line ~122 (`db.AddExecution(..., executor.BuildFinalCommand(values), ...)`). In reality, `BuildFinalCommand` has zero callers across the entire Go codebase — it's dead code.
**Resolution:** No changes needed in `execution_service.go`. The execution-history display correctly uses `BuildDisplayCommand` for the `FinalCmd` field. `BuildFinalCommand` was updated anyway (Task 1) to be correct if/when it's ever used.
**Files affected:** None (verification-only)

## Self-Check: PASSED

- ✅ `executor.go` — `BuildFinalCommand` is now a method on `*Executor` using `e.shell` basename (commit `59fff59`)
- ✅ `go build ./...` — compiles without errors
- ✅ No hardcoded `"bash"` strings in active Go source (only in comments)
- ✅ `BuildDisplayCommand` handles both shebang and no-shebang formats
- ✅ All terminal launches use `e.shell` + `e.flag` consistently
- ✅ 15-01 dependencies verified in place: `stripShebang()`, platform shebang injection, `-lc` flag fix
