# Fix Preset Preview and Output Display Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix the preset preview to show the fully rendered script with variables filled in, make copy button copy the filled command, and fix the output pane to show the actual CLI command instead of `bash <script> name=value`.

**Architecture:** The fix requires changes in three areas: (1) Frontend `CommandDetail` component to add a helper function that replaces template variables and use it for both preview rendering and copy functionality, (2) Backend `executor.go` to add a new function that builds a display-friendly command string, and (3) `app.go` to use this new function when recording executions. The frontend already has `renderScriptWithVars` but it only visualizes variables; we need a version that actually produces the substituted string.

**Tech Stack:** React + TypeScript (frontend), Go (backend), Wails v2 bindings

**Source:** todos/fix-preset-preview.pending.md

---

## Files to Modify

| File | Responsibility |
|------|---------------|
| `frontend/src/components/CommandDetail.tsx` | Main component showing command preview and preset selection |
| `executor.go` | Backend executor with `BuildFinalCommand` that shows `bash <script> name=value` |
| `app.go` | Entry point that calls `BuildFinalCommand` and stores result in `ExecutionRecord` |
| `frontend/src/types.ts` | Type definitions (read-only reference) |

---

### Task 1: Add Helper Function to Replace Template Vars in Frontend

**Files:**
- Modify: `frontend/src/components/CommandDetail.tsx`

The component already has `renderScriptWithVars` which produces JSX for display. We need a plain string version for copying and for potential future use.

- [ ] **Step 1: Add `getResolvedScript` helper function**

Add this function after `renderScriptWithVars` (around line 142):

```typescript
const getResolvedScript = useMemo(() => {
  if (!scriptBody) return "";
  return scriptBody.replace(/\{\{(\w+)\}\}/g, (match, varName) => {
    return resolvedValues[varName] || match;
  });
}, [scriptBody, resolvedValues]);
```

- [ ] **Step 2: Update `handleCopy` to use resolved script**

Find the `handleCopy` function (around line 90) and change it to:

```typescript
const handleCopy = useCallback(() => {
  const textToCopy = getResolvedScript || scriptBody;
  navigator.clipboard.writeText(textToCopy).then(() => {
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  });
}, [getResolvedScript, scriptBody]);
```

- [ ] **Step 3: Add preview display for resolved script**

Find the `argsPreview` section (around line 390). The current preview shows variable assignments like `name=Loco`. We need to also show the fully resolved script. Add a new div before the argsPreview:

```tsx
<div className="mb-2 pb-2 border-b border-border/50">
  <code className="text-xs whitespace-pre-wrap break-all">{getResolvedScript}</code>
</div>
```

Place this inside the `command-text-box` div, before the `argsPreview` map (around line 391).

- [ ] **Step 4: Commit**

```bash
git add frontend/src/components/CommandDetail.tsx
git commit -m "feat: show resolved script preview and copy filled command"
```

---

### Task 2: Add Backend Function to Build Display Command

**Files:**
- Modify: `executor.go`

- [ ] **Step 1: Add new `BuildDisplayCommand` function**

Add this function after `BuildFinalCommand` (around line 77):

```go
// BuildDisplayCommand builds a user-friendly display string showing the actual command with variables replaced.
// Unlike BuildFinalCommand which shows "bash <script> name=value", this shows the resolved script content.
func BuildDisplayCommand(scriptContent string, variables map[string]string) string {
	resolved := ReplaceTemplateVars(scriptContent, variables)
	// Strip shebang if present for cleaner display
	resolved = strings.TrimPrefix(resolved, "#!/bin/bash\n")
	resolved = strings.TrimPrefix(resolved, "#!/bin/bash\n\n")
	resolved = strings.TrimSpace(resolved)
	return resolved
}
```

- [ ] **Step 2: Commit**

```bash
git add executor.go
git commit -m "feat: add BuildDisplayCommand for user-friendly command display"
```

---

### Task 3: Update App.go to Use Display Command

**Files:**
- Modify: `app.go`

- [ ] **Step 1: Find the ExecuteCommand function**

Locate where `ExecutionRecord` is created (around line 253-268). Currently it uses:
```go
finalCmd := BuildFinalCommand(variables)
```

- [ ] **Step 2: Change to use BuildDisplayCommand**

Replace the `finalCmd` assignment with:

```go
finalCmd := BuildDisplayCommand(cmd.ScriptContent, variables)
```

The full context should look like:
```go
resolvedScript := ReplaceTemplateVars(cmd.ScriptContent, variables)
finalCmd := BuildDisplayCommand(cmd.ScriptContent, variables)

result := a.executor.ExecuteScript(resolvedScript, func(chunk OutputChunk) {
    wailsruntime.EventsEmit(a.ctx, "cmd-output", chunk)
})

record := ExecutionRecord{
    ID:            uuid.New().String(),
    CommandID:     commandID,
    ScriptContent: cmd.ScriptContent,
    FinalCmd:      finalCmd,
    Output:        result.Output,
    Error:         result.Error,
    ExitCode:      result.ExitCode,
    ExecutedAt:    time.Now(),
}
```

- [ ] **Step 3: Regenerate Wails bindings**

Run:
```bash
wails generate module
```

Expected: TypeScript bindings update (warnings about time.Time are normal).

- [ ] **Step 4: Commit**

```bash
git add app.go frontend/wailsjs/go/
git commit -m "feat: use BuildDisplayCommand for execution history"
```

---

### Task 4: Verify the Fixes

- [ ] **Step 1: Type-check**

Run:
```bash
make check
```

Expected: No errors in Go or TypeScript.

- [ ] **Step 2: Manual verification plan**

To verify the fix works:
1. Create a command: `echo "Hello {{name}}"`
2. Create a preset with `name=Loco`
3. Select the preset in CommandDetail
4. **Verify:** The preview box should show `echo "Hello Loco"`
5. **Verify:** Clicking copy should copy `echo "Hello Loco"` (paste to check)
6. **Verify:** Execute the command
7. **Verify:** The OutputPane should show `$ echo "Hello Loco"` not `$ bash <script> name="Loco"`
8. **Verify:** HistoryPane should also show `echo "Hello Loco"`

- [ ] **Step 3: Commit**

```bash
git commit --allow-empty -m "verify: preset preview and output display fixes confirmed"
```

---

### Task 5: Mark Todo Resolved

- [ ] **Step 1: Prepend resolution header**

Edit `todos/fix-preset-preview.pending.md` and prepend:
```markdown
<!-- Resolved: 2026-03-27 | Plan: docs/superpowers/plans/2026-03-27-fix-preset-preview.md -->
```

- [ ] **Step 2: Rename file**

```bash
git mv todos/fix-preset-preview.pending.md todos/fix-preset-preview.resolved.md
```

- [ ] **Step 3: Commit**

```bash
git add todos/fix-preset-preview.resolved.md
git commit -m "chore: mark fix-preset-preview as resolved"
```

---

## Summary of Changes

| Area | Before | After |
|------|--------|-------|
| Preset Preview | Shows `name=Loco` | Shows `echo "Hello Loco"` |
| Copy Button | Copies raw script | Copies filled script |
| Output Display | `bash <script> name="Loco"` | `echo "Hello Loco"` |
| History Display | `bash <script> name="Loco"` | `echo "Hello Loco"` |
