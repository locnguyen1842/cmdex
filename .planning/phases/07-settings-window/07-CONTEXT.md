# Phase 7: Settings Window - Context

**Gathered:** 2026-04-13
**Status:** Ready for planning

<domain>
## Phase Boundary

Convert the settings dialog from a modal popup to a proper application window using Wails v3 multi-window support. The settings window opens independently, persists its position/size, and syncs changes to the main window in real-time via Wails events.

</domain>

<decisions>
## Implementation Decisions

### Window Persistence Storage
- **D-01:** Store settings window position and size in SQLite via existing GetSettings/SetSettings — extend AppSettings struct with window state fields (x, y, width, height). No new file I/O needed.

### Settings Sync Mechanism
- **D-02:** Use Wails v3 event system — emit `settings-changed` event from settings window when settings are saved, main window listens for this event and applies changes immediately. No polling needed.

### Settings Component Architecture
- **D-03:** Create a new `SettingsPage.tsx` component containing all settings content (tabs, forms, actions). The existing `SettingsDialog.tsx` becomes a thin wrapper that renders `SettingsPage` inside a Dialog. Settings window renders `SettingsPage` directly as a standalone page.

### Window Creation Trigger
- **D-04:** Create settings window on first open, hide on close (don't destroy), show on subsequent opens. Window handle persists in memory. On app shutdown, window is destroyed with app.

### Menu/Shortcut (SWIN-01)
- **D-05:** Menu item "Preferences..." (CmdOrCtrl+,) already implemented in Phase 6 — continues to emit `open-settings` event. Phase 7 wires this to open settings window instead of modal.

### Settings Close Behavior (SWIN-02)
- **D-06:** Clicking X button or pressing Escape closes (hides) the settings window. Settings window does not quit the app.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase context
- `.planning/milestones/v1.1-ROADMAP.md` — Phase 7 goal, success criteria (SWIN-01 through SWIN-05), technical notes on Wails v3 multi-window
- `.planning/REQUIREMENTS.md` — SWIN-01 through SWIN-05 requirement definitions
- `.planning/phases/06-wails-v3-migration/06-CONTEXT.md` — Phase 6 decisions (Wails v3 migration, big-bang approach, v3 alpha pinned)

### Existing code (what needs modifying)
- `main.go` — Creates main window via `app.Window.NewWithOptions`. Need to add settings window creation and menu click handler that opens it.
- `frontend/src/App.tsx` — Currently handles `open-settings` event by setting `modal.type === 'settings'`. Need to change to open window instead.
- `frontend/src/components/SettingsDialog.tsx` — Current modal-based settings. Will become thin wrapper around SettingsPage.
- `frontend/wailsjs/runtime/runtime.d.ts` — Wails v3 runtime with EventsEmit/EventsOn for sync, WindowGetPosition/WindowGetSize for persistence.
- `app.go` — App struct with `db *DB` for GetSettings/SetSettings.

### No external specs
- No ADRs for this phase. Wails v3 docs cover window and event APIs.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `SettingsDialog.tsx` — All settings UI (tabs: appearance, typography, general) already implemented. Will be refactored into `SettingsPage.tsx`.
- `SettingsDialog.tsx` props: `theme`, `onThemeChange`, `uiFont`, `monoFont`, `density`, `onUiFontChange`, `onMonoFontChange`, `onDensityChange`, `customThemes`, `onImportTheme`, `onRemoveCustomTheme`, `onResetAllData`
- `useKeyboardShortcuts` hook already handles Ctrl/Cmd+, for opening settings
- `Events` from `@wailsio/runtime` for EventsOn/EventsEmit

### Established Patterns
- Settings stored as JSON in SQLite via `GetSettings()`/`SetSettings()` — AppSettings struct contains theme, locale, terminal, fonts, density, customThemes
- Theme changes apply via `document.documentElement.setAttribute('data-theme', theme)` and CSS custom properties
- Font changes apply via `document.documentElement.style.setProperty('--font-sans/font-mono', value)`

### Integration Points
- `main.go:33` — Menu click handler emits `open-settings` event
- `App.tsx:458` — `Events.On('open-settings', ...)` sets modal to settings
- Settings window will be second WebviewWindow sharing same Go backend

</code_context>

<specifics>
## Specific Ideas

- Settings window should use same theme/stylesheet as main window (inherits CSS variables)
- Settings window minimum reasonable size: 480x400 (smaller would clip content)
- Settings window title: "Settings" (standard macOS convention)

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 07-settings-window*
*Context gathered: 2026-04-13*
