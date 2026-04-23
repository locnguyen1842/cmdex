package migrations

import (
	"database/sql"
	"fmt"
)

var migration0006 = Migration{
	Version:     6,
	Description: "variable_presets: add position column",
	Up: func(tx *sql.Tx) error {
		stmts := []string{
			`ALTER TABLE variable_presets ADD COLUMN position INTEGER NOT NULL DEFAULT 0`,
			`UPDATE variable_presets SET position = rowid`,
		}
		for _, s := range stmts {
			if _, err := tx.Exec(s); err != nil {
				return fmt.Errorf("migration 0006 up: %w", err)
			}
		}
		return nil
	},
	Down: func(tx *sql.Tx) error {
		_, err := tx.Exec(`ALTER TABLE variable_presets DROP COLUMN position`)
		if err != nil {
			return fmt.Errorf("migration 0006 down: %w", err)
		}
		return nil
	},
}
