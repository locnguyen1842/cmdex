package migrations

import (
	"database/sql"
	"fmt"
)

var migration0002 = Migration{
	Version:     2,
	Description: "commands: category_id SET NULL, nullable",
	Up: func(tx *sql.Tx) error {
		stmts := []string{
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
			`UPDATE commands SET category_id = NULL WHERE category_id = ''`,
			`INSERT INTO commands_fts(commands_fts) VALUES('rebuild')`,
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
		for _, s := range stmts {
			if _, err := tx.Exec(s); err != nil {
				return fmt.Errorf("migration 0002 up: %w", err)
			}
		}
		return nil
	},
	Down: func(tx *sql.Tx) error {
		// Reverse: recreate commands with original REFERENCES categories(id) ON DELETE CASCADE
		// and category_id NOT NULL; set NULL back to empty string; rebuild FTS + triggers
		stmts := []string{
			`CREATE TABLE IF NOT EXISTS commands_new (
				id TEXT PRIMARY KEY,
				title TEXT NOT NULL,
				description TEXT NOT NULL DEFAULT '',
				script_content TEXT NOT NULL,
				category_id TEXT NOT NULL DEFAULT '',
				created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
				updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
				FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE CASCADE
			)`,
			`INSERT INTO commands_new SELECT id, title, description, script_content,
				COALESCE(category_id, ''), created_at, updated_at FROM commands`,
			`DROP TABLE commands`,
			`ALTER TABLE commands_new RENAME TO commands`,
			`INSERT INTO commands_fts(commands_fts) VALUES('rebuild')`,
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
		for _, s := range stmts {
			if _, err := tx.Exec(s); err != nil {
				return fmt.Errorf("migration 0002 down: %w", err)
			}
		}
		return nil
	},
}
