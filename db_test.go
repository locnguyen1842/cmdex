package main

import (
	"database/sql"
	"testing"

	_ "modernc.org/sqlite"
)

func newTestDB(t *testing.T) *DB {
	t.Helper()
	conn, err := sql.Open("sqlite", ":memory:")
	if err != nil {
		t.Fatalf("open memory db: %v", err)
	}
	return &DB{conn: conn}
}

func TestFreshDBMigrations(t *testing.T) {
	db := newTestDB(t)
	defer db.Close()

	if err := db.runMigrations(); err != nil {
		t.Fatalf("runMigrations failed: %v", err)
	}

	var version int
	if err := db.conn.QueryRow("SELECT version FROM schema_version LIMIT 1").Scan(&version); err != nil {
		t.Fatalf("query schema_version: %v", err)
	}
	if version != 9 {
		t.Errorf("schema_version = %d, want 9", version)
	}

	expectedTables := []string{
		"categories", "commands", "tags", "command_tags",
		"variable_definitions", "variable_presets", "preset_values",
		"executions", "app_settings", "schema_version",
	}
	for _, table := range expectedTables {
		var name string
		err := db.conn.QueryRow(
			"SELECT name FROM sqlite_master WHERE type='table' AND name=?",
			table,
		).Scan(&name)
		if err != nil {
			t.Errorf("expected table %q not found: %v", table, err)
		}
	}
}

func TestExistingDBIdempotent(t *testing.T) {
	db := newTestDB(t)
	defer db.Close()

	// Seed schema_version to 9 without creating tables
	if _, err := db.conn.Exec("CREATE TABLE schema_version (version INTEGER NOT NULL)"); err != nil {
		t.Fatalf("create schema_version: %v", err)
	}
	if _, err := db.conn.Exec("INSERT INTO schema_version (version) VALUES (9)"); err != nil {
		t.Fatalf("insert schema_version: %v", err)
	}

	if err := db.runMigrations(); err != nil {
		t.Fatalf("runMigrations on existing db failed: %v", err)
	}

	var version int
	if err := db.conn.QueryRow("SELECT version FROM schema_version LIMIT 1").Scan(&version); err != nil {
		t.Fatalf("query schema_version: %v", err)
	}
	if version != 9 {
		t.Errorf("schema_version = %d, want 9", version)
	}
}

func TestRollbackTo(t *testing.T) {
	db := newTestDB(t)
	defer db.Close()

	if err := db.runMigrations(); err != nil {
		t.Fatalf("runMigrations failed: %v", err)
	}

	if err := db.RollbackTo(5); err != nil {
		t.Fatalf("RollbackTo(5) failed: %v", err)
	}

	var version int
	if err := db.conn.QueryRow("SELECT version FROM schema_version LIMIT 1").Scan(&version); err != nil {
		t.Fatalf("query schema_version: %v", err)
	}
	if version != 5 {
		t.Errorf("schema_version = %d, want 5", version)
	}

	// Verify core tables still exist after partial rollback
	expectedTables := []string{
		"categories", "commands", "tags", "command_tags",
		"variable_definitions", "variable_presets", "preset_values",
		"executions", "app_settings", "schema_version",
	}
	for _, table := range expectedTables {
		var name string
		err := db.conn.QueryRow(
			"SELECT name FROM sqlite_master WHERE type='table' AND name=?",
			table,
		).Scan(&name)
		if err != nil {
			t.Errorf("expected table %q not found after rollback: %v", table, err)
		}
	}
}
