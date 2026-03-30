# Rename Commamer to Cmdex - Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rename the project from "Commamer" to "Cmdex" across all code, config, docs, and branding assets, plus generate 3 SVG logo concepts.

**Architecture:** String replacement across Go backend, React frontend, config files, and documentation. SVG logo generation for 3 concepts (Terminal Prompt Monogram, Command Codex Card, Cmd Diamond). No data migration.

**Tech Stack:** Go, React/TypeScript, SVG, Wails v2

---

### Task 1: Rename Go Backend References

**Files:**
- Modify: `main.go:24,25,31,34,50`
- Modify: `db.go:131,136`
- Modify: `executor.go:51`
- Modify: `go.mod:1`

- [ ] **Step 1: Update main.go menu labels and window title**

Replace all "Commamer" references in `main.go`:

```go
// Line 24: menu submenu name
firstMenu := appMenu.AddSubmenu("Cmdex")
// Line 25: about label
firstMenu.AddText("About Cmdex", nil, nil)
// Line 31: hide label
firstMenu.AddText("Hide Cmdex", keys.CmdOrCtrl("h"), nil)
// Line 34: quit label
firstMenu.AddText("Quit Cmdex", keys.CmdOrCtrl("q"), func(_ *menu.CallbackData) {
// Line 50: window title
Title:     "Cmdex",
```

- [ ] **Step 2: Update db.go data directory and database name**

In `db.go`, change lines 131 and 136:

```go
// Line 131: change .commamer to .cmdex
dataDir := filepath.Join(homeDir, ".cmdex")
// Line 136: change commamer.db to cmdex.db
dbPath := filepath.Join(dataDir, "cmdex.db")
```

- [ ] **Step 3: Update executor.go temp file pattern**

In `executor.go`, change line 51:

```go
f, err := os.CreateTemp("", "cmdex-*.sh")
```

- [ ] **Step 4: Update go.mod module name**

In `go.mod`, change line 1:

```
module cmdex
```

- [ ] **Step 5: Verify Go compiles**

Run: `cd /Users/mac/Documents/Projects/Others/commamer && go build ./...`
Expected: Build succeeds with no errors.

- [ ] **Step 6: Commit**

```bash
git add main.go db.go executor.go go.mod
git commit -m "refactor: rename Go backend references from Commamer to Cmdex"
```

---

### Task 2: Rename Frontend References

**Files:**
- Modify: `frontend/index.html:6`
- Modify: `frontend/src/App.tsx:437`
- Modify: `frontend/src/components/HistoryPane.tsx:45`
- Modify: `frontend/src/components/Sidebar.tsx:39`
- Modify: `frontend/src/locales/en.json:114`

- [ ] **Step 1: Update index.html title**

In `frontend/index.html`, change:

```html
<title>Cmdex</title>
```

- [ ] **Step 2: Update App.tsx localStorage key**

In `frontend/src/App.tsx`, change line 437:

```tsx
storageKey="cmdex-sidebar"
```

- [ ] **Step 3: Update HistoryPane.tsx localStorage key**

In `frontend/src/components/HistoryPane.tsx`, change line 45:

```tsx
storageKey="cmdex-history"
```

- [ ] **Step 4: Update Sidebar.tsx localStorage key**

In `frontend/src/components/Sidebar.tsx`, change line 39:

```tsx
const STORAGE_KEY = 'cmdex-expanded-categories';
```

- [ ] **Step 5: Update en.json welcome title**

In `frontend/src/locales/en.json`, change:

```json
"welcomeTitle": "Welcome to Cmdex",
```

- [ ] **Step 6: Verify frontend type-checks**

Run: `cd /Users/mac/Documents/Projects/Others/commamer/frontend && pnpm tsc --noEmit`
Expected: No type errors.

- [ ] **Step 7: Commit**

```bash
git add frontend/index.html frontend/src/App.tsx frontend/src/components/HistoryPane.tsx frontend/src/components/Sidebar.tsx frontend/src/locales/en.json
git commit -m "refactor: rename frontend references from Commamer to Cmdex"
```

---

### Task 3: Rename Config and Meta Files

**Files:**
- Modify: `wails.json:3,4`
- Modify: `.gitignore:4`
- Modify: `.serena/project.yml:2`

- [ ] **Step 1: Update wails.json**

Change name and outputfilename:

```json
{
  "$schema": "https://wails.io/schemas/config.v2.json",
  "name": "cmdex",
  "outputfilename": "cmdex",
```

- [ ] **Step 2: Update .gitignore**

Change line 4 from `commamer` to `cmdex` (the binary name).

- [ ] **Step 3: Update .serena/project.yml**

Change line 2:

```yaml
project_name: "cmdex"
```

- [ ] **Step 4: Commit**

```bash
git add wails.json .gitignore .serena/project.yml
git commit -m "refactor: rename config and meta files from Commamer to Cmdex"
```

---

### Task 4: Update Documentation

**Files:**
- Modify: `CLAUDE.md`
- Modify: `README.md`
- Modify: `agents.md`

- [ ] **Step 1: Update CLAUDE.md**

Replace all occurrences:
- "Commamer" -> "Cmdex"
- "commamer" -> "cmdex"
- `~/.commamer/commamer.db` -> `~/.cmdex/cmdex.db`
- `~/.commamer/` -> `~/.cmdex/`

Key lines to change:
- Line 5: "Cmdex is a cross-platform desktop app..."
- Line 7: "Data is stored locally in a SQLite database at `~/.cmdex/cmdex.db`..."
- Line 100: "...delete `~/.cmdex/cmdex.db` if schema changed..."
- Line 104: "...delete `~/.cmdex/cmdex.db` to reset"

- [ ] **Step 2: Update README.md**

Replace all occurrences:
- "# Commamer" -> "# Cmdex"
- "Commamer is a cross-platform..." -> "Cmdex is a cross-platform..."
- `~/.commamer/commamer.db` -> `~/.cmdex/cmdex.db`
- `cd commamer` -> `cd cmdex`
- "When executed, Commamer replaces..." -> "When executed, Cmdex replaces..."

- [ ] **Step 3: Update agents.md**

Replace all occurrences:
- "**Commamer** application" -> "**Cmdex** application"
- "**Commamer** is a cross-platform..." -> "**Cmdex** is a cross-platform..."
- `~/.commamer/data.json` -> `~/.cmdex/cmdex.db`

- [ ] **Step 4: Commit**

```bash
git add CLAUDE.md README.md agents.md
git commit -m "docs: update all documentation references from Commamer to Cmdex"
```

---

### Task 5: Generate SVG Logo - Concept A (Terminal Prompt Monogram)

**Files:**
- Create: `docs/logos/concept-a-terminal-prompt.svg`

- [ ] **Step 1: Create logo directory**

```bash
mkdir -p docs/logos
```

- [ ] **Step 2: Create Concept A SVG**

Create `docs/logos/concept-a-terminal-prompt.svg`:

A 1024x1024 rounded square with:
- Dark background (#0F0F14)
- Rounded corners (radius ~180)
- Bold stylized "C" letter (white, #FFFFFF) on the left
- Integrated ">_" terminal prompt to the right of the C
- Electric blue glow (#4A9EFF) on the prompt cursor with subtle glow filter
- Clean, minimal, monochrome-friendly

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024" width="1024" height="1024">
  <defs>
    <filter id="glow">
      <feGaussianBlur stdDeviation="8" result="blur"/>
      <feMerge>
        <feMergeNode in="blur"/>
        <feMergeNode in="SourceGraphic"/>
      </feMerge>
    </filter>
  </defs>
  <!-- Background -->
  <rect width="1024" height="1024" rx="180" ry="180" fill="#0F0F14"/>
  <!-- Bold C letter -->
  <text x="240" y="620" font-family="SF Mono, Menlo, Monaco, Consolas, monospace" font-size="480" font-weight="800" fill="#FFFFFF" letter-spacing="-20">C</text>
  <!-- Terminal prompt >_ with blue glow -->
  <g filter="url(#glow)">
    <text x="530" y="620" font-family="SF Mono, Menlo, Monaco, Consolas, monospace" font-size="320" font-weight="700" fill="#4A9EFF">&gt;_</text>
  </g>
</svg>
```

- [ ] **Step 3: Commit**

```bash
git add docs/logos/concept-a-terminal-prompt.svg
git commit -m "art: add Cmdex logo Concept A - Terminal Prompt Monogram"
```

---

### Task 6: Generate SVG Logo - Concept B (Command Codex Card)

**Files:**
- Create: `docs/logos/concept-b-codex-card.svg`

- [ ] **Step 1: Create Concept B SVG**

Create `docs/logos/concept-b-codex-card.svg`:

A 1024x1024 rounded square with:
- Dark background (#0F0F14)
- Rounded corners (radius ~180)
- Centered floating card shape with rounded corners and amber/gold (#F0A030) border
- Card has a header bar with ">_" prompt text
- Below header: 3 horizontal lines representing stored commands (subtle, semi-transparent white)
- Warm amber/gold accent throughout

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024" width="1024" height="1024">
  <defs>
    <filter id="cardShadow">
      <feDropShadow dx="0" dy="4" stdDeviation="20" flood-color="#F0A030" flood-opacity="0.3"/>
    </filter>
  </defs>
  <!-- Background -->
  <rect width="1024" height="1024" rx="180" ry="180" fill="#0F0F14"/>
  <!-- Card body -->
  <g filter="url(#cardShadow)">
    <rect x="222" y="222" width="580" height="580" rx="40" ry="40" fill="#1A1A24" stroke="#F0A030" stroke-width="6"/>
  </g>
  <!-- Card header bar -->
  <rect x="222" y="222" width="580" height="100" rx="40" ry="40" fill="#F0A030" opacity="0.15"/>
  <rect x="222" y="282" width="580" height="40" fill="#F0A030" opacity="0.15"/>
  <!-- Header divider -->
  <line x1="222" y1="322" x2="802" y2="322" stroke="#F0A030" stroke-width="2" opacity="0.5"/>
  <!-- Terminal prompt in header -->
  <text x="272" y="295" font-family="SF Mono, Menlo, Monaco, Consolas, monospace" font-size="72" font-weight="700" fill="#F0A030">&gt;_ cmdex</text>
  <!-- Command lines -->
  <rect x="272" y="380" width="430" height="12" rx="6" fill="#FFFFFF" opacity="0.25"/>
  <rect x="272" y="430" width="350" height="12" rx="6" fill="#FFFFFF" opacity="0.18"/>
  <rect x="272" y="480" width="400" height="12" rx="6" fill="#FFFFFF" opacity="0.12"/>
  <rect x="272" y="530" width="300" height="12" rx="6" fill="#FFFFFF" opacity="0.08"/>
  <!-- Dot decorations in header -->
  <circle cx="752" cy="272" r="10" fill="#F0A030" opacity="0.6"/>
  <circle cx="718" cy="272" r="10" fill="#F0A030" opacity="0.4"/>
  <circle cx="684" cy="272" r="10" fill="#F0A030" opacity="0.2"/>
</svg>
```

- [ ] **Step 2: Commit**

```bash
git add docs/logos/concept-b-codex-card.svg
git commit -m "art: add Cmdex logo Concept B - Command Codex Card"
```

---

### Task 7: Generate SVG Logo - Concept C (Cmd Diamond)

**Files:**
- Create: `docs/logos/concept-c-cmd-diamond.svg`

- [ ] **Step 1: Create Concept C SVG**

Create `docs/logos/concept-c-cmd-diamond.svg`:

A 1024x1024 rounded square with:
- Dark background (#0F0F14)
- Rounded corners (radius ~180)
- Centered diamond/rhombus shape
- Gradient fill from cyan (#00D4FF) to purple (#8B5CF6)
- ">_" prompt symbol centered inside the diamond (white)
- Subtle outer glow from the gradient

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024" width="1024" height="1024">
  <defs>
    <linearGradient id="diamondGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#00D4FF"/>
      <stop offset="100%" stop-color="#8B5CF6"/>
    </linearGradient>
    <filter id="diamondGlow">
      <feGaussianBlur stdDeviation="25" result="blur"/>
      <feMerge>
        <feMergeNode in="blur"/>
        <feMergeNode in="SourceGraphic"/>
      </feMerge>
    </filter>
  </defs>
  <!-- Background -->
  <rect width="1024" height="1024" rx="180" ry="180" fill="#0F0F14"/>
  <!-- Diamond shape with glow -->
  <g filter="url(#diamondGlow)">
    <polygon points="512,162 862,512 512,862 162,512" fill="none" stroke="url(#diamondGrad)" stroke-width="8"/>
    <polygon points="512,192 832,512 512,832 192,512" fill="url(#diamondGrad)" opacity="0.08"/>
  </g>
  <!-- Inner diamond accent -->
  <polygon points="512,262 762,512 512,762 262,512" fill="none" stroke="url(#diamondGrad)" stroke-width="3" opacity="0.3"/>
  <!-- Terminal prompt centered -->
  <text x="512" y="545" font-family="SF Mono, Menlo, Monaco, Consolas, monospace" font-size="220" font-weight="700" fill="#FFFFFF" text-anchor="middle">&gt;_</text>
</svg>
```

- [ ] **Step 2: Commit**

```bash
git add docs/logos/concept-c-cmd-diamond.svg
git commit -m "art: add Cmdex logo Concept C - Cmd Diamond"
```

---

### Task 8: Convert Selected Logo to App Icons

**Files:**
- Modify: `build/appicon.png`
- Modify: `build/darwin/logo-universal.png`
- Modify: `frontend/src/assets/images/logo-universal.png`

**Note:** This task requires user input on which logo concept to use. After generating all 3 SVGs, show them to the user and ask which to use.

- [ ] **Step 1: Ask user which concept to use**

Open each SVG in a browser or show them to the user. Ask: "Which logo concept do you want as the app icon? A (Terminal Prompt), B (Codex Card), or C (Diamond)?"

- [ ] **Step 2: Convert selected SVG to 1024x1024 PNG**

Use `sips` (macOS built-in) or `rsvg-convert` to convert:

```bash
# Option using rsvg-convert (if available):
rsvg-convert -w 1024 -h 1024 docs/logos/concept-X-*.svg -o build/appicon.png

# Option using sips + temporary conversion:
# First open the SVG in a browser and screenshot, or use another converter
```

If neither tool works, use a Node.js script with `sharp` or `@resvg/resvg-js`:

```bash
cd frontend && pnpm add -D @resvg/resvg-js
```

Then create a temporary conversion script:

```js
const { Resvg } = require('@resvg/resvg-js');
const fs = require('fs');
const svg = fs.readFileSync('../docs/logos/concept-X-selected.svg', 'utf8');
const resvg = new Resvg(svg, { fitTo: { mode: 'width', value: 1024 } });
const png = resvg.render().asPng();
fs.writeFileSync('../build/appicon.png', png);
```

- [ ] **Step 3: Copy to all icon locations**

```bash
cp build/appicon.png build/darwin/logo-universal.png
cp build/appicon.png frontend/src/assets/images/logo-universal.png
```

- [ ] **Step 4: Commit**

```bash
git add build/appicon.png build/darwin/logo-universal.png frontend/src/assets/images/logo-universal.png
git commit -m "art: set Cmdex app icon from selected logo concept"
```

---

### Task 9: Final Verification

- [ ] **Step 1: Search for any remaining "commamer" references**

```bash
grep -ri "commamer" --include="*.go" --include="*.ts" --include="*.tsx" --include="*.json" --include="*.html" --include="*.yml" --include="*.yaml" --include="*.md" .
```

Expected: Only matches in `docs/superpowers/specs/` and `docs/superpowers/plans/` (historical design docs). Also `.claude/settings.local.json` which contains a path reference (not a branding reference).

Any other matches need to be fixed.

- [ ] **Step 2: Verify full build**

```bash
make check
```

Expected: Both Go build and TypeScript type-check pass.

- [ ] **Step 3: Run wails dev for smoke test**

```bash
wails dev
```

Expected: App launches with title "Cmdex", macOS menu shows "About Cmdex", "Hide Cmdex", "Quit Cmdex". Data directory created at `~/.cmdex/`.

- [ ] **Step 4: Commit any remaining fixes**

If Step 1 found stray references, fix and commit:

```bash
git add -A
git commit -m "fix: clean up remaining Commamer references"
```
