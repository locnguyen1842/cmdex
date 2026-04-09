---
phase: 02-editor-interactions
plan: 01
subsystem: frontend/editor
tags: [ui, script-editor, unified-block, preview, template]
dependency_graph:
  requires: []
  provides: [unified-script-block, showPreview-toggle]
  affects: [CommandDetail.tsx]
tech_stack:
  added: []
  patterns: [unified-script-block, mode-toggle]
key_files:
  created: []
  modified:
    - frontend/src/components/CommandDetail.tsx
    - frontend/src/style.css
    - frontend/src/locales/en.json
decisions:
  - "Kept revert/save preset controls in the variable inputs panel below unified block"
  - "showPreview state resets to false on command.id change so Template mode is always default"
metrics:
  duration: "~10 minutes"
  completed: "2026-04-09T05:07:38Z"
  tasks_completed: 1
  tasks_total: 1
  files_modified: 3
---

# Phase 02 Plan 01: Unified Script Block Summary

**One-liner:** Replaced dual template+preview boxes with a single script block using a Code2/Eye icon toggle to switch between Template mode ({{var}} tokens) and Preview mode (resolved values or dimmed [varName] placeholders).

## What Was Built

- **Unified script block:** Single `command-text-box-inner` replacing two separate boxes
- **Toggle button:** Eye icon (show preview) / Code2 icon (show template) in the block header
- **`renderScriptUnified` memo:** Conditional rendering — Template mode shows `{{var}}` tokens as `.var-missing` spans; Preview mode shows resolved values as `.var-filled` or unresolved vars as `.var-placeholder-muted`
- **Single copy handler:** `handleCopy` copies template content in Template mode, resolved content in Preview mode
- **Preset variable panel:** Moved below unified block without a separate header; save/revert buttons only shown when `hasUnsavedChanges`
- **CSS:** Added `.var-placeholder-muted` and `.var-placeholder-muted.var-focused` rules
- **i18n:** Added `showPreview` and `showTemplate` keys

## Tasks

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Unify Template and Preview into a single script block | 87fb3cc | CommandDetail.tsx, style.css, en.json |

## Acceptance Criteria Results

| Check | Result |
|-------|--------|
| `showPreview` count >= 5 | 13 references |
| No `copiedTemplate`/`copiedPreview` | Confirmed |
| `Code2` and `Eye` imported + used | Lines 60-61, 905, 907 |
| `.var-placeholder-muted` in style.css | Lines 1335, 1340 |
| `showPreview`/`showTemplate` in en.json | Lines 48-49 |
| `command-text-box-label` count = 1 | Confirmed |
| TypeScript compilation | Passes |

## Deviations from Plan

**1. [Rule 2 - Missing functionality] Added save/revert preset controls to variable panel**

- **Found during:** Task 1 — Step 4 restructuring
- **Issue:** The plan removed the Preview box header (which contained revert/save preset buttons) but did not specify where those controls should move
- **Fix:** Added inline save/revert buttons below the variable inputs in the preset section, rendered conditionally when `hasUnsavedChanges` is true
- **Files modified:** `frontend/src/components/CommandDetail.tsx`
- **Commit:** 87fb3cc

## Known Stubs

None — all functionality is wired. Variable inputs update `overrides`, `resolvedValues` is computed from preset + overrides, `renderScriptUnified` consumes `resolvedValues`.

## Threat Flags

None — all variable values rendered as React text nodes (not innerHTML). No new network endpoints or auth paths introduced.

## Self-Check: PASSED

- [x] `frontend/src/components/CommandDetail.tsx` — exists and modified
- [x] `frontend/src/style.css` — exists and modified
- [x] `frontend/src/locales/en.json` — exists and modified
- [x] Commit `87fb3cc` — confirmed in git log
