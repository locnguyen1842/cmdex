---
name: todo-scanner
description: "Scans the todos/ folder for *.pending.md files and creates implementation plans from their content using the writing-plans workflow. Use this skill whenever the user mentions checking todos, scanning pending tasks, reviewing todo files, processing pending items, or wants to plan work from markdown todo files. Also triggers on phrases like 'what's pending', 'any todos', 'plan my tasks', or 'work on todos'."
---

# Todo Scanner

Scan the project's `todos/` directory for markdown files with the `*.pending.md` naming convention, create implementation plans for their content, and mark them as resolved after execution is complete.

**Announce at start:** "Using todo-scanner to check for pending tasks in `todos/`."

## Workflow

### Step 1: Scan for pending files

Search `todos/` (relative to project root) for files matching `*.pending.md`. Use glob or ls:

```bash
ls todos/*.pending.md 2>/dev/null
```

**If none found:** Tell the user — "No pending todo files found in `todos/`. Create a file like `todos/my-task.pending.md` to get started." Then stop.

**If `*.resolved.md` files also exist:** Mention how many previous todos have been completed, for context.

### Step 2: Present findings and let user choose

List all `*.pending.md` files with a brief preview (first 3-5 lines) of each. Ask the user which file(s) they want to work on.

If only one pending file exists, show its preview and confirm: "This is the only pending task. Want to plan and work on it?"

### Step 3: Read and analyze the selected todo

Read the full content of the selected `*.pending.md` file. The content may be:

- **Freeform:** Plain text, bullet points, rough notes describing the task
- **Structured:** Sections with title, description, acceptance criteria, etc.

Either format works. Extract the core task requirements regardless of structure. If the content is ambiguous or underspecified, ask the user for clarification before proceeding to planning.

### Step 4: Create implementation plan

Use the **writing-plans** skill to create a detailed implementation plan based on the todo content.

- Treat the todo content as the spec/requirements input
- Ensure the output directory exists: `mkdir -p docs/superpowers/plans/`
- Save the plan to `docs/superpowers/plans/YYYY-MM-DD-<todo-name>.md` (derive `<todo-name>` from the pending filename, e.g., `fix-preset-preview.pending.md` → `fix-preset-preview`)
- Follow writing-plans conventions (bite-sized tasks, frequent commits). If the project has no test infrastructure yet, adapt TDD steps to manual verification or skip test steps — match the project's current state.
- In the plan header, note the source: `**Source:** todos/<filename>.pending.md`

**Important:** The plan's final task MUST be a "Mark todo resolved" step that renames the source file (see Step 6). This ensures the rename happens as part of normal plan execution flow.

### Step 5: Execute the plan

After the plan is written, offer execution options per the writing-plans handoff:

1. **Subagent-Driven** (recommended) — dispatch a fresh subagent per task, review between tasks
2. **Inline Execution** — execute tasks in the current session with checkpoints

### Step 6: Mark as resolved

The plan's final task should contain this step. It runs **only after all implementation tasks are complete:**

1. First, prepend the resolution header to the pending file:
```markdown
<!-- Resolved: YYYY-MM-DD | Plan: docs/superpowers/plans/YYYY-MM-DD-<name>.md -->
```
2. Then rename:
```bash
git mv todos/<name>.pending.md todos/<name>.resolved.md
```
(Use `git mv` so the rename is tracked. Fall back to plain `mv` if not in a git repo.)

**Do NOT rename before execution is complete.** The rename is the signal that the work described in the todo has been fully implemented.

**If a plan is abandoned:** Leave the file as `*.pending.md`. It can be picked up again in a future session.

**If `<name>.resolved.md` already exists (collision):** Do NOT use `git mv` — it will fail. Instead:
1. Append the full content of `todos/<name>.pending.md` (including its resolution header) to the existing `todos/<name>.resolved.md`
2. Delete the pending file: `rm todos/<name>.pending.md`
3. Stage changes: run `git add todos/<name>.resolved.md` unconditionally, then check if inside a git repo (`git rev-parse --is-inside-work-tree`) and only if true run `git rm --quiet --ignore-unmatch todos/<name>.pending.md` to clean up the index (safe even if the file is already deleted); outside git, skip this step

This avoids leaving the `*.pending.md` file in place and prevents `git mv` from erroring on an existing target.

## File Naming Convention

| State | Pattern | Example |
|-------|---------|---------|
| Pending | `todos/<name>.pending.md` | `todos/fix-preset-preview.pending.md` |
| Resolved | `todos/<name>.resolved.md` | `todos/fix-preset-preview.resolved.md` |

Names should be kebab-case and descriptive of the task.

## Checklist

- [ ] Scan `todos/` for `*.pending.md` files
- [ ] Present found files to user for selection
- [ ] Read and understand the selected todo content
- [ ] Create implementation plan using writing-plans skill
- [ ] Execute the plan (subagent-driven or inline)
- [ ] Rename `*.pending.md` → `*.resolved.md` after full completion
