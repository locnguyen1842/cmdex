# Roadmap: Cmdex

## Milestones

- ✅ **v1.0 Premium Polish** — Phases 1-5 (shipped 2026-04-13)
- ✅ **v1.1 Build Settings Window** — Phases 6-7 (shipped)
- ✅ **v1.2 DB Migration Refactor** — Phases 8-9 (shipped)
- 🚧 **v1.3 Working Directory** — Phases 10-13 (in progress)
- 📋 **v2.0 Workspaces** — Phases (planned)

## Phases

<details>
<summary>✅ v1.0 Premium Polish (Phases 1-5) — SHIPPED 2026-04-13</summary>

### Phase 1: Layout Overhaul
**Goal**: Responsive layout with collapsible sidebar and smooth transitions
**Plans**: 3 plans

Plans:
- [x] 01-01: Responsive sidebar with auto-collapse
- [x] 01-02: Inline delete confirmation
- [x] 01-03: Transition polish (150ms)

### Phase 2: Editor & Interactions
**Goal**: Unified script block with template/preview toggle
**Plans**: 2 plans

Plans:
- [x] 02-01: Unified script block
- [x] 02-02: Editor interactions

### Phase 3: Theme Engine
**Goal**: Customizable theme system with OS dark/light sync
**Plans**: 3 plans

Plans:
- [x] 03-01: Theme engine core
- [x] 03-02: Built-in themes (8)
- [x] 03-03: OS preference sync

### Phase 4: Theme Customization
**Goal**: User-customizable colors, fonts, and layout density
**Plans**: 2 plans

Plans:
- [x] 04-01: Custom color picker
- [x] 04-02: Font & density settings

### Phase 5: Import & Export
**Goal**: JSON import/export with variables and presets
**Plans**: 2 plans

Plans:
- [x] 05-01: Export functionality
- [x] 05-02: Import functionality

</details>

<details>
<summary>✅ v1.1 Build Settings Window (Phases 6-7) — SHIPPED</summary>

### Phase 6: Wails Window Migration
**Goal**: Convert settings dialog to separate application window
**Plans**: TBD

Plans:
- [x] 06-01: Wails window setup
- [x] 06-02: Window management

### Phase 7: Settings Window Polish
**Goal**: Settings persist and apply in real-time
**Plans**: TBD

Plans:
- [x] 07-01: Real-time persistence
- [x] 07-02: Auto-save & UI polish

</details>

<details>
<summary>✅ v1.2 DB Migration Refactor (Phases 8-9) — SHIPPED</summary>

### Phase 8: Migration Package
**Goal**: Replace monolithic migrate() with per-file migration pattern
**Plans**: TBD

Plans:
- [x] 08-01: Migration package structure
- [x] 08-02: Migration runner

### Phase 9: Runner Integration
**Goal**: Port all existing migrations and add rollback support
**Plans**: TBD

Plans:
- [x] 09-01: Port existing migrations
- [x] 09-02: Rollback support

</details>

### 🚧 v1.3 Working Directory (In Progress)

**Milestone Goal:** Allow users to optionally specify a working directory per command, with a global default fallback, stored persistently and used during execution.

#### Phase 10: Data Foundation
**Goal**: Working directory data is persistently stored and can be imported/exported across OSes
**Depends on**: Phase 9
**Requirements**: DATA-01, DATA-02, DATA-03, DATA-04
**Success Criteria** (what must be TRUE):
  1. Command records can store and retrieve OS-keyed working directory data
  2. Settings records can store and retrieve OS-keyed default working directory data
  3. Database schema supports working_dir and default_working_dir columns via migration
  4. Import/export JSON preserves working directory data in OS-keyed format
**Plans**: 3 plans
**UI hint**: no

Plans:
- [ ] 10-01-PLAN.md — Define OSPathMap type and add working directory fields to Command/AppSettings models + TypeScript types
- [ ] 10-02-PLAN.md — Create migration 0010 and update db.go CRUD queries to persist WorkingDir
- [ ] 10-03-PLAN.md — Update import/export structs and wire WorkingDir through export/import round-trip

#### Phase 11: Execution Engine & Directory Picker
**Goal**: Commands execute in the correct working directory with a native directory picker available
**Depends on**: Phase 10
**Requirements**: EXEC-01, EXEC-02, EXEC-03, UIUX-02
**Success Criteria** (what must be TRUE):
  1. User can open a native directory picker dialog from the app via Wails bindings
  2. Commands execute in their specified working directory for the current OS when set
  3. Commands fall back to the global default working directory when none is specified per command
  4. Commands fall back to the OS home directory when neither command nor global default is configured
**Plans**: TBD
**UI hint**: no

Plans:
- [ ] 11-01: Add Wails binding for native directory picker dialog
- [ ] 11-02: Update executor to run commands in stored working directory with fallback chain
- [ ] 11-03: Wire executor fallback logic (command → global default → OS home)

#### Phase 12: Settings UI
**Goal**: Users can configure a global default working directory in the Settings window
**Depends on**: Phase 10, Phase 11
**Requirements**: SETT-01, SETT-02, SETT-03
**Success Criteria** (what must be TRUE):
  1. Settings window displays a working directory input with a browse button
  2. User can set and clear the global default working directory
  3. Global default persists across app restarts and applies to the current OS only
  4. UI shows only the current OS path, hiding the OS-keyed JSON abstraction
**Plans**: TBD
**UI hint**: yes

Plans:
- [ ] 12-01: Add working directory input with browse button to Settings window
- [ ] 12-02: Implement transparent OS-path read/write (hide JSON abstraction)
- [ ] 12-03: Persist and load global default working directory on app start

#### Phase 13: Command Editor & List UI
**Goal**: Users can set and view working directories per command transparently
**Depends on**: Phase 10, Phase 11
**Requirements**: UIUX-01, UIUX-03, UIUX-04
**Success Criteria** (what must be TRUE):
  1. Command Editor includes a working directory input with a browse button
  2. Command list and/or detail view displays the configured working directory as a plain path
  3. User never sees JSON structure or OS keys — only current OS path is ever exposed
  4. Working directory field can be left empty (no directory set)
**Plans**: TBD
**UI hint**: yes

Plans:
- [ ] 13-01: Add working directory input with browse button to Command Editor
- [ ] 13-02: Display working directory in command list/detail view
- [ ] 13-03: Ensure UI transparency — hide OS-keyed storage from users

## Progress

**Execution Order:**
Phases execute in numeric order: 10 → 11 → 12 → 13

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 1. Layout Overhaul | v1.0 | 3/3 | Complete | 2026-04-13 |
| 2. Editor & Interactions | v1.0 | 2/2 | Complete | 2026-04-13 |
| 3. Theme Engine | v1.0 | 3/3 | Complete | 2026-04-13 |
| 4. Theme Customization | v1.0 | 2/2 | Complete | 2026-04-13 |
| 5. Import & Export | v1.0 | 2/2 | Complete | 2026-04-13 |
| 6. Wails Window Migration | v1.1 | 2/2 | Complete | — |
| 7. Settings Window Polish | v1.1 | 2/2 | Complete | — |
| 8. Migration Package | v1.2 | 2/2 | Complete | — |
| 9. Runner Integration | v1.2 | 2/2 | Complete | — |
| 10. Data Foundation | v1.3 | 0/3 | Not started | — |
| 11. Execution Engine & Directory Picker | v1.3 | 0/3 | Not started | — |
| 12. Settings UI | v1.3 | 0/3 | Not started | — |
| 13. Command Editor & List UI | v1.3 | 0/3 | Not started | — |
