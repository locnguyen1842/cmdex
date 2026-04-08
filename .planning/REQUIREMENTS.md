# Requirements: Cmdex v2 — Premium Polish

**Defined:** 2026-04-08
**Core Value:** Users can organize commands by project context, sync them across devices, and share them with the community — all in a clean, customizable interface.

## v1 Requirements

Requirements for initial release. Each maps to roadmap phases.

### UI/UX Overhaul

- [ ] **UIUX-01**: Layout adapts to different window sizes with collapsible sidebar
- [ ] **UIUX-02**: Confirmation modals replaced with inline actions where possible
- [ ] **UIUX-03**: Smooth transitions on tab switches, panel toggles, sidebar collapse
- [ ] **UIUX-04**: Consistent spacing, whitespace, and visual hierarchy throughout
- [ ] **UIUX-05**: Template and preview blocks merged into a single unified script content block

### Themes

- [ ] **THME-01**: User can customize primary, accent, background, and text colors
- [ ] **THME-02**: Light and dark mode toggle with OS preference sync
- [ ] **THME-03**: 5-10 built-in preset themes (Catppuccin, Dracula, Nord, Solarized, etc.)
- [ ] **THME-04**: User can change editor and UI fonts
- [ ] **THME-05**: Layout density options (compact, comfortable, spacious)

### Import/Export

- [ ] **IMEX-01**: User can export commands as JSON file (with variables and presets intact)
- [ ] **IMEX-02**: User can import commands from JSON file with one-click

## v2 Requirements

Deferred to future release. Tracked but not in current roadmap.

### Workspaces

- **WORK-01**: User can create named workspaces
- **WORK-02**: User can rename and delete workspaces
- **WORK-03**: Sidebar shows workspace switcher dropdown to filter commands
- **WORK-04**: Default/global workspace shows commands not assigned to any workspace
- **WORK-05**: User can switch workspaces via keyboard shortcut

### Cloud & Auth

- **CLOD-01**: OAuth authentication (Google + GitHub sign-in)
- **CLOD-02**: Automatic background sync (offline-first, eventual consistency)
- **CLOD-03**: Sync status indicator
- **CLOD-04**: Selective sync (toggle per data type)

### Command Sharing

- **SHAR-01**: Generate shareable link for a command
- **SHAR-02**: View shared command without account
- **SHAR-03**: Share link preview (Open Graph tags)
- **SHAR-04**: Public command gallery with search

### Theme Marketplace

- **MKTL-01**: Create, export, import, and share themes with community
- **MKTL-02**: Theme preview before applying from marketplace

## Out of Scope

| Feature | Reason |
|---------|--------|
| Real-time collaboration / live co-editing | Enormous complexity; Cmdex is a personal tool |
| Team/organization management with roles | Scope creep into B2B SaaS territory |
| Full terminal emulator in app | Interactive shells need PTY, ANSI rendering — out of scope per existing decision |
| Email/password authentication | OAuth-only keeps auth simple and secure |
| Automatic command versioning/history | Database bloat; execution history already exists |
| Plugin/extension system | Massive engineering effort for plugin API and sandboxing |
| Mobile app | Desktop-first; Wails doesn't target mobile |
| Paid subscriptions/monetization | Premium features are free for this milestone |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| UIUX-01 | TBD | Pending |
| UIUX-02 | TBD | Pending |
| UIUX-03 | TBD | Pending |
| UIUX-04 | TBD | Pending |
| UIUX-05 | TBD | Pending |
| THME-01 | TBD | Pending |
| THME-02 | TBD | Pending |
| THME-03 | TBD | Pending |
| THME-04 | TBD | Pending |
| THME-05 | TBD | Pending |
| IMEX-01 | TBD | Pending |
| IMEX-02 | TBD | Pending |

**Coverage:**
- v1 requirements: 12 total
- Mapped to phases: 0
- Unmapped: 12 ⚠️

---
*Requirements defined: 2026-04-08*
*Last updated: 2026-04-08 after initial definition*
