package main

import (
	"database/sql"
	"fmt"
	"os"
	"path/filepath"
	"strings"
	"time"

	_ "modernc.org/sqlite"
)

type DB struct {
	conn    *sql.DB
	dataDir string
}

const schemaVersion = 7

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
    title TEXT,
    description TEXT,
    script_content TEXT NOT NULL,
    category_id TEXT DEFAULT NULL,
    position INTEGER NOT NULL DEFAULT 0,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE SET NULL
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
    position INTEGER NOT NULL DEFAULT 0,
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

CREATE TABLE IF NOT EXISTS app_settings (
    locale TEXT NOT NULL DEFAULT 'en',
    terminal TEXT NOT NULL DEFAULT ''
);

CREATE VIRTUAL TABLE IF NOT EXISTS commands_fts USING fts5(
    title, description, script_content, content='commands', content_rowid='rowid'
);

-- Triggers to keep FTS in sync
CREATE TRIGGER IF NOT EXISTS commands_ai AFTER INSERT ON commands BEGIN
    INSERT INTO commands_fts(rowid, title, description, script_content)
    VALUES (new.rowid, COALESCE(new.title, ''), COALESCE(new.description, ''), new.script_content);
END;

CREATE TRIGGER IF NOT EXISTS commands_ad AFTER DELETE ON commands BEGIN
    INSERT INTO commands_fts(commands_fts, rowid, title, description, script_content)
    VALUES ('delete', old.rowid, COALESCE(old.title, ''), COALESCE(old.description, ''), old.script_content);
END;

CREATE TRIGGER IF NOT EXISTS commands_au AFTER UPDATE ON commands BEGIN
    INSERT INTO commands_fts(commands_fts, rowid, title, description, script_content)
    VALUES ('delete', old.rowid, COALESCE(old.title, ''), COALESCE(old.description, ''), old.script_content);
    INSERT INTO commands_fts(rowid, title, description, script_content)
    VALUES (new.rowid, COALESCE(new.title, ''), COALESCE(new.description, ''), new.script_content);
END;
`

func NewDB() (*DB, error) {
	homeDir, err := os.UserHomeDir()
	if err != nil {
		return nil, fmt.Errorf("get home dir: %w", err)
	}

	dataDir := filepath.Join(homeDir, ".cmdex")
	if err := os.MkdirAll(dataDir, 0755); err != nil {
		return nil, fmt.Errorf("create data dir: %w", err)
	}

	dbPath := filepath.Join(dataDir, "cmdex.db")
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

	// Migration v1 -> v2: make category_id nullable with ON DELETE SET NULL
	if version < 2 {
		tx, err := db.conn.Begin()
		if err != nil {
			return fmt.Errorf("begin migration v2 tx: %w", err)
		}
		defer tx.Rollback()

		// SQLite doesn't support ALTER COLUMN, so recreate the table
		migrations := []string{
			`CREATE TABLE IF NOT EXISTS commands_new (
				id TEXT PRIMARY KEY,
				title TEXT NOT NULL,
				description TEXT NOT NULL DEFAULT '',
				script_content TEXT NOT NULL,
				category_id TEXT DEFAULT NULL,
				created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
				updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
				FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE SET NULL
			)`,
			`INSERT INTO commands_new SELECT * FROM commands`,
			`DROP TABLE commands`,
			`ALTER TABLE commands_new RENAME TO commands`,
			// Update empty strings to NULL
			`UPDATE commands SET category_id = NULL WHERE category_id = ''`,
			// Recreate FTS triggers
			`DROP TRIGGER IF EXISTS commands_ai`,
			`DROP TRIGGER IF EXISTS commands_ad`,
			`DROP TRIGGER IF EXISTS commands_au`,
			`CREATE TRIGGER commands_ai AFTER INSERT ON commands BEGIN
				INSERT INTO commands_fts(rowid, title, description, script_content)
				VALUES (new.rowid, new.title, new.description, new.script_content);
			END`,
			`CREATE TRIGGER commands_ad AFTER DELETE ON commands BEGIN
				INSERT INTO commands_fts(commands_fts, rowid, title, description, script_content)
				VALUES ('delete', old.rowid, old.title, old.description, old.script_content);
			END`,
			`CREATE TRIGGER commands_au AFTER UPDATE ON commands BEGIN
				INSERT INTO commands_fts(commands_fts, rowid, title, description, script_content)
				VALUES ('delete', old.rowid, old.title, old.description, old.script_content);
				INSERT INTO commands_fts(rowid, title, description, script_content)
				VALUES (new.rowid, new.title, new.description, new.script_content);
			END`,
		}
		for _, m := range migrations {
			if _, err := tx.Exec(m); err != nil {
				return fmt.Errorf("migration v2: %w", err)
			}
		}
		if _, err := tx.Exec("UPDATE schema_version SET version = ?", 2); err != nil {
			return fmt.Errorf("update schema version: %w", err)
		}
		if err := tx.Commit(); err != nil {
			return fmt.Errorf("commit migration v2: %w", err)
		}
	}

	// Migration v2 -> v3: add position column to commands
	if version < 3 {
		tx, err := db.conn.Begin()
		if err != nil {
			return fmt.Errorf("begin migration v3 tx: %w", err)
		}
		defer tx.Rollback()

		migrations := []string{
			`ALTER TABLE commands ADD COLUMN position INTEGER NOT NULL DEFAULT 0`,
			`UPDATE commands SET position = rowid`,
		}
		for _, m := range migrations {
			if _, err := tx.Exec(m); err != nil {
				return fmt.Errorf("migration v3: %w", err)
			}
		}
		if _, err := tx.Exec("UPDATE schema_version SET version = ?", 3); err != nil {
			return fmt.Errorf("update schema version: %w", err)
		}
		if err := tx.Commit(); err != nil {
			return fmt.Errorf("commit migration v3: %w", err)
		}
	}

	// Migration v3 -> v5: make title and description nullable
	// Combined into single migration; disables FK enforcement to prevent
	// ON DELETE CASCADE from wiping child tables (variable_definitions,
	// variable_presets, command_tags, executions) when commands is recreated.
	if version < 5 {
		if _, err := db.conn.Exec("PRAGMA foreign_keys = OFF"); err != nil {
			return fmt.Errorf("disable FK for migration: %w", err)
		}
		defer db.conn.Exec("PRAGMA foreign_keys = ON")

		tx, err := db.conn.Begin()
		if err != nil {
			return fmt.Errorf("begin migration v5 tx: %w", err)
		}
		defer tx.Rollback()

		migrations := []string{
			`CREATE TABLE IF NOT EXISTS commands_new (
				id TEXT PRIMARY KEY,
				title TEXT,
				description TEXT,
				script_content TEXT NOT NULL,
				category_id TEXT DEFAULT NULL,
				position INTEGER NOT NULL DEFAULT 0,
				created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
				updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
				FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE SET NULL
			)`,
			`INSERT INTO commands_new SELECT id, title,
				CASE WHEN description = '' THEN NULL ELSE description END,
				script_content, category_id, position, created_at, updated_at
				FROM commands`,
			`DROP TABLE commands`,
			`ALTER TABLE commands_new RENAME TO commands`,
			`DROP TRIGGER IF EXISTS commands_ai`,
			`DROP TRIGGER IF EXISTS commands_ad`,
			`DROP TRIGGER IF EXISTS commands_au`,
			`CREATE TRIGGER commands_ai AFTER INSERT ON commands BEGIN
				INSERT INTO commands_fts(rowid, title, description, script_content)
				VALUES (new.rowid, COALESCE(new.title, ''), COALESCE(new.description, ''), new.script_content);
			END`,
			`CREATE TRIGGER commands_ad AFTER DELETE ON commands BEGIN
				INSERT INTO commands_fts(commands_fts, rowid, title, description, script_content)
				VALUES ('delete', old.rowid, COALESCE(old.title, ''), COALESCE(old.description, ''), old.script_content);
			END`,
			`CREATE TRIGGER commands_au AFTER UPDATE ON commands BEGIN
				INSERT INTO commands_fts(commands_fts, rowid, title, description, script_content)
				VALUES ('delete', old.rowid, COALESCE(old.title, ''), COALESCE(old.description, ''), old.script_content);
				INSERT INTO commands_fts(rowid, title, description, script_content)
				VALUES (new.rowid, COALESCE(new.title, ''), COALESCE(new.description, ''), new.script_content);
			END`,
		}
		for _, m := range migrations {
			if _, err := tx.Exec(m); err != nil {
				return fmt.Errorf("migration v5: %w", err)
			}
		}
		if _, err := tx.Exec("UPDATE schema_version SET version = ?", 5); err != nil {
			return fmt.Errorf("update schema version: %w", err)
		}
		if err := tx.Commit(); err != nil {
			return fmt.Errorf("commit migration v5: %w", err)
		}
		if _, err := db.conn.Exec("PRAGMA foreign_keys = ON"); err != nil {
			return fmt.Errorf("re-enable FK after migration: %w", err)
		}
	}

	// Migration v5 -> v6: add position column to variable_presets
	if version < 6 {
		tx, err := db.conn.Begin()
		if err != nil {
			return fmt.Errorf("begin migration v6 tx: %w", err)
		}
		defer tx.Rollback()

		migrations := []string{
			`ALTER TABLE variable_presets ADD COLUMN position INTEGER NOT NULL DEFAULT 0`,
			`UPDATE variable_presets SET position = rowid`,
		}
		for _, m := range migrations {
			if _, err := tx.Exec(m); err != nil {
				return fmt.Errorf("migration v6: %w", err)
			}
		}
		if _, err := tx.Exec("UPDATE schema_version SET version = ?", 6); err != nil {
			return fmt.Errorf("update schema version: %w", err)
		}
		if err := tx.Commit(); err != nil {
			return fmt.Errorf("commit migration v6: %w", err)
		}
	}

	if version < 7 {
		_, err := db.conn.Exec(`ALTER TABLE executions ADD COLUMN working_dir TEXT DEFAULT ''`)
		if err != nil {
			return fmt.Errorf("migration v7: %w", err)
		}
	}

	_, err = db.conn.Exec("UPDATE schema_version SET version = ?", schemaVersion)
	return err
}

// ---------------------------------------------------------------------------
// Categories
// ---------------------------------------------------------------------------

func (db *DB) GetCategories() ([]Category, error) {
	rows, err := db.conn.Query("SELECT id, name, icon, color, created_at, updated_at FROM categories ORDER BY created_at")
	if err != nil {
		return nil, fmt.Errorf("query categories: %w", err)
	}
	defer rows.Close()

	cats := []Category{}
	for rows.Next() {
		var c Category
		if err := rows.Scan(&c.ID, &c.Name, &c.Icon, &c.Color, &c.CreatedAt, &c.UpdatedAt); err != nil {
			return nil, fmt.Errorf("scan category: %w", err)
		}
		cats = append(cats, c)
	}
	return cats, rows.Err()
}

func (db *DB) CreateCategory(cat Category) error {
	_, err := db.conn.Exec(
		"INSERT INTO categories (id, name, icon, color, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)",
		cat.ID, cat.Name, cat.Icon, cat.Color, cat.CreatedAt, cat.UpdatedAt,
	)
	if err != nil {
		return fmt.Errorf("insert category: %w", err)
	}
	return nil
}

func (db *DB) UpdateCategory(cat Category) error {
	res, err := db.conn.Exec(
		"UPDATE categories SET name = ?, icon = ?, color = ?, updated_at = ? WHERE id = ?",
		cat.Name, cat.Icon, cat.Color, cat.UpdatedAt, cat.ID,
	)
	if err != nil {
		return fmt.Errorf("update category: %w", err)
	}
	n, _ := res.RowsAffected()
	if n == 0 {
		return fmt.Errorf("category %s not found", cat.ID)
	}
	return nil
}

func (db *DB) DeleteCategory(id string) error {
	res, err := db.conn.Exec("DELETE FROM categories WHERE id = ?", id)
	if err != nil {
		return fmt.Errorf("delete category: %w", err)
	}
	n, _ := res.RowsAffected()
	if n == 0 {
		return fmt.Errorf("category %s not found", id)
	}
	return nil
}

// ---------------------------------------------------------------------------
// Commands
// ---------------------------------------------------------------------------

func (db *DB) GetCommands() ([]Command, error) {
	rows, err := db.conn.Query(
		"SELECT id, title, description, script_content, category_id, position, created_at, updated_at FROM commands ORDER BY position ASC",
	)
	if err != nil {
		return nil, fmt.Errorf("query commands: %w", err)
	}
	defer rows.Close()

	cmds := []Command{}
	for rows.Next() {
		var c Command
		var catID sql.NullString
		if err := rows.Scan(&c.ID, &c.Title, &c.Description, &c.ScriptContent, &catID, &c.Position, &c.CreatedAt, &c.UpdatedAt); err != nil {
			return nil, fmt.Errorf("scan command: %w", err)
		}
		c.CategoryID = catID.String
		cmds = append(cmds, c)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}

	for i := range cmds {
		if err := db.loadCommandRelations(&cmds[i]); err != nil {
			return nil, err
		}
	}
	return cmds, nil
}

func (db *DB) GetCommandsByCategory(categoryID string) ([]Command, error) {
	rows, err := db.conn.Query(
		"SELECT id, title, description, script_content, category_id, position, created_at, updated_at FROM commands WHERE category_id = ? ORDER BY position ASC",
		categoryID,
	)
	if err != nil {
		return nil, fmt.Errorf("query commands by category: %w", err)
	}
	defer rows.Close()

	cmds := []Command{}
	for rows.Next() {
		var c Command
		var catID sql.NullString
		if err := rows.Scan(&c.ID, &c.Title, &c.Description, &c.ScriptContent, &catID, &c.Position, &c.CreatedAt, &c.UpdatedAt); err != nil {
			return nil, fmt.Errorf("scan command: %w", err)
		}
		c.CategoryID = catID.String
		cmds = append(cmds, c)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}

	for i := range cmds {
		if err := db.loadCommandRelations(&cmds[i]); err != nil {
			return nil, err
		}
	}
	return cmds, nil
}

func (db *DB) GetCommand(id string) (Command, error) {
	var c Command
	var catID sql.NullString
	err := db.conn.QueryRow(
		"SELECT id, title, description, script_content, category_id, position, created_at, updated_at FROM commands WHERE id = ?", id,
	).Scan(&c.ID, &c.Title, &c.Description, &c.ScriptContent, &catID, &c.Position, &c.CreatedAt, &c.UpdatedAt)
	if err != nil {
		return c, fmt.Errorf("get command %s: %w", id, err)
	}
	c.CategoryID = catID.String
	if err := db.loadCommandRelations(&c); err != nil {
		return c, err
	}
	return c, nil
}

func (db *DB) loadCommandRelations(cmd *Command) error {
	// Tags
	tagRows, err := db.conn.Query(
		"SELECT t.name FROM tags t JOIN command_tags ct ON ct.tag_id = t.id WHERE ct.command_id = ? ORDER BY t.name",
		cmd.ID,
	)
	if err != nil {
		return fmt.Errorf("query tags: %w", err)
	}
	defer tagRows.Close()

	cmd.Tags = []string{}
	for tagRows.Next() {
		var name string
		if err := tagRows.Scan(&name); err != nil {
			return fmt.Errorf("scan tag: %w", err)
		}
		cmd.Tags = append(cmd.Tags, name)
	}
	if err := tagRows.Err(); err != nil {
		return err
	}

	// Variables
	varRows, err := db.conn.Query(
		"SELECT name, description, example, default_expr, sort_order FROM variable_definitions WHERE command_id = ? ORDER BY sort_order",
		cmd.ID,
	)
	if err != nil {
		return fmt.Errorf("query variables: %w", err)
	}
	defer varRows.Close()

	cmd.Variables = []VariableDefinition{}
	for varRows.Next() {
		var v VariableDefinition
		if err := varRows.Scan(&v.Name, &v.Description, &v.Example, &v.Default, &v.SortOrder); err != nil {
			return fmt.Errorf("scan variable: %w", err)
		}
		cmd.Variables = append(cmd.Variables, v)
	}
	if err := varRows.Err(); err != nil {
		return err
	}

	// Presets — ORDER BY position must match GetPresets / ReorderPresets
	presetRows, err := db.conn.Query(
		"SELECT id, name, position FROM variable_presets WHERE command_id = ? ORDER BY position, name",
		cmd.ID,
	)
	if err != nil {
		return fmt.Errorf("query presets: %w", err)
	}
	defer presetRows.Close()

	cmd.Presets = []VariablePreset{}
	for presetRows.Next() {
		var p VariablePreset
		if err := presetRows.Scan(&p.ID, &p.Name, &p.Position); err != nil {
			return fmt.Errorf("scan preset: %w", err)
		}
		p.Values = map[string]string{}

		valRows, err := db.conn.Query(
			"SELECT variable_name, value FROM preset_values WHERE preset_id = ?", p.ID,
		)
		if err != nil {
			return fmt.Errorf("query preset values: %w", err)
		}
		for valRows.Next() {
			var k, v string
			if err := valRows.Scan(&k, &v); err != nil {
				valRows.Close()
				return fmt.Errorf("scan preset value: %w", err)
			}
			p.Values[k] = v
		}
		valRows.Close()
		if err := valRows.Err(); err != nil {
			return err
		}

		cmd.Presets = append(cmd.Presets, p)
	}
	return presetRows.Err()
}

func nullableString(s string) interface{} {
	if s == "" {
		return nil
	}
	return s
}

func nullableNullString(ns sql.NullString) interface{} {
	if !ns.Valid || ns.String == "" {
		return nil
	}
	return ns.String
}

func (db *DB) CreateCommand(cmd Command) error {
	tx, err := db.conn.Begin()
	if err != nil {
		return fmt.Errorf("begin tx: %w", err)
	}
	defer tx.Rollback()

	_, err = tx.Exec(
		`INSERT INTO commands (id, title, description, script_content, category_id, position, created_at, updated_at)
		 VALUES (?, ?, ?, ?, ?, COALESCE((SELECT MAX(position)+1 FROM commands WHERE category_id IS ?), 0), ?, ?)`,
		cmd.ID, nullableNullString(cmd.Title), nullableNullString(cmd.Description), cmd.ScriptContent,
		nullableString(cmd.CategoryID), nullableString(cmd.CategoryID),
		cmd.CreatedAt, cmd.UpdatedAt,
	)
	if err != nil {
		return fmt.Errorf("insert command: %w", err)
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
		return fmt.Errorf("begin tx: %w", err)
	}
	defer tx.Rollback()

	// Fetch existing command to check if category_id changed
	var oldCategoryID sql.NullString
	err = tx.QueryRow("SELECT category_id FROM commands WHERE id = ?", cmd.ID).Scan(&oldCategoryID)
	if err != nil {
		return fmt.Errorf("get existing command: %w", err)
	}

	// Determine if category changed
	oldCat := oldCategoryID.String
	newCat := cmd.CategoryID
	categoryChanged := oldCat != newCat

	// If category changed, route through UpdateCommandPosition logic
	if categoryChanged {
		// Rollback this transaction and use UpdateCommandPosition instead for the move
		tx.Rollback()

		// Use UpdateCommandPosition to handle the category move with proper reindexing
		// Append to end of new category (position = len of target category)
		if err := db.UpdateCommandPosition(cmd.ID, newCat, 999999); err != nil {
			return err
		}

		// Now open a new transaction to update the other fields
		tx, err = db.conn.Begin()
		if err != nil {
			return fmt.Errorf("begin tx after position update: %w", err)
		}
		defer tx.Rollback()
	}

	// Update all fields except category_id and position (those are handled by UpdateCommandPosition if changed)
	var updateErr error
	if categoryChanged {
		// Category already updated by UpdateCommandPosition, so skip it
		_, updateErr = tx.Exec(
			"UPDATE commands SET title = ?, description = ?, script_content = ?, updated_at = ? WHERE id = ?",
			nullableNullString(cmd.Title), nullableNullString(cmd.Description), cmd.ScriptContent, cmd.UpdatedAt, cmd.ID,
		)
	} else {
		// Category didn't change, safe to update everything
		_, updateErr = tx.Exec(
			"UPDATE commands SET title = ?, description = ?, script_content = ?, category_id = ?, updated_at = ? WHERE id = ?",
			nullableNullString(cmd.Title), nullableNullString(cmd.Description), cmd.ScriptContent, nullableString(cmd.CategoryID), cmd.UpdatedAt, cmd.ID,
		)
	}
	if updateErr != nil {
		return fmt.Errorf("update command: %w", updateErr)
	}

	// Replace tags
	if _, err := tx.Exec("DELETE FROM command_tags WHERE command_id = ?", cmd.ID); err != nil {
		return fmt.Errorf("delete old tags: %w", err)
	}
	if err := db.saveTags(tx, cmd.ID, cmd.Tags); err != nil {
		return err
	}

	// Replace variables
	if _, err := tx.Exec("DELETE FROM variable_definitions WHERE command_id = ?", cmd.ID); err != nil {
		return fmt.Errorf("delete old variables: %w", err)
	}
	if err := db.saveVariables(tx, cmd.ID, cmd.Variables); err != nil {
		return err
	}

	return tx.Commit()
}

func (db *DB) RenameCommand(id string, title string) error {
	res, err := db.conn.Exec(
		"UPDATE commands SET title = ?, updated_at = ? WHERE id = ?",
		nullableString(title), time.Now(), id,
	)
	if err != nil {
		return fmt.Errorf("rename command: %w", err)
	}
	n, _ := res.RowsAffected()
	if n == 0 {
		return fmt.Errorf("command %s not found", id)
	}
	return nil
}

func (db *DB) DeleteCommand(id string) error {
	res, err := db.conn.Exec("DELETE FROM commands WHERE id = ?", id)
	if err != nil {
		return fmt.Errorf("delete command: %w", err)
	}
	n, _ := res.RowsAffected()
	if n == 0 {
		return fmt.Errorf("command %s not found", id)
	}
	return nil
}

// UpdateCommandPosition moves a command to a new category and normalizes
// positions within the target category so they are 0-indexed with no gaps.
// newCategoryID may be empty string (uncategorized).
// newIndex is the 0-based insertion index within the target category.
func (db *DB) UpdateCommandPosition(id string, newCategoryID string, newIndex int) error {
	tx, err := db.conn.Begin()
	if err != nil {
		return fmt.Errorf("begin tx: %w", err)
	}
	defer tx.Rollback()

	// Fetch all commands in the target category, excluding the moving one
	var rows *sql.Rows
	if newCategoryID == "" {
		rows, err = tx.Query(
			"SELECT id FROM commands WHERE (category_id IS NULL OR category_id = '') AND id != ? ORDER BY position ASC",
			id,
		)
	} else {
		rows, err = tx.Query(
			"SELECT id FROM commands WHERE category_id = ? AND id != ? ORDER BY position ASC",
			newCategoryID, id,
		)
	}
	if err != nil {
		return fmt.Errorf("query commands for reorder: %w", err)
	}

	var ordered []string
	for rows.Next() {
		var rowID string
		if err := rows.Scan(&rowID); err != nil {
			rows.Close()
			return fmt.Errorf("scan id: %w", err)
		}
		ordered = append(ordered, rowID)
	}
	rows.Close()
	if err := rows.Err(); err != nil {
		return err
	}

	// Insert the moving command at newIndex (clamped to valid range)
	if newIndex < 0 {
		newIndex = 0
	}
	if newIndex > len(ordered) {
		newIndex = len(ordered)
	}
	tail := make([]string, len(ordered)-newIndex)
	copy(tail, ordered[newIndex:])
	ordered = append(ordered[:newIndex], append([]string{id}, tail...)...)

	// Write positions 0, 1, 2, … and update category
	for i, cmdID := range ordered {
		var execErr error
		if newCategoryID == "" {
			_, execErr = tx.Exec(
				"UPDATE commands SET position = ?, category_id = NULL WHERE id = ?",
				i, cmdID,
			)
		} else {
			_, execErr = tx.Exec(
				"UPDATE commands SET position = ?, category_id = ? WHERE id = ?",
				i, newCategoryID, cmdID,
			)
		}
		if execErr != nil {
			return fmt.Errorf("update position for %s: %w", cmdID, execErr)
		}
	}

	return tx.Commit()
}

func (db *DB) saveTags(tx *sql.Tx, commandID string, tags []string) error {
	for _, tag := range tags {
		tag = strings.TrimSpace(tag)
		if tag == "" {
			continue
		}
		// Upsert tag
		_, err := tx.Exec("INSERT OR IGNORE INTO tags (name) VALUES (?)", tag)
		if err != nil {
			return fmt.Errorf("upsert tag: %w", err)
		}
		// Link
		_, err = tx.Exec(
			"INSERT OR IGNORE INTO command_tags (command_id, tag_id) SELECT ?, id FROM tags WHERE name = ?",
			commandID, tag,
		)
		if err != nil {
			return fmt.Errorf("link tag: %w", err)
		}
	}
	return nil
}

func (db *DB) saveVariables(tx *sql.Tx, commandID string, vars []VariableDefinition) error {
	for i, v := range vars {
		_, err := tx.Exec(
			"INSERT INTO variable_definitions (command_id, name, description, example, default_expr, sort_order) VALUES (?, ?, ?, ?, ?, ?)",
			commandID, v.Name, v.Description, v.Example, v.Default, i,
		)
		if err != nil {
			return fmt.Errorf("insert variable %s: %w", v.Name, err)
		}
	}
	return nil
}

// ---------------------------------------------------------------------------
// Presets
// ---------------------------------------------------------------------------

func (db *DB) GetPresets(commandID string) ([]VariablePreset, error) {
	rows, err := db.conn.Query("SELECT id, name, position FROM variable_presets WHERE command_id = ? ORDER BY position, name", commandID)
	if err != nil {
		return nil, fmt.Errorf("query presets: %w", err)
	}
	defer rows.Close()

	presets := []VariablePreset{}
	for rows.Next() {
		var p VariablePreset
		if err := rows.Scan(&p.ID, &p.Name, &p.Position); err != nil {
			return nil, fmt.Errorf("scan preset: %w", err)
		}
		p.Values = map[string]string{}

		valRows, err := db.conn.Query("SELECT variable_name, value FROM preset_values WHERE preset_id = ?", p.ID)
		if err != nil {
			return nil, fmt.Errorf("query preset values: %w", err)
		}
		for valRows.Next() {
			var k, v string
			if err := valRows.Scan(&k, &v); err != nil {
				valRows.Close()
				return nil, fmt.Errorf("scan preset value: %w", err)
			}
			p.Values[k] = v
		}
		valRows.Close()
		if err := valRows.Err(); err != nil {
			return nil, err
		}

		presets = append(presets, p)
	}
	return presets, rows.Err()
}

func (db *DB) SavePreset(commandID string, preset VariablePreset) error {
	tx, err := db.conn.Begin()
	if err != nil {
		return fmt.Errorf("begin tx: %w", err)
	}
	defer tx.Rollback()

	var maxPos int
	_ = tx.QueryRow("SELECT COALESCE(MAX(position), -1) FROM variable_presets WHERE command_id = ?", commandID).Scan(&maxPos)

	_, err = tx.Exec("INSERT INTO variable_presets (id, command_id, name, position) VALUES (?, ?, ?, ?)",
		preset.ID, commandID, preset.Name, maxPos+1,
	)
	if err != nil {
		return fmt.Errorf("insert preset: %w", err)
	}

	for k, v := range preset.Values {
		_, err = tx.Exec("INSERT INTO preset_values (preset_id, variable_name, value) VALUES (?, ?, ?)",
			preset.ID, k, v,
		)
		if err != nil {
			return fmt.Errorf("insert preset value: %w", err)
		}
	}

	return tx.Commit()
}

func (db *DB) UpdatePreset(preset VariablePreset) error {
	tx, err := db.conn.Begin()
	if err != nil {
		return fmt.Errorf("begin tx: %w", err)
	}
	defer tx.Rollback()

	res, err := tx.Exec("UPDATE variable_presets SET name = ? WHERE id = ?", preset.Name, preset.ID)
	if err != nil {
		return fmt.Errorf("update preset: %w", err)
	}
	n, _ := res.RowsAffected()
	if n == 0 {
		return fmt.Errorf("preset %s not found", preset.ID)
	}

	// Replace values
	if _, err := tx.Exec("DELETE FROM preset_values WHERE preset_id = ?", preset.ID); err != nil {
		return fmt.Errorf("delete old preset values: %w", err)
	}
	for k, v := range preset.Values {
		_, err = tx.Exec("INSERT INTO preset_values (preset_id, variable_name, value) VALUES (?, ?, ?)",
			preset.ID, k, v,
		)
		if err != nil {
			return fmt.Errorf("insert preset value: %w", err)
		}
	}

	return tx.Commit()
}

func (db *DB) DeletePreset(presetID string) error {
	res, err := db.conn.Exec("DELETE FROM variable_presets WHERE id = ?", presetID)
	if err != nil {
		return fmt.Errorf("delete preset: %w", err)
	}
	n, _ := res.RowsAffected()
	if n == 0 {
		return fmt.Errorf("preset %s not found", presetID)
	}
	return nil
}

func (db *DB) ReorderPresets(commandID string, presetIDs []string) error {
	tx, err := db.conn.Begin()
	if err != nil {
		return fmt.Errorf("begin tx: %w", err)
	}
	defer tx.Rollback()

	for i, id := range presetIDs {
		if _, err := tx.Exec("UPDATE variable_presets SET position = ? WHERE id = ? AND command_id = ?", i, id, commandID); err != nil {
			return fmt.Errorf("reorder preset: %w", err)
		}
	}

	return tx.Commit()
}

// ---------------------------------------------------------------------------
// Executions
// ---------------------------------------------------------------------------

func (db *DB) GetExecutions() ([]ExecutionRecord, error) {
	rows, err := db.conn.Query(
		"SELECT id, command_id, script_content, final_cmd, output, error, exit_code, working_dir, executed_at FROM executions ORDER BY executed_at DESC",
	)
	if err != nil {
		return nil, fmt.Errorf("query executions: %w", err)
	}
	defer rows.Close()

	records := []ExecutionRecord{}
	for rows.Next() {
		var r ExecutionRecord
		if err := rows.Scan(&r.ID, &r.CommandID, &r.ScriptContent, &r.FinalCmd, &r.Output, &r.Error, &r.ExitCode, &r.WorkingDir, &r.ExecutedAt); err != nil {
			return nil, fmt.Errorf("scan execution: %w", err)
		}
		records = append(records, r)
	}
	return records, rows.Err()
}

func (db *DB) AddExecution(record ExecutionRecord) error {
	_, err := db.conn.Exec(
		"INSERT INTO executions (id, command_id, script_content, final_cmd, output, error, exit_code, working_dir, executed_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
		record.ID, record.CommandID, record.ScriptContent, record.FinalCmd, record.Output, record.Error, record.ExitCode, record.WorkingDir, record.ExecutedAt,
	)
	if err != nil {
		return fmt.Errorf("insert execution: %w", err)
	}
	return nil
}

func (db *DB) ClearExecutions() error {
	_, err := db.conn.Exec("DELETE FROM executions")
	if err != nil {
		return fmt.Errorf("clear executions: %w", err)
	}
	return nil
}

// ---------------------------------------------------------------------------
// Search
// ---------------------------------------------------------------------------

func (db *DB) SearchCommands(query string) ([]Command, error) {
	query = strings.TrimSpace(query)
	if query == "" {
		return []Command{}, nil
	}

	// Try FTS5 first
	rows, err := db.conn.Query(
		`SELECT c.id, c.title, c.description, c.script_content, c.category_id, c.position, c.created_at, c.updated_at
		 FROM commands_fts fts
		 JOIN commands c ON c.rowid = fts.rowid
		 WHERE commands_fts MATCH ?
		 ORDER BY rank`,
		query+"*",
	)
	if err != nil {
		// Fallback to LIKE search on FTS error
		return db.searchCommandsLike(query)
	}
	defer rows.Close()

	cmds := []Command{}
	for rows.Next() {
		var c Command
		var catID sql.NullString
		if err := rows.Scan(&c.ID, &c.Title, &c.Description, &c.ScriptContent, &catID, &c.Position, &c.CreatedAt, &c.UpdatedAt); err != nil {
			return nil, fmt.Errorf("scan search result: %w", err)
		}
		c.CategoryID = catID.String
		cmds = append(cmds, c)
	}
	if err := rows.Err(); err != nil {
		return db.searchCommandsLike(query)
	}

	for i := range cmds {
		if err := db.loadCommandRelations(&cmds[i]); err != nil {
			return nil, err
		}
	}
	return cmds, nil
}

func (db *DB) searchCommandsLike(query string) ([]Command, error) {
	like := "%" + query + "%"
	rows, err := db.conn.Query(
		`SELECT id, title, description, script_content, category_id, position, created_at, updated_at
		 FROM commands
		 WHERE title LIKE ? OR description LIKE ? OR script_content LIKE ?
		 ORDER BY position ASC`,
		like, like, like,
	)
	if err != nil {
		return nil, fmt.Errorf("like search: %w", err)
	}
	defer rows.Close()

	cmds := []Command{}
	for rows.Next() {
		var c Command
		var catID sql.NullString
		if err := rows.Scan(&c.ID, &c.Title, &c.Description, &c.ScriptContent, &catID, &c.Position, &c.CreatedAt, &c.UpdatedAt); err != nil {
			return nil, fmt.Errorf("scan like result: %w", err)
		}
		c.CategoryID = catID.String
		cmds = append(cmds, c)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}

	for i := range cmds {
		if err := db.loadCommandRelations(&cmds[i]); err != nil {
			return nil, err
		}
	}
	return cmds, nil
}

// ---------------------------------------------------------------------------
// Settings
// ---------------------------------------------------------------------------

func (db *DB) GetSettings() (AppSettings, error) {
	var s AppSettings
	err := db.conn.QueryRow("SELECT locale, terminal FROM app_settings LIMIT 1").Scan(&s.Locale, &s.Terminal)
	if err == sql.ErrNoRows {
		// Auto-insert defaults
		s = AppSettings{Locale: "en", Terminal: ""}
		_, err = db.conn.Exec("INSERT INTO app_settings (locale, terminal) VALUES (?, ?)", s.Locale, s.Terminal)
		if err != nil {
			return s, fmt.Errorf("insert default settings: %w", err)
		}
		return s, nil
	}
	if err != nil {
		return s, fmt.Errorf("get settings: %w", err)
	}
	return s, nil
}

func (db *DB) SetSettings(s AppSettings) error {
	_, err := db.conn.Exec("UPDATE app_settings SET locale = ?, terminal = ?", s.Locale, s.Terminal)
	if err != nil {
		return fmt.Errorf("update settings: %w", err)
	}
	return nil
}

// ResetAll deletes all user data and recreates the default settings row.
func (db *DB) ResetAll() error {
	tx, err := db.conn.Begin()
	if err != nil {
		return fmt.Errorf("begin tx: %w", err)
	}
	defer tx.Rollback()

	tables := []string{
		"preset_values",
		"variable_presets",
		"variable_definitions",
		"command_tags",
		"executions",
		"commands",
		"tags",
		"categories",
		"app_settings",
	}
	for _, t := range tables {
		if _, err := tx.Exec("DELETE FROM " + t); err != nil {
			return fmt.Errorf("clear %s: %w", t, err)
		}
	}

	if _, err := tx.Exec("INSERT INTO app_settings (locale, terminal) VALUES ('en', '')"); err != nil {
		return fmt.Errorf("insert default settings: %w", err)
	}

	if err := tx.Commit(); err != nil {
		return fmt.Errorf("commit reset: %w", err)
	}

	_, _ = db.conn.Exec("VACUUM")
	return nil
}

// ensure time import is used
var _ = time.Now
