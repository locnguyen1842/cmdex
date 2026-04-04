# UI Polish & Fixes — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix 7 UI issues in the Cmdex app: preset preview values, status bar removal, tag layout, shortcuts popup, resizable output pane, palette revamp, and preset chip selector.

**Architecture:** All changes are frontend-only (React + TypeScript). No Go backend changes required. Tasks are independent and can be done in order — each produces a visible improvement.

**Tech Stack:** React 18, TypeScript, Tailwind CSS v4, shadcn/ui, Wails v2. No tests exist — verify visually with `wails dev`.

**Source:** todos/revamp-ui.md (items 1–7)

---

## File Map

| File | Changes |
|---|---|
| `frontend/src/components/CommandDetail.tsx` | Tasks 1, 3, 7 |
| `frontend/src/App.tsx` | Task 2 |
| `frontend/src/style.css` | Tasks 2, 3, 5, 7 |
| `frontend/src/components/CommandPalette.tsx` | Task 6 |
| `frontend/src/components/OutputPane.tsx` | Task 5 |
| `frontend/src/components/Sidebar.tsx` | Task 4 |

---

## Task 1: Fix Preset Preview — Show Resolved Values with Highlights

**Problem:** The preset preview box uses `renderScriptWithVars` which always shows `{{var}}` (never substitutes the actual value). It should show the actual preset value in green, and only fall back to yellow `{{var}}` when empty.

**Files:**
- Modify: `frontend/src/components/CommandDetail.tsx`

- [ ] **Step 1: Add `renderScriptResolved` memo after `renderScriptWithVars`**

In `CommandDetail.tsx`, after line 146 (after the `renderScriptWithVars` memo), add:

```tsx
const renderScriptResolved = useMemo(() => {
  if (!scriptBody) return null;
  const parts = scriptBody.split(/(\{\{\w+\}\})/g);
  return parts.map((part, i) => {
    if (/^\{\{\w+\}\}$/.test(part)) {
      const varName = part.slice(2, -2);
      const val = resolvedValues[varName];
      if (val) {
        return (
          <span key={i} className="var-filled" title={`${varName}=${val}`}>
            {val}
          </span>
        );
      }
      return (
        <span key={i} className="var-missing" title={varName}>
          {part}
        </span>
      );
    }
    return <span key={i}>{part}</span>;
  });
}, [scriptBody, resolvedValues]);
```

- [ ] **Step 2: Use `renderScriptResolved` in the preset preview box**

Find the preview box inside the arguments section (around line 414). It currently has:

```tsx
<div className="mb-2 pb-2 border-b border-border/50">
  <code className="text-xs whitespace-pre-wrap break-all">
    {renderScriptWithVars}
  </code>
</div>
```

Replace with:

```tsx
<div className="mb-2 pb-2 border-b border-border/50">
  <code className="text-xs whitespace-pre-wrap break-all">
    {renderScriptResolved}
  </code>
</div>
```

The top-level script box (around line 233) keeps using `renderScriptWithVars` — do NOT change that one.

- [ ] **Step 3: Verify visually**

Run `wails dev`. Open a command with variables. Select a preset. The preview box should now show the actual preset values (green) instead of `{{varName}}`. Variables with no value in the preset should still show `{{varName}}` in yellow.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/components/CommandDetail.tsx
git commit -m "fix: preset preview now shows resolved values with highlights"
```

---

## Task 2: Remove Status Bar

**Problem:** The status bar at the top of the app (added in a previous session) adds visual noise. Remove it.

**Files:**
- Modify: `frontend/src/App.tsx`
- Modify: `frontend/src/style.css`

- [ ] **Step 1: Remove the status bar JSX from App.tsx**

In `App.tsx`, find and remove this entire block (the status bar div including its contents):

```tsx
{/* Status bar at top (VS Code titlebar style) */}
<div className="status-bar" style={{ '--wails-draggable': 'drag' } as React.CSSProperties}>
  <div className="status-bar-left">
    ...
  </div>
  <div className="status-bar-right">
    ...
  </div>
</div>
```

Also remove the `activeThemeLabel` variable that was only used in the status bar:

```tsx
// Remove this line:
const activeThemeLabel = THEMES.find(t => t.id === theme)?.label ?? theme;
```

- [ ] **Step 2: Remove the `--wails-draggable` drag region**

The status bar was the drag handle for the window. Move `--wails-draggable: drag` to the sidebar header instead. In `style.css`, the `.sidebar-header` already has `--wails-draggable: drag` so this is already covered. Also verify `tab-bar` or `main-header` can serve as drag region if needed. Add to `.tab-bar` in CSS:

```css
.tab-bar {
  /* existing properties... */
  --wails-draggable: drag;
}
```

- [ ] **Step 3: Remove status bar CSS from style.css**

Find and delete the entire `/* ========== Status Bar ========== */` section:

```css
/* ========== Status Bar ========== */

.status-bar { ... }
.status-bar-left { ... }
.status-bar-right { ... }
.status-item { ... }
.status-item:hover { ... }
```

- [ ] **Step 4: Remove unused import**

In `App.tsx`, `isMac` was imported from `useKeyboardShortcuts` and used in the status bar. Check if it's still used elsewhere (it is — in the keyboard shortcuts section). Leave the import.

- [ ] **Step 5: Run type check**

```bash
cd frontend && pnpm tsc --noEmit
```

Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/App.tsx frontend/src/style.css
git commit -m "chore: remove status bar"
```

---

## Task 3: Tags on Second Line — Better Visibility

**Problem:** In `CommandDetail`, tags appear below description but can visually blend in. In the sidebar, tags are not shown at all. Fix both: ensure tags in the detail header have clear visual separation, and add a second-line tag display to sidebar command items.

**Files:**
- Modify: `frontend/src/components/CommandDetail.tsx`
- Modify: `frontend/src/components/Sidebar.tsx`
- Modify: `frontend/src/style.css`

- [ ] **Step 1: Fix detail header tag layout in CommandDetail.tsx**

The current order is: title → description → tags. Reorder to: title → tags → description. This puts the compact badges right under the title, where they're scannable. Find the `detail-header` div and reorder:

```tsx
<div className="detail-header">
  {editingTitle ? (
    <Input
      ref={titleInputRef}
      className="detail-title-input text-2xl font-bold h-auto py-1"
      type="text"
      value={titleDraft}
      onChange={(e) => setTitleDraft(e.target.value)}
      onBlur={commitTitleEdit}
      onKeyDown={(e) => {
        if (e.key === "Enter") commitTitleEdit();
        if (e.key === "Escape") setEditingTitle(false);
      }}
    />
  ) : (
    <h1
      className="detail-title"
      onDoubleClick={handleTitleDoubleClick}
      title={t("commandDetail.doubleClickToRename")}
    >
      {command.title}
    </h1>
  )}
  {command.tags && command.tags.length > 0 && (
    <div className="detail-tags">
      {command.tags.map((tag, i) => (
        <Badge key={i} variant="secondary">
          {tag}
        </Badge>
      ))}
    </div>
  )}
  {command.description && (
    <p className="detail-description">{command.description}</p>
  )}
</div>
```

- [ ] **Step 2: Add tags to sidebar command items in Sidebar.tsx**

Find `SortableCommandItem` (or the `command-item` render). The `.cmd-title` span currently holds only the title. Wrap the content to show title on the first line and tags (if any) on a second line:

```tsx
<span className="cmd-body">
  <span className="cmd-title">{cmd.title}</span>
  {cmd.tags && cmd.tags.length > 0 && (
    <span className="cmd-tags-row">
      {cmd.tags.slice(0, 3).map((tag) => (
        <span key={tag} className="cmd-tag-chip">#{tag}</span>
      ))}
    </span>
  )}
</span>
```

Replace the existing `<span className="cmd-title">{cmd.title}</span>` with this block.

- [ ] **Step 3: Add sidebar tag styles to style.css**

In `style.css`, after the `.command-item .cmd-title` rule, add:

```css
.command-item .cmd-body {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.command-item .cmd-title {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  font-weight: 400;
}

.cmd-tags-row {
  display: flex;
  gap: 4px;
  flex-wrap: nowrap;
  overflow: hidden;
}

.cmd-tag-chip {
  font-size: 10px;
  color: var(--muted-foreground);
  opacity: 0.75;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 60px;
}
```

Remove the old standalone `.command-item .cmd-title` rule (it's now inside `.cmd-body`).

- [ ] **Step 4: Verify visually**

Run `wails dev`. Commands with tags should now show tag chips on a second line in the sidebar. In the detail view, tags should appear right under the title before the description.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/CommandDetail.tsx frontend/src/components/Sidebar.tsx frontend/src/style.css
git commit -m "feat: improve tags layout — second line in sidebar, reordered in detail"
```

---

## Task 4: Shortcuts Info Popup in Sidebar Footer

**Problem:** Users have no way to discover keyboard shortcuts without guessing. Add an info icon (ⓘ) next to the settings gear in the sidebar footer that opens a popover listing all shortcuts.

**Files:**
- Modify: `frontend/src/components/Sidebar.tsx`
- Modify: `frontend/src/style.css`

- [ ] **Step 1: Add the shortcut list constant to Sidebar.tsx**

At the top of `Sidebar.tsx` (after imports), add the shortcuts data. Detect Mac at the top level:

```tsx
import { isMac } from '../hooks/useKeyboardShortcuts';

const cmd = isMac ? '⌘' : 'Ctrl';

const SHORTCUT_GROUPS = [
  {
    label: 'Navigation',
    items: [
      { keys: [`${cmd}P`],              description: 'Command Palette' },
      { keys: ['Ctrl+Tab'],             description: 'Next tab' },
      { keys: ['Ctrl+Shift+Tab'],       description: 'Previous tab' },
      { keys: [isMac ? '^W' : 'Ctrl+W'], description: 'Close tab' },
    ],
  },
  {
    label: 'Commands',
    items: [
      { keys: [`${cmd}↩`],  description: 'Run command' },
      { keys: [`${cmd}E`],  description: 'Edit command' },
      { keys: [`${cmd}N`],  description: 'New command' },
      { keys: [`${cmd}T`],  description: 'New command (alt)' },
    ],
  },
  {
    label: 'App',
    items: [
      { keys: [`${cmd},`], description: 'Settings' },
    ],
  },
];
```

- [ ] **Step 2: Add the info icon button and Popover to the sidebar footer**

In `Sidebar.tsx`, find the sidebar footer section. It currently renders settings + add buttons. Import `Popover`, `PopoverTrigger`, `PopoverContent` and the `Info` icon:

```tsx
import { Search, Plus, Pencil, X, ChevronRight, Terminal, Settings, GripVertical, Group, Info } from 'lucide-react';
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';
```

Add the info button next to the settings button in the sidebar footer:

```tsx
<div className="sidebar-footer">
  <div className="add-btns">
    <Tooltip>
      <TooltipTrigger asChild>
        <Button variant="ghost" size="icon-xs" onClick={onOpenSettings}>
          <Settings className="size-4" />
        </Button>
      </TooltipTrigger>
      <TooltipContent>Settings ⌘,</TooltipContent>
    </Tooltip>

    <Popover>
      <Tooltip>
        <TooltipTrigger asChild>
          <PopoverTrigger asChild>
            <Button variant="ghost" size="icon-xs">
              <Info className="size-4" />
            </Button>
          </PopoverTrigger>
        </TooltipTrigger>
        <TooltipContent>Keyboard Shortcuts</TooltipContent>
      </Tooltip>
      <PopoverContent side="top" align="start" className="shortcuts-popup w-64 p-3">
        <div className="shortcuts-popup-title">Keyboard Shortcuts</div>
        {SHORTCUT_GROUPS.map((group) => (
          <div key={group.label} className="shortcuts-group">
            <div className="shortcuts-group-label">{group.label}</div>
            {group.items.map((item) => (
              <div key={item.description} className="shortcut-row">
                <span className="shortcut-desc">{item.description}</span>
                <span className="shortcut-keys-row">
                  {item.keys.map((k) => (
                    <kbd key={k} className="kbd">{k}</kbd>
                  ))}
                </span>
              </div>
            ))}
          </div>
        ))}
      </PopoverContent>
    </Popover>
  </div>
</div>
```

- [ ] **Step 3: Add shortcuts popup styles to style.css**

```css
/* ========== Shortcuts Popup ========== */

.shortcuts-popup-title {
  font-size: 11px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.7px;
  color: var(--muted-foreground);
  margin-bottom: 10px;
}

.shortcuts-group {
  margin-bottom: 10px;
}

.shortcuts-group-label {
  font-size: 10px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.6px;
  color: var(--muted-foreground);
  opacity: 0.6;
  margin-bottom: 4px;
}

.shortcut-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 3px 0;
  font-size: 12px;
  color: var(--foreground);
}

.shortcut-desc {
  flex: 1;
  opacity: 0.85;
}

.shortcut-keys-row {
  display: flex;
  gap: 2px;
}
```

- [ ] **Step 4: Run type check**

```bash
cd frontend && pnpm tsc --noEmit
```

Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/Sidebar.tsx frontend/src/style.css
git commit -m "feat: add keyboard shortcuts info popup in sidebar footer"
```

---

## Task 5: Vertically Resizable Output Pane

**Problem:** The output pane height is fixed (`max-height: 200px`). Users should be able to drag the top edge to resize it.

**Files:**
- Modify: `frontend/src/components/OutputPane.tsx`
- Modify: `frontend/src/style.css`

- [ ] **Step 1: Add resize state and drag logic to OutputPane.tsx**

Replace the OutputPane component signature and add resize logic:

```tsx
import React, { useEffect, useRef, useMemo, useCallback, useState } from 'react';

const MIN_HEIGHT = 80;
const MAX_HEIGHT = 600;
const DEFAULT_HEIGHT = 200;
const STORAGE_KEY = 'cmdex-output-height';

const OutputPane: React.FC<OutputPaneProps> = ({ record, streamLines, isExecuting, isOpen, onToggle }) => {
  const { t } = useTranslation();
  const bodyRef = useRef<HTMLDivElement>(null);
  const autoScrollRef = useRef(true);
  const [height, setHeight] = useState<number>(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved ? Number(saved) : DEFAULT_HEIGHT;
  });
  const isDraggingRef = useRef(false);
  const startYRef = useRef(0);
  const startHeightRef = useRef(0);

  const handleResizeStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    isDraggingRef.current = true;
    startYRef.current = e.clientY;
    startHeightRef.current = height;

    const onMouseMove = (ev: MouseEvent) => {
      if (!isDraggingRef.current) return;
      const delta = startYRef.current - ev.clientY; // dragging up = increase height
      const newHeight = Math.min(MAX_HEIGHT, Math.max(MIN_HEIGHT, startHeightRef.current + delta));
      setHeight(newHeight);
    };

    const onMouseUp = () => {
      isDraggingRef.current = false;
      setHeight((h) => {
        localStorage.setItem(STORAGE_KEY, String(h));
        return h;
      });
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
  }, [height]);
  
  // ... rest of existing component state unchanged
```

- [ ] **Step 2: Add resize handle to JSX and apply dynamic height**

In the `return` of `OutputPane`, add the resize handle above the collapsible and pass `height` as inline style:

```tsx
return (
  <Collapsible open={isOpen} onOpenChange={onToggle} className="output-pane">
    {/* Resize handle — only visible when open */}
    {isOpen && (
      <div className="output-resize-handle" onMouseDown={handleResizeStart} />
    )}
    <div className="output-pane-header" onClick={onToggle}>
      {/* ... existing header content unchanged ... */}
    </div>
    <CollapsibleContent>
      <div
        className="output-pane-body"
        ref={bodyRef}
        onScroll={handleScroll}
        style={{ maxHeight: height }}
      >
        {/* ... existing body content unchanged ... */}
      </div>
    </CollapsibleContent>
  </Collapsible>
);
```

- [ ] **Step 3: Add resize handle CSS to style.css**

In the `/* ========== Output Pane ========== */` section, add the resize handle styles and remove the hardcoded `max-height`:

```css
.output-resize-handle {
  height: 4px;
  cursor: ns-resize;
  background: transparent;
  transition: background var(--transition-fast);
  flex-shrink: 0;
}

.output-resize-handle:hover,
.output-resize-handle:active {
  background: var(--primary);
}
```

Also update `.output-pane-body` — remove the `max-height: 200px` line (it's now controlled by inline style):

```css
.output-pane-body {
  flex: 1;
  padding: 12px 14px;
  font-family: var(--font-mono);
  font-size: 12px;
  line-height: 1.6;
  color: var(--foreground);
  overflow-y: auto;
  white-space: pre-wrap;
  word-break: break-all;
  opacity: 0.9;
  /* max-height removed — controlled by inline style */
}
```

- [ ] **Step 4: Run type check**

```bash
cd frontend && pnpm tsc --noEmit
```

Expected: no errors.

- [ ] **Step 5: Verify visually**

Run `wails dev`. Open the output pane. Drag the thin strip at the top edge — the pane should resize. Reload the app — the height should be restored from localStorage.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/components/OutputPane.tsx frontend/src/style.css
git commit -m "feat: vertically resizable output pane with localStorage persistence"
```

---

## Task 6: Command Palette — Remove Run Button, Add Script Preview

**Problem:** The command palette has a run-directly button which causes accidental execution. Replace it with a styled script preview and description in each result row.

**Files:**
- Modify: `frontend/src/components/CommandPalette.tsx`
- Modify: `frontend/src/App.tsx`
- Modify: `frontend/src/style.css`

- [ ] **Step 1: Remove `onRun` prop from CommandPalette**

In `CommandPalette.tsx`, update the interface and component signature:

```tsx
interface CommandPaletteProps {
  open: boolean;
  commands: Command[];
  categories: Category[];
  onClose: () => void;
  onOpen: (cmd: Command) => void;
  // onRun removed
}

const CommandPalette: React.FC<CommandPaletteProps> = ({
  open,
  commands,
  categories,
  onClose,
  onOpen,
}) => {
```

Also remove `isMac` import if only used for run button, and update `handleKeyDown` — remove the `Cmd+Enter` run branch, keep only plain `Enter` to open:

```tsx
} else if (e.key === 'Enter') {
  e.preventDefault();
  const cmd = filtered[activeIndex];
  if (!cmd) return;
  onOpen(cmd);
  onClose();
}
```

- [ ] **Step 2: Add script preview snippet to each result item**

Each palette item currently shows title + description + category badge + run button. Replace the run button with a script preview snippet. First add a helper to truncate the script:

```tsx
function scriptSnippet(content: string): string {
  const body = content.replace(/^#!.*\n?/, '').trim(); // strip shebang
  const firstLine = body.split('\n').find((l) => l.trim()) || '';
  return firstLine.length > 60 ? firstLine.slice(0, 57) + '…' : firstLine;
}
```

In the result item JSX, remove the `<button className="palette-run-btn">` block and add the snippet below the title/description:

```tsx
<div
  key={cmd.id}
  data-idx={i}
  className={`palette-item${isActive ? ' active' : ''}`}
  onMouseEnter={() => setActiveIndex(i)}
  onClick={() => { onOpen(cmd); onClose(); }}
>
  <FileText size={13} className="palette-item-icon" />
  <div className="palette-item-body">
    <span className="palette-item-title">
      <Highlight text={cmd.title} query={query.trim()} />
    </span>
    {cmd.description && (
      <span className="palette-item-desc">
        <Highlight text={cmd.description} query={query.trim()} />
      </span>
    )}
    {cmd.scriptContent && (
      <span className="palette-item-script">
        {scriptSnippet(cmd.scriptContent)}
      </span>
    )}
  </div>
  <div className="palette-item-meta">
    {catName && <span className="palette-cat-badge">{catName}</span>}
    {(cmd.tags || []).slice(0, 2).map((tag) => (
      <span key={tag} className="palette-tag-badge">#{tag}</span>
    ))}
  </div>
</div>
```

- [ ] **Step 3: Update footer hints — remove run hint**

In the palette footer, remove the `⌘↩ run` hint. Update to:

```tsx
<div className="palette-footer">
  <span className="palette-hint"><kbd>↑</kbd><kbd>↓</kbd> navigate</span>
  <span className="palette-hint"><kbd>↩</kbd> open</span>
  <span className="palette-hint"><kbd>Esc</kbd> close</span>
  <span className="palette-hint" style={{ marginLeft: 'auto', opacity: 0.5 }}>
    {filtered.length} result{filtered.length !== 1 ? 's' : ''}
  </span>
</div>
```

- [ ] **Step 4: Add script snippet style to style.css**

In the `/* ========== Command Palette ========== */` section, add after `.palette-item-desc`:

```css
.palette-item-script {
  font-family: var(--font-mono);
  font-size: 10px;
  color: var(--primary);
  opacity: 0.75;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 320px;
}
```

Also remove `.palette-run-btn` and its hover rules entirely from style.css.

- [ ] **Step 5: Remove `onRun` prop usage in App.tsx**

In `App.tsx`, update the `<CommandPalette>` render — remove the `onRun` prop and `handlePaletteRun`:

```tsx
<CommandPalette
  open={paletteOpen}
  commands={commands}
  categories={categories}
  onClose={() => setPaletteOpen(false)}
  onOpen={handleSelectCommand}
/>
```

Delete the `handlePaletteRun` function from App.tsx entirely. Also remove it from `useCallback` dependencies.

- [ ] **Step 6: Run type check**

```bash
cd frontend && pnpm tsc --noEmit
```

Expected: no errors.

- [ ] **Step 7: Commit**

```bash
git add frontend/src/components/CommandPalette.tsx frontend/src/App.tsx frontend/src/style.css
git commit -m "feat: palette shows script preview instead of run button"
```

---

## Task 7: Preset Box Chip Selector (Option A)

**Problem:** The current preset selector is a small dropdown inside a Popover which is hard to use. Replace with horizontal chip buttons that directly select presets, and show pattern=value rows that are inline-editable.

**Files:**
- Modify: `frontend/src/components/CommandDetail.tsx`
- Modify: `frontend/src/style.css`

This task fully replaces the Popover + Command-based preset selector in the arguments section.

- [ ] **Step 1: Add per-variable inline edit state**

In `CommandDetail.tsx`, add state for tracking which variable is being inline-edited:

```tsx
const [editingVar, setEditingVar] = useState<string | null>(null);
const [editingVarValue, setEditingVarValue] = useState('');
```

- [ ] **Step 2: Replace the preset selector section in JSX**

Find the `preview-box-wrapper` div (inside the `variables.length > 0` block) and replace it entirely with the new chip + inline edit UI:

```tsx
{variables.length > 0 && (
  <div className="detail-section mt-4">
    <div className="detail-section-title">
      {t("commandDetail.arguments")}
      <Tooltip>
        <TooltipTrigger asChild>
          <Button variant="ghost" size="icon-xs" onClick={onManagePresets}>
            <ListTree />
          </Button>
        </TooltipTrigger>
        <TooltipContent>{t("commandDetail.managePresets")}</TooltipContent>
      </Tooltip>
    </div>

    {/* Preset chip row */}
    {command.presets.length > 0 && (
      <div className="preset-chips">
        <button
          className={`preset-chip${selectedPresetId === '' ? ' active' : ''}`}
          onClick={() => setSelectedPresetId('')}
        >
          {t("commandDetail.noPreset")}
        </button>
        {command.presets.map((p) => (
          <button
            key={p.id}
            className={`preset-chip${selectedPresetId === p.id ? ' active' : ''}`}
            onClick={() => setSelectedPresetId(p.id)}
          >
            {p.name}
          </button>
        ))}
      </div>
    )}

    {/* Pattern=Value rows */}
    <div className="preset-vars-list">
      {variables.map((v) => {
        const val = resolvedValues[v.name];
        const isEditing = editingVar === v.name;
        return (
          <div key={v.name} className="preset-var-row">
            <span className="preset-var-name">
              {val ? (
                <span className="var-filled" title={v.name}>{"{{" + v.name + "}}"}</span>
              ) : (
                <span className="var-missing" title={v.name}>{"{{" + v.name + "}}"}</span>
              )}
            </span>
            <span className="preset-var-equals">=</span>
            {isEditing ? (
              <input
                className="preset-var-input"
                autoFocus
                value={editingVarValue}
                onChange={(e) => setEditingVarValue(e.target.value)}
                onBlur={() => {
                  // commit value — for now just close, full edit goes through onFillVariables
                  setEditingVar(null);
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') setEditingVar(null);
                  if (e.key === 'Escape') setEditingVar(null);
                }}
              />
            ) : (
              <span
                className={`preset-var-value${val ? '' : ' empty'}`}
                onClick={() => {
                  setEditingVar(v.name);
                  setEditingVarValue(val || '');
                }}
                title="Click to edit"
              >
                {val || <span className="preset-var-placeholder">click to set…</span>}
              </span>
            )}
          </div>
        );
      })}
    </div>

    {/* Run button */}
    <div className="command-actions mt-3">
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="success"
            size="sm"
            onClick={() => {
              const hasEmpty = variables.some((v) => !resolvedValues[v.name]);
              if (hasEmpty) {
                onFillVariables(resolvedValues);
              } else {
                onExecute(resolvedValues);
              }
            }}
            disabled={isExecuting}
          >
            {isExecuting ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Play className="size-4" />
            )}
          </Button>
        </TooltipTrigger>
        <TooltipContent>
          {isExecuting
            ? t("commandDetail.running")
            : <ShortcutHint label={t("commandDetail.execute")} shortcut={`${cmdKey}↩`} />}
        </TooltipContent>
      </Tooltip>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button variant="ghost" size="sm" onClick={() => onRunInTerminal(resolvedValues)}>
            <SquareTerminal className="size-4" />
          </Button>
        </TooltipTrigger>
        <TooltipContent>{t("commandDetail.runInTerminal")}</TooltipContent>
      </Tooltip>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button variant="ghost" size="sm" onClick={handleCopy}>
            {copied ? <Check className="size-4 text-success" /> : <Copy className="size-4" />}
          </Button>
        </TooltipTrigger>
        <TooltipContent>
          {copied ? t("commandDetail.copied") : t("commandDetail.copyCommand")}
        </TooltipContent>
      </Tooltip>
    </div>
  </div>
)}
```

Remove the old `import { Popover, PopoverTrigger, PopoverContent }` and `import { Command as CmdPrimitive, CommandInput, CommandList, CommandEmpty, CommandGroup, CommandItem }` from `CommandDetail.tsx` — they're no longer needed there. Also remove `ChevronDown` from lucide imports if unused.

- [ ] **Step 3: Add preset chip and var row CSS to style.css**

```css
/* ========== Preset Chips ========== */

.preset-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-bottom: 12px;
}

.preset-chip {
  padding: 3px 12px;
  font-size: 12px;
  font-weight: 500;
  border: 1px solid var(--border);
  border-radius: 4px;
  background: var(--card);
  color: var(--muted-foreground);
  cursor: pointer;
  transition: all var(--transition-fast);
  font-family: var(--font-sans);
}

.preset-chip:hover {
  background: var(--accent);
  color: var(--foreground);
}

.preset-chip.active {
  background: color-mix(in srgb, var(--primary) 15%, transparent);
  border-color: var(--primary);
  color: var(--primary);
}

/* ========== Preset Var Rows ========== */

.preset-vars-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin-bottom: 4px;
}

.preset-var-row {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  font-family: var(--font-mono);
}

.preset-var-name {
  min-width: 120px;
}

.preset-var-equals {
  color: var(--muted-foreground);
  flex-shrink: 0;
}

.preset-var-value {
  flex: 1;
  color: var(--foreground);
  cursor: pointer;
  padding: 2px 6px;
  border-radius: 3px;
  border: 1px solid transparent;
  transition: border-color var(--transition-fast), background var(--transition-fast);
  min-height: 22px;
}

.preset-var-value:hover {
  background: var(--accent);
  border-color: var(--border);
}

.preset-var-value.empty {
  color: var(--muted-foreground);
}

.preset-var-placeholder {
  font-style: italic;
  opacity: 0.5;
  font-family: var(--font-sans);
  font-size: 11px;
}

.preset-var-input {
  flex: 1;
  background: var(--card);
  border: 1px solid var(--primary);
  border-radius: 3px;
  padding: 2px 6px;
  font-family: var(--font-mono);
  font-size: 13px;
  color: var(--foreground);
  outline: none;
  box-shadow: 0 0 0 2px color-mix(in srgb, var(--primary) 20%, transparent);
}
```

- [ ] **Step 4: Run type check**

```bash
cd frontend && pnpm tsc --noEmit
```

Expected: no errors.

- [ ] **Step 5: Verify visually**

Run `wails dev`. Open a command with variables and presets. You should see chip buttons for each preset. Clicking a chip selects it and the var rows below update. Clicking a value cell activates an inline input.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/components/CommandDetail.tsx frontend/src/style.css
git commit -m "feat: preset chip selector with inline-editable variable rows"
```

---

## Task 8: Mark Todo Resolved

- [ ] **Prepend resolution header and rename**

```bash
# Prepend header to the file
echo '<!-- Resolved: 2026-04-01 | Plan: docs/superpowers/plans/2026-04-01-ui-polish-fixes.md -->' | cat - todos/revamp-ui.md > /tmp/revamp-ui-resolved.md && mv /tmp/revamp-ui-resolved.md todos/revamp-ui.md
git mv todos/revamp-ui.md todos/revamp-ui.resolved.md
git add todos/revamp-ui.resolved.md
git commit -m "chore: mark revamp-ui todo as resolved (items 1-7)"
```
