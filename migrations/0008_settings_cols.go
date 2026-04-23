package migrations

import (
	"database/sql"
	"fmt"
)

var migration0008 = Migration{
	Version:     8,
	Description: "app_settings: add theme/font/density columns",
	Up: func(tx *sql.Tx) error {
		stmts := []string{
			`ALTER TABLE app_settings ADD COLUMN theme TEXT NOT NULL DEFAULT 'vscode-dark'`,
			`ALTER TABLE app_settings ADD COLUMN last_dark_theme TEXT NOT NULL DEFAULT 'vscode-dark'`,
			`ALTER TABLE app_settings ADD COLUMN last_light_theme TEXT NOT NULL DEFAULT 'vscode-light'`,
			`ALTER TABLE app_settings ADD COLUMN custom_themes TEXT NOT NULL DEFAULT '[]'`,
			`ALTER TABLE app_settings ADD COLUMN ui_font TEXT NOT NULL DEFAULT 'Inter'`,
			`ALTER TABLE app_settings ADD COLUMN mono_font TEXT NOT NULL DEFAULT 'JetBrains Mono'`,
			`ALTER TABLE app_settings ADD COLUMN density TEXT NOT NULL DEFAULT 'comfortable'`,
		}
		for _, s := range stmts {
			if _, err := tx.Exec(s); err != nil {
				return fmt.Errorf("migration 0008 up: %w", err)
			}
		}
		return nil
	},
	Down: func(tx *sql.Tx) error {
		stmts := []string{
			`ALTER TABLE app_settings DROP COLUMN theme`,
			`ALTER TABLE app_settings DROP COLUMN last_dark_theme`,
			`ALTER TABLE app_settings DROP COLUMN last_light_theme`,
			`ALTER TABLE app_settings DROP COLUMN custom_themes`,
			`ALTER TABLE app_settings DROP COLUMN ui_font`,
			`ALTER TABLE app_settings DROP COLUMN mono_font`,
			`ALTER TABLE app_settings DROP COLUMN density`,
		}
		for _, s := range stmts {
			if _, err := tx.Exec(s); err != nil {
				return fmt.Errorf("migration 0008 down: %w", err)
			}
		}
		return nil
	},
}
