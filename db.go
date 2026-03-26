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
