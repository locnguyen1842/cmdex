# Roadmap: Cmdex v2 — Premium Polish

## Overview

This milestone transforms Cmdex from a functional command manager into a polished, customizable desktop app. The work progresses from structural layout changes (responsive, decluttered) through visual refinement (transitions, unified editor), into a full theme system (colors, light/dark, presets, fonts, density), and closes with import/export for command portability. Each phase delivers observable improvements users can see and feel immediately.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [ ] **Phase 1: Layout Overhaul** - Responsive layout, inline actions replacing modals, consistent visual hierarchy
- [ ] **Phase 2: Editor & Interactions** - Unified script block and smooth transitions throughout the app
- [ ] **Phase 3: Theme Engine** - Color customization, light/dark mode, and built-in preset themes
- [ ] **Phase 4: Theme Customization** - Font selection and layout density options
- [ ] **Phase 5: Import & Export** - Command portability via JSON files

## Phase Details

### Phase 1: Layout Overhaul
**Goal**: Users experience a clean, responsive interface that works at any window size and minimizes interruptions
**Depends on**: Nothing (first phase)
**Requirements**: UIUX-01, UIUX-02, UIUX-04
**Success Criteria** (what must be TRUE):
  1. User can resize the window from narrow to wide and the layout adapts without breaking or clipping
  2. Sidebar collapses to icons or hides entirely at narrow widths
  3. Destructive actions (delete command, delete category) use inline confirmation instead of modal dialogs
  4. Spacing between controls, panels, and sections follows a consistent rhythm with clear visual hierarchy
**Plans**: 3 plans

Plans:
- [x] 01-01-PLAN.md — Auto-collapse sidebar on window resize (≤600px) via ResizablePanel window.resize listener; 44px rail width
- [x] 01-02-PLAN.md — Replace confirmDelete AlertDialog with inline Popover in Sidebar; remove modal path from App.tsx
- [x] 01-03-PLAN.md — Spacing normalization pass: sidebar density, pane headers, main-body, panel separators

### Phase 2: Editor & Interactions
**Goal**: Users interact with a streamlined editor and feel the app respond fluidly to every action
**Depends on**: Phase 1
**Requirements**: UIUX-05, UIUX-03
**Success Criteria** (what must be TRUE):
  1. Template placeholders and resolved preview are visible in a single unified script block (no separate panels to toggle between)
  2. Tab switches animate smoothly rather than snapping instantly
  3. Sidebar collapse/expand and panel toggles use visible transitions
  4. No layout jumps or flicker during transitions
**Plans**: TBD

Plans:
- [ ] 02-01: TBD
- [ ] 02-02: TBD

### Phase 3: Theme Engine
**Goal**: Users can personalize the app's color scheme and switch between light and dark appearances
**Depends on**: Phase 1
**Requirements**: THME-01, THME-02, THME-03
**Success Criteria** (what must be TRUE):
  1. User can open a theme settings panel and change primary, accent, background, and text colors with live preview
  2. User can toggle between light and dark mode from the UI
  3. App respects OS light/dark preference on startup and when the OS setting changes
  4. User can select from at least 5 built-in themes (e.g., Catppuccin, Dracula, Nord, Solarized, One Dark) and the app updates immediately
**Plans**: TBD

Plans:
- [ ] 03-01: TBD
- [ ] 03-02: TBD
- [ ] 03-03: TBD

### Phase 4: Theme Customization
**Goal**: Users can fine-tune typography and information density to match their preferences
**Depends on**: Phase 3
**Requirements**: THME-04, THME-05
**Success Criteria** (what must be TRUE):
  1. User can change the editor font and the UI font independently, and the change applies immediately
  2. User can switch between compact, comfortable, and spacious density modes
  3. Density change visibly adjusts padding, margins, and font sizes across all views
**Plans**: TBD

Plans:
- [ ] 04-01: TBD
- [ ] 04-02: TBD

### Phase 5: Import & Export
**Goal**: Users can move commands between machines or share them as files
**Depends on**: Phase 1
**Requirements**: IMEX-01, IMEX-02
**Success Criteria** (what must be TRUE):
  1. User can export selected commands to a JSON file that includes variable definitions and presets
  2. User can import commands from a JSON file with one click and see them appear in the sidebar
  3. Imported commands preserve all variable definitions and preset values from the export
**Plans**: TBD

Plans:
- [ ] 05-01: TBD
- [ ] 05-02: TBD

## Progress

**Execution Order:**
Phases execute in numeric order: 1 -> 2 -> 3 -> 4 -> 5

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Layout Overhaul | 0/3 | Not started | - |
| 2. Editor & Interactions | 0/2 | Not started | - |
| 3. Theme Engine | 0/3 | Not started | - |
| 4. Theme Customization | 0/2 | Not started | - |
| 5. Import & Export | 0/2 | Not started | - |
