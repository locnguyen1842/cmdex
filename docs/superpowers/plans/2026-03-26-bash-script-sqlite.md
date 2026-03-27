# Bash Script Commands + SQLite Storage Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace JSON file storage with SQLite and plain-text commands with bash scripts that define `main()` functions, with variables passed as positional args.

**Architecture:** SQLite (`modernc.org/sqlite`) stores all data including script content. A new `script.go` handles script generation/parsing. The executor writes scripts to temp files for execution. Frontend gets a simple/advanced editor toggle and explicit variable management.

**Tech Stack:** Go 1.23, modernc.org/sqlite, Wails v2, React 19, TypeScript, Tailwind CSS 4

**Spec:** `docs/superpowers/specs/2026-03-26-bash-file-commands-design.md`

---

### Task 1: Add SQLite dependency and create database layer

**Files:**
- Modify: `go.mod`
- Create: `db.go`

- [ ] **Step 1: Add SQLite dependency**

Run:
```bash
cd /Users/mac/Documents/Projects/Others/commamer && go get modernc.org/sqlite
```

- [ ] **Step 2: Create `db.go` with schema initialization**

Create `db.go`:

```go
package main

import (
	"database/sql"
	"fmt"
	"os"
	"path/filepath"

	_ "modernc.org/sqlite"
)

type DB struct {
	conn    *sql.DB
	dataDir string
}

const schemaVersion = 1

const schema = `
CREATE TABLE IF NOT EXISTS schema_version (
    version INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS categories (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    icon TEXT NOT NULL DEFAULT '',
    color TEXT NOT NULL DEFAULT '',
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS commands (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    script_content TEXT NOT NULL,
    category_id TEXT NOT NULL DEFAULT '',
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS tags (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS command_tags (
    command_id TEXT NOT NULL,
    tag_id INTEGER NOT NULL,
    PRIMARY KEY (command_id, tag_id),
    FOREIGN KEY (command_id) REFERENCES commands(id) ON DELETE CASCADE,
    FOREIGN KEY (tag_id) REFERENCES tags(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS variable_definitions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    command_id TEXT NOT NULL,
    name TEXT NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    example TEXT NOT NULL DEFAULT '',
    default_expr TEXT NOT NULL DEFAULT '',
    sort_order INTEGER NOT NULL DEFAULT 0,
    FOREIGN KEY (command_id) REFERENCES commands(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS variable_presets (
    id TEXT PRIMARY KEY,
    command_id TEXT NOT NULL,
    name TEXT NOT NULL,
    FOREIGN KEY (command_id) REFERENCES commands(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS preset_values (
    preset_id TEXT NOT NULL,
    variable_name TEXT NOT NULL,
    value TEXT NOT NULL DEFAULT '',
    PRIMARY KEY (preset_id, variable_name),
    FOREIGN KEY (preset_id) REFERENCES variable_presets(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS executions (
    id TEXT PRIMARY KEY,
    command_id TEXT NOT NULL,
    script_content TEXT NOT NULL,
    final_cmd TEXT NOT NULL,
    output TEXT NOT NULL DEFAULT '',
    error TEXT NOT NULL DEFAULT '',
    exit_code INTEGER NOT NULL DEFAULT 0,
    executed_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE VIRTUAL TABLE IF NOT EXISTS commands_fts USING fts5(
    title, description, script_content, content='commands', content_rowid='rowid'
);

-- Triggers to keep FTS in sync
CREATE TRIGGER IF NOT EXISTS commands_ai AFTER INSERT ON commands BEGIN
    INSERT INTO commands_fts(rowid, title, description, script_content)
    VALUES (new.rowid, new.title, new.description, new.script_content);
END;

CREATE TRIGGER IF NOT EXISTS commands_ad AFTER DELETE ON commands BEGIN
    INSERT INTO commands_fts(commands_fts, rowid, title, description, script_content)
    VALUES ('delete', old.rowid, old.title, old.description, old.script_content);
END;

CREATE TRIGGER IF NOT EXISTS commands_au AFTER UPDATE ON commands BEGIN
    INSERT INTO commands_fts(commands_fts, rowid, title, description, script_content)
    VALUES ('delete', old.rowid, old.title, old.description, old.script_content);
    INSERT INTO commands_fts(rowid, title, description, script_content)
    VALUES (new.rowid, new.title, new.description, new.script_content);
END;
`

func NewDB() (*DB, error) {
	homeDir, err := os.UserHomeDir()
	if err != nil {
		return nil, fmt.Errorf("get home dir: %w", err)
	}

	dataDir := filepath.Join(homeDir, ".commamer")
	if err := os.MkdirAll(dataDir, 0755); err != nil {
		return nil, fmt.Errorf("create data dir: %w", err)
	}

	dbPath := filepath.Join(dataDir, "commamer.db")
	conn, err := sql.Open("sqlite", dbPath+"?_pragma=foreign_keys(1)&_pragma=journal_mode(wal)")
	if err != nil {
		return nil, fmt.Errorf("open database: %w", err)
	}

	db := &DB{conn: conn, dataDir: dataDir}
	if err := db.migrate(); err != nil {
		conn.Close()
		return nil, fmt.Errorf("migrate: %w", err)
	}

	return db, nil
}

func (db *DB) Close() error {
	return db.conn.Close()
}

func (db *DB) migrate() error {
	var version int
	err := db.conn.QueryRow("SELECT version FROM schema_version LIMIT 1").Scan(&version)
	if err != nil {
		// Table doesn't exist or is empty — run full schema
		if _, err := db.conn.Exec(schema); err != nil {
			return fmt.Errorf("exec schema: %w", err)
		}
		_, err = db.conn.Exec("INSERT INTO schema_version (version) VALUES (?)", schemaVersion)
		return err
	}

	if version >= schemaVersion {
		return nil
	}

	// Future migrations go here
	_, err = db.conn.Exec("UPDATE schema_version SET version = ?", schemaVersion)
	return err
}
```

- [ ] **Step 3: Verify it compiles**

Run:
```bash
cd /Users/mac/Documents/Projects/Others/commamer && go build ./...
```

Expected: Build succeeds (db.go compiles but is not wired into the app yet)

- [ ] **Step 4: Commit**

```bash
git add go.mod go.sum db.go
git commit -m "feat: add SQLite database layer with schema and migrations"
```

---

### Task 2: Add DB CRUD methods for categories

**Files:**
- Modify: `db.go`

- [ ] **Step 1: Add category CRUD methods to `db.go`**

Append to `db.go`:

```go
func (db *DB) GetCategories() ([]Category, error) {
	rows, err := db.conn.Query("SELECT id, name, icon, color, created_at, updated_at FROM categories ORDER BY created_at")
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var categories []Category
	for rows.Next() {
		var c Category
		if err := rows.Scan(&c.ID, &c.Name, &c.Icon, &c.Color, &c.CreatedAt, &c.UpdatedAt); err != nil {
			return nil, err
		}
		categories = append(categories, c)
	}
	if categories == nil {
		categories = []Category{}
	}
	return categories, rows.Err()
}

func (db *DB) CreateCategory(cat Category) error {
	_, err := db.conn.Exec(
		"INSERT INTO categories (id, name, icon, color, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)",
		cat.ID, cat.Name, cat.Icon, cat.Color, cat.CreatedAt, cat.UpdatedAt,
	)
	return err
}

func (db *DB) UpdateCategory(cat Category) error {
	res, err := db.conn.Exec(
		"UPDATE categories SET name = ?, icon = ?, color = ?, updated_at = ? WHERE id = ?",
		cat.Name, cat.Icon, cat.Color, cat.UpdatedAt, cat.ID,
	)
	if err != nil {
		return err
	}
	n, _ := res.RowsAffected()
	if n == 0 {
		return fmt.Errorf("category not found: %s", cat.ID)
	}
	return nil
}

func (db *DB) DeleteCategory(id string) error {
	res, err := db.conn.Exec("DELETE FROM categories WHERE id = ?", id)
	if err != nil {
		return err
	}
	n, _ := res.RowsAffected()
	if n == 0 {
		return fmt.Errorf("category not found: %s", id)
	}
	return nil
}
```

- [ ] **Step 2: Verify it compiles**

Run:
```bash
cd /Users/mac/Documents/Projects/Others/commamer && go build ./...
```

- [ ] **Step 3: Commit**

```bash
git add db.go
git commit -m "feat: add category CRUD methods to DB layer"
```

---

### Task 3: Add DB CRUD methods for commands (with tags, variables, presets)

**Files:**
- Modify: `db.go`
- Modify: `models.go`

- [ ] **Step 1: Update models**

In `models.go`, update the `Command` struct and `VariableDefinition`:

Replace the `Command` struct:
```go
// Command represents a saved CLI command backed by a bash script
type Command struct {
	ID            string               `json:"id"`
	Title         string               `json:"title"`
	Description   string               `json:"description"`
	ScriptContent string               `json:"scriptContent"`
	Tags          []string             `json:"tags"`
	Variables     []VariableDefinition `json:"variables"`
	Presets       []VariablePreset     `json:"presets"`
	CategoryID    string               `json:"categoryId"`
	CreatedAt     time.Time            `json:"createdAt"`
	UpdatedAt     time.Time            `json:"updatedAt"`
}
```

Update `VariableDefinition`:
```go
// VariableDefinition stores per-command variable metadata
type VariableDefinition struct {
	Name        string `json:"name"`
	Description string `json:"description"`
	Example     string `json:"example"`
	Default     string `json:"default"`   // plain value or CEL expression
	SortOrder   int    `json:"sortOrder"`
}
```

Update `ExecutionRecord`:
```go
// ExecutionRecord captures a single command execution for history
type ExecutionRecord struct {
	ID            string    `json:"id"`
	CommandID     string    `json:"commandId"`
	ScriptContent string    `json:"scriptContent"`
	FinalCmd      string    `json:"finalCmd"`
	Output        string    `json:"output"`
	Error         string    `json:"error"`
	ExitCode      int       `json:"exitCode"`
	ExecutedAt    time.Time `json:"executedAt"`
}
```

Remove the `AppData` struct and `AppSettings` struct — add settings to DB later. For now keep `AppSettings` as-is since settings are still needed.

Actually, keep `AppSettings` as-is. Remove `AppData`:
```go
// Remove the AppData struct entirely
```

- [ ] **Step 2: Add command CRUD methods to `db.go`**

Append to `db.go`:

```go
func (db *DB) GetCommands() ([]Command, error) {
	rows, err := db.conn.Query(
		"SELECT id, title, description, script_content, category_id, created_at, updated_at FROM commands ORDER BY created_at",
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var commands []Command
	for rows.Next() {
		var c Command
		if err := rows.Scan(&c.ID, &c.Title, &c.Description, &c.ScriptContent, &c.CategoryID, &c.CreatedAt, &c.UpdatedAt); err != nil {
			return nil, err
		}
		commands = append(commands, c)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}

	// Load tags, variables, presets for each command
	for i := range commands {
		if err := db.loadCommandRelations(&commands[i]); err != nil {
			return nil, err
		}
	}
	if commands == nil {
		commands = []Command{}
	}
	return commands, nil
}

func (db *DB) GetCommandsByCategory(categoryID string) ([]Command, error) {
	rows, err := db.conn.Query(
		"SELECT id, title, description, script_content, category_id, created_at, updated_at FROM commands WHERE category_id = ? ORDER BY created_at",
		categoryID,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var commands []Command
	for rows.Next() {
		var c Command
		if err := rows.Scan(&c.ID, &c.Title, &c.Description, &c.ScriptContent, &c.CategoryID, &c.CreatedAt, &c.UpdatedAt); err != nil {
			return nil, err
		}
		commands = append(commands, c)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}

	for i := range commands {
		if err := db.loadCommandRelations(&commands[i]); err != nil {
			return nil, err
		}
	}
	if commands == nil {
		commands = []Command{}
	}
	return commands, nil
}

func (db *DB) GetCommand(id string) (Command, error) {
	var c Command
	err := db.conn.QueryRow(
		"SELECT id, title, description, script_content, category_id, created_at, updated_at FROM commands WHERE id = ?", id,
	).Scan(&c.ID, &c.Title, &c.Description, &c.ScriptContent, &c.CategoryID, &c.CreatedAt, &c.UpdatedAt)
	if err != nil {
		return Command{}, fmt.Errorf("command not found: %s", id)
	}
	if err := db.loadCommandRelations(&c); err != nil {
		return Command{}, err
	}
	return c, nil
}

func (db *DB) loadCommandRelations(cmd *Command) error {
	// Load tags
	tagRows, err := db.conn.Query(
		"SELECT t.name FROM tags t JOIN command_tags ct ON t.id = ct.tag_id WHERE ct.command_id = ?",
		cmd.ID,
	)
	if err != nil {
		return err
	}
	defer tagRows.Close()
	cmd.Tags = []string{}
	for tagRows.Next() {
		var name string
		if err := tagRows.Scan(&name); err != nil {
			return err
		}
		cmd.Tags = append(cmd.Tags, name)
	}

	// Load variables
	varRows, err := db.conn.Query(
		"SELECT name, description, example, default_expr, sort_order FROM variable_definitions WHERE command_id = ? ORDER BY sort_order",
		cmd.ID,
	)
	if err != nil {
		return err
	}
	defer varRows.Close()
	cmd.Variables = []VariableDefinition{}
	for varRows.Next() {
		var v VariableDefinition
		if err := varRows.Scan(&v.Name, &v.Description, &v.Example, &v.Default, &v.SortOrder); err != nil {
			return err
		}
		cmd.Variables = append(cmd.Variables, v)
	}

	// Load presets
	presetRows, err := db.conn.Query(
		"SELECT id, name FROM variable_presets WHERE command_id = ? ORDER BY name",
		cmd.ID,
	)
	if err != nil {
		return err
	}
	defer presetRows.Close()
	cmd.Presets = []VariablePreset{}
	for presetRows.Next() {
		var p VariablePreset
		if err := presetRows.Scan(&p.ID, &p.Name); err != nil {
			return err
		}
		// Load preset values
		valRows, err := db.conn.Query(
			"SELECT variable_name, value FROM preset_values WHERE preset_id = ?", p.ID,
		)
		if err != nil {
			return err
		}
		p.Values = make(map[string]string)
		for valRows.Next() {
			var name, value string
			if err := valRows.Scan(&name, &value); err != nil {
				valRows.Close()
				return err
			}
			p.Values[name] = value
		}
		valRows.Close()
		cmd.Presets = append(cmd.Presets, p)
	}

	return nil
}

func (db *DB) CreateCommand(cmd Command) error {
	tx, err := db.conn.Begin()
	if err != nil {
		return err
	}
	defer tx.Rollback()

	_, err = tx.Exec(
		"INSERT INTO commands (id, title, description, script_content, category_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
		cmd.ID, cmd.Title, cmd.Description, cmd.ScriptContent, cmd.CategoryID, cmd.CreatedAt, cmd.UpdatedAt,
	)
	if err != nil {
		return err
	}

	if err := db.saveTags(tx, cmd.ID, cmd.Tags); err != nil {
		return err
	}
	if err := db.saveVariables(tx, cmd.ID, cmd.Variables); err != nil {
		return err
	}

	return tx.Commit()
}

func (db *DB) UpdateCommand(cmd Command) error {
	tx, err := db.conn.Begin()
	if err != nil {
		return err
	}
	defer tx.Rollback()

	res, err := tx.Exec(
		"UPDATE commands SET title = ?, description = ?, script_content = ?, category_id = ?, updated_at = ? WHERE id = ?",
		cmd.Title, cmd.Description, cmd.ScriptContent, cmd.CategoryID, cmd.UpdatedAt, cmd.ID,
	)
	if err != nil {
		return err
	}
	n, _ := res.RowsAffected()
	if n == 0 {
		return fmt.Errorf("command not found: %s", cmd.ID)
	}

	// Replace tags
	if _, err := tx.Exec("DELETE FROM command_tags WHERE command_id = ?", cmd.ID); err != nil {
		return err
	}
	if err := db.saveTags(tx, cmd.ID, cmd.Tags); err != nil {
		return err
	}

	// Replace variables
	if _, err := tx.Exec("DELETE FROM variable_definitions WHERE command_id = ?", cmd.ID); err != nil {
		return err
	}
	if err := db.saveVariables(tx, cmd.ID, cmd.Variables); err != nil {
		return err
	}

	return tx.Commit()
}

func (db *DB) DeleteCommand(id string) error {
	res, err := db.conn.Exec("DELETE FROM commands WHERE id = ?", id)
	if err != nil {
		return err
	}
	n, _ := res.RowsAffected()
	if n == 0 {
		return fmt.Errorf("command not found: %s", id)
	}
	return nil
}

func (db *DB) saveTags(tx *sql.Tx, commandID string, tags []string) error {
	for _, tag := range tags {
		var tagID int64
		err := tx.QueryRow("SELECT id FROM tags WHERE name = ?", tag).Scan(&tagID)
		if err == sql.ErrNoRows {
			res, err := tx.Exec("INSERT INTO tags (name) VALUES (?)", tag)
			if err != nil {
				return err
			}
			tagID, _ = res.LastInsertId()
		} else if err != nil {
			return err
		}
		if _, err := tx.Exec("INSERT OR IGNORE INTO command_tags (command_id, tag_id) VALUES (?, ?)", commandID, tagID); err != nil {
			return err
		}
	}
	return nil
}

func (db *DB) saveVariables(tx *sql.Tx, commandID string, vars []VariableDefinition) error {
	for _, v := range vars {
		_, err := tx.Exec(
			"INSERT INTO variable_definitions (command_id, name, description, example, default_expr, sort_order) VALUES (?, ?, ?, ?, ?, ?)",
			commandID, v.Name, v.Description, v.Example, v.Default, v.SortOrder,
		)
		if err != nil {
			return err
		}
	}
	return nil
}
```

- [ ] **Step 3: Verify it compiles**

Run:
```bash
cd /Users/mac/Documents/Projects/Others/commamer && go build ./...
```

- [ ] **Step 4: Commit**

```bash
git add db.go models.go
git commit -m "feat: add command CRUD with tags, variables, presets to DB layer"
```

---

### Task 4: Add DB methods for presets, executions, search, and settings

**Files:**
- Modify: `db.go`

- [ ] **Step 1: Add preset CRUD methods**

Append to `db.go`:

```go
// ========== Preset Operations ==========

func (db *DB) GetPresets(commandID string) ([]VariablePreset, error) {
	rows, err := db.conn.Query("SELECT id, name FROM variable_presets WHERE command_id = ? ORDER BY name", commandID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var presets []VariablePreset
	for rows.Next() {
		var p VariablePreset
		if err := rows.Scan(&p.ID, &p.Name); err != nil {
			return nil, err
		}
		valRows, err := db.conn.Query("SELECT variable_name, value FROM preset_values WHERE preset_id = ?", p.ID)
		if err != nil {
			return nil, err
		}
		p.Values = make(map[string]string)
		for valRows.Next() {
			var name, value string
			if err := valRows.Scan(&name, &value); err != nil {
				valRows.Close()
				return nil, err
			}
			p.Values[name] = value
		}
		valRows.Close()
		presets = append(presets, p)
	}
	if presets == nil {
		presets = []VariablePreset{}
	}
	return presets, rows.Err()
}

func (db *DB) SavePreset(commandID string, preset VariablePreset) error {
	tx, err := db.conn.Begin()
	if err != nil {
		return err
	}
	defer tx.Rollback()

	_, err = tx.Exec("INSERT INTO variable_presets (id, command_id, name) VALUES (?, ?, ?)",
		preset.ID, commandID, preset.Name)
	if err != nil {
		return err
	}

	for name, value := range preset.Values {
		_, err = tx.Exec("INSERT INTO preset_values (preset_id, variable_name, value) VALUES (?, ?, ?)",
			preset.ID, name, value)
		if err != nil {
			return err
		}
	}

	return tx.Commit()
}

func (db *DB) UpdatePreset(preset VariablePreset) error {
	tx, err := db.conn.Begin()
	if err != nil {
		return err
	}
	defer tx.Rollback()

	_, err = tx.Exec("UPDATE variable_presets SET name = ? WHERE id = ?", preset.Name, preset.ID)
	if err != nil {
		return err
	}

	_, err = tx.Exec("DELETE FROM preset_values WHERE preset_id = ?", preset.ID)
	if err != nil {
		return err
	}

	for name, value := range preset.Values {
		_, err = tx.Exec("INSERT INTO preset_values (preset_id, variable_name, value) VALUES (?, ?, ?)",
			preset.ID, name, value)
		if err != nil {
			return err
		}
	}

	return tx.Commit()
}

func (db *DB) DeletePreset(presetID string) error {
	_, err := db.conn.Exec("DELETE FROM variable_presets WHERE id = ?", presetID)
	return err
}
```

- [ ] **Step 2: Add execution history methods**

Append to `db.go`:

```go
// ========== Execution History ==========

func (db *DB) GetExecutions() ([]ExecutionRecord, error) {
	rows, err := db.conn.Query(
		"SELECT id, command_id, script_content, final_cmd, output, error, exit_code, executed_at FROM executions ORDER BY executed_at DESC",
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var records []ExecutionRecord
	for rows.Next() {
		var r ExecutionRecord
		if err := rows.Scan(&r.ID, &r.CommandID, &r.ScriptContent, &r.FinalCmd, &r.Output, &r.Error, &r.ExitCode, &r.ExecutedAt); err != nil {
			return nil, err
		}
		records = append(records, r)
	}
	if records == nil {
		records = []ExecutionRecord{}
	}
	return records, rows.Err()
}

func (db *DB) AddExecution(record ExecutionRecord) error {
	_, err := db.conn.Exec(
		"INSERT INTO executions (id, command_id, script_content, final_cmd, output, error, exit_code, executed_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
		record.ID, record.CommandID, record.ScriptContent, record.FinalCmd, record.Output, record.Error, record.ExitCode, record.ExecutedAt,
	)
	return err
}

func (db *DB) ClearExecutions() error {
	_, err := db.conn.Exec("DELETE FROM executions")
	return err
}
```

- [ ] **Step 3: Add search method**

Append to `db.go`:

```go
// ========== Search ==========

func (db *DB) SearchCommands(query string) ([]Command, error) {
	if query == "" {
		return db.GetCommands()
	}

	// Use FTS5 for search
	rows, err := db.conn.Query(
		`SELECT c.id, c.title, c.description, c.script_content, c.category_id, c.created_at, c.updated_at
		 FROM commands c
		 JOIN commands_fts fts ON c.rowid = fts.rowid
		 WHERE commands_fts MATCH ?
		 ORDER BY rank`,
		query+"*",
	)
	if err != nil {
		// Fallback to LIKE search if FTS query fails (e.g., special characters)
		return db.searchCommandsLike(query)
	}
	defer rows.Close()

	var commands []Command
	for rows.Next() {
		var c Command
		if err := rows.Scan(&c.ID, &c.Title, &c.Description, &c.ScriptContent, &c.CategoryID, &c.CreatedAt, &c.UpdatedAt); err != nil {
			return nil, err
		}
		commands = append(commands, c)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}

	for i := range commands {
		if err := db.loadCommandRelations(&commands[i]); err != nil {
			return nil, err
		}
	}
	if commands == nil {
		commands = []Command{}
	}
	return commands, nil
}

func (db *DB) searchCommandsLike(query string) ([]Command, error) {
	like := "%" + query + "%"
	rows, err := db.conn.Query(
		`SELECT id, title, description, script_content, category_id, created_at, updated_at
		 FROM commands
		 WHERE title LIKE ? OR description LIKE ? OR script_content LIKE ?
		 ORDER BY created_at`,
		like, like, like,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var commands []Command
	for rows.Next() {
		var c Command
		if err := rows.Scan(&c.ID, &c.Title, &c.Description, &c.ScriptContent, &c.CategoryID, &c.CreatedAt, &c.UpdatedAt); err != nil {
			return nil, err
		}
		commands = append(commands, c)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}

	for i := range commands {
		if err := db.loadCommandRelations(&commands[i]); err != nil {
			return nil, err
		}
	}
	if commands == nil {
		commands = []Command{}
	}
	return commands, nil
}
```

- [ ] **Step 4: Add settings methods**

Append to `db.go`:

```go
// ========== Settings ==========

func (db *DB) GetSettings() (AppSettings, error) {
	// Settings stored as key-value in a simple approach:
	// We'll use a dedicated settings table
	var s AppSettings
	s.Locale = "en" // defaults

	row := db.conn.QueryRow("SELECT locale, terminal FROM app_settings LIMIT 1")
	err := row.Scan(&s.Locale, &s.Terminal)
	if err == sql.ErrNoRows {
		// Initialize default settings
		_, _ = db.conn.Exec("INSERT INTO app_settings (locale, terminal) VALUES ('en', '')")
		return s, nil
	}
	return s, err
}

func (db *DB) SetSettings(s AppSettings) error {
	_, err := db.conn.Exec("UPDATE app_settings SET locale = ?, terminal = ?", s.Locale, s.Terminal)
	return err
}
```

We also need to add the `app_settings` table to the schema. In `db.go`, add this to the `schema` const, before the `CREATE VIRTUAL TABLE` line:

```sql
CREATE TABLE IF NOT EXISTS app_settings (
    locale TEXT NOT NULL DEFAULT 'en',
    terminal TEXT NOT NULL DEFAULT ''
);
```

And add the `"database/sql"` import if not already present (it should be from Task 1).

- [ ] **Step 5: Verify it compiles**

Run:
```bash
cd /Users/mac/Documents/Projects/Others/commamer && go build ./...
```

- [ ] **Step 6: Commit**

```bash
git add db.go
git commit -m "feat: add presets, executions, search, and settings DB methods"
```

---

### Task 5: Create script generation and parsing utilities

**Files:**
- Create: `script.go`

- [ ] **Step 1: Create `script.go`**

```go
package main

import (
	"strings"
)

const scriptHeader = "#!/bin/bash"
const mainOpen = "main() {"
const mainClose = "}"
const mainCall = `main "$@"`

// GenerateScript builds a full bash script from a body and variable definitions.
// The body is the user-written content (what goes inside main() after locals).
func GenerateScript(body string, variables []VariableDefinition) string {
	var sb strings.Builder

	sb.WriteString(scriptHeader)
	sb.WriteString("\n\n")
	sb.WriteString(mainOpen)
	sb.WriteString("\n")

	// Write local declarations from variable definitions
	for i, v := range variables {
		sb.WriteString("  local ")
		sb.WriteString(v.Name)
		sb.WriteString("=\"$")
		sb.WriteString(itoa(i + 1))
		sb.WriteString("\"\n")
	}

	if len(variables) > 0 {
		sb.WriteString("\n")
	}

	// Write the body, indented with 2 spaces per line
	for _, line := range strings.Split(body, "\n") {
		if line == "" {
			sb.WriteString("\n")
		} else {
			sb.WriteString("  ")
			sb.WriteString(line)
			sb.WriteString("\n")
		}
	}

	sb.WriteString(mainClose)
	sb.WriteString("\n\n")
	sb.WriteString(mainCall)
	sb.WriteString("\n")

	return sb.String()
}

// ParseScriptBody extracts the user-editable body from a full script.
// Returns the content between local declarations and the closing } of main(),
// with the 2-space indent removed.
func ParseScriptBody(scriptContent string) string {
	lines := strings.Split(scriptContent, "\n")

	// Find main() opening
	mainStart := -1
	for i, line := range lines {
		if strings.TrimSpace(line) == mainOpen {
			mainStart = i
			break
		}
	}
	if mainStart == -1 {
		return scriptContent // not a valid script, return as-is
	}

	// Find closing } for main (the first } at column 0 after mainStart)
	mainEnd := -1
	for i := mainStart + 1; i < len(lines); i++ {
		if strings.TrimSpace(lines[i]) == mainClose {
			mainEnd = i
			break
		}
	}
	if mainEnd == -1 {
		return scriptContent
	}

	// Extract lines between mainStart and mainEnd, skipping local declarations
	bodyStart := mainStart + 1
	for bodyStart < mainEnd {
		trimmed := strings.TrimSpace(lines[bodyStart])
		if strings.HasPrefix(trimmed, "local ") && strings.Contains(trimmed, "=\"$") {
			bodyStart++
			continue
		}
		break
	}

	// Skip the blank line between locals and body
	if bodyStart < mainEnd && strings.TrimSpace(lines[bodyStart]) == "" {
		bodyStart++
	}

	// Collect body lines, removing 2-space indent
	var bodyLines []string
	for i := bodyStart; i < mainEnd; i++ {
		line := lines[i]
		if strings.HasPrefix(line, "  ") {
			line = line[2:]
		}
		bodyLines = append(bodyLines, line)
	}

	return strings.Join(bodyLines, "\n")
}

// RegenerateSignature replaces the local declarations in an existing script
// with new ones based on the current variable definitions, preserving the rest.
func RegenerateSignature(scriptContent string, variables []VariableDefinition) string {
	lines := strings.Split(scriptContent, "\n")

	// Find main() opening
	mainStart := -1
	for i, line := range lines {
		if strings.TrimSpace(line) == mainOpen {
			mainStart = i
			break
		}
	}
	if mainStart == -1 {
		// Not a valid script, wrap it
		return GenerateScript(scriptContent, variables)
	}

	// Find where locals end (first non-local, non-empty line after main start)
	bodyStart := mainStart + 1
	for bodyStart < len(lines) {
		trimmed := strings.TrimSpace(lines[bodyStart])
		if strings.HasPrefix(trimmed, "local ") && strings.Contains(trimmed, "=\"$") {
			bodyStart++
			continue
		}
		break
	}
	// Skip blank line after locals
	if bodyStart < len(lines) && strings.TrimSpace(lines[bodyStart]) == "" {
		bodyStart++
	}

	// Rebuild
	var sb strings.Builder

	// Keep everything before main()
	for i := 0; i <= mainStart; i++ {
		sb.WriteString(lines[i])
		sb.WriteString("\n")
	}

	// Write new locals
	for i, v := range variables {
		sb.WriteString("  local ")
		sb.WriteString(v.Name)
		sb.WriteString("=\"$")
		sb.WriteString(itoa(i + 1))
		sb.WriteString("\"\n")
	}

	if len(variables) > 0 {
		sb.WriteString("\n")
	}

	// Keep everything from bodyStart onwards
	for i := bodyStart; i < len(lines); i++ {
		sb.WriteString(lines[i])
		if i < len(lines)-1 {
			sb.WriteString("\n")
		}
	}

	return sb.String()
}

func itoa(i int) string {
	return strings.TrimSpace(strings.Replace(
		strings.Replace(
			strings.Replace(
				strings.Replace(
					strings.Replace(
						strings.Replace(
							strings.Replace(
								strings.Replace(
									strings.Replace(
										strings.Replace("0123456789", "", "", 0),
										"", "", 0),
									"", "", 0),
								"", "", 0),
							"", "", 0),
						"", "", 0),
					"", "", 0),
				"", "", 0),
			"", "", 0),
		"", "", 0))
	// Simpler approach:
	return fmt.Sprintf("%d", i)
}
```

Wait, let me simplify the itoa. Just use `strconv`:

```go
package main

import (
	"fmt"
	"strconv"
	"strings"
)

// ... (all functions above, but replace the itoa function with):

func itoa(i int) string {
	return strconv.Itoa(i)
}
```

Actually, let me just write the complete clean file:

```go
package main

import (
	"strconv"
	"strings"
)

const scriptHeader = "#!/bin/bash"
const mainOpen = "main() {"
const mainClose = "}"
const mainCall = `main "$@"`

// GenerateScript builds a full bash script from a body and variable definitions.
func GenerateScript(body string, variables []VariableDefinition) string {
	var sb strings.Builder

	sb.WriteString(scriptHeader)
	sb.WriteString("\n\n")
	sb.WriteString(mainOpen)
	sb.WriteString("\n")

	for i, v := range variables {
		sb.WriteString("  local ")
		sb.WriteString(v.Name)
		sb.WriteString("=\"$")
		sb.WriteString(strconv.Itoa(i + 1))
		sb.WriteString("\"\n")
	}

	if len(variables) > 0 {
		sb.WriteString("\n")
	}

	for _, line := range strings.Split(body, "\n") {
		if line == "" {
			sb.WriteString("\n")
		} else {
			sb.WriteString("  ")
			sb.WriteString(line)
			sb.WriteString("\n")
		}
	}

	sb.WriteString(mainClose)
	sb.WriteString("\n\n")
	sb.WriteString(mainCall)
	sb.WriteString("\n")

	return sb.String()
}

// ParseScriptBody extracts the user-editable body from a full script.
func ParseScriptBody(scriptContent string) string {
	lines := strings.Split(scriptContent, "\n")

	mainStart := -1
	for i, line := range lines {
		if strings.TrimSpace(line) == mainOpen {
			mainStart = i
			break
		}
	}
	if mainStart == -1 {
		return scriptContent
	}

	mainEnd := -1
	for i := mainStart + 1; i < len(lines); i++ {
		if strings.TrimSpace(lines[i]) == mainClose {
			mainEnd = i
			break
		}
	}
	if mainEnd == -1 {
		return scriptContent
	}

	bodyStart := mainStart + 1
	for bodyStart < mainEnd {
		trimmed := strings.TrimSpace(lines[bodyStart])
		if strings.HasPrefix(trimmed, "local ") && strings.Contains(trimmed, "=\"$") {
			bodyStart++
			continue
		}
		break
	}

	if bodyStart < mainEnd && strings.TrimSpace(lines[bodyStart]) == "" {
		bodyStart++
	}

	var bodyLines []string
	for i := bodyStart; i < mainEnd; i++ {
		line := lines[i]
		if strings.HasPrefix(line, "  ") {
			line = line[2:]
		}
		bodyLines = append(bodyLines, line)
	}

	return strings.Join(bodyLines, "\n")
}

// RegenerateSignature replaces local declarations in an existing script.
func RegenerateSignature(scriptContent string, variables []VariableDefinition) string {
	lines := strings.Split(scriptContent, "\n")

	mainStart := -1
	for i, line := range lines {
		if strings.TrimSpace(line) == mainOpen {
			mainStart = i
			break
		}
	}
	if mainStart == -1 {
		return GenerateScript(scriptContent, variables)
	}

	bodyStart := mainStart + 1
	for bodyStart < len(lines) {
		trimmed := strings.TrimSpace(lines[bodyStart])
		if strings.HasPrefix(trimmed, "local ") && strings.Contains(trimmed, "=\"$") {
			bodyStart++
			continue
		}
		break
	}
	if bodyStart < len(lines) && strings.TrimSpace(lines[bodyStart]) == "" {
		bodyStart++
	}

	var sb strings.Builder

	for i := 0; i <= mainStart; i++ {
		sb.WriteString(lines[i])
		sb.WriteString("\n")
	}

	for i, v := range variables {
		sb.WriteString("  local ")
		sb.WriteString(v.Name)
		sb.WriteString("=\"$")
		sb.WriteString(strconv.Itoa(i + 1))
		sb.WriteString("\"\n")
	}

	if len(variables) > 0 {
		sb.WriteString("\n")
	}

	for i := bodyStart; i < len(lines); i++ {
		sb.WriteString(lines[i])
		if i < len(lines)-1 {
			sb.WriteString("\n")
		}
	}

	return sb.String()
}
```

- [ ] **Step 2: Verify it compiles**

Run:
```bash
cd /Users/mac/Documents/Projects/Others/commamer && go build ./...
```

- [ ] **Step 3: Commit**

```bash
git add script.go
git commit -m "feat: add script generation, parsing, and signature regeneration"
```

---

### Task 6: Refactor executor for script-based execution

**Files:**
- Modify: `executor.go`

- [ ] **Step 1: Remove old variable methods, add script execution**

In `executor.go`:

1. Remove `variableRegex` var declaration
2. Remove `ParseVariables` method
3. Remove `SubstituteVariables` method
4. Update `Execute` to become `ExecuteScript`:
5. Update `ExecuteStreaming` to become `ExecuteScriptStreaming`:

Replace the imports and the first section of executor.go (up through SubstituteVariables) with:

```go
package main

import (
	"bufio"
	"bytes"
	"context"
	"fmt"
	"io"
	"os"
	"os/exec"
	"runtime"
	"strings"
	"sync"
	"time"

	"github.com/google/cel-go/cel"
	"github.com/google/cel-go/common/types"
	"github.com/google/cel-go/common/types/ref"
)

const (
	maxStoredOutputBytes = 8 * 1024
	defaultExecTimeout   = 60 * time.Second
)

type Executor struct {
	shell string
	flag  string
}

func NewExecutor() *Executor {
	var shell, flag string

	if runtime.GOOS == "windows" {
		shell = "cmd"
		flag = "/C"
	} else {
		shell = os.Getenv("SHELL")
		if shell == "" {
			shell = "/bin/sh"
		}
		flag = "-lc"
	}

	return &Executor{shell: shell, flag: flag}
}

// writeTempScript writes script content to a temp file and returns its path.
func writeTempScript(content string) (string, error) {
	f, err := os.CreateTemp("", "commamer-*.sh")
	if err != nil {
		return "", err
	}
	if _, err := f.WriteString(content); err != nil {
		f.Close()
		os.Remove(f.Name())
		return "", err
	}
	if err := f.Close(); err != nil {
		os.Remove(f.Name())
		return "", err
	}
	return f.Name(), nil
}

// buildScriptCommand builds the command string for executing a script with args.
func buildScriptCommand(scriptPath string, args []string) string {
	parts := []string{"bash", scriptPath}
	for _, a := range args {
		parts = append(parts, fmt.Sprintf("%q", a))
	}
	return strings.Join(parts, " ")
}

// ExecuteScript runs a script with args and returns the result.
func (e *Executor) ExecuteScript(scriptContent string, args []string) ExecutionResult {
	tmpPath, err := writeTempScript(scriptContent)
	if err != nil {
		return ExecutionResult{Error: err.Error(), ExitCode: -1}
	}
	defer os.Remove(tmpPath)

	ctx, cancel := context.WithTimeout(context.Background(), defaultExecTimeout)
	defer cancel()

	cmdArgs := append([]string{tmpPath}, args...)
	cmd := exec.CommandContext(ctx, "bash", cmdArgs...)

	var stdout, stderr bytes.Buffer
	cmd.Stdout = &stdout
	cmd.Stderr = &stderr

	err = cmd.Run()

	result := ExecutionResult{
		Output:   stdout.String(),
		ExitCode: 0,
	}

	if stderr.Len() > 0 {
		result.Error = stderr.String()
	}

	if ctx.Err() == context.DeadlineExceeded {
		result.Error = fmt.Sprintf("command timed out after %s", defaultExecTimeout)
		result.ExitCode = -1
		return result
	}

	if err != nil {
		if exitErr, ok := err.(*exec.ExitError); ok {
			result.ExitCode = exitErr.ExitCode()
		} else {
			result.Error = err.Error()
			result.ExitCode = -1
		}
	}

	return result
}

// ExecuteScriptStreaming runs a script with args and streams output via callback.
func (e *Executor) ExecuteScriptStreaming(scriptContent string, args []string, onChunk func(OutputChunk)) ExecutionResult {
	tmpPath, err := writeTempScript(scriptContent)
	if err != nil {
		return ExecutionResult{Error: err.Error(), ExitCode: -1}
	}
	defer os.Remove(tmpPath)

	ctx, cancel := context.WithTimeout(context.Background(), defaultExecTimeout)
	defer cancel()

	cmdArgs := append([]string{tmpPath}, args...)
	cmd := exec.CommandContext(ctx, "bash", cmdArgs...)

	stdoutPipe, err := cmd.StdoutPipe()
	if err != nil {
		return ExecutionResult{Error: err.Error(), ExitCode: -1}
	}
	stderrPipe, err := cmd.StderrPipe()
	if err != nil {
		return ExecutionResult{Error: err.Error(), ExitCode: -1}
	}

	if err := cmd.Start(); err != nil {
		return ExecutionResult{Error: err.Error(), ExitCode: -1}
	}

	var wg sync.WaitGroup
	var mu sync.Mutex
	var outputBuf, errorBuf strings.Builder
	outputCapped, errorCapped := false, false

	streamReader := func(pipe io.Reader, stream string, buf *strings.Builder, capped *bool) {
		defer wg.Done()
		scanner := bufio.NewScanner(pipe)
		scanner.Buffer(make([]byte, 64*1024), 1024*1024)
		for scanner.Scan() {
			line := scanner.Text() + "\n"
			onChunk(OutputChunk{Stream: stream, Data: line})

			mu.Lock()
			if !*capped {
				if buf.Len()+len(line) > maxStoredOutputBytes {
					remaining := maxStoredOutputBytes - buf.Len()
					if remaining > 0 {
						buf.WriteString(line[:remaining])
					}
					buf.WriteString("\n... [output truncated] ...\n")
					*capped = true
				} else {
					buf.WriteString(line)
				}
			}
			mu.Unlock()
		}
	}

	wg.Add(2)
	go streamReader(stdoutPipe, "stdout", &outputBuf, &outputCapped)
	go streamReader(stderrPipe, "stderr", &errorBuf, &errorCapped)
	wg.Wait()

	waitErr := cmd.Wait()

	result := ExecutionResult{
		Output:   outputBuf.String(),
		ExitCode: 0,
	}
	if errorBuf.Len() > 0 {
		result.Error = errorBuf.String()
	}

	if ctx.Err() == context.DeadlineExceeded {
		onChunk(OutputChunk{Stream: "stderr", Data: fmt.Sprintf("\n[timed out after %s]\n", defaultExecTimeout)})
		if result.Error != "" {
			result.Error += "\n"
		}
		result.Error += fmt.Sprintf("command timed out after %s", defaultExecTimeout)
		result.ExitCode = -1
		return result
	}

	if waitErr != nil {
		if exitErr, ok := waitErr.(*exec.ExitError); ok {
			result.ExitCode = exitErr.ExitCode()
		} else {
			if result.Error == "" {
				result.Error = waitErr.Error()
			}
			result.ExitCode = -1
		}
	}

	return result
}
```

Keep all the terminal-related code as-is (OutputChunk, terminalDef, GetAvailableTerminals, etc.), and also keep `EvalDefaults`.

Update `OpenInTerminal` to work with scripts — change its signature to accept script content:

```go
// OpenInTerminal opens a terminal and runs the script with args.
func (e *Executor) OpenInTerminal(terminalID string, scriptContent string, args []string) error {
	tmpPath, err := writeTempScript(scriptContent)
	if err != nil {
		return err
	}
	// Note: we don't defer Remove here because the terminal process needs the file.
	// The temp file will be cleaned up by the OS eventually.

	cmdParts := []string{"bash", tmpPath}
	for _, a := range args {
		cmdParts = append(cmdParts, fmt.Sprintf("%q", a))
	}
	cmdText := strings.Join(cmdParts, " ")

	defs := e.terminalDefs()

	if terminalID != "" {
		for _, d := range defs {
			if d.ID == terminalID && e.terminalExists(d) && d.LaunchFn != nil {
				return d.LaunchFn(e, cmdText)
			}
		}
	}

	for _, d := range defs {
		if e.terminalExists(d) && d.LaunchFn != nil {
			return d.LaunchFn(e, cmdText)
		}
	}
	return fmt.Errorf("no terminal emulator found")
}
```

- [ ] **Step 2: Verify it compiles**

Run:
```bash
cd /Users/mac/Documents/Projects/Others/commamer && go build ./...
```

This will fail because `app.go` still references old methods. That's expected — we'll fix it in the next task.

- [ ] **Step 3: Commit**

```bash
git add executor.go
git commit -m "feat: refactor executor for script-based execution with temp files"
```

---

### Task 7: Rewrite `app.go` to use DB and script-based execution

**Files:**
- Modify: `app.go`

- [ ] **Step 1: Rewrite `app.go`**

Replace the entire content of `app.go`:

```go
package main

import (
	"context"
	"fmt"
	"strings"
	"time"

	"github.com/google/uuid"
	wailsruntime "github.com/wailsapp/wails/v2/pkg/runtime"
)

// App struct holds application state
type App struct {
	ctx      context.Context
	db       *DB
	executor *Executor
}

// NewApp creates a new App application struct
func NewApp() *App {
	return &App{}
}

// startup is called when the app starts
func (a *App) startup(ctx context.Context) {
	a.ctx = ctx
	db, err := NewDB()
	if err != nil {
		fmt.Println("Error initializing database:", err)
		return
	}
	a.db = db
	a.executor = NewExecutor()
}

// shutdown is called when the app is closing
func (a *App) shutdown(ctx context.Context) {
	if a.db != nil {
		a.db.Close()
	}
}

// ========== Category Operations ==========

func (a *App) GetCategories() []Category {
	cats, err := a.db.GetCategories()
	if err != nil {
		fmt.Println("Error getting categories:", err)
		return []Category{}
	}
	return cats
}

func (a *App) CreateCategory(name string, icon string, color string) (Category, error) {
	cat := Category{
		ID:        uuid.New().String(),
		Name:      name,
		Icon:      icon,
		Color:     color,
		CreatedAt: time.Now(),
		UpdatedAt: time.Now(),
	}
	if err := a.db.CreateCategory(cat); err != nil {
		return Category{}, err
	}
	return cat, nil
}

func (a *App) UpdateCategory(id string, name string, icon string, color string) (Category, error) {
	cat := Category{
		ID:        id,
		Name:      name,
		Icon:      icon,
		Color:     color,
		UpdatedAt: time.Now(),
	}
	if err := a.db.UpdateCategory(cat); err != nil {
		return Category{}, err
	}
	// Re-fetch to get full data
	cats, _ := a.db.GetCategories()
	for _, c := range cats {
		if c.ID == id {
			return c, nil
		}
	}
	return cat, nil
}

func (a *App) DeleteCategory(id string) error {
	return a.db.DeleteCategory(id)
}

// ========== Command Operations ==========

func (a *App) GetCommands() []Command {
	cmds, err := a.db.GetCommands()
	if err != nil {
		fmt.Println("Error getting commands:", err)
		return []Command{}
	}
	return cmds
}

func (a *App) GetCommandsByCategory(categoryID string) []Command {
	cmds, err := a.db.GetCommandsByCategory(categoryID)
	if err != nil {
		fmt.Println("Error getting commands:", err)
		return []Command{}
	}
	return cmds
}

func (a *App) CreateCommand(title, description, scriptBody, categoryID string, tags []string, variables []VariableDefinition, isAdvanced bool) (Command, error) {
	if tags == nil {
		tags = []string{}
	}
	if variables == nil {
		variables = []VariableDefinition{}
	}

	// Assign sort order
	for i := range variables {
		variables[i].SortOrder = i
	}

	// Generate script content
	var scriptContent string
	if isAdvanced {
		scriptContent = RegenerateSignature(scriptBody, variables)
	} else {
		scriptContent = GenerateScript(scriptBody, variables)
	}

	cmd := Command{
		ID:            uuid.New().String(),
		Title:         title,
		Description:   description,
		ScriptContent: scriptContent,
		CategoryID:    categoryID,
		Tags:          tags,
		Variables:     variables,
		Presets:       []VariablePreset{},
		CreatedAt:     time.Now(),
		UpdatedAt:     time.Now(),
	}

	if err := a.db.CreateCommand(cmd); err != nil {
		return Command{}, err
	}
	return cmd, nil
}

func (a *App) UpdateCommand(id, title, description, scriptBody, categoryID string, tags []string, variables []VariableDefinition, isAdvanced bool) (Command, error) {
	if tags == nil {
		tags = []string{}
	}
	if variables == nil {
		variables = []VariableDefinition{}
	}

	for i := range variables {
		variables[i].SortOrder = i
	}

	var scriptContent string
	if isAdvanced {
		scriptContent = RegenerateSignature(scriptBody, variables)
	} else {
		scriptContent = GenerateScript(scriptBody, variables)
	}

	cmd := Command{
		ID:            id,
		Title:         title,
		Description:   description,
		ScriptContent: scriptContent,
		CategoryID:    categoryID,
		Tags:          tags,
		Variables:     variables,
		UpdatedAt:     time.Now(),
	}

	if err := a.db.UpdateCommand(cmd); err != nil {
		return Command{}, err
	}

	return a.db.GetCommand(id)
}

func (a *App) DeleteCommand(id string) error {
	return a.db.DeleteCommand(id)
}

// GetScriptContent returns the full script content for the editor
func (a *App) GetScriptContent(commandID string) (string, error) {
	cmd, err := a.db.GetCommand(commandID)
	if err != nil {
		return "", err
	}
	return cmd.ScriptContent, nil
}

// GetScriptBody returns just the body (for simple mode editing)
func (a *App) GetScriptBody(commandID string) (string, error) {
	cmd, err := a.db.GetCommand(commandID)
	if err != nil {
		return "", err
	}
	return ParseScriptBody(cmd.ScriptContent), nil
}

// ========== Execution Operations ==========

func (a *App) GetVariables(commandID string) []VariablePrompt {
	cmd, err := a.db.GetCommand(commandID)
	if err != nil {
		return []VariablePrompt{}
	}

	if len(cmd.Variables) == 0 {
		return []VariablePrompt{}
	}

	evaluated := a.executor.EvalDefaults(cmd.Variables)

	var prompts []VariablePrompt
	for _, v := range cmd.Variables {
		p := VariablePrompt{
			Name:        v.Name,
			Description: v.Description,
			Example:     v.Example,
			DefaultExpr: v.Default,
		}
		if val, exists := evaluated[v.Name]; exists {
			p.DefaultValue = val
		}
		prompts = append(prompts, p)
	}
	if prompts == nil {
		prompts = []VariablePrompt{}
	}
	return prompts
}

func (a *App) RunCommand(commandID string, variables map[string]string) ExecutionRecord {
	cmd, err := a.db.GetCommand(commandID)
	if err != nil {
		return ExecutionRecord{
			ID:       uuid.New().String(),
			Error:    err.Error(),
			ExitCode: -1,
		}
	}

	// Regenerate signature with current variables
	scriptContent := RegenerateSignature(cmd.ScriptContent, cmd.Variables)

	// Build args in sort_order
	args := make([]string, len(cmd.Variables))
	for i, v := range cmd.Variables {
		args[i] = variables[v.Name]
	}

	finalCmd := buildScriptCommand("<script>", args)

	result := a.executor.ExecuteScriptStreaming(scriptContent, args, func(chunk OutputChunk) {
		wailsruntime.EventsEmit(a.ctx, "cmd-output", chunk)
	})

	record := ExecutionRecord{
		ID:            uuid.New().String(),
		CommandID:     commandID,
		ScriptContent: scriptContent,
		FinalCmd:      finalCmd,
		Output:        result.Output,
		Error:         result.Error,
		ExitCode:      result.ExitCode,
		ExecutedAt:    time.Now(),
	}

	_ = a.db.AddExecution(record)

	return record
}

func (a *App) RunInTerminal(commandID string, variables map[string]string) error {
	cmd, err := a.db.GetCommand(commandID)
	if err != nil {
		return err
	}

	scriptContent := RegenerateSignature(cmd.ScriptContent, cmd.Variables)

	args := make([]string, len(cmd.Variables))
	for i, v := range cmd.Variables {
		args[i] = variables[v.Name]
	}

	settings, _ := a.db.GetSettings()
	return a.executor.OpenInTerminal(settings.Terminal, scriptContent, args)
}

// ========== Execution History ==========

func (a *App) GetExecutionHistory() []ExecutionRecord {
	records, err := a.db.GetExecutions()
	if err != nil {
		fmt.Println("Error getting executions:", err)
		return []ExecutionRecord{}
	}
	return records
}

func (a *App) ClearExecutionHistory() error {
	return a.db.ClearExecutions()
}

// ========== Variable Presets ==========

func (a *App) GetPresets(commandID string) []VariablePreset {
	presets, err := a.db.GetPresets(commandID)
	if err != nil {
		return []VariablePreset{}
	}
	return presets
}

func (a *App) SavePreset(commandID string, name string, values map[string]string) (VariablePreset, error) {
	preset := VariablePreset{
		ID:     uuid.New().String(),
		Name:   name,
		Values: values,
	}
	if err := a.db.SavePreset(commandID, preset); err != nil {
		return VariablePreset{}, err
	}
	return preset, nil
}

func (a *App) UpdatePreset(commandID string, presetID string, name string, values map[string]string) (VariablePreset, error) {
	preset := VariablePreset{
		ID:     presetID,
		Name:   name,
		Values: values,
	}
	if err := a.db.UpdatePreset(preset); err != nil {
		return VariablePreset{}, err
	}
	return preset, nil
}

func (a *App) DeletePreset(commandID string, presetID string) error {
	return a.db.DeletePreset(presetID)
}

// ========== Settings ==========

func (a *App) GetSettings() AppSettings {
	settings, err := a.db.GetSettings()
	if err != nil {
		return AppSettings{Locale: "en"}
	}
	return settings
}

func (a *App) GetAvailableTerminals() []TerminalInfo {
	return a.executor.GetAvailableTerminals()
}

func (a *App) SetSettings(locale string, terminal string) error {
	return a.db.SetSettings(AppSettings{Locale: locale, Terminal: terminal})
}

// ========== Search ==========

func (a *App) SearchCommands(query string) []Command {
	if query == "" {
		return a.GetCommands()
	}

	cmds, err := a.db.SearchCommands(strings.ToLower(query))
	if err != nil {
		fmt.Println("Error searching commands:", err)
		return []Command{}
	}
	return cmds
}
```

- [ ] **Step 2: Update `main.go` to wire in shutdown**

In `main.go`, find the `OnShutdown` callback in the Wails options and add `app.shutdown`:

Check if `OnShutdown` exists. If not, add it to the Wails app options:
```go
OnShutdown: app.shutdown,
```

- [ ] **Step 3: Delete `store.go`**

Run:
```bash
rm /Users/mac/Documents/Projects/Others/commamer/store.go
```

- [ ] **Step 4: Verify it compiles**

Run:
```bash
cd /Users/mac/Documents/Projects/Others/commamer && go build ./...
```

- [ ] **Step 5: Commit**

```bash
git add app.go main.go script.go db.go models.go
git rm store.go
git commit -m "feat: rewrite app.go to use SQLite DB and script-based execution"
```

---

### Task 8: Update frontend types and Wails bindings

**Files:**
- Modify: `frontend/src/types.ts`

- [ ] **Step 1: Update TypeScript types**

Replace `frontend/src/types.ts`:

```typescript
// Type definitions matching Go backend models

export interface Category {
  id: string;
  name: string;
  icon: string;
  color: string;
  createdAt: string;
  updatedAt: string;
}

export interface VariableDefinition {
  name: string;
  description: string;
  example: string;
  default: string;
  sortOrder: number;
}

export interface VariablePreset {
  id: string;
  name: string;
  values: Record<string, string>;
}

export interface Command {
  id: string;
  title: string;
  description: string;
  scriptContent: string;
  tags: string[];
  variables: VariableDefinition[];
  presets: VariablePreset[];
  categoryId: string;
  createdAt: string;
  updatedAt: string;
}

export interface VariablePrompt {
  name: string;
  placeholder: string;
  description: string;
  example: string;
  defaultExpr: string;
  defaultValue: string;
}

export interface TerminalInfo {
  id: string;
  name: string;
}

export interface ExecutionResult {
  output: string;
  error: string;
  exitCode: number;
}

export interface ExecutionRecord {
  id: string;
  commandId: string;
  scriptContent: string;
  finalCmd: string;
  output: string;
  error: string;
  exitCode: number;
  executedAt: string;
}
```

- [ ] **Step 2: Regenerate Wails bindings**

Run:
```bash
cd /Users/mac/Documents/Projects/Others/commamer && wails generate module
```

- [ ] **Step 3: Commit**

```bash
git add frontend/src/types.ts frontend/wailsjs/
git commit -m "feat: update frontend types for script-based commands"
```

---

### Task 9: Refactor CommandEditor for script body + variable panel

**Files:**
- Modify: `frontend/src/components/CommandEditor.tsx`

- [ ] **Step 1: Rewrite CommandEditor**

Replace the content of `CommandEditor.tsx`:

```tsx
import React, { useState, KeyboardEvent } from "react";
import { useTranslation } from "react-i18next";
import { Category, Command, VariableDefinition } from "../types";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { X, Plus, ArrowUp, ArrowDown } from "lucide-react";

interface CommandEditorProps {
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
    isAdvanced: boolean;
  }) => void;
  onCancel: () => void;
}

const CommandEditor: React.FC<CommandEditorProps> = ({
  command,
  categories,
  defaultCategoryId,
  onSave,
  onCancel,
}) => {
  const { t } = useTranslation();
  const [title, setTitle] = useState(command?.title || "");
  const [description, setDescription] = useState(command?.description || "");

  // Parse body from existing script or use empty
  const getInitialBody = (): string => {
    if (!command?.scriptContent) return "";
    // For existing commands, we need to call the backend to parse.
    // For now, do a simple client-side parse as fallback.
    return parseScriptBodyClient(command.scriptContent);
  };

  const [scriptBody, setScriptBody] = useState(getInitialBody);
  const [advancedScript, setAdvancedScript] = useState(command?.scriptContent || "");
  const [isAdvanced, setIsAdvanced] = useState(false);

  const UNCATEGORIZED = "__uncategorized__";
  const [categoryId, setCategoryId] = useState(
    command?.categoryId || defaultCategoryId || UNCATEGORIZED,
  );
  const [tags, setTags] = useState<string[]>(command?.tags || []);
  const [tagInput, setTagInput] = useState("");

  const initVarDefs = (): VariableDefinition[] => {
    return (command?.variables || []).map((v, i) => ({
      ...v,
      sortOrder: v.sortOrder ?? i,
    }));
  };
  const [variables, setVariables] = useState<VariableDefinition[]>(initVarDefs);
  const hasVars = variables.length > 0;

  const updateVariable = (
    index: number,
    field: keyof Omit<VariableDefinition, "sortOrder">,
    value: string,
  ) => {
    setVariables((prev) =>
      prev.map((v, i) => (i === index ? { ...v, [field]: value } : v)),
    );
  };

  const addVariable = () => {
    const name = `var${variables.length + 1}`;
    setVariables((prev) => [
      ...prev,
      { name, description: "", example: "", default: "", sortOrder: prev.length },
    ]);
  };

  const removeVariable = (index: number) => {
    setVariables((prev) =>
      prev.filter((_, i) => i !== index).map((v, i) => ({ ...v, sortOrder: i })),
    );
  };

  const moveVariable = (index: number, direction: "up" | "down") => {
    const newIndex = direction === "up" ? index - 1 : index + 1;
    if (newIndex < 0 || newIndex >= variables.length) return;
    setVariables((prev) => {
      const next = [...prev];
      [next[index], next[newIndex]] = [next[newIndex], next[index]];
      return next.map((v, i) => ({ ...v, sortOrder: i }));
    });
  };

  const handleModeToggle = (advanced: boolean) => {
    if (advanced && !isAdvanced) {
      // Switching to advanced: generate full script from current body
      setAdvancedScript(generateScriptClient(scriptBody, variables));
    } else if (!advanced && isAdvanced) {
      // Switching to simple: extract body from advanced script
      setScriptBody(parseScriptBodyClient(advancedScript));
    }
    setIsAdvanced(advanced);
  };

  const handleSave = () => {
    if (!title.trim()) return;
    const body = isAdvanced ? advancedScript : scriptBody;
    if (!body.trim()) return;
    onSave({
      title: title.trim(),
      description: description.trim(),
      scriptBody: body,
      categoryId: categoryId === UNCATEGORIZED ? "" : categoryId,
      tags,
      variables,
      isAdvanced,
    });
  };

  const handleTagKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if ((e.key === "Enter" || e.key === ",") && tagInput.trim()) {
      e.preventDefault();
      const newTag = tagInput.trim().replace(",", "");
      if (newTag && !tags.includes(newTag)) {
        setTags([...tags, newTag]);
      }
      setTagInput("");
    } else if (e.key === "Backspace" && !tagInput && tags.length > 0) {
      setTags(tags.slice(0, -1));
    }
  };

  const removeTag = (tag: string) => {
    setTags(tags.filter((t) => t !== tag));
  };

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) onCancel();
      }}
    >
      <DialogContent
        className={`sm:max-w-xl md:max-w-2xl ${hasVars ? "lg:max-w-4xl" : ""} p-0`}
      >
        <DialogHeader className="px-6 pt-6 pb-0">
          <DialogTitle>
            {command
              ? t("commandEditor.editCommand")
              : t("commandEditor.newCommand")}
          </DialogTitle>
          <DialogDescription className="sr-only">
            {command
              ? t("commandEditor.editCommandDesc")
              : t("commandEditor.createCommandDesc")}
          </DialogDescription>
        </DialogHeader>
        <div className={`flex ${hasVars ? "divide-x divide-border" : ""}`}>
          <div className="flex-1 px-6 py-4 space-y-4">
            <div className="space-y-2">
              <Label htmlFor="cmd-title">{t("commandEditor.title")}</Label>
              <Input
                id="cmd-title"
                placeholder={t("commandEditor.titlePlaceholder")}
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                autoFocus
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="cmd-desc">{t("commandEditor.description")}</Label>
              <Textarea
                id="cmd-desc"
                placeholder={t("commandEditor.descriptionPlaceholder")}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={2}
              />
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="cmd-script">
                  {isAdvanced ? t("commandEditor.script") : t("commandEditor.command")}
                </Label>
                <div className="flex items-center gap-2">
                  <Label htmlFor="advanced-mode" className="text-xs text-muted-foreground">
                    {t("commandEditor.advancedMode")}
                  </Label>
                  <Switch
                    id="advanced-mode"
                    checked={isAdvanced}
                    onCheckedChange={handleModeToggle}
                  />
                </div>
              </div>
              {isAdvanced ? (
                <Textarea
                  id="cmd-script"
                  className="font-mono text-xs"
                  value={advancedScript}
                  onChange={(e) => setAdvancedScript(e.target.value)}
                  rows={12}
                />
              ) : (
                <>
                  <Textarea
                    id="cmd-script"
                    className="font-mono"
                    placeholder={t("commandEditor.commandPlaceholder")}
                    value={scriptBody}
                    onChange={(e) => setScriptBody(e.target.value)}
                    rows={3}
                  />
                  <p className="text-xs text-muted-foreground">
                    {t("commandEditor.scriptHint")}
                  </p>
                </>
              )}
            </div>
            <div className="space-y-2">
              <Label>{t("commandEditor.category")}</Label>
              <Select value={categoryId} onValueChange={setCategoryId}>
                <SelectTrigger>
                  <SelectValue placeholder={t("commandEditor.uncategorized")} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={UNCATEGORIZED}>
                    {t("commandEditor.uncategorized")}
                  </SelectItem>
                  {categories.map((cat) => (
                    <SelectItem key={cat.id} value={cat.id}>
                      {cat.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>{t("commandEditor.tags")}</Label>
              <div className="tags-input-wrapper">
                {tags.map((tag) => (
                  <Badge key={tag} variant="secondary" className="gap-1">
                    {tag}
                    <X
                      className="size-3 cursor-pointer"
                      onClick={() => removeTag(tag)}
                    />
                  </Badge>
                ))}
                <input
                  type="text"
                  className="tags-input-field"
                  placeholder={
                    tags.length === 0 ? t("commandEditor.tagsPlaceholder") : ""
                  }
                  value={tagInput}
                  onChange={(e) => setTagInput(e.target.value)}
                  onKeyDown={handleTagKeyDown}
                />
              </div>
            </div>
          </div>

          {/* Variable panel - always shown, with add button */}
          <div className="w-72 px-4 py-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                {t("commandEditor.variables")}
              </h3>
              <Button variant="ghost" size="icon-xs" onClick={addVariable}>
                <Plus className="size-3.5" />
              </Button>
            </div>
            <ScrollArea className="h-[360px]">
              <div className="space-y-4 pr-3">
                {variables.length === 0 ? (
                  <p className="text-xs text-muted-foreground text-center italic py-4">
                    {t("commandEditor.noVariables")}
                  </p>
                ) : (
                  variables.map((v, index) => (
                    <div key={index} className="space-y-2">
                      <div className="flex items-center gap-1">
                        <Input
                          className="h-7 text-sm font-medium flex-1"
                          value={v.name}
                          onChange={(e) =>
                            updateVariable(index, "name", e.target.value)
                          }
                          placeholder={t("commandEditor.varNamePlaceholder")}
                        />
                        <Button
                          variant="ghost"
                          size="icon-xs"
                          onClick={() => moveVariable(index, "up")}
                          disabled={index === 0}
                        >
                          <ArrowUp className="size-3" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon-xs"
                          onClick={() => moveVariable(index, "down")}
                          disabled={index === variables.length - 1}
                        >
                          <ArrowDown className="size-3" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon-xs"
                          onClick={() => removeVariable(index)}
                        >
                          <X className="size-3" />
                        </Button>
                      </div>
                      <div className="space-y-1.5">
                        <div>
                          <Label className="text-xs text-muted-foreground">
                            {t("commandEditor.varDescription")}
                          </Label>
                          <Input
                            className="h-7 text-xs"
                            value={v.description}
                            onChange={(e) =>
                              updateVariable(index, "description", e.target.value)
                            }
                          />
                        </div>
                        <div>
                          <Label className="text-xs text-muted-foreground">
                            {t("commandEditor.varExample")}
                          </Label>
                          <Input
                            className="h-7 text-xs"
                            value={v.example}
                            onChange={(e) =>
                              updateVariable(index, "example", e.target.value)
                            }
                          />
                        </div>
                        <div>
                          <Label className="text-xs text-muted-foreground">
                            {t("commandEditor.varDefault")}
                          </Label>
                          <Input
                            className="h-7 text-xs font-mono"
                            value={v.default}
                            onChange={(e) =>
                              updateVariable(index, "default", e.target.value)
                            }
                          />
                        </div>
                      </div>
                      <Separator className="mt-2" />
                    </div>
                  ))
                )}
              </div>
            </ScrollArea>
          </div>
        </div>
        <DialogFooter className="px-6 pb-6">
          <Button variant="ghost" onClick={onCancel}>
            {t("commandEditor.cancel")}
          </Button>
          <Button
            onClick={handleSave}
            disabled={!title.trim() || !(isAdvanced ? advancedScript.trim() : scriptBody.trim())}
          >
            {command
              ? t("commandEditor.saveChanges")
              : t("commandEditor.createCommand")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

// Client-side script parsing (mirrors Go logic)
function parseScriptBodyClient(scriptContent: string): string {
  const lines = scriptContent.split("\n");

  let mainStart = -1;
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].trim() === "main() {") {
      mainStart = i;
      break;
    }
  }
  if (mainStart === -1) return scriptContent;

  let mainEnd = -1;
  for (let i = mainStart + 1; i < lines.length; i++) {
    if (lines[i].trim() === "}") {
      mainEnd = i;
      break;
    }
  }
  if (mainEnd === -1) return scriptContent;

  let bodyStart = mainStart + 1;
  while (bodyStart < mainEnd) {
    const trimmed = lines[bodyStart].trim();
    if (trimmed.startsWith("local ") && trimmed.includes('="$')) {
      bodyStart++;
      continue;
    }
    break;
  }

  if (bodyStart < mainEnd && lines[bodyStart].trim() === "") {
    bodyStart++;
  }

  const bodyLines: string[] = [];
  for (let i = bodyStart; i < mainEnd; i++) {
    let line = lines[i];
    if (line.startsWith("  ")) {
      line = line.slice(2);
    }
    bodyLines.push(line);
  }

  return bodyLines.join("\n");
}

// Client-side script generation (mirrors Go logic)
function generateScriptClient(body: string, variables: VariableDefinition[]): string {
  let script = "#!/bin/bash\n\nmain() {\n";

  for (let i = 0; i < variables.length; i++) {
    script += `  local ${variables[i].name}="$${i + 1}"\n`;
  }

  if (variables.length > 0) {
    script += "\n";
  }

  for (const line of body.split("\n")) {
    if (line === "") {
      script += "\n";
    } else {
      script += `  ${line}\n`;
    }
  }

  script += '}\n\nmain "$@"\n';
  return script;
}

export default CommandEditor;
```

- [ ] **Step 2: Verify the Switch component exists**

Run:
```bash
ls /Users/mac/Documents/Projects/Others/commamer/frontend/src/components/ui/switch.tsx
```

If it doesn't exist, install it:
```bash
cd /Users/mac/Documents/Projects/Others/commamer/frontend && npx shadcn@latest add switch
```

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/CommandEditor.tsx frontend/src/components/ui/
git commit -m "feat: refactor CommandEditor with script body, advanced mode, explicit variables"
```

---

### Task 10: Refactor CommandDetail for script display

**Files:**
- Modify: `frontend/src/components/CommandDetail.tsx`

- [ ] **Step 1: Update CommandDetail**

Key changes to `CommandDetail.tsx`:
1. Replace `command.commandText` references with script body display
2. Remove `${varName}` regex rendering — show the script body directly
3. Update preview to show `bash <script> "arg1" "arg2"` format
4. Update copy to copy script body

Replace the `renderCommandText` function and update references:

Replace the `renderCommandText` function:
```tsx
function renderScriptBody(scriptContent: string): string {
  // Simple client-side parse to extract body
  const lines = scriptContent.split("\n");
  let mainStart = -1;
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].trim() === "main() {") { mainStart = i; break; }
  }
  if (mainStart === -1) return scriptContent;
  let mainEnd = -1;
  for (let i = mainStart + 1; i < lines.length; i++) {
    if (lines[i].trim() === "}") { mainEnd = i; break; }
  }
  if (mainEnd === -1) return scriptContent;
  let bodyStart = mainStart + 1;
  while (bodyStart < mainEnd) {
    const trimmed = lines[bodyStart].trim();
    if (trimmed.startsWith("local ") && trimmed.includes('="$')) { bodyStart++; continue; }
    break;
  }
  if (bodyStart < mainEnd && lines[bodyStart].trim() === "") bodyStart++;
  const bodyLines: string[] = [];
  for (let i = bodyStart; i < mainEnd; i++) {
    let line = lines[i];
    if (line.startsWith("  ")) line = line.slice(2);
    bodyLines.push(line);
  }
  return bodyLines.join("\n");
}
```

In the component, update `handleCopy` to copy the script body:
```tsx
const scriptBody = useMemo(() => renderScriptBody(command.scriptContent), [command.scriptContent]);

const handleCopy = useCallback(() => {
  navigator.clipboard.writeText(scriptBody).then(() => {
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  });
}, [scriptBody]);
```

Update the preview section — instead of replacing `${var}` in command text, show the execution command with resolved values:
```tsx
const previewText = useMemo(() => {
  if (variables.length === 0) return scriptBody;
  const args = variables.map((v) => resolvedValues[v.name] || `<${v.name}>`);
  return `# bash script.sh ${args.map(a => `"${a}"`).join(" ")}\n\n${scriptBody}`;
}, [scriptBody, variables, resolvedValues]);
```

Replace the command-text-box rendering to just show the script body as plain text:
```tsx
<div className="command-text-box">
  <pre className="whitespace-pre-wrap text-sm">{scriptBody}</pre>
  {/* keep existing action buttons */}
</div>
```

For the preview section (when variables exist), show the body with a header showing how it'll be called.

Update `onRunInTerminal` and `onExecute` calls — they now just pass variable values (no commandText):
```tsx
onExecute: (values: Record<string, string>) => void;
onRunInTerminal: (values: Record<string, string>) => void;
```

Remove `previewText` from clipboard copy in the preview section — use the scriptBody instead.

- [ ] **Step 2: Commit**

```bash
git add frontend/src/components/CommandDetail.tsx
git commit -m "feat: update CommandDetail to display script body instead of command text"
```

---

### Task 11: Refactor App.tsx for new API signatures

**Files:**
- Modify: `frontend/src/App.tsx`

- [ ] **Step 1: Update imports and API calls**

Key changes to `App.tsx`:

1. Remove `extractVarNames` function (no longer needed)
2. Update `ModalState` — remove `commandText` from modal states, replace with `commandId`
3. Update `CreateCommand`/`UpdateCommand` calls to use new signatures
4. Update `GetVariables` call — no longer takes `commandText`
5. Update `RunCommand` call — no longer takes `commandText`
6. Update `RunInTerminal` call — no longer takes `commandText`
7. Remove `pendingCommandUpdate` logic (variable changes no longer affect presets the same way)

Update the Wails imports — add new methods, remove unused ones:
```tsx
import {
    GetCategories,
    CreateCategory,
    UpdateCategory,
    DeleteCategory,
    GetCommands,
    CreateCommand,
    UpdateCommand,
    DeleteCommand,
    SearchCommands,
    GetVariables,
    RunCommand,
    GetExecutionHistory,
    ClearExecutionHistory,
    GetPresets,
    SavePreset,
    UpdatePreset,
    DeletePreset,
    GetSettings,
    RunInTerminal,
    GetScriptBody,
} from '../wailsjs/go/main/App';
```

Update `ModalState` type:
```tsx
type ModalState =
    | { type: 'none' }
    | { type: 'commandEditor'; command?: Command; defaultCategoryId?: string }
    | { type: 'categoryEditor'; category?: Category }
    | { type: 'managePresets'; variables: VarPromptType[]; commandId: string; presets: VariablePreset[] }
    | { type: 'fillVariables'; variables: VarPromptType[]; commandId: string; initialValues: Record<string, string> }
    | { type: 'confirmDelete'; itemType: 'command' | 'category'; id: string; name: string };
```

Update `GetVariables` effect — now only takes commandID:
```tsx
useEffect(() => {
    if (selectedCommand) {
        GetVariables(selectedCommand.id)
            .then(vars => setResolvedVariables(vars || []))
            .catch(() => setResolvedVariables([]));
    } else {
        setResolvedVariables([]);
    }
}, [selectedCommand]);
```

Update `handleCreateCommand`:
```tsx
const handleCreateCommand = async (data: {
    title: string; description: string; scriptBody: string; categoryId: string; tags: string[]; variables: VariableDefinition[]; isAdvanced: boolean;
}) => {
    try {
        const cmd = await CreateCommand(data.title, data.description, data.scriptBody, data.categoryId, data.tags, data.variables, data.isAdvanced);
        await loadData();
        setSelectedCommand(cmd);
        setModal({ type: 'none' });
        toast.success(t('toast.commandCreated'));
    } catch (err) {
        console.error('Failed to create command:', err);
    }
};
```

Update `handleUpdateCommand` — simplified, no more variable change detection:
```tsx
const handleUpdateCommand = async (data: {
    title: string; description: string; scriptBody: string; categoryId: string; tags: string[]; variables: VariableDefinition[]; isAdvanced: boolean;
}) => {
    if (modal.type !== 'commandEditor' || !modal.command) return;
    try {
        const cmd = await UpdateCommand(modal.command.id, data.title, data.description, data.scriptBody, data.categoryId, data.tags, data.variables, data.isAdvanced);
        await loadData();
        setSelectedCommand(cmd);
        setModal({ type: 'none' });
        toast.success(t('toast.commandSaved'));
    } catch (err) {
        console.error('Failed to update command:', err);
    }
};
```

Remove `commitCommandUpdate`, `confirmPendingCommandUpdate`, `pendingCommandUpdate` state, and the related AlertDialog.

Update `handleRenameCommand` — use `GetScriptBody` to get current body:
```tsx
const handleRenameCommand = async (newTitle: string) => {
    if (!selectedCommand) return;
    try {
        const body = await GetScriptBody(selectedCommand.id);
        const cmd = await UpdateCommand(
            selectedCommand.id, newTitle, selectedCommand.description,
            body, selectedCommand.categoryId,
            selectedCommand.tags, selectedCommand.variables, false
        );
        await loadData();
        setSelectedCommand(cmd);
    } catch (err) {
        console.error('Failed to rename command:', err);
    }
};
```

Update `handleExecute`:
```tsx
const handleExecute = async (values: Record<string, string>) => {
    if (!selectedCommand) return;
    runCommandDirect(selectedCommand.id, values);
};
```

Update `handleRunInTerminal`:
```tsx
const handleRunInTerminal = async (values: Record<string, string>) => {
    if (!selectedCommand) return;
    try {
        await RunInTerminal(selectedCommand.id, values);
    } catch (err) {
        toast.error(String(err));
    }
};
```

Update `handleManagePresets`:
```tsx
const handleManagePresets = async () => {
    if (!selectedCommand) return;
    const vars = await GetVariables(selectedCommand.id);
    const presets = await GetPresets(selectedCommand.id);
    setModal({
        type: 'managePresets',
        variables: vars || [],
        commandId: selectedCommand.id,
        presets: presets || [],
    });
};
```

Update `handleFillVariables`:
```tsx
const handleFillVariables = async (initialValues: Record<string, string>) => {
    if (!selectedCommand) return;
    const vars = await GetVariables(selectedCommand.id);
    setModal({
        type: 'fillVariables',
        variables: vars || [],
        commandId: selectedCommand.id,
        initialValues,
    });
};
```

Update `handleVariableSubmit`:
```tsx
const handleVariableSubmit = async (values: Record<string, string>) => {
    if (!selectedCommand) return;
    setModal({ type: 'none' });
    runCommandDirect(selectedCommand.id, values);
};
```

Update `runCommandDirect`:
```tsx
const runCommandDirect = async (commandId: string, variables: Record<string, string>) => {
    setIsExecuting(true);
    setSelectedRecord(null);
    setStreamLines([]);
    streamBufferRef.current = [];
    setOutputPaneOpen(true);

    const cleanup = EventsOn('cmd-output', (chunk: { stream: string; data: string }) => {
        const prefix = chunk.stream === 'stderr' ? '\x1b[stderr]' : '';
        streamBufferRef.current.push(prefix + chunk.data);
        if (streamFlushRef.current === null) {
            streamFlushRef.current = requestAnimationFrame(flushStreamBuffer);
        }
    });

    try {
        const record = await RunCommand(commandId, variables);
        if (streamFlushRef.current !== null) {
            cancelAnimationFrame(streamFlushRef.current);
            streamFlushRef.current = null;
        }
        if (streamBufferRef.current.length > 0) {
            flushStreamBuffer();
        }
        setSelectedRecord(record);
        await loadHistory();
        if (record.exitCode === 0) {
            toast.success(t('toast.commandSuccess'));
        } else {
            toast.error(t('toast.commandFailed', { code: record.exitCode }));
        }
    } catch (err) {
        setSelectedRecord({
            id: '',
            commandId: commandId,
            scriptContent: '',
            finalCmd: '',
            output: '',
            error: String(err),
            exitCode: -1,
            executedAt: new Date().toISOString(),
        });
        toast.error(t('toast.commandFailed', { code: -1 }));
    } finally {
        cleanup();
        setIsExecuting(false);
    }
};
```

Update the `VariablePrompt` modal renders — remove `commandText` prop, since the preview in VariablePrompt also needs updating (Task 12).

For now, pass `scriptContent` where `commandText` was expected — we'll update VariablePrompt in the next task.

- [ ] **Step 2: Commit**

```bash
git add frontend/src/App.tsx
git commit -m "feat: refactor App.tsx for new script-based API signatures"
```

---

### Task 12: Update VariablePrompt for script-based commands

**Files:**
- Modify: `frontend/src/components/VariablePrompt.tsx`

- [ ] **Step 1: Update VariablePrompt**

Key changes:
1. Replace `commandText` prop with `scriptBody` (just the body for preview)
2. Update preview rendering — show the body with variable values substituted as bash variables
3. Remove `${varName}` regex-based rendering

In the interface, rename `commandText` to `scriptBody`:
```tsx
interface VariablePromptProps {
  mode: 'manage' | 'fill';
  variables: VariablePromptType[];
  scriptBody: string;
  presets: VariablePreset[];
  // ... rest unchanged
}
```

Update `getPreviewText`:
```tsx
const getPreviewText = () => {
  // Show the script body with a header showing the args
  const args = variables.map(v => values[v.name] || `<${v.name}>`);
  const header = args.length > 0 ? `# args: ${args.map(a => `"${a}"`).join(" ")}\n` : "";
  return header + scriptBody;
};
```

Update `renderPreview` — just show the script body as-is (no regex substitution):
```tsx
const renderPreview = (): React.ReactNode[] => {
  return [<span key="body">{scriptBody}</span>];
};
```

Or better, show a formatted preview with the args listed:
```tsx
const renderPreview = (): React.ReactNode => {
  const args = variables.map(v => {
    const val = values[v.name];
    return val
      ? <span key={v.name} className="var-filled">"{val}"</span>
      : <span key={v.name} className="var-missing">&lt;{v.name}&gt;</span>;
  });
  return (
    <div>
      {args.length > 0 && (
        <div className="text-muted-foreground mb-1">
          args: {args.reduce<React.ReactNode[]>((acc, el, i) => {
            if (i > 0) acc.push(<span key={`sep-${i}`}> </span>);
            acc.push(el);
            return acc;
          }, [])}
        </div>
      )}
      <pre className="whitespace-pre-wrap">{scriptBody}</pre>
    </div>
  );
};
```

- [ ] **Step 2: Update App.tsx to pass `scriptBody` instead of `commandText`**

In the VariablePrompt modal renders in `App.tsx`, change:
- `commandText={modal.commandText}` → compute scriptBody from selectedCommand

Add a helper or pass `scriptBody` from the modal state. Simplest: add `scriptBody` to the modal state, computed when opening.

Update `handleManagePresets`:
```tsx
const handleManagePresets = async () => {
    if (!selectedCommand) return;
    const vars = await GetVariables(selectedCommand.id);
    const presets = await GetPresets(selectedCommand.id);
    const body = await GetScriptBody(selectedCommand.id);
    setModal({
        type: 'managePresets',
        variables: vars || [],
        commandId: selectedCommand.id,
        presets: presets || [],
        scriptBody: body,
    });
};
```

Update `handleFillVariables`:
```tsx
const handleFillVariables = async (initialValues: Record<string, string>) => {
    if (!selectedCommand) return;
    const vars = await GetVariables(selectedCommand.id);
    const body = await GetScriptBody(selectedCommand.id);
    setModal({
        type: 'fillVariables',
        variables: vars || [],
        commandId: selectedCommand.id,
        initialValues,
        scriptBody: body,
    });
};
```

Update `ModalState` type to include `scriptBody`:
```tsx
type ModalState =
    | { type: 'none' }
    | { type: 'commandEditor'; command?: Command; defaultCategoryId?: string }
    | { type: 'categoryEditor'; category?: Category }
    | { type: 'managePresets'; variables: VarPromptType[]; commandId: string; presets: VariablePreset[]; scriptBody: string }
    | { type: 'fillVariables'; variables: VarPromptType[]; commandId: string; initialValues: Record<string, string>; scriptBody: string }
    | { type: 'confirmDelete'; itemType: 'command' | 'category'; id: string; name: string };
```

Then in the JSX, pass `scriptBody={modal.scriptBody}`.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/VariablePrompt.tsx frontend/src/App.tsx
git commit -m "feat: update VariablePrompt for script-based preview"
```

---

### Task 13: Update i18n locale file

**Files:**
- Modify: `frontend/src/locales/en.json`

- [ ] **Step 1: Update en.json**

Add/update keys:

```json
{
  "commandEditor": {
    "newCommand": "New Command",
    "editCommand": "Edit Command",
    "editCommandDesc": "Edit command details",
    "createCommandDesc": "Create a new command",
    "title": "Title",
    "titlePlaceholder": "e.g., Scan Redis Keys",
    "description": "Description",
    "descriptionPlaceholder": "What does this command do?",
    "command": "Command",
    "script": "Script",
    "commandPlaceholder": "redis-cli --scan --pattern \"$pattern\"",
    "scriptHint": "Reference variables as $varName (defined in the panel on the right).",
    "advancedMode": "Advanced",
    "category": "Category",
    "uncategorized": "Uncategorized",
    "tags": "Tags",
    "tagsPlaceholder": "Type and press Enter...",
    "variables": "Variables",
    "noVariables": "No variables defined. Click + to add one.",
    "varNamePlaceholder": "variable name",
    "varDescription": "Description",
    "varExample": "Example",
    "varDefault": "Default / CEL",
    "cancel": "Cancel",
    "saveChanges": "Save Changes",
    "createCommand": "Create Command"
  }
}
```

Merge these into the existing `en.json`, keeping all other sections unchanged.

- [ ] **Step 2: Commit**

```bash
git add frontend/src/locales/en.json
git commit -m "feat: update i18n keys for script-based command editor"
```

---

### Task 14: Build and verify end-to-end

**Files:**
- None (verification only)

- [ ] **Step 1: Run type check**

```bash
cd /Users/mac/Documents/Projects/Others/commamer && make check
```

Fix any TypeScript or Go compilation errors.

- [ ] **Step 2: Run wails dev**

```bash
cd /Users/mac/Documents/Projects/Others/commamer && wails dev
```

Test:
1. App launches without errors
2. Create a new command with simple body (e.g., `echo "hello"`)
3. Create a command with variables — add a variable in the panel, reference it as `$varName` in the body
4. Execute the command — verify it runs correctly
5. Toggle advanced mode — verify the full script is shown
6. Edit in advanced mode — verify changes are preserved
7. Test presets still work
8. Test search finds commands
9. Test execution history shows entries
10. Test terminal execution works

- [ ] **Step 3: Final commit**

```bash
git add -A
git commit -m "fix: resolve build issues from script-based command refactor"
```
