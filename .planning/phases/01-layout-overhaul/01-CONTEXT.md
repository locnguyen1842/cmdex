# Phase 1: Layout Overhaul - Context

**Gathered:** 2026-04-08
**Status:** Ready for planning

<domain>
## Phase Boundary

Responsive layout, inline actions replacing modals, and consistent visual hierarchy. Users experience a clean interface that works at any window size and minimizes interruptions. Animations/transitions are Phase 2; theme engine is Phase 3.

</domain>

<decisions>
## Implementation Decisions

### Sidebar Responsive Behavior
- **D-01:** Sidebar auto-collapses to icon rail when window width drops below ~600px. User can manually expand it after auto-collapse.
- **D-02:** Collapsed state shows the existing icon rail (the `ResizablePanel` collapsed render — app logo icon, click to expand). No full-hide / hamburger overlay needed.
- **D-03:** `ResizablePanel` must be extended to observe `window.resize` events and trigger collapse automatically when threshold is crossed. Existing localStorage persistence of collapsed state still applies.

### Inline Confirmation Pattern
- **D-04:** Delete command and delete category use a **popover confirmation** anchored to the trash icon. Popover shows "Delete?" label with a [Delete] button and an [X] cancel. No full-screen overlay.
- **D-05:** Scope: only `confirmDelete` (command and category) becomes inline. Discard unsaved changes, clear history, and CategoryEditor remain as dialogs — they have more content or are multi-step.
- **D-06:** Implementation: replace the `AlertDialog` for `confirmDelete` in `App.tsx` with a controlled `Popover` from `@/components/ui/popover` (already installed via shadcn). State lives where delete is triggered — sidebar item context menu or CommandDetail header.

### Spacing & Visual Hierarchy
- **D-07:** Spacing pass covers all four areas: sidebar density, CommandDetail controls, OutputPane/HistoryPane panel headers and items, and overall panel gaps between sidebar/content/output.
- **D-08:** Use the standard Tailwind spacing scale (4px base) consistently. No external reference — Claude picks specific values to achieve consistent rhythm. Goal is uniformity, not maximum whitespace.
- **D-09:** Section separators between sidebar, content, and output panes should use `border` (CSS variable `--border`) rather than visible gaps or shadows — keeps the VS Code Dark+ theme coherent.

### Claude's Discretion
- Exact pixel threshold for sidebar auto-collapse (suggested ~600px, can adjust based on content clipping)
- Popover positioning (above/below/side of trigger — use Radix auto-positioning)
- Specific padding/gap values for each area within the Tailwind scale
- Whether HistoryPane gets a resize handle or stays fixed-width

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirements
- `.planning/REQUIREMENTS.md` — UIUX-01, UIUX-02, UIUX-04 (the three requirements covered by this phase)
- `.planning/ROADMAP.md` §Phase 1 — Success criteria (4 items, must all be TRUE)

### Key source files to read before planning
- `frontend/src/components/ResizablePanel.tsx` — Current collapse implementation; needs window-resize auto-collapse extension
- `frontend/src/App.tsx` lines ~1080–1200 — Layout structure, modal state, confirmDelete AlertDialog usage
- `frontend/src/components/Sidebar.tsx` — Command/category list items, delete trigger points
- `frontend/src/style.css` — CSS variables (`--sidebar-width`, `--border`, spacing tokens)
- `frontend/src/components/CommandDetail.tsx` — Controls layout (execute, run-in-terminal, title, description, presets)
- `frontend/src/components/OutputPane.tsx` — Panel header, toggle button
- `frontend/src/components/HistoryPane.tsx` — Panel header, record list

### UI primitives available (no new installs needed)
- `frontend/src/components/ui/popover.tsx` — Radix Popover (already installed)
- `frontend/src/components/ui/alert-dialog.tsx` — Existing AlertDialog (stays for non-delete modals)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `ResizablePanel.tsx`: `collapsed` state, `collapse()` / `expand()` callbacks, `localStorage` persistence — extend with `useEffect` on `window.resize` to auto-collapse
- `Popover` from `@/components/ui/popover`: Radix-based, already in the project — use for inline delete confirmation
- `ContextMenu` already used in `Sidebar.tsx` for right-click actions on commands/categories — delete action is already wired, just needs to change confirmation flow
- CSS variables in `style.css` for spacing: `--sidebar-width: 300px`, `--header-height: 35px`, `--tab-bar-height: 35px`

### Established Patterns
- `ResizablePanel` stores state in `localStorage` keyed by `storageKey` prop — preserve this for the auto-collapse feature
- Delete is triggered via `ContextMenu` in sidebar → calls `onDeleteCommand` / `onDeleteCategory` on `App.tsx` → currently opens `confirmDelete` AlertDialog via `setModal()`
- To inline the confirmation: remove `setModal()` call path for these two, handle confirmation at the Sidebar level with a local `Popover` state
- App.tsx `ModalState` discriminated union — `confirmDelete` case can be removed once inline is implemented (or kept for other uses)

### Integration Points
- `ResizablePanel` receives no width-change callback — `App.tsx` doesn't know when it's collapsed; the auto-collapse is self-contained inside `ResizablePanel`
- Sidebar delete actions (`onDeleteCommand`, `onDeleteCategory`) are passed as props from `App.tsx` — the actual delete logic stays in `App.tsx`, only the confirmation UI moves to `Sidebar.tsx` inline
- `OutputPane` and `HistoryPane` are rendered in `App.tsx` directly, not in sub-routers — spacing changes happen in their respective component files and in `App.tsx` layout divs

</code_context>

<specifics>
## Specific Ideas

- Sidebar collapsed state should show the existing app logo icon (the `<svg>` in `collapsedIcon` prop in `App.tsx`) — no new icon needed
- Popover confirmation: "Delete?" as a label, red [Delete] button, and an [X] or [Cancel] button. Match the visual style of the existing destructive `AlertDialogAction variant="destructive"`.
- The VS Code Dark+ theme is the current default — spacing changes should feel native to it (tight but not cramped)

</specifics>

<deferred>
## Deferred Ideas

- Discard unsaved changes → inline: deferred (multi-step, stays as dialog)
- Clear history → inline: reviewed, not in scope for Phase 1 (only delete command/category per success criteria)
- CategoryEditor → inline: deferred (form-based, stays as dialog)
- Sidebar icon-only mode (showing category icons without labels at mid-width): not in scope — just the icon rail for the app logo

None — discussion stayed within phase scope otherwise.

</deferred>

---

*Phase: 01-layout-overhaul*
*Context gathered: 2026-04-08*
