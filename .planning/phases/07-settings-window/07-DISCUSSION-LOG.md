# Phase 7: Settings Window - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-13
**Phase:** 07-settings-window
**Areas discussed:** Window Persistence Storage, Settings Sync Mechanism, Component Architecture, Window Creation Trigger

---

## Window Persistence Storage

| Option | Description | Selected |
|--------|-------------|----------|
| SQLite (extend existing GetSettings/SetSettings) | Store window state in same DB as other settings | ✓ |
| JSON file in app data directory | Separate file for window state | |
| Wails v3 built-in window state API | Native framework API | |

**User's choice:** SQLite (extend existing GetSettings/SetSettings)
**Notes:** Recommended option. Aligns with existing patterns, simpler to implement.

---

## Settings Sync Mechanism

| Option | Description | Selected |
|--------|-------------|----------|
| Wails event system (`settings-changed` event) | Emit event, main window listens | ✓ |
| Main window polls GetSettings() on timer | Polling-based sync | |
| Direct DOM update via Go→JS bridge | Tight coupling approach | |

**User's choice:** Wails event system
**Notes:** Recommended option. Explicitly mentioned in roadmap technical notes, native to v3 architecture.

---

## Component Architecture

| Option | Description | Selected |
|--------|-------------|----------|
| Keep SettingsDialog, create separate SettingsWindow | Simple but code duplication | |
| Adapt SettingsDialog for both modal and window | Complex conditional logic | |
| Create SettingsPage, make SettingsDialog a wrapper | Balanced approach | ✓ |

**User's choice:** Create SettingsPage, make SettingsDialog a wrapper
**Notes:** Recommended option. Keeps code DRY while maintaining clean separation.

---

## Window Creation Trigger

| Option | Description | Selected |
|--------|-------------|----------|
| Create once on first open, hide on close | Good balance of resource usage and UX | ✓ |
| Create on each open, destroy on close | Clean but slower | |
| Pre-created at app startup | Fastest but uses resources always | |

**User's choice:** Create once on first open, hide on close
**Notes:** Recommended option. Most common pattern for preference windows.

---

## Deferred Ideas

None — discussion stayed within phase scope.
