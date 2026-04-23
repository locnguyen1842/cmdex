package migrations

import (
	"database/sql"
	"fmt"
)

var migration0003 = Migration{
	Version:     3,
	Description: "commands: add position column",
	Up: func(tx *sql.Tx) error {
		stmts := []string{
			`ALTER TABLE commands ADD COLUMN position INTEGER NOT NULL DEFAULT 0`,
			`UPDATE commands SET position = rowid`,
		}
		for _, s := range stmts {
			if _, err := tx.Exec(s); err != nil {
				return fmt.Errorf("migration 0003 up: %w", err)
			}
		}
		return nil
	},
	Down: func(tx *sql.Tx) error {
		// modernc.org/sqlite v1.47.0 bundles SQLite 3.48.x; DROP COLUMN available since 3.35.0
		_, err := tx.Exec(`ALTER TABLE commands DROP COLUMN position`)
		if err != nil {
			return fmt.Errorf("migration 0003 down: %w", err)
		}
		return nil
	},
}
