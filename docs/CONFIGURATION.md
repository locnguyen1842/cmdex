<!-- generated-by: gsd-doc-writer -->
# Configuration

Cmdex stores all user preferences and application data locally. This document describes every configurable aspect of the application, where settings are stored, and their default values.

---

## 1. App Settings Overview

User preferences are managed centrally through the **Settings** modal, accessible from the sidebar or via the `Cmd + ,` (macOS) / `Ctrl + ,` (Windows/Linux) keyboard shortcut. Settings are grouped into three tabs:

- **Appearance** — Themes, layout density, and custom theme import
- **Typography** — UI font and editor/monospace font selection
- **General** — Language/locale, terminal emulator, and data reset

Settings are persisted automatically to the local SQLite database when changed.

---

## 2. Appearance Settings

### Themes

Cmdex supports a collection of built-in color themes, plus the ability to import custom themes. The active theme is applied globally across the application.

| Theme ID | Label | Type |
|----------|-------|------|
| `vscode-dark` | VS Code Dark+ | Dark |
| `vscode-light` | VS Code Light+ | Light |
| `monokai` | Monokai | Dark |
| `tokyo-night` | Tokyo Night | Dark |
| `one-dark` | One Dark Pro | Dark |
| `classic` | Classic (Purple) | Dark |
| `catppuccin-mocha` | Catppuccin Mocha | Dark |
| `dracula` | Dracula | Dark |

- **Default:** `vscode-dark`
- The app tracks the last used dark and light theme separately, enabling quick toggling when the OS color scheme changes.
- **Custom themes** can be imported via a JSON file. The expected format includes `name`, `type` (`dark` or `light`), and a `colors` object with CSS variable mappings (e.g., `background`, `foreground`, `primary`, `accent`, `border`).

### Layout Density

Controls the spacing and compactness of the UI.

| Value | Label | Description |
|-------|-------|-------------|
| `compact` | Compact | Reduced padding and tighter spacing |
| `comfortable` | Comfortable | Balanced spacing (default) |
| `spacious` | Spacious | Increased padding and relaxed spacing |

- **Default:** `comfortable`
- Applied via the `data-density` HTML attribute on the document root.

---

## 3. Terminal Settings

The **Terminal** setting determines which terminal emulator is used when running a command via **"Run in Terminal"**.

- **Auto-detect** (default): The application automatically detects available terminal emulators on the system.
- **Manual selection**: Users can choose from a list of detected terminals.

Detected terminals are platform-specific:

- **macOS**: Terminal, iTerm2, Kitty, Hyper, Alacritty, WezTerm, Warp
- **Linux**: GNOME Terminal, Konsole, xterm, urxvt, Kitty, Alacritty, Tilix, Terminator, WezTerm, Hyper
- **Windows**: Windows Terminal, cmd, PowerShell, ConEmu, Cmder, Alacritty, WezTerm, Hyper

The terminal preference is stored as a terminal ID string (e.g., `iterm2`, `kitty`). An empty string means auto-detect.

---

## 4. Language / Locale

Cmdex supports internationalization via `react-i18next`.

- **Current supported languages:** English (`en`)
- **Default:** `en`
- The locale setting drives the UI language and is persisted across sessions.

---

## 5. Database Location

All application data — including commands, categories, variable presets, execution history, and settings — is stored in a local SQLite database.

| Property | Value |
|----------|-------|
| **Directory** | `~/.cmdex/` |
| **Database file** | `~/.cmdex/cmdex.db` |
| **Driver** | SQLite (via `modernc.org/sqlite`) |

The database is created automatically on first launch if it does not exist. It includes schema versioning and automatic migrations (current schema version: `9`).

---

## 6. Settings Storage (SQLite)

Application settings are stored in the `app_settings` table as a single JSON row.

### `app_settings` Table Schema

```sql
CREATE TABLE IF NOT EXISTS app_settings (
    data TEXT NOT NULL DEFAULT '{}'
);
```

The `data` column contains a JSON object with the following fields:

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `locale` | string | `"en"` | UI language code |
| `terminal` | string | `""` | Preferred terminal ID; empty = auto-detect |
| `theme` | string | `"vscode-dark"` | Active theme ID |
| `lastDarkTheme` | string | `"vscode-dark"` | Last selected dark theme |
| `lastLightTheme` | string | `"vscode-light"` | Last selected light theme |
| `customThemes` | string | `"[]"` | JSON-encoded array of custom theme objects |
| `uiFont` | string | `"Inter"` | Sans-serif UI font family |
| `monoFont` | string | `"JetBrains Mono"` | Monospace font for script editor |
| `density` | string | `"comfortable"` | Layout density (`compact`, `comfortable`, `spacious`) |
| `windowX` | int | `-1` | Settings window X position; `-1` = center |
| `windowY` | int | `-1` | Settings window Y position; `-1` = center |
| `windowWidth` | int | `640` | Settings window width (min: 480) |
| `windowHeight` | int | `520` | Settings window height (min: 400) |

### Persistence Behavior

- Settings are **auto-saved** to the database whenever a value changes in the UI.
- On startup, settings are loaded from the database and applied to the frontend state.
- A one-time migration from legacy `localStorage` keys (used in earlier versions) occurs automatically if present, after which the localStorage keys are cleared.
- Settings changes emit a `settingsChanged` Wails event so that all open windows stay synchronized.

### Resetting Data

Users can reset all application data from the **Danger Zone** section in Settings. This:

1. Deletes all commands, categories, tags, variable definitions, presets, and execution history
2. Resets `app_settings` to factory defaults
3. Runs `VACUUM` on the SQLite database to reclaim space

**This action is irreversible.**
