# Testing Patterns

**Analysis Date:** 2026-04-08

## Test Framework

**Runner:**

- **Not detected** for Go or frontend. There is no `vitest`, `jest`, `@testing-library`, or Go `testing` usage in application source.

**Assertion library:**

- Not applicable until a runner is added.

**Run commands (current verification, not tests):**

```bash
make check              # go build ./... && cd frontend && pnpm tsc --noEmit
go build ./...          # compile all packages (root module)
cd frontend && pnpm tsc --noEmit   # TypeScript type-check only
```

CI (`.github/workflows/ci.yml`) runs `go build ./...`, `pnpm tsc --noEmit`, and a Wails matrix build via `dAppCore/build/actions/build/wails2@v4.0.0` — **no `go test` or frontend test script**.

## Test File Organization

**Location:**

- No `*_test.go` files under the repo root.
- No `*.test.ts`, `*.test.tsx`, `*.spec.ts`, or `*.spec.tsx` under `frontend/src`.

**Naming:**

- When adding Go tests: place `*_test.go` alongside the file under test (e.g. `script_test.go` next to `script.go`).
- When adding frontend tests: common choices are co-located `ComponentName.test.tsx` or a `frontend/src/__tests__/` tree — neither exists yet.

## Test Structure

**Suite organization:**

- Not applicable — no test suites present.

**Patterns to adopt (recommended):**

- **Go:** Use table-driven tests for `script.go` (`GenerateScript`, `ExtractTemplateVars`, `ReplaceTemplateVars`) and `db.go` migration logic with `t.TempDir()` and isolated SQLite files.
- **React:** If adding Vitest + React Testing Library, colocate tests with components and mock Wails bindings by substituting imports from `frontend/wailsjs/go/main/App` (or inject a small adapter layer first).

## Mocking

**Framework:** None configured.

**What to mock (when tests are added):**

- **Wails bindings:** `GetCategories`, `RunCommand`, etc. from `frontend/wailsjs/go/main/App` — mock at module boundary or wrap in a thin `api` module that tests can replace.
- **Wails events:** `EventsOn` from `frontend/wailsjs/runtime/runtime` in UI tests.
- **Go:** Use `httptest`/interfaces sparingly; for `Executor`, consider an interface for `os/exec` or test pure functions (`BuildFinalCommand`, template helpers) without subprocess.

**What NOT to mock:**

- Prefer real SQLite against a temp file for integration-style DB tests in `db.go` (fast and representative for this app).

## Fixtures and Factories

**Test data:**

- Not present. For future Go tests, construct `Command`, `Category`, and `VariableDefinition` literals matching `models.go`.

**Location:**

- N/A — introduce `testdata/` or helpers inside `*_test.go` as needed.

## Coverage

**Requirements:** None enforced; no coverage tooling in `Makefile` or CI.

**View coverage (after adding tests):**

```bash
go test ./... -coverprofile=coverage.out && go tool cover -html=coverage.out
# Frontend (example if Vitest is added):
# cd frontend && pnpm vitest run --coverage
```

## Test Types

**Unit tests:**

- **Go:** Not present. Highest value: `script.go`, pure helpers in `executor.go`, and validation-style logic.
- **Frontend:** Not present. Highest value: `frontend/src/utils/tabDraft.ts`, `frontend/src/utils/templateVars.ts`, `frontend/src/lib/shortcuts.ts`.

**Integration tests:**

- Not present. Reasonable target: DB round-trips in `db.go` with migrations on a fresh DB file.

**E2E tests:**

- Not used (no Playwright/Cypress/Spectron in `frontend/package.json`).

## Common Patterns

**Async testing:**

- N/A until frontend test runner exists; prefer `async` Vitest tests with `userEvent` if adopting Testing Library.

**Error testing:**

- For Go, use `if err != nil` checks with `t.Fatalf` / `errors.Is` once `_test.go` files exist.

---

*Testing analysis: 2026-04-08*
