---
created: 2026-04-23T12:30:00Z
title: Revamp Working Directory UI in Command Editor
area: ui
files:
  - frontend/src/components/CommandDetail.tsx
  - frontend/src/style.css
---

## Problem

The current working directory input in the Command Editor is a plain text field sitting above the command preview section. It takes up vertical space, looks utilitarian, and doesn't match the polished UI of the rest of the app. The user wants a more refined, space-efficient solution.

## Solution

Replace the inline working directory input with a **fancy popup-trigger action icon** in the `command-text-box-header-actions` area.

### Details

1. **Remove** the inline working directory input field and hint text from above the command preview.

2. **Add** a new action icon button in `command-text-box-header-actions` (near the run/settings icons). Use a `FolderOpen` or similar icon.

3. **Tooltip on hover**: Show the current working directory value, but **shortened** to the last 2 path segments. Format: `.../Documents/cmdex` (always prefix with `.../` and show the final 2 directories). If the path has fewer than 2 segments, show it as-is. If unset, show "No working directory set".

4. **Popup on click**: When the user clicks the icon, open a centered/modal popup with:
   - A title like "Working Directory"
   - A text input pre-filled with the current full path (or empty)
   - A **Browse** button that triggers `PickDirectory()`
   - A **Clear** button to unset the directory
   - A **Save** or **Apply** button to confirm
   - Make the popup look polished — use the app's existing modal/card styling (rounded corners, dark theme, proper spacing, maybe a subtle border or shadow).

5. **Persist**: The popup should update the draft's `workingDir` via `onDraftChange` when saved.

### Shorten Path Format

- Input: `/Users/mac/Documents/Projects/cmdex`
- Output: `.../Projects/cmdex` (last 2 segments)
- Input: `/Users/mac`
- Output: `/Users/mac` (fewer than 2 segments, show as-is)
- Input: `''` (empty)
- Output: `No working directory set` (in tooltip)

## Related

- Phase 13: Command Editor & List UI (working directory feature)
- `getOSPath` / `setOSPath` helpers in `frontend/src/types.ts`
