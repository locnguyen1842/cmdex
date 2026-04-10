---
phase: 01-layout-overhaul
plan: 02
subsystem: frontend/sidebar
tags: [ui, modal-reduction, popover, delete-confirmation, i18n]
dependency_graph:
  requires: []
  provides: [inline-delete-confirmation-sidebar]
  affects: [frontend/src/components/Sidebar.tsx, frontend/src/App.tsx, frontend/src/locales/en.json]
tech_stack:
  added: []
  patterns: [local-popover-state, inline-confirmation]
key_files:
  created: []
  modified:
    - frontend/src/components/Sidebar.tsx
    - frontend/src/App.tsx
    - frontend/src/locales/en.json
decisions:
  - Popover confirmation state is fully local to Sidebar — not lifted to App.tsx ModalState
  - CommandDetail onDelete also wired to handleDeleteCommand directly (all command delete paths now bypass modal)
  - confirmDelete case removed from ModalState union type entirely
metrics:
  duration: ~5 minutes
  completed: "2026-04-08T12:07:01Z"
  tasks_completed: 2
  tasks_total: 2
  files_modified: 3
---

# Phase 01 Plan 02: Inline Delete Confirmation Popover Summary

**One-liner:** Replaced full-screen confirmDelete AlertDialog with inline Radix Popover anchored to delete triggers in Sidebar, with local state management and i18n keys.

## What Was Built

Two inline Popover confirmations anchored to Sidebar delete triggers:

1. **Command delete (context menu):** Right-clicking a command item and selecting Delete now opens a Popover with "Delete?" label, a red "Delete" button, and a "Keep it" button. State tracked via `pendingDeleteCmd` (command id or null) local to Sidebar.

2. **Category delete (header X button):** Clicking the trash icon on a category header now opens the same Popover pattern. State tracked via `pendingDeleteCat` (category id or null) local to Sidebar.

Both Popovers dismiss on Escape, click-outside, or the "Keep it" button — with no data mutation.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Add inline Popover delete confirmation to Sidebar | d650304 | frontend/src/components/Sidebar.tsx |
| 2 | Remove confirmDelete modal from App.tsx and update i18n | 97a7d03 | frontend/src/App.tsx, frontend/src/locales/en.json |

## Key Changes

### Sidebar.tsx
- Added `pendingDeleteCmd` and `pendingDeleteCat` state (both `string | null`)
- Extended `SortableCommandItemProps` with `isPendingDelete`, `onRequestDelete`, `onCancelDelete`
- Context menu Delete item calls `onRequestDelete` (opens Popover) instead of direct delete
- Popover with hidden trigger span anchored inside ContextMenu
- Category header X button wrapped in `<Popover>` with `PopoverTrigger` — opens on click, confirms/dismisses inline

### App.tsx
- `handleDeleteCategory`: removed `setModal(confirmDelete)` — now calls `DeleteCategory` directly with toast feedback
- `handleDeleteCommand`: changed from sync `setModal` to async direct `DeleteCommand` call with toast feedback
- `CommandDetail` `onDelete` prop: now calls `void handleDeleteCommand(selectedCommand)` directly
- Removed entire `<AlertDialog open={modal.type === 'confirmDelete'} ...>` JSX block (~22 lines)
- Removed `{ type: 'confirmDelete'; itemType: 'command' | 'category'; id: string; name: string }` from `ModalState` union
- Removed `confirmDelete` async function entirely

### en.json
- Added `sidebar.deleteConfirm.label` = "Delete?"
- Added `sidebar.deleteConfirm.confirm` = "Delete"
- Added `sidebar.deleteConfirm.dismiss` = "Keep it"

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing coverage] CommandDetail onDelete also used confirmDelete modal**
- **Found during:** Task 2
- **Issue:** The `onDelete` prop passed to `CommandDetail` in App.tsx also triggered `setModal({ type: 'confirmDelete', ... })`. The plan focused on Sidebar flows but the task requirement was to remove the AlertDialog entirely — leaving CommandDetail wired to the now-removed modal case would cause a broken delete path.
- **Fix:** Updated `CommandDetail` `onDelete` prop to call `void handleDeleteCommand(selectedCommand)` directly.
- **Files modified:** frontend/src/App.tsx
- **Commit:** 97a7d03

## Known Stubs

None — all delete paths are fully wired to actual backend calls.

## Threat Flags

None — no new network endpoints, auth paths, or schema changes introduced. Existing STRIDE analysis in plan covers the Popover confirmation trust boundary (T-02-01 through T-02-03).

## Self-Check: PASSED

- [x] frontend/src/components/Sidebar.tsx modified with pendingDeleteCmd, pendingDeleteCat, inline Popovers
- [x] frontend/src/App.tsx: no `modal.type === 'confirmDelete'` references, no `setModal({ type: 'confirmDelete'`
- [x] frontend/src/locales/en.json contains `deleteConfirm` with `label`, `confirm`, `dismiss` keys
- [x] Commit d650304 exists (Task 1)
- [x] Commit 97a7d03 exists (Task 2)
- [x] TypeScript check passes (0 errors)
