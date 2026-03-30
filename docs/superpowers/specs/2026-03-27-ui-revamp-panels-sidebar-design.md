# UI Revamp — Resizable Panels, Sidebar Redesign, Drag-and-Drop

**Date:** 2026-03-27
**Status:** Approved

---

## Overview

Revamp the three-panel layout (sidebar / detail / history) to support horizontal resizing and collapsing. Redesign the sidebar's command list with drag-and-drop reordering, context menus, and a cleaner toolbar. Remove the bottom footer buttons from the sidebar.

---

## 1. Panel Resize & Toggle — Icon-Rail Collapse (Approved Option A)

Both the left sidebar and right history pane get:

- A **drag handle** on the inner edge (4px wide, highlighted on hover with the accent color). Dragging resizes the panel; min/max widths enforced.
- A **collapse toggle**: clicking the drag handle (or a small arrow on it) collapses the panel to a ~40px icon rail.
- **Collapsed icon-rail** shows: the app logo icon (sidebar) or a history icon (history pane) + a `▶`/`◀` expand arrow. Clicking expands back to the last-used width.
- Panel widths persist in `localStorage` across sessions.

**Sidebar:**
- Default width: 300px. Min: 200px. Max: 480px.
- Collapsed rail: 40px. Shows logo icon + expand arrow.

**History pane:**
- Default width: 220px. Min: 160px. Max: 400px.
- Collapsed rail: 40px. Shows clock/history icon + expand arrow.

**Implementation note:** Use a `ResizablePanel` wrapper component (pure CSS + mouse event drag) — no external resize library needed. Store widths in localStorage keys `commamer-sidebar-width` and `commamer-history-width`. Store collapsed state in `commamer-sidebar-collapsed` and `commamer-history-collapsed`.

---

## 2. Sidebar Redesign

### 2a. Search bar + Add button

The search input row gets a **`+` button** (accent-colored, 28×28px) immediately to the right of the input. Clicking it opens the Create Command modal (same as the old "+ New Command" footer button), with no default category.

### 2b. Remove footer buttons

The `sidebar-footer` `add-btns` row (containing "+ Category" and "+ New Command") is **removed entirely**. The Settings gear icon moves to the top header row, next to the logo.

### 2c. Context menu (right-click)

A custom context menu (`ContextMenu` component using Radix UI `ContextMenu`) is attached to the entire sidebar scroll area.

**Right-click on empty space or a category header:**
```
📄 New Command
📁 New Group
```

**Right-click on a command item:**
```
✏️  Edit
🎛️  Manage Presets
─────────────
🗑️  Delete   (red)
```

"New Group" opens the existing Category Editor modal. "New Command" opens Command Editor with no default category (unless right-clicked inside a category, in which case that category is pre-selected). "Edit", "Manage Presets", "Delete" map to the existing handlers in `App.tsx`.

---

## 3. Drag-and-Drop Command Ordering

### 3a. Backend changes

Add a `position` column to the `commands` table (INTEGER NOT NULL DEFAULT 0). On insert, set position to `MAX(position) + 1` for the target category (or globally for uncategorized). Add a `ReorderCommand(id, newPosition, newCategoryId)` Go method and a `UpdateCommandPosition` DB method. The `GetCommands` query changes to `ORDER BY position ASC`.

A migration (schema v bump) adds the `position` column and back-fills existing rows with `ROW_NUMBER() OVER (ORDER BY created_at)` per category group.

### 3b. Frontend drag-and-drop

Use **`@dnd-kit/core`** + **`@dnd-kit/sortable`** (already a well-maintained library, ~15KB). Each command item becomes a `SortableItem`. Categories are separate droppable containers.

**Drag behavior:**
- A **drag handle icon** (⠿, `GripVertical` from lucide) appears on the left of each command row on hover.
- While dragging: the dragged item shows a semi-transparent ghost; a 2px accent-colored drop indicator line appears between items at the target insertion point.
- **Within a category:** reorders the command within the group.
- **Dropped onto a different category header or into a different category's command list:** moves the command to that category, appended as the last item in the group.
- On drop, call `ReorderCommand` with the new position index and (if changed) new `categoryId`. Optimistic UI update — revert on error.

### 3c. Position model

Position is a sparse integer per-category (not global). When a command moves between categories, it gets `MAX(position) + 1` in the new category. Positions are re-normalized (0, 1, 2, …) on each reorder to avoid gaps growing unbounded.

---

## 4. Files Affected

| File | Change |
|------|--------|
| `models.go` | Add `Position int` to `Command` struct |
| `db.go` | Schema migration: add `position` to `commands`; update `GetCommands`, `GetCommandsByCategory`, `CreateCommand`; add `UpdateCommandPosition` |
| `app.go` | Add `ReorderCommand(id, newPosition, newCategoryId)` bound method |
| `frontend/src/types.ts` | Add `position: number` to `Command` |
| `frontend/src/App.tsx` | Add `handleReorderCommand`; pass to Sidebar; settings gear moves to header |
| `frontend/src/components/Sidebar.tsx` | Full rewrite: add resize/collapse, dnd-kit sortable, context menu, remove footer, add `+` button |
| `frontend/src/components/HistoryPane.tsx` | Wrap in resizable panel with icon-rail collapse |
| `frontend/src/style.css` | Add drag-handle, resize-handle, context-menu, icon-rail styles |
| `frontend/package.json` | Add `@dnd-kit/core`, `@dnd-kit/sortable`, `@dnd-kit/utilities` |

---

## 5. Out of Scope

- Drag-and-drop for category reordering (categories remain ordered by `created_at`)
- Multi-select drag
- Drag commands between the search results view and categories
- Touch/mobile drag support
