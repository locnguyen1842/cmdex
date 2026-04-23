# Requirements: v1.3 Working Directory

**Milestone:** v1.3
**Name:** Working Directory
**Started:** 2026-04-23
**Status:** Planning

---

## v1.3 Requirements

### Data Model & Storage (DATA)

- [ ] **DATA-01**: Command model stores working directories as a JSON object keyed by OS (`darwin`, `windows`, `linux`), allowing per-OS paths
- [ ] **DATA-02**: Settings model stores the global default working directory as a JSON object keyed by OS
- [ ] **DATA-03**: Database migration adds `working_dir` (JSON text) to the commands table and `default_working_dir` (JSON text) to the settings table
- [ ] **DATA-04**: Import/Export JSON format supports the OS-keyed working directory object so cross-OS imports work seamlessly

### Settings & Defaults (SETT)

- [ ] **SETT-01**: Settings window provides a working directory input with a browse button to set the global default
- [ ] **SETT-02**: Global default working directory is persisted as JSON (transparent to user) and loaded on app start for the current OS
- [ ] **SETT-03**: UI only exposes the current OS path — user inputs a plain path without seeing OS-specific abstraction

### UI/UX (UIUX)

- [ ] **UIUX-01**: Command Editor includes a working directory input with a browse button; user enters a plain path without seeing OS-specific abstraction
- [ ] **UIUX-02**: Native directory picker dialog is available via Wails bindings for both Settings and Command Editor
- [ ] **UIUX-03**: Command list and/or detail view displays the configured working directory as a plain path (current OS only)
- [ ] **UIUX-04**: UI is completely transparent about OS-keyed storage — user never sees the JSON structure or OS keys

### Command Execution (EXEC)

- [ ] **EXEC-01**: Executor runs the command subprocess in the command's stored working directory for the current OS when set
- [ ] **EXEC-02**: When a command has no working dir for the current OS, the executor falls back to the global `default_working_dir` for the current OS
- [ ] **EXEC-03**: When neither command nor global default is set for the current OS, the executor falls back to the OS-appropriate default directory (e.g., user's home directory)

---

## Future Requirements

- **EXEC-04**: Validate that the working directory exists before executing and surface a clear error if not
- **EXEC-05**: Prompt the user to select a working directory at execution time if none is configured
- **UIUX-05**: Visual indicator in the command list for commands that have a custom working directory set

---

## Out of Scope

- Changing the working directory dynamically during command execution (per-command only, no mid-script cd)
- Remote/network directories as working directories (local filesystem only)
- Working directory templates or variables (e.g., `${PROJECT_ROOT}`) — plain absolute/relative paths only
- Per-category or per-workspace default working directories (deferred to v2.0 Workspaces)
- Exposing OS-keyed paths in the UI — only current OS is ever visible

---

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| DATA-01 | — | Pending |
| DATA-02 | — | Pending |
| DATA-03 | — | Pending |
| DATA-04 | — | Pending |
| SETT-01 | — | Pending |
| SETT-02 | — | Pending |
| SETT-03 | — | Pending |
| UIUX-01 | — | Pending |
| UIUX-02 | — | Pending |
| UIUX-03 | — | Pending |
| UIUX-04 | — | Pending |
| EXEC-01 | — | Pending |
| EXEC-02 | — | Pending |
| EXEC-03 | — | Pending |

**Coverage:** 14/14 (100%)

---

*Last updated: 2026-04-23*
