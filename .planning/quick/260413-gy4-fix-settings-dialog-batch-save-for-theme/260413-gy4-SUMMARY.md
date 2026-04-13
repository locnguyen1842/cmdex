---
phase: quick
plan: 260413-gy4
subsystem: frontend/settings
tags: [settings, theme, drag, ux, batch-save]
dependency_graph:
  requires: []
  provides: [batch-save-appearance, draggable-settings-dialog]
  affects: [frontend/src/components/SettingsDialog.tsx]
tech_stack:
  added: []
  patterns: [draft-state-pattern, document-event-listeners-for-drag]
key_files:
  modified:
    - frontend/src/components/SettingsDialog.tsx
decisions:
  - Import theme remains immediate-apply (import = intent to apply); synced to both draft and saved state to keep dialog consistent
  - Drag uses document-level mousemove/mouseup listeners (registered once on mount) rather than per-drag registration to avoid stale closure issues
  - dialogOffset stored as nullable {x,y} state; null means centered (no inline style override)
metrics:
  duration: ~10 minutes
  completed: 2026-04-13
---

# Quick Fix 260413-gy4: Batch-Save Appearance Settings + Draggable Dialog Summary

Deferred theme/font/density application to Save click using draft state pattern mirroring locale/terminal; added drag-to-reposition behavior on the dialog header.

## Tasks Completed

| Task | Description | Commit |
|------|-------------|--------|
| 1 | Add draft state for theme/uiFont/monoFont/density; call callbacks only on Save | e25b837 |
| 2 | Make settings dialog draggable by its header | e25b837 |

## Changes

### SettingsDialog.tsx

**Task 1 — Batch save:**
- Added `draftTheme`, `draftUiFont`, `draftMonoFont`, `draftDensity` state variables initialized from incoming props
- Added `savedTheme`, `savedUiFont`, `savedMonoFont`, `savedDensity` counterparts tracking currently applied values
- `useEffect` on `open` now syncs all four draft/saved pairs from current prop values (added `theme, uiFont, monoFont, density` to deps)
- All selection handlers (`onThemeChange`, `onUiFontChange`, `onMonoFontChange`, `onDensityChange`) replaced with `setDraft*` calls
- `handleSave` now calls all four parent callbacks with draft values before updating saved state
- `isDirty` extended to cover all 6 fields
- `handleCancel` extracted as a callback that resets all drafts to saved values and resets dialog offset
- Import theme handler still calls `onThemeChange` immediately (intentional) and syncs `setDraftTheme`/`setSavedTheme`

**Task 2 — Draggable dialog:**
- Added `dialogRef`, `dragStateRef`, `dialogOffset` state
- `handleHeaderMouseDown` starts drag tracking on left-click
- Document-level `mousemove`/`mouseup` listeners registered once in `useEffect([], [])`
- `DialogContent` receives `ref={dialogRef}` and `style` with `translate(calc(-50% + Xpx), calc(-50% + Ypx))` when offset is non-null
- `DialogHeader` gets `select-none cursor-grab active:cursor-grabbing` + `onMouseDown={handleHeaderMouseDown}`
- Offset resets to `null` on close (via `handleCancel`)
- No changes to `dialog.tsx`

## Deviations from Plan

None - plan executed exactly as written.

## Self-Check: PASSED

- `frontend/src/components/SettingsDialog.tsx` — FOUND
- Commit `e25b837` — FOUND
- `pnpm tsc --noEmit` — PASSED (no errors)
