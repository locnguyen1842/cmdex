package migrations

import "database/sql"

// Migration represents a single versioned schema change.
type Migration struct {
	// Version is the schema_version value after this migration is applied.
	// Values skip 4 (combined into 5) matching the original monolith.
	Version     int
	Description string
	// DisableFKDuringMigration signals that the runner must issue
	// PRAGMA foreign_keys = OFF on the raw connection before beginning
	// the transaction for this migration. Only migration0005 sets this true.
	DisableFKDuringMigration bool
	Up                       func(tx *sql.Tx) error
	Down                     func(tx *sql.Tx) error
}

// Migrations is the ordered list of all schema changes.
// The Phase 9 runner iterates this slice in order.
// NOTE: index 3 (version 5) follows index 2 (version 3) — version 4 was
// intentionally combined into version 5. Runner must compare Migration.Version,
// NOT assume +1 increments.
var Migrations = []Migration{
	migration0001,
	migration0002,
	migration0003,
	migration0005,
	migration0006,
	migration0007,
	migration0008,
	migration0009,
	migration0010,
}
