# Add Tag Filtering to Sidebar Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a tag filter section to the sidebar that allows users to filter commands by their tags, with support for multiple tag selection (AND logic) and a clear button.

**Architecture:** The tag filter requires changes in two places: (1) `App.tsx` to manage the selected tags state and filter the command list, and (2) `Sidebar.tsx` to display the tag filter UI. Tags are already stored on commands (`command.tags: string[]`), so no backend changes are needed. The filtering is done client-side by intersecting the selected tags with each command's tags.

**Tech Stack:** React + TypeScript, shadcn/ui components (Badge, Collapsible, Button)

**Source:** todos/add-command-tags-filter.pending.md

---

## Files to Modify

| File | Responsibility |
|------|---------------|
| `frontend/src/App.tsx` | State management for selected tags, filtering logic |
| `frontend/src/components/Sidebar.tsx` | Tag filter UI (collapsible section, tag badges, clear button) |
| `frontend/src/types.ts` | Reference only - Command type already has `tags: string[]` |

---

### Task 1: Add Tag State and Filtering in App.tsx

**Files:**
- Modify: `frontend/src/App.tsx`

- [ ] **Step 1: Add selected tags state**

Find the state declarations (around line 66) and add after `searchQuery`:

```typescript
const [selectedTags, setSelectedTags] = useState<string[]>([]);
```

- [ ] **Step 2: Compute filtered commands with tag filtering**

After the `useEffect` that fetches commands (around line 121), add:

```typescript
const filteredCommands = useMemo(() => {
    if (selectedTags.length === 0) return commands;
    return commands.filter(cmd => 
        selectedTags.every(tag => cmd.tags?.includes(tag))
    );
}, [commands, selectedTags]);
```

- [ ] **Step 3: Compute all unique tags from commands**

Add after the filteredCommands memo:

```typescript
const allTags = useMemo(() => {
    const tagSet = new Set<string>();
    commands.forEach(cmd => {
        cmd.tags?.forEach(tag => tagSet.add(tag));
    });
    return Array.from(tagSet).sort();
}, [commands]);
```

- [ ] **Step 4: Pass new props to Sidebar**

Find the Sidebar component usage (around line 395) and add the new props:

```tsx
<Sidebar
    categories={categories}
    commands={filteredCommands}  // Change from commands to filteredCommands
    selectedCommandId={selectedCommand?.id || null}
    searchQuery={searchQuery}
    onSearchChange={setSearchQuery}
    selectedTags={selectedTags}
    onTagToggle={(tag) => {
        setSelectedTags(prev => 
            prev.includes(tag) 
                ? prev.filter(t => t !== tag)
                : [...prev, tag]
        );
    }}
    onClearTags={() => setSelectedTags([])}
    allTags={allTags}
    onSelectCommand={handleSelectCommand}
    // ... rest of props
```

- [ ] **Step 5: Commit**

```bash
git add frontend/src/App.tsx
git commit -m "feat: add tag filtering state and logic"
```

---

### Task 2: Add Tag Filter UI to Sidebar

**Files:**
- Modify: `frontend/src/components/Sidebar.tsx`

- [ ] **Step 1: Update Sidebar props interface**

Find the `SidebarProps` interface (around line 14) and add:

```typescript
selectedTags: string[];
onTagToggle: (tag: string) => void;
onClearTags: () => void;
allTags: string[];
```

- [ ] **Step 2: Destructure new props**

In the component function (around line 28), add to the destructuring:

```typescript
selectedTags,
onTagToggle,
onClearTags,
allTags,
```

- [ ] **Step 3: Add tag filter section**

Find the location after the search input and before the ScrollArea (around line 102). Add a collapsible tag filter section:

```tsx
{allTags.length > 0 && (
    <Collapsible className="px-3 py-2 border-b border-border/50">
        <CollapsibleTrigger asChild>
            <div className="flex items-center justify-between cursor-pointer">
                <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                    {t('sidebar.tags')}
                </span>
                <div className="flex items-center gap-1">
                    {selectedTags.length > 0 && (
                        <Badge variant="secondary" className="text-[10px] h-4 px-1">
                            {selectedTags.length}
                        </Badge>
                    )}
                    <ChevronRight className={`size-3.5 text-muted-foreground transition-transform ${openCategories.has('tags') ? 'rotate-90' : ''}`} />
                </div>
            </div>
        </CollapsibleTrigger>
        <CollapsibleContent>
            <div className="flex flex-wrap gap-1.5 mt-2">
                {allTags.map(tag => (
                    <Badge
                        key={tag}
                        variant={selectedTags.includes(tag) ? "default" : "secondary"}
                        className="cursor-pointer text-xs"
                        onClick={() => onTagToggle(tag)}
                    >
                        {tag}
                    </Badge>
                ))}
            </div>
            {selectedTags.length > 0 && (
                <Button
                    variant="ghost"
                    size="sm"
                    className="mt-2 h-6 text-xs text-muted-foreground"
                    onClick={onClearTags}
                >
                    <X className="size-3 mr-1" />
                    {t('sidebar.clearTags')}
                </Button>
            )}
        </CollapsibleContent>
    </Collapsible>
)}
```

- [ ] **Step 4: Add missing imports**

Add `X` to the import from lucide-react if not already there:

```typescript
import { Search, Plus, Pencil, X, ChevronRight, Terminal, Settings } from 'lucide-react';
```

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/Sidebar.tsx
git commit -m "feat: add tag filter UI to sidebar"
```

---

### Task 3: Add i18n Translations

**Files:**
- Modify: `frontend/src/locales/en.json`

- [ ] **Step 1: Find sidebar section**

Locate the sidebar translations in `en.json`.

- [ ] **Step 2: Add new translation keys**

Add these keys to the sidebar section:

```json
{
  "sidebar": {
    "searchPlaceholder": "Search commands...",
    "category": "Category",
    "command": "Command",
    "addACommand": "Add a command...",
    "uncategorized": "Uncategorized",
    "addCommand": "Add Command",
    "editCategory": "Edit Category",
    "deleteCategory": "Delete Category",
    "tags": "Tags",
    "clearTags": "Clear"
  }
}
```

- [ ] **Step 3: Commit**

```bash
git add frontend/src/locales/en.json
git commit -m "feat: add tag filter translations"
```

---

### Task 4: Verify the Implementation

- [ ] **Step 1: Type-check**

Run:
```bash
make check
```

Expected: No errors in Go or TypeScript.

- [ ] **Step 2: Manual verification plan**

To verify the feature works:
1. Ensure you have commands with tags (check CommandDetail to see tags displayed)
2. **Verify:** Sidebar shows a "Tags" collapsible section with all unique tags as badges
3. **Verify:** Clicking a tag selects it (badge changes to primary/default variant)
4. **Verify:** Command list filters to show only commands with that tag
5. **Verify:** Selecting a second tag applies AND filtering (only commands with BOTH tags)
6. **Verify:** Clear button appears when tags are selected
7. **Verify:** Clicking Clear removes all tag filters
8. **Verify:** Tag filter section is hidden when no commands have tags

- [ ] **Step 3: Commit**

```bash
git commit --allow-empty -m "verify: tag filtering feature confirmed"
```

---

### Task 5: Mark Todo Resolved

- [ ] **Step 1: Prepend resolution header**

Edit `todos/add-command-tags-filter.pending.md` and prepend:
```markdown
<!-- Resolved: 2026-03-27 | Plan: docs/superpowers/plans/2026-03-27-add-command-tags-filter.md -->
```

- [ ] **Step 2: Rename file**

```bash
git mv todos/add-command-tags-filter.pending.md todos/add-command-tags-filter.resolved.md
```

- [ ] **Step 3: Commit**

```bash
git add todos/add-command-tags-filter.resolved.md
git commit -m "chore: mark add-command-tags-filter as resolved"
```

---

## Summary of Changes

| Component | Changes |
|-----------|---------|
| App.tsx | Add `selectedTags` state, `filteredCommands` memo, `allTags` memo, pass new props to Sidebar |
| Sidebar.tsx | Add tag filter props, collapsible tag section with clickable badges, clear button |
| en.json | Add `sidebar.tags` and `sidebar.clearTags` translations |

## Behavior

| Action | Result |
|--------|--------|
| Click tag badge | Tag is selected, command list filters |
| Click selected tag | Tag is deselected |
| Select multiple tags | AND logic - commands must have ALL selected tags |
| Click Clear | All tag filters removed |
| No commands have tags | Tag filter section is hidden |
