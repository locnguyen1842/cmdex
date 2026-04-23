# Cmdex — Project

## What This Is

Cmdex is a cross-platform desktop app for saving, organizing, and executing CLI commands as bash scripts with dynamic variable arguments. Built with Go + Wails v2 (backend) and React + TypeScript + Vite (frontend), with SQLite local storage.

## Core Value

Users can organize commands by project context, execute them with variable placeholders, and share them with the community — all in a clean, customizable interface.

## Current State (v1.3 In Progress)

**Milestone:** v1.3 Working Directory
**Tech Stack:** Go + Wails v3 + React + TypeScript + Tailwind + SQLite
**Status:** Phase 11 complete — execution engine supports working directory fallback chain (command → global default → home)

### v1.3 Features Delivered (so far)
- ✅ OSPathMap model for cross-OS working directory storage (Phase 10)
- ✅ Native directory picker via Wails binding (Phase 11)
- ✅ Executor runs commands in resolved working directory (Phase 11)
- ✅ Terminal launchers honor working directory (Phase 11)

### v1.0 Features Delivered

- ✅ Responsive sidebar (auto-collapse at ≤600px)
- ✅ Inline delete confirmation (no modals)
- ✅ 150ms transitions (tabs, sidebar, output pane)
- ✅ Unified script block (template/preview toggle)
- ✅ Theme engine (8 built-in themes, custom colors)
- ✅ OS dark/light preference sync
- ✅ Font selection (7 bundled fonts)
- ✅ Layout density (compact/comfortable/spacious)
- ✅ Import/Export (JSON with variables/presets)

### v1.0 Technical Debt

- No automated tests exist

## Current Milestone: v1.3 Working Directory

**Goal:** Allow users to optionally specify a working directory per command, with a global default fallback, stored persistently and used during execution.

**Target features:**
- Add `working_dir` field to the Command data model (Go + SQLite)
- UI input in Command Editor for setting/editing working directory per command
- Directory picker/selector integration (native file dialog via Wails)
- Command executor uses the stored working directory when spawning subprocesses
- Global "Default Working Directory" setting in Settings window
- Command execution falls back to global default when command has no specific directory set

---

## Previous Milestone: v1.2 DB Migration Refactor

**Goal:** Replace the monolithic inline `migrate()` function with a per-file up/down migration pattern — each migration in its own numbered Go file.

**Target features:**
- `migrations/` package with individual numbered files (e.g. `0001_initial.go`)
- Each file has `Up(tx *sql.Tx) error` and `Down(tx *sql.Tx) error`
- Migration runner handles discovery, ordering, and transaction wrapping automatically
- All 9 existing migrations ported to the new format
- `DB.RollbackTo(version int)` for dev/testing rollback

---

## Previous Milestone: v1.1 Build Settings Window

**Goal:** Convert the settings dialog from a popup/modal to a proper application Window using Wails window management.

**Target features:**
- Settings opened as separate application window (not dialog/popup)
- Window management (position, size, minimize, maximize)
- Settings persist and apply in real-time

---

## Next Milestone Goals (v2.0)

- **Workspaces** — Named project contexts with sidebar switcher
- **Cloud sync** — Cloudflare Workers + D1 + R2 backend
- **OAuth** — Google + GitHub sign-in
- **Command sharing** — Generate shareable links

## Out of Scope

- Real-time collaboration (sync is eventual, not live)
- Mobile app (desktop-first)
- Email/password auth (OAuth-only)
- Team/organization management (personal tool)

## Constraints

- Cloud: Cloudflare services (Workers + D1 + R2)
- Auth: OAuth only (Google/GitHub)
- Desktop: Wails v2

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `/gsd-transition`):
1. Requirements invalidated? → Move to Out of Scope with reason
2. Requirements validated? → Move to Validated with phase reference
3. New requirements emerged? → Add to Active
4. Decisions to log? → Add to Key Decisions
5. "What This Is" still accurate? → Update if drifted

**After each milestone** (via `/gsd-complete-milestone`):
1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state

---

*Last updated: 2026-04-23 — Phase 11 complete*