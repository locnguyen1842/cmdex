package migrations

import (
	"database/sql"
	"encoding/json"
	"fmt"
)

// settingsV9 mirrors AppSettings fields present at v8 schema (before v9 migration).
// Do NOT import package main — circular import. WindowX/Y/Width/Height omitted
// (those fields were added to AppSettings in models.go after the v9 migration).
type settingsV9 struct {
	Locale         string `json:"locale"`
	Terminal       string `json:"terminal"`
	Theme          string `json:"theme"`
	LastDarkTheme  string `json:"lastDarkTheme"`
	LastLightTheme string `json:"lastLightTheme"`
	CustomThemes   string `json:"customThemes"`
	UIFont         string `json:"uiFont"`
	MonoFont       string `json:"monoFont"`
	Density        string `json:"density"`
}

var migration0009 = Migration{
	Version:     9,
	Description: "app_settings: replace columnar schema with single JSON column",
	Up: func(tx *sql.Tx) error {
		// Read existing row to preserve values
		var locale, terminal, theme, lastDarkTheme, lastLightTheme, customThemes, uiFont, monoFont, density string
		err := tx.QueryRow(`SELECT locale, terminal, theme, last_dark_theme, last_light_theme,
			custom_themes, ui_font, mono_font, density FROM app_settings LIMIT 1`).
			Scan(&locale, &terminal, &theme, &lastDarkTheme, &lastLightTheme,
				&customThemes, &uiFont, &monoFont, &density)
		hasRow := err == nil

		stmts := []string{
			`DROP TABLE app_settings`,
			`CREATE TABLE app_settings (data TEXT NOT NULL DEFAULT '{}')`,
		}
		for _, s := range stmts {
			if _, err := tx.Exec(s); err != nil {
				return fmt.Errorf("migration 0009 up: %w", err)
			}
		}

		// Re-insert existing data as JSON, or insert defaults
		s := settingsV9{
			Locale: "en", Terminal: "", Theme: "vscode-dark",
			LastDarkTheme: "vscode-dark", LastLightTheme: "vscode-light",
			CustomThemes: "[]", UIFont: "Inter", MonoFont: "JetBrains Mono", Density: "comfortable",
		}
		if hasRow {
			s = settingsV9{
				Locale: locale, Terminal: terminal, Theme: theme,
				LastDarkTheme: lastDarkTheme, LastLightTheme: lastLightTheme,
				CustomThemes: customThemes, UIFont: uiFont, MonoFont: monoFont, Density: density,
			}
		}
		data, err := json.Marshal(s)
		if err != nil {
			return fmt.Errorf("migration 0009 marshal: %w", err)
		}
		if _, err := tx.Exec(`INSERT INTO app_settings (data) VALUES (?)`, string(data)); err != nil {
			return fmt.Errorf("migration 0009 insert: %w", err)
		}
		return nil
	},
	Down: func(tx *sql.Tx) error {
		// Read JSON from current app_settings
		var raw string
		err := tx.QueryRow(`SELECT data FROM app_settings LIMIT 1`).Scan(&raw)
		hasRow := err == nil

		// Build defaults; unmarshal if row exists
		s := settingsV9{
			Locale: "en", Terminal: "", Theme: "vscode-dark",
			LastDarkTheme: "vscode-dark", LastLightTheme: "vscode-light",
			CustomThemes: "[]", UIFont: "Inter", MonoFont: "JetBrains Mono", Density: "comfortable",
		}
		if hasRow {
			_ = json.Unmarshal([]byte(raw), &s)
		}

		// Recreate columnar v8 schema
		stmts := []string{
			`DROP TABLE app_settings`,
			`CREATE TABLE app_settings (locale TEXT NOT NULL DEFAULT 'en', terminal TEXT NOT NULL DEFAULT '')`,
			`ALTER TABLE app_settings ADD COLUMN theme TEXT NOT NULL DEFAULT 'vscode-dark'`,
			`ALTER TABLE app_settings ADD COLUMN last_dark_theme TEXT NOT NULL DEFAULT 'vscode-dark'`,
			`ALTER TABLE app_settings ADD COLUMN last_light_theme TEXT NOT NULL DEFAULT 'vscode-light'`,
			`ALTER TABLE app_settings ADD COLUMN custom_themes TEXT NOT NULL DEFAULT '[]'`,
			`ALTER TABLE app_settings ADD COLUMN ui_font TEXT NOT NULL DEFAULT 'Inter'`,
			`ALTER TABLE app_settings ADD COLUMN mono_font TEXT NOT NULL DEFAULT 'JetBrains Mono'`,
			`ALTER TABLE app_settings ADD COLUMN density TEXT NOT NULL DEFAULT 'comfortable'`,
		}
		for _, stmt := range stmts {
			if _, err := tx.Exec(stmt); err != nil {
				return fmt.Errorf("migration 0009 down: %w", err)
			}
		}

		if _, err := tx.Exec(
			`INSERT INTO app_settings (locale, terminal, theme, last_dark_theme, last_light_theme,
				custom_themes, ui_font, mono_font, density)
			VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
			s.Locale, s.Terminal, s.Theme, s.LastDarkTheme, s.LastLightTheme,
			s.CustomThemes, s.UIFont, s.MonoFont, s.Density,
		); err != nil {
			return fmt.Errorf("migration 0009 down insert: %w", err)
		}
		return nil
	},
}
