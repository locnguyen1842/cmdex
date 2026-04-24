---
phase: 01-editor-multi-mount-refactor
plan: 02
subsystem: ui
tags: [react, usecallback, memo, stale-closure, wails]

requires:
  - phase: 01-editor-multi-mount-refactor
    plan: 01
    provides: React.memo-wrapped CommandDetail component

provides:
  - Per-tab useCallback factory functions for all CommandDetail action handlers
  - Parameterized refreshCommand helper replacing selectedCommand-bound refreshSelectedCommand
  - Updated CommandDetail JSX wired to factory functions keyed by activeTabId

affects:
  - 01-editor-multi-mount-refactor-03 (per-tab multi-mount)

tech-stack:
  added: []
  patterns:
    - "useCallback factory pattern: outer useCallback with stable deps returns an inner callback keyed by tabId"
    - "Ref-based lookups inside callbacks to avoid stale closures (allCommandsRef, tabDraftsRef, tabBaselinesRef)"

key-files:
  created: []
  modified:
    - frontend/src/App.tsx

key-decisions:
  - "Kept legacy selectedCommand-bound handlers (handleExecute, handleFillVariables, handleDeleteCommand, handleSaveScriptDirect) for keyboard shortcuts, Sidebar, and AlertDialog usage"
  - "Excluded unstable regular functions (closeTab, computeRemovedVarsWithPresets, runCommandDirect) from factory dependency arrays with eslint-disable comments to keep factories stable"
  - "Replaced refreshSelectedCommand with refreshCommand(commandId) to eliminate selectedCommand capture in preset factory callbacks"

patterns-established:
  - "Per-tab handler factory: const makeHandler = useCallback((tabId) => async (...) => { lookup via refs; execute logic }, [stableDeps])"
  - "Delegating wrapper for non-CommandDetail consumers: const handleLegacy = useCallback(async (...) => { const fn = makeHandler(activeTabId); await fn(...); }, [activeTabId, makeHandler])"

requirements-completed:
  - PERF-02
  - STAB-01

duration: 15min
completed: 2026-04-24
---

# Phase 01 Plan 02: Per-Tab Callback Factory Refactor Summary

**All CommandDetail action callbacks converted from `selectedCommand`-bound closures to `useCallback` factory functions keyed by `tabId`, enabling React.memo effectiveness and per-tab multi-mount in Plan 03.**

## Performance

- **Duration:** 15 min
- **Started:** 2026-04-24T06:02:42Z
- **Completed:** 2026-04-24T06:17:42Z
- **Tasks:** 2
- **Files modified:** 1

## Accomplishments
- Created 10 per-tab handler factory functions (`makeHandleExecute`, `makeHandleRunInTerminal`, `makeHandleFillVariables`, `makeHandleDelete`, `makeHandleAddPreset`, `makeHandleRenamePreset`, `makeHandleDeletePreset`, `makeHandleReorderPresets`, `makeHandleSavePresetValues`, `makeHandleSaveScript`)
- Replaced `refreshSelectedCommand` with parameterized `refreshCommand(commandId)` to remove `selectedCommand` capture from preset handler closures
- Updated `CommandDetail` JSX props to call factories with `activeTabId`
- Removed dead code: `handleManagePresets`, `handleAddPresetFromDetail`, `handleRenamePresetFromDetail`, `handleDeletePresetFromDetail`, `handleReorderPresetsFromDetail`, `handleSavePresetValuesFromDetail`
- Verified TypeScript compilation passes with zero errors

## Task Commits

Each task was committed atomically:

1. **Task 1: Create per-tab callback factories** - `cb44546` (feat)
2. **Task 2: Audit for stale closures and dead code** - audit and dead-code removal completed inline during Task 1; no additional file changes required

**Plan metadata:** `cb44546` (docs: complete plan)

## Files Created/Modified
- `frontend/src/App.tsx` - Added 10 useCallback factory functions, replaced `refreshSelectedCommand` with `refreshCommand`, updated CommandDetail JSX to use factories, removed 6 unused selectedCommand-bound handlers

## Decisions Made
- **Kept legacy handlers for non-CommandDetail consumers:** `handleExecute`, `handleFillVariables`, `handleDeleteCommand`, and `handleSaveScriptDirect` remain because they are used by keyboard shortcuts, Sidebar, and AlertDialog respectively. Each either retains its original implementation or delegates to the new factory.
- **Excluded unstable functions from factory dependency arrays:** `closeTab`, `computeRemovedVarsWithPresets`, and `runCommandDirect` are regular functions recreated every render. Including them in `useCallback` deps would defeat the stability purpose. Added `// eslint-disable-next-line react-hooks/exhaustive-deps` comments where needed.
- **Used ref-based lookups inside callbacks:** Factories access `allCommandsRef.current`, `tabDraftsRef.current`, and `tabBaselinesRef.current` instead of capturing `selectedCommand`, `tabDrafts`, or `tabBaselines` state directly, preventing stale closures.

## Deviations from Plan

### Task Execution Merge

**Task 2 audit and cleanup merged into Task 1 commit**
- **Reason:** Dead-code removal (unused `selectedCommand`-bound handlers) and dependency-array verification were performed inline during factory creation to ensure correctness before committing. No separate file modifications remained for a distinct Task 2 commit.
- **Impact:** All verification criteria (TypeScript compilation, no `selectedCommand` in factories, correct dependency arrays) were met within the single Task 1 commit.

## Issues Encountered
- ESLint is not installed in the frontend project; used `npx tsc --noEmit` as the fallback verification method per the plan's fallback instruction.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- All per-tab handler factories are stable and ready for Plan 03 (per-tab CommandDetail multi-mount)
- React.memo (Plan 01) will become effective once each tab caches its factory result in Plan 03
- No blockers

## Self-Check: PASSED

- [x] SUMMARY.md created at `.planning/phases/01-editor-multi-mount-refactor/01-02-SUMMARY.md`
- [x] Commit `cb44546` exists with correct message
- [x] `frontend/src/App.tsx` compiles with zero TypeScript errors
- [x] All 10 factory functions present (`makeHandleExecute`, `makeHandleRunInTerminal`, `makeHandleFillVariables`, `makeHandleDelete`, `makeHandleAddPreset`, `makeHandleRenamePreset`, `makeHandleDeletePreset`, `makeHandleReorderPresets`, `makeHandleSavePresetValues`, `makeHandleSaveScript`)
- [x] No `selectedCommand` references inside factory closures
- [x] `updateDraft` left unchanged (already stable)

---
*Phase: 01-editor-multi-mount-refactor*
*Completed: 2026-04-24*
