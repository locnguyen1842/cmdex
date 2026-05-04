---
phase: 15-cross-platform-execution
plan: 01
subsystem: execution-engine
tags: [shebang, cross-platform, script-generation, executor, backward-compat]
requires: []
provides: [shebang-free-script-storage, platform-aware-execution, backward-compatible-parsing]
affects: [script.go, executor.go]
tech-stack:
  added: []
  patterns: [platform-aware-shebang-injection, generic-shebang-stripping, dead-code-identified]
key-files:
  created: []
  modified:
    - script.go (remove scriptHeader constant, simplify GenerateScript, generic ParseScriptBody)
    - executor.go (platform shebang in ExecuteScript, fix Unix -lc flag, add stripShebang helper)
decisions:
  - "Shebangs removed from stored scripts; platform-appropriate shebangs injected at execution time only"
  - "Unix execution path now uses -lc flag (was previously dropped), enabling login shell with profile sourcing"
  - "ParseScriptBody and stripShebang use generic #! prefix detection for full backward compatibility"
  - "BuildFinalCommand is dead code (defined but never called); left untouched for now"
completed: 2026-05-04T07:45:22Z
duration: ~5min
---

# Phase 15 Plan 01: Centralize Shebang Handling (script.go + executor.go core)

**One-liner:** Removed hardcoded `#!/bin/bash` from script storage, centralized platform-aware shebang injection in executor at runtime with generic backward-compatible parsing.

## Tasks Completed

| Task | Name | Commit | Key Changes |
|------|------|--------|-------------|
| 1 | Update script.go | `b04a573` | Removed `const scriptHeader`, `GenerateScript()` returns body-only, `ParseScriptBody()` strips any `#!` prefix |
| 2 | Update executor.go | `f706f56` | Platform shebang in `ExecuteScript()`, fixed Unix `-lc` flag, added `stripShebang()` helper |
| 3 | Verify execution_service.go compatibility | N/A (no changes) | All 3 call sites (`BuildDisplayCommand`, `ExecuteScript`, `OpenInTerminal`) verified compatible |

## Execution Flow

The new data flow for command execution:

```
Storage:   GenerateScript(body) → "echo hi\n"          (no shebang stored)
Parsing:   ParseScriptBody("#!/bin/bash\n\necho hi\n") → "echo hi"  (backward compat)
Execution: ExecuteScript("echo hi") → stripShebang → "#!/bin/sh\necho hi\n" → temp file → sh -lc /tmp/xxx.sh
Windows:   ExecuteScript("echo hi") → stripShebang → "echo hi\n" → temp file → cmd /C tmp.bat
```

## Changes Summary

### script.go
- **Removed:** `const scriptHeader = "#!/bin/bash"`
- **Changed `GenerateScript()`:** Returns trimmed body with trailing newline, no shebang prefix. Empty input returns empty string.
- **Changed `ParseScriptBody()`:** Generic `#!` detection replaces specific `#!/bin/bash` check. Strips the entire first line if it starts with `#!`. Handles both old (shebang in DB) and new (no shebang) formats transparently.

### executor.go
- **Added shebang injection in `ExecuteScript()`:** Strips existing shebang from stored content via `stripShebang()`, then prepends `#!/bin/sh\n` on Unix. No shebang on Windows (`.bat` files don't use them).
- **Fixed Unix execution path:** Previously `exec.CommandContext(ctx, e.shell, tmpPath)` dropped the `-lc` flag. Now uses `exec.CommandContext(ctx, e.shell, e.flag, tmpPath)` uniformly across platforms — `/C` on Windows, `-lc` on Unix.
- **Added `stripShebang()` helper:** Removes any `#!...` first line from script content. Used by `ExecuteScript()` for backward compatibility with old DB records that still contain `#!/bin/bash`.

### execution_service.go
- **No changes needed.** All three call sites (`BuildDisplayCommand`, `ExecuteScript`, `OpenInTerminal`) remain signature-compatible. The executor's internal shebang handling is transparent to callers.

## Deviations from Plan

None — plan executed exactly as written. All three tasks completed per specification with zero deviations.

## Self-Check: PASSED

All files exist and commits verified:
- ✅ `script.go` — modified, committed as `b04a573`
- ✅ `executor.go` — modified, committed as `f706f56`
- ✅ `execution_service.go` — reviewed, no changes needed
- ✅ `go build ./...` — succeeds with no errors
- ✅ `GenerateScript` returns body without shebang prefix
- ✅ `ParseScriptBody` strips any `#!` line generically
- ✅ `ExecuteScript` adds `#!/bin/sh` on Unix, no shebang on Windows
- ✅ Unix execution uses `-lc` flag (was previously unused)
- ✅ Backward compatible: existing DB scripts with `#!/bin/bash` execute correctly
