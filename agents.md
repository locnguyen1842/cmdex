# Agents documentation

This document describes how an AI agent can continue development on the **Cmdex** application.

## Project Overview

**Cmdex** is a cross-platform desktop app for saving and executing CLI commands with variable placeholders (e.g., `echo ${message}`). It is built with:
- **Go** (Backend, file I/O, subprocess execution)
- **Wails v2** (Desktop bindings & window management)
- **React 18 + Vite + TypeScript** (Frontend UI)

## Key Architectural Concepts

### 1. Data Flow (Wails Bindings)
The Go backend exposes methods via the `App` struct in `app.go`. During build/dev time, Wails automatically generates TypeScript bindings in `frontend/wailsjs/go/main/App.ts` and `App.d.ts`.
- **To add a new backend feature:**
  1. Add a method to the `App` struct in `app.go` (e.g., `func (a *App) ExportData() string`).
  2. Run `wails generate module` (or run `wails dev` which does this automatically).
  3. Import the generated function in your React component: `import { ExportData } from '../wailsjs/go/main/App'`.

### 2. Local Storage (`store.go`)
Data is stored locally in `~/.cmdex/cmdex.db`.
- The `Store` struct uses a `sync.Mutex` to ensure thread-safe read/write operations.
- Data structures are defined in `models.go`.

### 3. Command Execution (`executor.go`)
- The app uses `os/exec` to run commands.
- **Variables** are identified by the regex `\$\{(\w+)\}`. The app parses `${varName}` into prompt objects, waits for user input from the React UI, substitutes the values back into the string, and executes.
- Platform awareness: Uses `/bin/sh -c` on Mac/Linux and `cmd /C` on Windows.

### 4. Frontend State & UI (`frontend/src/`)
- All primary logic and modaling is handled centrally in `App.tsx`.
- The design system is custom CSS located in `style.css`. It heavily uses CSS variables (`--bg-primary`, `--accent-primary`) for its dark theme. If modifying colors, update the CSS variables rather than hardcoding.
- Modals (Command Editor, Variable Prompt, etc.) are managed via a single discriminated union state `modal` in `App.tsx`.

## Common Tasks for Agents

### Adding a new field to a Command or Category
1. Update the struct in `models.go`.
2. Update the `Create` and `Update` method signatures in `app.go`.
3. Update the data mappings in the CRUD logic within `app.go`.
4. Update the TypeScript interfaces in `frontend/src/types.ts`.
5. Update `CommandDetail.tsx` or `CategoryEditor.tsx` to handle the new input.
6. Update `App.tsx` where the Create/Update functions are called.

### Updating Wails config
Window dimensions, title, background color, and platform-specific tweaks (like Mac properties) are configured in `main.go` inside the `wails.Run(&options.App{...})` block.

## Useful Commands

- **Run Dev Server** (auto-reloads frontend, requires manual restart for Go changes):
  ```bash
  wails dev
  ```
- **Generate Bindings Manually** (if you just want to update TS types after a Go change without launching the frontend):
  ```bash
  wails generate module
  ```
- **Build Release Binary**:
  ```bash
  wails build
  ```
- **Check TypeScript Types**:
  ```bash
  cd frontend && npx tsc --noEmit
  ```

## Current Limitations & Known Considerations
- The terminal output panel is a simple `<div>` that renders textual standard output. It does not handle interactive shells (like `vim`, `htop`, or REPLs) or advanced ANSI color codes (though ANSI stripping could be added).
- Large JSON data files could theoretically slow down the synchronous read/write operations, though for typical command note-taking, this is negligible.
