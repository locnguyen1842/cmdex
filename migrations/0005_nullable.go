package migrations

import (
	"database/sql"
	"fmt"
)

var migration0005 = Migration{
	Version:                  5,
	Description:              "commands: title/description nullable (FK off during table recreation)",
	DisableFKDuringMigration: true,
	Up: func(tx *sql.Tx) error {
		stmts := []string{
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
			`INSERT INTO commands_fts(commands_fts) VALUES('rebuild')`,
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
		for _, s := range stmts {
			if _, err := tx.Exec(s); err != nil {
				return fmt.Errorf("migration 0005 up: %w", err)
			}
		}
		return nil
	},
	Down: func(tx *sql.Tx) error {
		// Reverse: commands.title NOT NULL DEFAULT '', description NOT NULL DEFAULT ''
		// Also requires FK disabled (DisableFKDuringMigration covers both directions)
		stmts := []string{
			`CREATE TABLE IF NOT EXISTS commands_new (
				id TEXT PRIMARY KEY,
				title TEXT NOT NULL DEFAULT '',
				description TEXT NOT NULL DEFAULT '',
				script_content TEXT NOT NULL,
				category_id TEXT DEFAULT NULL,
				position INTEGER NOT NULL DEFAULT 0,
				created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
				updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
				FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE SET NULL
			)`,
			`INSERT INTO commands_new SELECT id,
				COALESCE(title, ''), COALESCE(description, ''),
				script_content, category_id, position, created_at, updated_at
				FROM commands`,
			`DROP TABLE commands`,
			`ALTER TABLE commands_new RENAME TO commands`,
			`INSERT INTO commands_fts(commands_fts) VALUES('rebuild')`,
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
		for _, s := range stmts {
			if _, err := tx.Exec(s); err != nil {
				return fmt.Errorf("migration 0005 down: %w", err)
			}
		}
		return nil
	},
}
