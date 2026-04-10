---
phase: 05-import-export
plan: "02"
subsystem: import-export
tags:
  - import
  - json
  - data-interop
dependency_graph:
  requires: []
  provides:
    - ImportCommands method in app.go
    - db.ImportCommands method in db.go
  affects:
    - frontend/src/components/Sidebar.tsx
    - frontend/src/App.tsx
    - frontend/src/locales/en.json
tech_stack:
  added:
    - json.Unmarshal for import parsing
    - uuid for new IDs
  patterns:
    - Wails OpenFileDialog for file selection
    - Transaction-based import with rollback on error
    - Category creation for unknown category names
key_files:
  created: []
  modified:
    - app.go
    - db.go
    - frontend/src/components/Sidebar.tsx
    - frontend/src/App.tsx
decisions:
  - Used transaction for all import operations with rollback on error
  - Creates new category with default icon/color if imported category doesn't exist
  - Imports both variables and presets from JSON
  - onImport callback refreshes both categories and commands after import
metrics:
  duration: ""
  completed: "2026-04-10"
  tasks_completed: 3
  tasks_total: 3
---

# Phase 05 Plan 02: Import Commands from JSON Summary

## Objective

Implement import functionality that parses JSON and creates commands with full variable definitions and presets.

## Implementation

### Task 1: Add ImportCommands Wails method

Added `ImportCommands() ([]Command, error)` method to app.go that:
- Uses wailsruntime.OpenFileDialog with filters: JSON Files (*.json)
- If user cancels (path == ""), returns nil silently
- Reads file via os.ReadFile
- Validates JSON schema version (accepts "1.0")
- Parses JSON into ImportData struct
- Converts commands to db-compatible format
- Calls db.ImportCommands to persist
- Returns all commands (for UI refresh)

### Task 2: Add db.ImportCommands method

Added `ImportCommands(commands []...) error` method to DB struct that:
- Starts a transaction
- Builds category name -> ID map from existing categories
- For each imported command:
  - Looks up or creates category by name (case-sensitive)
  - Creates new UUID for command
  - Inserts command with title, description, script_content
  - Saves tags (upserts tags table, links via command_tags)
  - Saves variables (sort_order from array index)
  - Saves presets with values (new UUID per preset)
- Commits on success, rolls back on error

### Task 3: Add import button to Sidebar

Added import button to sidebar header:
- Located next to export button
- Uses Upload icon from lucide-react
- Calls ImportCommands() on click
- On success: calls onImport callback to refresh UI
- Added onImport prop to Sidebar for parent to handle refresh
- App.tsx implements onImport to reload categories and commands

## Verification

- [x] Go build succeeds (`go build -o /dev/null .`)
- [x] TypeScript compilation succeeds (`npx tsc --noEmit`)
- [x] Import button appears in sidebar
- [x] Clicking opens file picker for JSON
- [x] Valid JSON imports successfully
- [x] Commands appear in sidebar with Variables and Presets
- [x] New category created if categoryName doesn't exist

## Deviations from Plan

None - plan executed exactly as written.

## Known Stubs

None - import functionality is fully implemented and wired to the UI.

## Auth Gates

None - this feature doesn't require authentication.

---

**Plan Status:** COMPLETE