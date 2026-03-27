# Commamer

Commamer is a cross-platform desktop application for saving, organizing, and executing CLI commands with dynamic template variables. Built with Go + Wails v2 and React + TypeScript, it offers a fast, native-like experience with a modern dark-themed interface.

## Features

- **Template Variables**: Use `{{variableName}}` syntax in your scripts. Variables are auto-detected as you type and can also be added manually.
  ```bash
  docker logs -f --tail {{lines}} {{container_name}}
  ```
- **Categorized Storage**: Organize commands into custom categories with unique colors.
- **Variable Presets**: Save named sets of variable values for quick reuse.
- **CEL Default Values**: Variable defaults support [CEL expressions](https://github.com/google/cel-go) with built-in functions: `now()`, `env("KEY")`, `date("2006-01-02")`.
- **In-App Execution**: Run commands directly within the app with streaming output in an integrated terminal panel.
- **Run in Terminal**: Open commands in your preferred terminal emulator (auto-detects Terminal, iTerm2, Warp, Alacritty, Kitty, Ghostty, and more).
- **Full-Text Search**: Instantly filter commands by title, description, tags, or script content (powered by SQLite FTS5).
- **Local Storage**: All data is stored locally in `~/.commamer/commamer.db` (SQLite). No cloud sync, no external dependencies.
- **Dark Theme**: A premium dark UI with glassmorphism effects, smooth animations, and responsive layout.

## Tech Stack

- **Backend**: [Go](https://go.dev/) with [modernc.org/sqlite](https://pkg.go.dev/modernc.org/sqlite) (pure Go, no CGo)
- **Desktop Framework**: [Wails v2](https://wails.io/)
- **Frontend**: [React 18](https://react.dev/) + [TypeScript](https://www.typescriptlang.org/) + [Vite](https://vitejs.dev/)
- **UI**: [shadcn/ui](https://ui.shadcn.com/) (Radix UI + Tailwind CSS)

## Prerequisites

- Go 1.23+
- Node.js 18+ with [pnpm](https://pnpm.io/)
- [Wails v2 CLI](https://wails.io/docs/gettingstarted/installation):
  ```bash
  go install github.com/wailsapp/wails/v2/cmd/wails@latest
  ```

## Getting Started

1. **Clone the repository**:
   ```bash
   git clone <repo-url>
   cd commamer
   ```

2. **Install frontend dependencies**:
   ```bash
   cd frontend && pnpm install && cd ..
   ```

3. **Run in development mode** (hot-reloads frontend):
   ```bash
   wails dev
   ```

4. **Build for production**:
   ```bash
   wails build
   ```
   The binary will be in `build/bin/`.

## Variable Syntax

Use `{{variableName}}` anywhere in your script body. Variables are auto-detected from the template and appear in the editor's variable panel, where you can add descriptions, examples, and default values.

**Example:**
```bash
redis-cli --scan --pattern "{{pattern}}" | head -n {{limit}}
```

When executed, Commamer replaces `{{pattern}}` and `{{limit}}` with the values you provide (or their defaults), then runs the script.

**CEL defaults** let you compute values dynamically:
- `now()` — current timestamp (RFC3339)
- `env("HOME")` — read environment variables
- `date("2006-01-02")` — current date in custom format

## Project Structure

- `main.go` — Entry point, Wails window config, native menu
- `app.go` — Bound methods exposed to the frontend (CRUD, execution, search, settings)
- `models.go` — Core data types (`Command`, `Category`, `VariableDefinition`, etc.)
- `db.go` — SQLite database layer with schema migrations and FTS5 search
- `script.go` — `{{var}}` template extraction, replacement, and script generation
- `executor.go` — Script execution, streaming output, terminal detection, CEL evaluation
- `frontend/` — React + TypeScript + Vite frontend

## License

MIT License
