# Cmdex v2 — Premium Release

## What This Is

Cmdex is a cross-platform desktop app for saving, organizing, and executing CLI commands as bash scripts with dynamic variable arguments. Built with Go + Wails v2 (backend) and React + TypeScript + Vite (frontend), with SQLite local storage. This milestone adds workspace management, cloud sync/sharing, user-defined themes, and a comprehensive UI/UX overhaul to transform Cmdex into a premium command management tool.

## Core Value

Users can organize commands by project context, sync them across devices, and share them with the community — all in a clean, customizable interface.

## Requirements

### Validated

- ✓ Command CRUD (create, edit, delete, organize by category) — existing
- ✓ Variable template system (`{{var}}` placeholders with auto-detection) — existing
- ✓ Variable presets (named sets of variable values per command) — existing
- ✓ Script execution with streaming output — existing
- ✓ Tab-based editor with dirty state tracking — existing
- ✓ Full-text search (FTS5) across commands — existing
- ✓ Category management with drag-and-drop ordering — existing
- ✓ CEL expression support for variable defaults (`now()`, `env()`, `date()`) — existing
- ✓ Terminal emulator detection and external terminal launch — existing
- ✓ Keyboard shortcuts and command palette — existing
- ✓ i18n support (English) — existing
- ✓ Execution history tracking — existing
- ✓ Dark theme with CSS variable-based styling — existing

### Active

- [ ] UI/UX overhaul — simplify layout, reduce panel clutter, minimize modals, improve navigation flow
- [ ] Responsive layout — adapt to different window sizes
- [ ] Visual polish — animations, transitions, micro-interactions
- [ ] Workspace management — project-scoped command contexts with sidebar switcher
- [ ] Cloud backend — Cloudflare stack (Workers + D1 + R2)
- [ ] OAuth authentication — Google and GitHub sign-in (no email/password)
- [ ] Cross-device sync — sync commands, categories, presets across devices
- [ ] Command sharing via links — generate shareable links for commands/collections
- [ ] Public command gallery — browse, search, and import shared commands
- [ ] Full theme customization — colors, fonts, layout density
- [ ] Theme marketplace — create, export, import, and share themes

### Out of Scope

- Email/password authentication — OAuth-only keeps auth simple and secure
- Real-time collaboration — sync is eventual, not live co-editing
- Mobile app — desktop-first, Wails doesn't target mobile
- Paid subscriptions/monetization — premium features are free for this milestone
- Team/organization management — workspaces are personal project contexts, not shared team spaces
- Interactive shell in output panel — out of scope per existing design decision

## Context

- **Existing stack:** Go 1.25 + Wails v2.11 + React 19 + TypeScript 5.9 + Vite 7 + Tailwind v4 + SQLite (modernc.org/sqlite)
- **Frontend patterns:** shadcn/ui components (Radix + Tailwind + CVA), centralized state in App.tsx, Wails event streaming for output
- **Current pain points:** UI feels cluttered (too many panels, dense controls, modal overload), layout not responsive, navigation takes too many clicks
- **Cloud preference:** Cloudflare services (Workers for API, D1 for database, R2 for storage)
- **Auth preference:** OAuth only (Google + GitHub) — no password management
- **No tests exist** — no Go or frontend test files currently in the project

## Constraints

- **Tech stack**: Must use Cloudflare services for cloud backend — user preference for Cloudflare ecosystem
- **Auth**: OAuth-only (Google/GitHub) — no email/password flows
- **Desktop framework**: Wails v2 — existing investment, not migrating
- **Frontend**: React + TypeScript + Tailwind — existing stack, not changing
- **Data**: SQLite remains local data store — cloud sync is additive, not replacement

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Cloudflare for cloud backend | User preference; Workers + D1 + R2 covers API + DB + storage in one ecosystem | — Pending |
| OAuth-only auth | Simplifies auth flow; no password management overhead | — Pending |
| Workspace = project context | Commands grouped by project/directory, sidebar switcher to filter | — Pending |
| Full theming + marketplace | Colors, fonts, density + create/export/import/share themes | — Pending |
| UI simplification priority | Reduce panels, controls, modals before adding new features | — Pending |

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
*Last updated: 2026-04-08 after initialization*
