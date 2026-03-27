# Bash File-Based Command Storage

## Overview

Replace plain-text `commandText` storage with auto-generated bash scripts stored at `~/.commamer/scripts/{id}.sh`. Each script defines a `main()` function with named local variables derived from the UI variable panel. Users can edit the script body directly for advanced use cases.

## Current State

- Commands store a `commandText` string field (e.g., `redis-cli --scan --pattern "${pattern}"`)
- Variables are auto-detected via `${varName}` regex from the command text
- At execution time, `${varName}` placeholders are string-replaced with user-provided values
- The final string is passed to `$SHELL -lc` for execution

## New Design

### Data Model

**`Command` struct changes:**
- Remove: `commandText` field
- Add: `scriptPath` field (string, relative path like `scripts/{id}.sh`)

**Script file location:** `~/.commamer/scripts/`

**Existing data:** Wiped on upgrade. No migration. Users start fresh.

### Generated Script Format

For a command with variables `pattern` (order 0) and `host` (order 1):

```bash
#!/bin/bash

main() {
  local pattern="$1"
  local host="$2"

  redis-cli --scan --pattern "$pattern" -h "$host"
}

main "$@"
```

For a command with no variables:

```bash
#!/bin/bash

main() {
  openssl rand -base64 32
}

main "$@"
```

**Structure rules:**
- Shebang line: always `#!/bin/bash`
- `main()` function: always present
- Local variable declarations: auto-generated from the variable panel (source of truth), one per line, mapped to positional args `$1`, `$2`, ... in variable definition order
- Body: user-editable content between the local declarations and the closing `}`
- `main "$@"` call: always appended after the function definition

### Variable Management

- **Source of truth:** The variable definitions panel in the UI (name, description, example, default)
- **No more regex detection:** Variables are explicitly added/removed by the user in the panel
- **Function signature:** Always regenerated from the variable panel before execution
- **In script body:** User references variables as regular bash variables (`$pattern`, `"$host"`)
- **Variable order:** Determined by the order in the variables array (matches positional args)

### Execution Flow

1. User clicks Execute (or Run in Terminal)
2. If command has variables with missing values -> prompt for values (same UX as today, with presets)
3. Backend reads the script file content
4. Backend regenerates the `main()` function signature (local declarations) from current variable definitions, preserving the user's script body
5. Writes the updated script to disk
6. Executes: `bash <script_path> "val1" "val2"` (args in variable definition order)
7. Streams output via Wails events (same mechanism as today)

### Command Editor UX

**Two modes:**

1. **Simple mode (default):** A textarea for the "command body" -- the content that goes inside `main()` after the local variable declarations. Looks almost identical to today's command text editor. User types something like `redis-cli --scan --pattern "$pattern"`.

2. **Advanced mode (toggle):** A full script editor showing the complete `.sh` file. User can freely edit the entire script. The variable panel still controls the function signature -- on save, the `main()` signature (local declarations) is regenerated from the panel.

**Variable panel (right side):**
- Same fields as today: name, description, example, default (CEL expression)
- Explicit add/remove buttons (no auto-detection from script content)
- Order matters (drag to reorder, or arrow buttons) -- determines positional arg mapping

**Save behavior:**
- Simple mode: app wraps the body text into the full script template and writes the `.sh` file
- Advanced mode: app regenerates only the local declarations in `main()`, preserves everything else, writes the `.sh` file
- Variable panel changes always update the function signature on next save

### Script File Management

- **Create:** When a command is created, generate the `.sh` file at `~/.commamer/scripts/{command-id}.sh`
- **Update:** Overwrite the `.sh` file on save
- **Delete:** Remove the `.sh` file when the command is deleted
- **Directory:** `Store` ensures `~/.commamer/scripts/` exists on startup

### Backend Changes

**`models.go`:**
- `Command` struct: remove `commandText`, add `ScriptPath string`
- Keep `VariableDefinition`, `VariablePreset`, `VariablePrompt` as-is
- Remove `variableRegex` from executor

**`app.go`:**
- `CreateCommand`: accept title, description, scriptBody, categoryID, tags, variables, isAdvanced. Generate the `.sh` file. Store `scriptPath`.
- `UpdateCommand`: same params. Regenerate/update the `.sh` file.
- `DeleteCommand`: also delete the `.sh` file.
- `GetScriptContent(commandID)`: new method. Returns the script file content for the editor.
- `GetVariables`: simplify -- no longer parses command text. Just returns enriched prompts from stored variable definitions with CEL-evaluated defaults.
- `RunCommand`: read script path, regenerate signature, execute with `bash <path> args...`
- `RunInTerminal`: same approach but via terminal launcher

**`executor.go`:**
- Remove: `ParseVariables`, `SubstituteVariables`, `variableRegex`
- Add: `ExecuteScript(scriptPath string, args []string) ExecutionResult`
- Add: `ExecuteScriptStreaming(scriptPath string, args []string, onChunk func(OutputChunk)) ExecutionResult`
- Keep: terminal-related code (update `OpenInTerminal` to run scripts)
- Keep: `EvalDefaults` (still used for variable default evaluation)

**`store.go`:**
- Add `scriptsDir` field, ensure `~/.commamer/scripts/` exists in `NewStore()`
- Add `ScriptsDir() string` getter

**New file `script.go`** (optional, or inline in app.go):
- `GenerateScript(body string, variables []VariableDefinition) string` -- builds full script from body + variable defs
- `ParseScriptBody(scriptContent string) string` -- extracts the user-editable body from a full script (for simple mode editing)
- `RegenerateSignature(scriptContent string, variables []VariableDefinition) string` -- replaces local declarations in an existing script

### Frontend Changes

**`types.ts`:**
- `Command` interface: remove `commandText`, add `scriptPath: string`

**`CommandEditor.tsx`:**
- Replace command textarea with:
  - Simple mode: textarea for body text (what goes inside main after locals)
  - Advanced mode: larger textarea/code editor for full script
  - Toggle button between modes
- Variable panel: add explicit "Add Variable" button, remove button per variable, reorder controls
- On save: send body text + mode flag to backend

**`CommandDetail.tsx`:**
- Display the script body (from `GetScriptContent`) instead of `commandText`
- Update copy button to copy the full script or just the body
- Preview section: show how the script will be called with resolved variable values
- Remove `${varName}` regex-based rendering

**`App.tsx`:**
- Update all `CreateCommand`/`UpdateCommand` calls with new params
- Add `GetScriptContent` call when selecting a command
- Update search to work with script content

**`en.json`:**
- Update/add i18n keys for: script body, advanced mode toggle, add variable button, etc.
- Remove keys related to `${varName}` placeholder hints

### Search

`SearchCommands` currently searches `commandText`. After the change:
- Search title, description, tags (same as today)
- Additionally read script file content for full-text search against command body
