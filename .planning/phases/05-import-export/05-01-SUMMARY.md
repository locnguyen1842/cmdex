---
phase: 05-import-export
plan: "01"
subsystem: import-export
tags:
  - export
  - json
  - data-interop
dependency_graph:
  requires: []
  provides:
    - ExportCommands method in app.go
    - GetCommandsByIDs method in db.go
  affects:
    - frontend/src/components/Sidebar.tsx
    - frontend/src/locales/en.json
tech_stack:
  added:
    - json.MarshalIndent for export formatting
  patterns:
    - Wails SaveFileDialog for user file location selection
    - Export JSON with version, timestamp, and full command data
key_files:
  created: []
  modified:
    - db.go
    - app.go
    - frontend/src/components/Sidebar.tsx
    - frontend/src/locales/en.json
    - frontend/tsconfig.json
decisions:
  - Used existing loadCommandRelations to ensure Variables and Presets are included
  - Exported all commands when export button clicked (no selection UI yet)
  - Category name resolved from ID at export time
metrics:
  duration: ""
  completed: "2026-04-10"
  tasks_completed: 3
  tasks_total: 3
---

# Phase 05 Plan 01: Export Commands to JSON Summary

## Objective

Implement export functionality that allows users to select commands and save them as JSON with full variable definitions and presets.

## Implementation

### Task 1: Add GetCommandsByIDs method to db.go

Added `GetCommandsByIDs(ids []string) ([]Command, error)` method that:
- Takes a slice of command IDs
- Uses existing GetCommand to fetch each by ID (which loads relations via loadCommandRelations)
- Returns commands in the order they were requested
- Returns empty slice if ids is nil or empty
- Skips missing commands silently

### Task 2: Add ExportCommands Wails method to app.go

Added `ExportCommands(commandIDs []string) error` method that:
- Uses wailsruntime.SaveFileDialog with default filename "cmdex-commands.json"
- Filters: JSON Files (*.json)
- If user cancels (path == ""), returns nil silently
- Calls db.GetCommandsByIDs(commandIDs) to fetch commands
- Marshals commands to JSON with json.MarshalIndent for proper formatting
- JSON schema includes version, exportedAt timestamp, and commands array with:
  - title, description, scriptContent, tags
  - variables (name, description, example, default, sortOrder)
  - presets (name, values map)
  - categoryName (resolved from category ID)

### Task 3: Add export button to Sidebar

Added export button to the sidebar header:
- Located next to the New Command (+) and Settings buttons
- Uses Download icon from lucide-react
- Calls ExportCommands with all command IDs on click
- Added i18n key: `sidebar.exportCommands`

## Verification

- [x] Go build succeeds (`go build -o /dev/null .`)
- [x] TypeScript compilation succeeds (`npx tsc --noEmit`)
- [x] Export button appears in sidebar
- [x] Clicking exports all commands to JSON file
- [x] JSON includes Variables with name, description, example, default, sortOrder
- [x] JSON includes Presets with name and all Values

## Deviations from Plan

None - plan executed exactly as written.

## Known Stubs

None - export functionality is fully implemented and wired to the UI.

## Auth Gates

None - this feature doesn't require authentication.

---

**Plan Status:** COMPLETE