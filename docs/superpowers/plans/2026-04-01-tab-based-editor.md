# Tab-Based Command Editor — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the modal-based CommandEditor with an inline tab that opens for create/edit, styled like a text editor with dedicated sections for each field.

**Architecture:** Extend the existing tab system in `App.tsx` with a new `'editor'` tab kind. Editor tabs render `CommandEditorTab` instead of `CommandDetail`. When saved, the editor tab converts to a command tab. When discarded, the tab closes. The existing `CommandEditor.tsx` modal is kept temporarily then removed after the tab editor is stable.

**Tech Stack:** React 18, TypeScript, Tailwind CSS v4, shadcn/ui, Wails v2. No tests exist — verify visually with `wails dev`.

**Source:** todos/revamp-ui.md (item 8)

---

## File Map

| File | Role |
|---|---|
| `frontend/src/components/CommandEditorTab.tsx` | **NEW** — inline editor tab component |
| `frontend/src/components/TabBar.tsx` | Modified — support `isDirty` dot indicator |
| `frontend/src/App.tsx` | Modified — tab type discriminant, open editor tab on new/edit |
| `frontend/src/style.css` | Modified — editor tab styles |
| `frontend/src/components/CommandEditor.tsx` | Removed (after Task 4 stable) |

---

## Task 1: Extend Tab Type to Support Editor Tabs

The current `Tab` type is `{ id: string; title: string }`. We need a discriminant to distinguish command-view tabs from editor tabs.

**Files:**
- Modify: `frontend/src/components/TabBar.tsx`
- Modify: `frontend/src/App.tsx`

- [ ] **Step 1: Update Tab type in TabBar.tsx**

In `frontend/src/components/TabBar.tsx`, update the `Tab` interface:

```tsx
export interface Tab {
  id: string;       // for editor tabs: '__new__' or commandId being edited
  title: string;
  kind: 'command' | 'editor';
  isDirty?: boolean;
}
```

- [ ] **Step 2: Show dirty indicator in TabBar**

In `TabBar.tsx`, update the tab item to show a dot when `isDirty`:

```tsx
<div
  key={tab.id}
  ref={isActive ? activeRef : null}
  className={`tab-item${isActive ? ' active' : ''}`}
  onClick={() => onSelectTab(tab.id)}
>
  <span className="tab-title" title={tab.title}>{tab.title}</span>
  {tab.isDirty && <span className="tab-dirty-dot" title="Unsaved changes" />}
  <span
    className="tab-close"
    role="button"
    aria-label="Close tab"
    onClick={(e) => {
      e.stopPropagation();
      onCloseTab(tab.id);
    }}
  >
    <X size={12} />
  </span>
</div>
```

- [ ] **Step 3: Add dirty dot style to style.css**

In the `/* ========== Tab Bar ========== */` section, add:

```css
.tab-dirty-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--muted-foreground);
  flex-shrink: 0;
  margin-right: 2px;
}

.tab-item.active .tab-dirty-dot {
  background: var(--foreground);
}
```

- [ ] **Step 4: Update `openTab` in App.tsx to include `kind`**

In `App.tsx`, the `openTab` function adds tabs. Update all `setOpenTabs` calls to include `kind: 'command'`:

```tsx
const openTab = (cmd: Command) => {
  setSelectedCommand(cmd);
  setSelectedRecord(null);
  setActiveTabId(cmd.id);
  setOpenTabs(prev => {
    const exists = prev.find(t => t.id === cmd.id);
    if (exists) {
      return prev.map(t => t.id === cmd.id ? { ...t, title: cmd.title, kind: 'command' } : t);
    }
    return [...prev, { id: cmd.id, title: cmd.title, kind: 'command' }];
  });
};
```

- [ ] **Step 5: Run type check**

```bash
cd frontend && pnpm tsc --noEmit
```

Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/components/TabBar.tsx frontend/src/App.tsx frontend/src/style.css
git commit -m "feat: extend tab type with kind and isDirty indicator"
```

---

## Task 2: Create `CommandEditorTab` Component

This is the core new component — an inline, text-editor-like UI for creating and editing commands.

**Files:**
- Create: `frontend/src/components/CommandEditorTab.tsx`
- Modify: `frontend/src/style.css`

- [ ] **Step 1: Create `frontend/src/components/CommandEditorTab.tsx`**

```tsx
import React, { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Category, Command, VariableDefinition } from '../types';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Save, X, Plus } from 'lucide-react';
import { GetScriptBody } from '../../wailsjs/go/main/App';

const TEMPLATE_VAR_RE = /\{\{(\w+)\}\}/g;

function extractTemplateVars(text: string): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  let m: RegExpExecArray | null;
  TEMPLATE_VAR_RE.lastIndex = 0;
  while ((m = TEMPLATE_VAR_RE.exec(text)) !== null) {
    if (!seen.has(m[1])) { seen.add(m[1]); result.push(m[1]); }
  }
  return result;
}

export interface CommandEditorTabProps {
  /** undefined = new command */
  command?: Command;
  categories: Category[];
  defaultCategoryId?: string;
  onSave: (data: {
    title: string;
    description: string;
    scriptBody: string;
    categoryId: string;
    tags: string[];
    variables: VariableDefinition[];
  }) => void;
  onDiscard: () => void;
  onDirtyChange?: (dirty: boolean) => void;
}

const CommandEditorTab: React.FC<CommandEditorTabProps> = ({
  command,
  categories,
  defaultCategoryId,
  onSave,
  onDiscard,
  onDirtyChange,
}) => {
  const { t } = useTranslation();
  const isNew = !command;

  const [title, setTitle] = useState(command?.title ?? '');
  const [description, setDescription] = useState(command?.description ?? '');
  const [scriptBody, setScriptBody] = useState('');
  const [categoryId, setCategoryId] = useState(command?.categoryId ?? defaultCategoryId ?? '');
  const [tags, setTags] = useState<string[]>(command?.tags ?? []);
  const [tagInput, setTagInput] = useState('');
  const [variables, setVariables] = useState<VariableDefinition[]>(command?.variables ?? []);
  const scriptRef = useRef<HTMLTextAreaElement>(null);

  // Load script body for edit mode
  useEffect(() => {
    if (command?.id) {
      GetScriptBody(command.id)
        .then(body => setScriptBody(body))
        .catch(() => setScriptBody(''));
    }
  }, [command?.id]);

  // Track dirty state
  const isDirty = useMemo(() => {
    if (isNew) return title !== '' || scriptBody !== '' || description !== '';
    return (
      title !== (command?.title ?? '') ||
      description !== (command?.description ?? '') ||
      scriptBody !== '' // simplified — always dirty in edit mode until saved
    );
  }, [title, description, scriptBody, isNew, command]);

  useEffect(() => { onDirtyChange?.(isDirty); }, [isDirty, onDirtyChange]);

  // Auto-detect variables from script
  useEffect(() => {
    const detected = extractTemplateVars(scriptBody);
    setVariables(prev => {
      const existing = new Map(prev.map(v => [v.name, v]));
      return detected.map((name, i) => existing.get(name) ?? {
        name,
        description: '',
        example: '',
        default: '',
        sortOrder: i,
      });
    });
  }, [scriptBody]);

  const handleTagKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if ((e.key === 'Enter' || e.key === ',') && tagInput.trim()) {
      e.preventDefault();
      const newTag = tagInput.trim().replace(/,+$/, '');
      if (newTag && !tags.includes(newTag)) setTags(prev => [...prev, newTag]);
      setTagInput('');
    } else if (e.key === 'Backspace' && !tagInput && tags.length > 0) {
      setTags(prev => prev.slice(0, -1));
    }
  };

  const handleSave = useCallback(() => {
    if (!title.trim() || !scriptBody.trim()) return;
    onSave({ title: title.trim(), description, scriptBody, categoryId, tags, variables });
  }, [title, description, scriptBody, categoryId, tags, variables, onSave]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 's') {
      e.preventDefault();
      handleSave();
    }
    if (e.key === 'Escape') {
      onDiscard();
    }
  };

  return (
    <div className="editor-tab" onKeyDown={handleKeyDown} tabIndex={-1}>

      {/* Header toolbar */}
      <div className="editor-tab-toolbar">
        <span className="editor-tab-breadcrumb">
          {isNew ? 'New Command' : `Edit: ${command.title}`}
        </span>
        <div className="editor-tab-actions">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="sm" onClick={onDiscard}>
                <X className="size-4 mr-1" /> Discard
              </Button>
            </TooltipTrigger>
            <TooltipContent>Discard changes (Esc)</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="success"
                size="sm"
                onClick={handleSave}
                disabled={!title.trim() || !scriptBody.trim()}
              >
                <Save className="size-4 mr-1" /> Save
              </Button>
            </TooltipTrigger>
            <TooltipContent>Save (⌘S)</TooltipContent>
          </Tooltip>
        </div>
      </div>

      <div className="editor-tab-body">

        {/* Title */}
        <div className="editor-section">
          <label className="editor-label">Title</label>
          <input
            className="editor-title-input"
            value={title}
            onChange={e => setTitle(e.target.value)}
            placeholder="Command title…"
            autoFocus={isNew}
          />
        </div>

        {/* Category */}
        <div className="editor-section">
          <label className="editor-label">Category</label>
          <Select value={categoryId || '__none__'} onValueChange={v => setCategoryId(v === '__none__' ? '' : v)}>
            <SelectTrigger className="w-48">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__none__">
                <span className="italic opacity-60">Uncategorized</span>
              </SelectItem>
              {categories.map(cat => (
                <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Tags */}
        <div className="editor-section">
          <label className="editor-label">Tags</label>
          <div className="tags-input-wrapper">
            {tags.map(tag => (
              <Badge key={tag} variant="secondary" className="gap-1">
                {tag}
                <button onClick={() => setTags(prev => prev.filter(t => t !== tag))}>
                  <X className="size-2.5" />
                </button>
              </Badge>
            ))}
            <input
              className="tags-input-field"
              value={tagInput}
              onChange={e => setTagInput(e.target.value)}
              onKeyDown={handleTagKeyDown}
              placeholder={tags.length === 0 ? 'Add tags (Enter or comma)…' : ''}
            />
          </div>
        </div>

        {/* Description */}
        <div className="editor-section">
          <label className="editor-label">Description</label>
          <textarea
            className="editor-description-input"
            value={description}
            onChange={e => setDescription(e.target.value)}
            placeholder="Optional description…"
            rows={2}
          />
        </div>

        {/* Script */}
        <div className="editor-section editor-section-grow">
          <label className="editor-label">
            Script
            {variables.length > 0 && (
              <span className="editor-label-hint">
                — detected variables: {variables.map(v => `{{${v.name}}}`).join(', ')}
              </span>
            )}
          </label>
          <textarea
            ref={scriptRef}
            className="editor-script-input"
            value={scriptBody}
            onChange={e => setScriptBody(e.target.value)}
            placeholder={"#!/bin/bash\necho 'Hello {{name}}'"}
            spellCheck={false}
          />
        </div>

        {/* Variables summary (auto-detected) */}
        {variables.length > 0 && (
          <div className="editor-section">
            <label className="editor-label">Variables <span className="editor-label-hint">(auto-detected from script)</span></label>
            <div className="editor-vars-list">
              {variables.map((v, i) => (
                <div key={v.name} className="editor-var-row">
                  <span className="editor-var-name">{"{{" + v.name + "}}"}</span>
                  <input
                    className="editor-var-default"
                    value={v.default ?? ''}
                    onChange={e => setVariables(prev => prev.map((vv, ii) =>
                      ii === i ? { ...vv, default: e.target.value } : vv
                    ))}
                    placeholder="default value or CEL expression…"
                  />
                  <input
                    className="editor-var-desc"
                    value={v.description ?? ''}
                    onChange={e => setVariables(prev => prev.map((vv, ii) =>
                      ii === i ? { ...vv, description: e.target.value } : vv
                    ))}
                    placeholder="description (optional)"
                  />
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default CommandEditorTab;
```

- [ ] **Step 2: Add editor tab styles to style.css**

```css
/* ========== Command Editor Tab ========== */

.editor-tab {
  display: flex;
  flex-direction: column;
  height: 100%;
  overflow: hidden;
  outline: none;
}

.editor-tab-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 20px;
  border-bottom: 1px solid var(--border);
  background: var(--card);
  flex-shrink: 0;
}

.editor-tab-breadcrumb {
  font-size: 12px;
  color: var(--muted-foreground);
  font-weight: 500;
}

.editor-tab-actions {
  display: flex;
  gap: 6px;
}

.editor-tab-body {
  flex: 1;
  overflow-y: auto;
  padding: 20px 24px;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.editor-section {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.editor-section-grow {
  flex: 1;
  min-height: 160px;
}

.editor-label {
  font-size: 11px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.7px;
  color: var(--muted-foreground);
}

.editor-label-hint {
  font-weight: 400;
  text-transform: none;
  letter-spacing: 0;
  font-size: 11px;
  margin-left: 4px;
  color: var(--primary);
  opacity: 0.75;
}

.editor-title-input {
  font-size: 20px;
  font-weight: 600;
  background: transparent;
  border: none;
  border-bottom: 1px solid var(--border);
  color: var(--foreground);
  outline: none;
  padding: 4px 0;
  width: 100%;
  transition: border-color var(--transition-fast);
}

.editor-title-input:focus {
  border-bottom-color: var(--primary);
}

.editor-title-input::placeholder {
  color: var(--muted-foreground);
  opacity: 0.5;
}

.editor-description-input {
  width: 100%;
  background: var(--card);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  color: var(--foreground);
  font-size: 13px;
  font-family: var(--font-sans);
  padding: 8px 10px;
  resize: none;
  outline: none;
  transition: border-color var(--transition-fast);
}

.editor-description-input:focus {
  border-color: var(--ring);
}

.editor-script-input {
  flex: 1;
  width: 100%;
  min-height: 200px;
  background: var(--card);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  color: var(--foreground);
  font-family: var(--font-mono);
  font-size: 13px;
  line-height: 1.6;
  padding: 12px 14px;
  resize: vertical;
  outline: none;
  transition: border-color var(--transition-fast);
}

.editor-script-input:focus {
  border-color: var(--ring);
}

.editor-script-input::placeholder {
  color: var(--muted-foreground);
  opacity: 0.4;
}

.editor-vars-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.editor-var-row {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 12px;
}

.editor-var-name {
  font-family: var(--font-mono);
  color: var(--var-missing-fg);
  min-width: 120px;
  flex-shrink: 0;
}

.editor-var-default,
.editor-var-desc {
  flex: 1;
  background: var(--card);
  border: 1px solid var(--border);
  border-radius: 3px;
  color: var(--foreground);
  font-size: 12px;
  font-family: var(--font-mono);
  padding: 3px 7px;
  outline: none;
  transition: border-color var(--transition-fast);
}

.editor-var-default:focus,
.editor-var-desc:focus {
  border-color: var(--ring);
}

.editor-var-desc {
  font-family: var(--font-sans);
}
```

- [ ] **Step 3: Run type check**

```bash
cd frontend && pnpm tsc --noEmit
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/components/CommandEditorTab.tsx frontend/src/style.css
git commit -m "feat: add CommandEditorTab component"
```

---

## Task 3: Wire Editor Tabs into App.tsx

Replace the modal `commandEditor` state with an editor tab that opens in-place.

**Files:**
- Modify: `frontend/src/App.tsx`

- [ ] **Step 1: Add `editorTabData` state to App.tsx**

Below the `paletteOpen` state, add:

```tsx
interface EditorTabData {
  command?: Command;
  defaultCategoryId?: string;
}
const [editorTabData, setEditorTabData] = useState<EditorTabData | null>(null);
```

- [ ] **Step 2: Add `openEditorTab` helper**

Add a helper that opens an editor tab (adds it to `openTabs` and activates it):

```tsx
const EDITOR_TAB_ID = '__editor__';

const openEditorTab = useCallback((data: EditorTabData) => {
  setEditorTabData(data);
  setActiveTabId(EDITOR_TAB_ID);
  setOpenTabs(prev => {
    const exists = prev.find(t => t.id === EDITOR_TAB_ID);
    const title = data.command ? `Edit: ${data.command.title}` : 'New Command';
    if (exists) return prev.map(t => t.id === EDITOR_TAB_ID ? { ...t, title, isDirty: false } : t);
    return [...prev, { id: EDITOR_TAB_ID, title, kind: 'editor' as const, isDirty: false }];
  });
}, []);

const closeEditorTab = useCallback(() => {
  setEditorTabData(null);
  setOpenTabs(prev => {
    const newTabs = prev.filter(t => t.id !== EDITOR_TAB_ID);
    if (activeTabId === EDITOR_TAB_ID) {
      const lastCmd = newTabs.findLast(t => t.kind === 'command');
      if (lastCmd) {
        const cmd = commands.find(c => c.id === lastCmd.id);
        if (cmd) { setSelectedCommand(cmd); setActiveTabId(lastCmd.id); }
      } else {
        setSelectedCommand(null);
        setActiveTabId(null);
      }
    }
    return newTabs;
  });
}, [activeTabId, commands]);
```

- [ ] **Step 3: Update modal triggers to use editor tab**

Replace the `setModal({ type: 'commandEditor', ... })` calls. There are 3 places in App.tsx:

**a) New command button:**
```tsx
// Old:
onAddCommand={(catId) => setModal({ type: 'commandEditor', defaultCategoryId: catId })}
// New:
onAddCommand={(catId) => openEditorTab({ defaultCategoryId: catId })}
```

**b) Edit command from sidebar:**
```tsx
// Old:
onEditCommand={(cmd) => setModal({ type: 'commandEditor', command: cmd })}
// New:
onEditCommand={(cmd) => openEditorTab({ command: cmd })}
```

**c) Edit button inside CommandDetail (via keyboard shortcut and inline button):**

In the keyboard shortcuts section, update:
```tsx
[`${cmdOrCtrl}+e`]: () => {
  if (selectedCommand && modal.type === 'none') {
    openEditorTab({ command: selectedCommand });
  }
},
```

And update the `onEdit` prop passed to `<CommandDetail>`:
```tsx
onEdit={() => openEditorTab({ command: selectedCommand })}
```

Also update `handleCreateCommand` and `handleUpdateCommand` to call `closeEditorTab()` instead of `setModal({ type: 'none' })`.

- [ ] **Step 4: Render `CommandEditorTab` in the main content area**

Import the component at the top of `App.tsx`:
```tsx
import CommandEditorTab from './components/CommandEditorTab';
```

In the JSX, update the `main-content` section to also handle the editor tab:

```tsx
<div className="main-content">
  {activeTabId === EDITOR_TAB_ID && editorTabData !== null ? (
    <CommandEditorTab
      command={editorTabData.command}
      categories={categories}
      defaultCategoryId={editorTabData.defaultCategoryId}
      onSave={editorTabData.command ? handleUpdateCommand : handleCreateCommand}
      onDiscard={() => {
        if (editorTabData.command || confirm('Discard unsaved changes?')) {
          closeEditorTab();
        }
      }}
      onDirtyChange={(dirty) => {
        setOpenTabs(prev => prev.map(t =>
          t.id === EDITOR_TAB_ID ? { ...t, isDirty: dirty } : t
        ));
      }}
    />
  ) : selectedCommand ? (
    <div className="main-body">
      <CommandDetail ... />
    </div>
  ) : (
    <div className="empty-state"> ... </div>
  )}
</div>
```

- [ ] **Step 5: Update `closeTab` to handle editor tab**

In the `closeTab` function, add a check: if closing the editor tab and it's dirty, show a confirm dialog:

```tsx
const closeTab = (commandId: string) => {
  if (commandId === EDITOR_TAB_ID) {
    const editorTab = openTabs.find(t => t.id === EDITOR_TAB_ID);
    if (editorTab?.isDirty && !confirm('Discard unsaved changes?')) return;
    closeEditorTab();
    return;
  }
  // ... existing logic unchanged
};
```

- [ ] **Step 6: Remove `commandEditor` from ModalState**

Since the editor is now a tab, remove it from the modal union type:

```tsx
type ModalState =
  | { type: 'none' }
  | { type: 'categoryEditor'; category?: Category }
  | { type: 'managePresets'; variables: VarPromptType[]; commandId: string; presets: VariablePreset[] }
  | { type: 'fillVariables'; variables: VarPromptType[]; commandId: string; initialValues: Record<string, string> }
  | { type: 'confirmDelete'; itemType: 'command' | 'category'; id: string; name: string }
  | { type: 'settings' };
```

Remove the `{modal.type === 'commandEditor' && <CommandEditor ... />}` render block from the JSX.

- [ ] **Step 7: Run type check**

```bash
cd frontend && pnpm tsc --noEmit
```

Expected: no errors.

- [ ] **Step 8: Commit**

```bash
git add frontend/src/App.tsx
git commit -m "feat: wire CommandEditorTab into app — new/edit opens as tab"
```

---

## Task 4: Remove CommandEditor Modal

Once the tab-based editor is working, delete the old modal.

**Files:**
- Delete: `frontend/src/components/CommandEditor.tsx`
- Modify: `frontend/src/App.tsx`

- [ ] **Step 1: Verify the tab editor works for create and edit**

Run `wails dev`. Test:
- `Cmd+N` / `Cmd+T` → opens "New Command" editor tab
- Filling in title + script + save → creates command, tab converts to command view
- Right-click a command → Edit → opens editor tab with pre-filled fields
- Saving an edited command → updates it, tab converts back to command view
- Pressing Esc in editor → confirms discard and closes tab

- [ ] **Step 2: Remove CommandEditor import and delete the file**

In `App.tsx`, remove:
```tsx
import CommandEditor from './components/CommandEditor';
```

Delete the file:
```bash
git rm frontend/src/components/CommandEditor.tsx
```

- [ ] **Step 3: Run type check**

```bash
cd frontend && pnpm tsc --noEmit
```

Expected: no errors.

- [ ] **Step 4: Final build check**

```bash
cd frontend && pnpm build
```

Expected: builds without errors.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/App.tsx
git commit -m "feat: remove CommandEditor modal — replaced by tab-based editor"
```
