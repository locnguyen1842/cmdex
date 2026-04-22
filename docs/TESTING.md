<!-- generated-by: gsd-doc-writer -->

# Testing Guide

This document covers the current testing status, manual testing workflows, and a roadmap for introducing automated tests in the Cmdex project.

## 1. Current Testing Status

**Cmdex currently has no automated tests.**

- **Go backend:** No `*_test.go` files exist in the repository.
- **Frontend:** No `.test.ts`, `.spec.ts`, or `.test.tsx` files exist in `frontend/src/`.
- **Scripts:** `frontend/package.json` does not define any test scripts (e.g., `test`, `test:unit`).
- **CI:** The GitHub Actions workflows (`.github/workflows/ci.yml`) perform build checks and TypeScript type checking but do not run any test suites.

Verification is currently done entirely through manual QA and static analysis (`go build ./...` and `pnpm tsc --noEmit`).

## 2. Manual Testing Guide

### Running the Application

Start the development server with hot-reload for the frontend:

```bash
wails3 dev
# or
make dev
# or
task dev
```

Build a production binary:

```bash
wails3 build
# or
make build
# or
task build
```

### Static Checks

Before committing, run the static checks that mirror CI:

```bash
# Go compile check
go build ./...

# TypeScript type check
cd frontend && pnpm tsc --noEmit
```

### Manual QA Workflow

1. Start the app with `wails3 dev`.
2. Reset all data via the UI (or delete `~/.cmdex/cmdex.db`) to test a fresh install state.
3. Exercise the features in the checklist below.
4. Test on your target platform (macOS, Linux, or Windows), as terminal integration and shell execution vary by OS.

## 3. Planned Testing Strategy

The project is structured to support three layers of automated testing:

### Go Unit & Integration Tests

Use Go's built-in `testing` package and standard `reflect.DeepEqual` (or `github.com/google/go-cmp`) for assertions.

**Priority targets:**

| Module | File | Why test |
|--------|------|----------|
| Script parsing | `script.go` | Pure functions (`ExtractTemplateVars`, `ReplaceTemplateVars`, `MergeDetectedVars`, `ParseScriptBody`) are deterministic and easy to unit test. |
| Executor logic | `executor.go` | `EvalDefaults` (CEL expression evaluation), `BuildDisplayCommand`, `BuildFinalCommand`, and terminal-def selection logic. |
| Database layer | `db.go` | CRUD operations, migrations, and FTS search. Use a temporary SQLite file or `:memory:` database in tests. |
| Service layer | `*_service.go` | Thin wrappers around `db` methods; test input validation and error handling. |

**Example test file pattern:**

```go
// script_test.go
package main

import "testing"

func TestExtractTemplateVars(t *testing.T) {
    got := ExtractTemplateVars("echo {{greeting}} {{name}}")
    want := []string{"greeting", "name"}
    // assert equality
}
```

Run Go tests:

```bash
go test ./...
```

### Frontend Unit Tests

The frontend uses **React 19**, **Vite**, and **TypeScript**. The recommended test stack is **Vitest** (aligns with Vite) plus **React Testing Library**.

**Priority targets:**

| Module | File | Why test |
|--------|------|----------|
| Template variables | `frontend/src/utils/templateVars.ts` | Pure functions (`extractTemplateVarNames`, `mergeDetectedVariables`, `buildVariablesFromScript`). |
| Tab draft utilities | `frontend/src/utils/tabDraft.ts` | `draftsEqual`, `cloneDraft`, `draftFromCommand` contain core state logic. |
| Type utilities | `frontend/src/types.ts` | `getCommandDisplayTitle` and other data transforms. |

**Suggested devDependencies to add:**

```bash
cd frontend
pnpm add -D vitest @testing-library/react @testing-library/jest-dom jsdom
```

Then add a `test` script to `frontend/package.json`:

```json
"scripts": {
  "test": "vitest run",
  "test:watch": "vitest"
}
```

### E2E / Integration Tests

End-to-end testing for a Wails v3 desktop app is more involved because the runtime requires a native webview.

**Recommended approach (incremental):**

1. **Backend integration tests:** Test the full Go stack (DB -> Services) without the UI by calling service methods directly in `*_test.go` files.
2. **Frontend component tests:** Mount key components (e.g., `CommandDetail`, `VariablePrompt`) with mocked Wails bindings.
3. **E2E (future):** Evaluate <!-- VERIFY: Wails v3 E2E tooling or Playwright with a server-mode build --> if native E2E becomes necessary.

## 4. Testing Checklist for Common Features

Use this checklist during manual QA before a release.

### Categories

- [ ] Create a new category.
- [ ] Edit a category name and color.
- [ ] Delete a category; verify its commands become uncategorized.

### Commands

- [ ] Create a command with a title, description, tags, and script body.
- [ ] Verify `{{variable}}` syntax is auto-detected in the script body.
- [ ] Save the command and confirm it appears in the sidebar.
- [ ] Edit an existing command and save changes.
- [ ] Delete a command and confirm it disappears from the sidebar and tabs.
- [ ] Reorder commands via drag-and-drop within a category.
- [ ] Move a command to a different category via drag-and-drop.

### Variables & Execution

- [ ] Define variables with descriptions, examples, and default values.
- [ ] Test CEL default expressions: `now()`, `env("HOME")`, `date("2006-01-02")`.
- [ ] Run a command inline; verify stdout/stderr appear in the Output pane.
- [ ] Verify exit codes are captured (0 for success, non-zero for failure).
- [ ] Run a command in an external terminal; verify the terminal opens and executes.
- [ ] Confirm execution history is saved and visible in the History pane.

### Variable Presets

- [ ] Create a preset from the current variable values.
- [ ] Apply a preset and verify fields populate correctly.
- [ ] Rename a preset.
- [ ] Delete a preset.
- [ ] Reorder presets via drag-and-drop.

### Settings

- [ ] Switch themes (dark, light, custom) and verify CSS variables update.
- [ ] Change UI font and monospace font; verify font family changes.
- [ ] Switch density (compact, comfortable, spacious) and verify spacing.
- [ ] Change locale/language and verify UI strings reload.
- [ ] Open the Settings window from the menu and close it; reopen without errors.
- [ ] Restart the app and confirm all settings persist.

### Search & Command Palette

- [ ] Use the command palette (`Cmd/Ctrl + P`) to find and open a command.
- [ ] Use the sidebar search to filter commands by title or content.
- [ ] Verify full-text search (FTS5) returns relevant results.

### UI / Edge Cases

- [ ] Open a new command tab; verify the dirty indicator appears after editing.
- [ ] Close a dirty tab and confirm the discard/save prompt appears.
- [ ] Switch between tabs and verify output/history pane state is restored.
- [ ] Use keyboard shortcuts (e.g., `Cmd/Ctrl + Enter` to run, `Cmd/Ctrl + S` to save).
- [ ] Resize the window and verify minimum dimensions are respected.

## 5. How to Add Tests

### Adding a Go Unit Test

1. Create a file named `<module>_test.go` in the same package (e.g., `script_test.go` next to `script.go`).
2. Write table-driven tests for pure functions.
3. For DB tests, initialize `DB` with a temporary path or `:memory:` SQLite connection, then call `migrate()`.
4. Run the test:

```bash
go test ./... -v
go test -run TestExtractTemplateVars ./...
```

### Adding a Frontend Unit Test

1. Install Vitest and Testing Library if not already present:

```bash
cd frontend
pnpm add -D vitest @testing-library/react @testing-library/jest-dom jsdom
```

2. Create `frontend/src/utils/templateVars.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { extractTemplateVarNames } from './templateVars';

describe('extractTemplateVarNames', () => {
  it('detects unique variables in order', () => {
    expect(extractTemplateVarNames('echo {{name}} {{name}}')).toEqual(['name']);
  });
});
```

3. Add a `test` script to `frontend/package.json`:

```json
"scripts": {
  "test": "vitest run",
  "test:watch": "vitest"
}
```

4. Run the tests:

```bash
cd frontend && pnpm test
```

### Updating CI to Run Tests

Add test steps to `.github/workflows/ci.yml` after the existing build/typecheck jobs:

```yaml
- name: Go tests
  run: go test ./...

- name: Frontend tests
  run: cd frontend && pnpm test
```

For the `build-check` job, you may also want to run `go test ./...` on each OS matrix to catch platform-specific behavior in `executor.go`.
