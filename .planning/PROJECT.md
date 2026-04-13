# Cmdex — Project

## What This Is

Cmdex is a cross-platform desktop app for saving, organizing, and executing CLI commands as bash scripts with dynamic variable arguments. Built with Go + Wails v2 (backend) and React + TypeScript + Vite (frontend), with SQLite local storage.

## Core Value

Users can organize commands by project context, execute them with variable placeholders, and share them with the community — all in a clean, customizable interface.

## Current State (v1.0 Shipped)

**Shipped:** 2026-04-13
**Tech Stack:** Go + Wails v2 + React + TypeScript + Tailwind + SQLite
**LOC:** ~3500 (Go + TypeScript)

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

---

*Last updated: 2026-04-13 after v1.0 milestone*