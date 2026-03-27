# Bash File-Based Command Storage with SQLite

## Overview

Replace plain-text `commandText` storage with auto-generated bash scripts stored at `~/.commamer/scripts/{id}.sh`. Each script defines a `main()` function with named local variables derived from the UI variable panel. Users can edit the script body directly for advanced use cases. All metadata is stored in SQLite (replacing JSON files) for enterprise readiness.

## Current State

- Commands store a `commandText` string field (e.g., `redis-cli --scan --pattern "${pattern}"`)
- Variables are auto-detected via `${varName}` regex from the command text
- At execution time, `${varName}` placeholders are string-replaced with user-provided values
- The final string is passed to `$SHELL -lc` for execution
- Data persisted as JSON files (`data.json`, `executions.json`) with in-memory mutex

## New Design

### Storage: SQLite

**Driver:** `modernc.org/sqlite` (pure Go, no CGo dependency)

**Database location:** `~/.commamer/commamer.db`

**Schema:**

```sql
CREATE TABLE categories (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    icon TEXT NOT NULL DEFAULT '',
    color TEXT NOT NULL DEFAULT '',
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE commands (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    script_path TEXT NOT NULL,
    category_id TEXT NOT NULL DEFAULT '',
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE CASCADE
);

CREATE TABLE tags (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE
);

CREATE TABLE command_tags (
    command_id TEXT NOT NULL,
    tag_id INTEGER NOT NULL,
    PRIMARY KEY (command_id, tag_id),
    FOREIGN KEY (command_id) REFERENCES commands(id) ON DELETE CASCADE,
    FOREIGN KEY (tag_id) REFERENCES tags(id) ON DELETE CASCADE
);

CREATE TABLE variable_definitions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    command_id TEXT NOT NULL,
    name TEXT NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    example TEXT NOT NULL DEFAULT '',
    default_expr TEXT NOT NULL DEFAULT '',
    sort_order INTEGER NOT NULL DEFAULT 0,
    FOREIGN KEY (command_id) REFERENCES commands(id) ON DELETE CASCADE
);

CREATE TABLE variable_presets (
    id TEXT PRIMARY KEY,
    command_id TEXT NOT NULL,
    name TEXT NOT NULL,
    FOREIGN KEY (command_id) REFERENCES commands(id) ON DELETE CASCADE
);

CREATE TABLE preset_values (
    preset_id TEXT NOT NULL,
    variable_name TEXT NOT NULL,
    value TEXT NOT NULL DEFAULT '',
    PRIMARY KEY (preset_id, variable_name),
    FOREIGN KEY (preset_id) REFERENCES variable_presets(id) ON DELETE CASCADE
);

CREATE TABLE executions (
    id TEXT PRIMARY KEY,
    command_id TEXT NOT NULL,
    script_path TEXT NOT NULL,
    final_cmd TEXT NOT NULL,
    output TEXT NOT NULL DEFAULT '',
    error TEXT NOT NULL DEFAULT '',
    exit_code INTEGER NOT NULL DEFAULT 0,
    executed_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE VIRTUAL TABLE commands_fts USING fts5(
    title, description, content='commands', content_rowid='rowid'
);
```

**Key schema decisions:**
- Tags normalized into their own table for consistent enterprise tagging
- `sort_order` on variable_definitions controls positional arg mapping
- FTS5 virtual table for fast command search
- CASCADE deletes throughout
- Execution history uncapped (retention policies can be added later)
- `category_id` defaults to empty string for uncategorized commands (no FK constraint on empty string)

**Existing data:** Wiped on upgrade. No migration from JSON. Users start fresh. Old JSON files (`data.json`, `executions.json`) are ignored.

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
- Local variable declarations: auto-generated from the variable panel (source of truth), one per line, mapped to positional args `$1`, `$2`, ... in variable definition order (`sort_order`)
- Body: user-editable content between the local declarations and the closing `}`
- `main "$@"` call: always appended after the function definition

### Variable Management

- **Source of truth:** The variable definitions in the database (managed via UI panel)
- **No more regex detection:** Variables are explicitly added/removed by the user in the panel
- **Function signature:** Always regenerated from variable definitions before execution
- **In script body:** User references variables as regular bash variables (`$pattern`, `"$host"`)
- **Variable order:** Determined by `sort_order` column (matches positional args)

### Execution Flow

1. User clicks Execute (or Run in Terminal)
2. If command has variables with missing values -> prompt for values (same UX as today, with presets)
3. Backend reads the script file content
4. Backend regenerates the `main()` function signature (local declarations) from current variable definitions, preserving the user's script body
5. Writes the updated script to disk
6. Executes: `bash <script_path> "val1" "val2"` (args in `sort_order` order)
7. Streams output via Wails events (same mechanism as today)

### Command Editor UX

**Two modes:**

1. **Simple mode (default):** A textarea for the "command body" -- the content that goes inside `main()` after the local variable declarations. Looks almost identical to today's command text editor. User types something like `redis-cli --scan --pattern "$pattern"`.

2. **Advanced mode (toggle):** A full script editor showing the complete `.sh` file. User can freely edit the entire script. The variable panel still controls the function signature -- on save, the `main()` signature (local declarations) is regenerated from the panel.

**Variable panel (right side):**
- Same fields as today: name, description, example, default (CEL expression)
- Explicit add/remove buttons (no auto-detection from script content)
- Order matters (drag to reorder, or arrow buttons) -- determines positional arg mapping via `sort_order`

**Save behavior:**
- Simple mode: app wraps the body text into the full script template and writes the `.sh` file
- Advanced mode: app regenerates only the local declarations in `main()`, preserves everything else, writes the `.sh` file
- Variable panel changes always update the function signature on next save

### Script File Management

- **Create:** When a command is created, generate the `.sh` file at `~/.commamer/scripts/{command-id}.sh`
- **Update:** Overwrite the `.sh` file on save
- **Delete:** Remove the `.sh` file when the command is deleted
- **Directory:** Store ensures `~/.commamer/scripts/` exists on startup

### Backend Changes

**Remove files:**
- `store.go` — replaced entirely by SQLite-based store

**New file `db.go`:**
- SQLite database initialization with `modernc.org/sqlite`
- Schema creation/migration via version table
- All CRUD operations as methods on a `DB` struct
- Transaction support for multi-table operations (e.g., creating a command with tags and variables)
- FTS5 index maintenance (triggers or manual sync on insert/update/delete)

**`models.go`:**
- `Command` struct: remove `commandText`, add `ScriptPath string`
- Keep `VariableDefinition` — add `SortOrder int` field
- Keep `VariablePreset`, `VariablePrompt` as-is
- Remove `variableRegex` from executor

**`app.go`:**
- Replace `store *Store` with `db *DB`
- `CreateCommand`: accept title, description, scriptBody, categoryID, tags, variables, isAdvanced. Generate the `.sh` file. Insert into DB.
- `UpdateCommand`: same params. Regenerate/update the `.sh` file. Update DB.
- `DeleteCommand`: delete `.sh` file + DB row (cascade handles related data).
- `GetScriptContent(commandID)`: new method. Returns the script file content for the editor.
- `GetVariables`: simplify -- query variable_definitions from DB, evaluate CEL defaults, return enriched prompts.
- `RunCommand`: read script path from DB, regenerate signature, execute with `bash <path> args...`
- `RunInTerminal`: same approach but via terminal launcher

**`executor.go`:**
- Remove: `ParseVariables`, `SubstituteVariables`, `variableRegex`
- Add: `ExecuteScript(scriptPath string, args []string) ExecutionResult`
- Add: `ExecuteScriptStreaming(scriptPath string, args []string, onChunk func(OutputChunk)) ExecutionResult`
- Keep: terminal-related code (update `OpenInTerminal` to run scripts)
- Keep: `EvalDefaults` (still used for variable default evaluation)

**New file `script.go`:**
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
- Update search to use FTS5 results from backend

**`en.json`:**
- Update/add i18n keys for: script body, advanced mode toggle, add variable button, etc.
- Remove keys related to `${varName}` placeholder hints

### Search

Uses FTS5 virtual table for fast full-text search on command title and description. The `SearchCommands` backend method queries the FTS index. Script file content search can be added later if needed.
