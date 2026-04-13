---
phase: quick
plan: 260413-h6j
subsystem: frontend/settings-ui
tags: [settings, drag, live-preview, sidebar, context-menu]
dependency_graph:
  requires: []
  provides: [drag-via-dom-ref, live-preview-callbacks, sidebar-context-menus]
  affects: [SettingsDialog.tsx, Sidebar.tsx]
tech_stack:
  added: []
  patterns: [direct-DOM-mutation-for-perf, immediate-parent-callback-for-preview]
key_files:
  modified:
    - frontend/src/components/SettingsDialog.tsx
    - frontend/src/components/Sidebar.tsx
decisions:
  - Use dragOffsetRef + direct style.transform instead of useState to eliminate re-render on every mousemove
  - Call parent callbacks immediately on selection (not only on Save) so app previews changes live; Cancel reverts via same callbacks
  - Export/Import moved from sidebar header buttons to context menus (category + empty-space) to declutter header
metrics:
  duration: ~10min
  completed: "2026-04-13"
  tasks_completed: 2
  files_changed: 2
---

# Quick Plan 260413-h6j: Fix Draggable Lag, Live Preview, Import/Export Context Menus Summary

**One-liner:** DOM-direct drag (no setState in mousemove), live theme/font/density preview with Cancel revert, osPreference line removed, Import/Export moved from header buttons to sidebar context menus.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Fix drag lag and live preview in SettingsDialog | e2610db | SettingsDialog.tsx |
| 2 | Move Import/Export from sidebar header to context menus | e2610db | Sidebar.tsx |

## Changes Made

### SettingsDialog.tsx

**Drag lag fix:** Removed `dialogOffset` React state and replaced with `dragOffsetRef = useRef({x:0,y:0})`. The `onMove` handler now writes directly to `dialogRef.current.style.transform` — zero re-renders during drag. `handleHeaderMouseDown` reads origin from `dragOffsetRef.current` instead of state. `handleCancel` resets the DOM transform and ref.

**Live preview:** Each selection handler (`ThemeSwatch.onSelect` for built-in and custom themes, `FontPickerCard.onSelect` for UI and mono fonts, `CustomFontCard.onChange`, `ToggleGroup.onValueChange` for density) now immediately calls the parent callback alongside the draft setter. `handleCancel` calls all four parent callbacks with saved values to revert live preview on dismiss.

**osPreference removed:** Deleted the `<p>` element with the 🌙/☀️ indicator and the `osDark` useState + its useEffect entirely.

### Sidebar.tsx

**Header cleaned up:** Removed the two `Tooltip+Button` blocks for Export (Download icon) and Import (Upload icon) from the `sidebar-header`.

**Context menus:** Added Export and Import `ContextMenuItem` entries to:
1. Each named category's context menu (exports only that category's commands by filtering on `c.categoryId === cat.id`)
2. The empty-space/global context menu (exports all commands)

`Download` and `Upload` lucide-react imports retained since they're now used in context menus.

## Deviations from Plan

None — plan executed exactly as written.

## Self-Check

- [x] `frontend/src/components/SettingsDialog.tsx` — modified
- [x] `frontend/src/components/Sidebar.tsx` — modified
- [x] Commit e2610db exists
- [x] `pnpm tsc --noEmit` passes (0 errors)
- [x] No `setDialogOffset` calls remain
- [x] `osDark` state and effect absent
- [x] `osPreference` paragraph absent
- [x] Each theme/font/density handler calls parent callback immediately
- [x] `handleCancel` calls parent callbacks with saved values
- [x] Sidebar header has no Export/Import buttons
- [x] Category context menus have Export + Import items
- [x] Empty-space context menu has Export + Import items

## Self-Check: PASSED
