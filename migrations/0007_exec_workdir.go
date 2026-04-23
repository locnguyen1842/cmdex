package migrations

import (
	"database/sql"
	"fmt"
)

var migration0007 = Migration{
	Version:     7,
	Description: "executions: add working_dir column",
	Up: func(tx *sql.Tx) error {
		_, err := tx.Exec(`ALTER TABLE executions ADD COLUMN working_dir TEXT DEFAULT ''`)
		if err != nil {
			return fmt.Errorf("migration 0007 up: %w", err)
		}
		return nil
	},
	Down: func(tx *sql.Tx) error {
		// modernc.org/sqlite v1.47.0 bundles SQLite 3.48.x; DROP COLUMN available since 3.35.0
		_, err := tx.Exec(`ALTER TABLE executions DROP COLUMN working_dir`)
		if err != nil {
			return fmt.Errorf("migration 0007 down: %w", err)
		}
		return nil
	},
}
