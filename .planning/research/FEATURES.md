# Feature Research

**Domain:** Desktop command management / developer productivity tool (premium features: workspaces, cloud sync, sharing, theming)
**Researched:** 2026-04-08
**Confidence:** MEDIUM-HIGH

## Feature Landscape

### Table Stakes (Users Expect These)

Features users assume exist once you market sync/sharing/workspaces. Missing these means the feature feels broken, not just incomplete.

#### Workspace Management

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Named workspaces with isolated command lists | Every tool with "workspaces" provides scoped contexts (VS Code, Warp Drive, Raycast) | MEDIUM | Core data model change: workspace_id FK on commands/categories |
| Sidebar workspace switcher | Raycast, VS Code, Warp all use sidebar/dropdown to switch context | LOW | Dropdown or list in sidebar header; filter commands by active workspace |
| Default/global workspace | Users expect uncategorized commands to remain accessible; massCode has "All Snippets" view | LOW | Null workspace_id = global; always visible regardless of active workspace |
| Workspace CRUD (create, rename, delete) | Basic management; every workspace-supporting tool has this | LOW | Delete should prompt about contained commands (move to global or delete) |
| Quick workspace switching (keyboard shortcut) | Power users expect Cmd+number or Cmd+Shift+W style shortcuts | LOW | Bind to existing keyboard shortcut system |

#### Cloud Sync

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Account creation via OAuth (Google + GitHub) | Standard for dev tools; Raycast, Warp, Cacher all use OAuth | MEDIUM | Cloudflare Workers + OAuth flow; store tokens locally |
| Automatic background sync | Raycast Cloud Sync works silently after setup; users expect set-and-forget | HIGH | Requires conflict resolution strategy, sync queue, network retry |
| Offline-first with eventual consistency | massCode, Pieces, all local-first tools preserve full functionality offline | HIGH | SQLite remains source of truth; sync is additive layer, never blocks UI |
| Sync status indicator | Users need confidence data is synced; Dropbox-style checkmark/spinner | LOW | Simple status icon in header or settings |
| Selective sync (what syncs, what doesn't) | Raycast excludes clipboard history and credentials; users expect control | MEDIUM | Settings UI for toggling sync per data type |
| Data encryption in transit | Basic expectation for any cloud-connected tool | LOW | HTTPS to Cloudflare Workers handles this by default |

#### Command Sharing

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Generate shareable link for a command | GitHub Gist, Pieces, Cacher all generate unique URLs | MEDIUM | Upload command JSON to Cloudflare R2/D1, generate slug/URL |
| View shared command without account | Pieces allows this; GitHub Gist allows it; friction kills sharing | LOW | Public web page rendering the command (Cloudflare Pages or Worker) |
| Import shared command into own library | One-click "save to my commands" from shared view; Cacher and Pieces do this | MEDIUM | Deduplicate on import; handle variable definitions correctly |
| Share link preview (Open Graph tags) | Links shared in Slack/Discord should render a preview card | LOW | OG meta tags on the shared command page |

#### Theme Customization

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Color scheme customization (primary, accent, background, text) | VS Code, Warp, any modern dev tool lets you change colors | MEDIUM | Extend existing CSS variable system; live preview in settings |
| Light and dark mode toggle | Table stakes for any desktop app in 2026; Warp syncs with OS | LOW | Already have dark theme; add light variant + OS sync |
| Preset built-in themes (5-10 options) | VS Code ships with ~15; Warp ships with dozens; bare minimum is 5-10 | LOW | Ship Catppuccin, Dracula, Nord, Solarized, One Dark, plus originals |
| Theme persistence across sessions | Obviously expected; broken without it | LOW | Already stored in browser storage; extend to app settings in SQLite |

#### UI/UX Overhaul

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Responsive layout (adapts to window resize) | Desktop apps should handle resize gracefully; current layout is rigid | MEDIUM | Flexbox/grid rework; collapse sidebar at narrow widths |
| Reduced modal usage | Modern UX trend: inline editing > modal dialogs; VS Code rarely uses modals | MEDIUM | Replace confirmation modals with inline actions; keep only critical modals |
| Smooth transitions and animations | Framer Motion / CSS transitions expected in polished apps | MEDIUM | Tab switches, panel toggles, sidebar collapse need animation |
| Consistent spacing and visual hierarchy | Current UI described as "cluttered" in PROJECT.md | MEDIUM | Design pass: increase whitespace, reduce visual density, clear hierarchy |

### Differentiators (Competitive Advantage)

Features that set Cmdex apart from generic snippet managers. These align with the core value of "command execution with variable templates."

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Public command gallery with search | Go beyond 1:1 sharing; let users discover commands (like CodePen for CLI). No competitor in the command-execution space does this well | HIGH | Cloudflare D1 for gallery index; search, categories, popularity ranking |
| One-click import with variable preset support | Shared commands retain their variable definitions and presets; recipient gets a fully functional template, not just text | MEDIUM | Serialize/deserialize full command model including VariableDefinitions |
| Workspace-aware sync (sync per workspace) | Users may want some workspaces local-only (sensitive company commands) and others synced; Raycast has selective sync but not workspace-granular | MEDIUM | Per-workspace sync toggle; defaults to sync-enabled |
| Theme marketplace (create, export, share themes) | VS Code's theme marketplace is hugely popular; no command tool has this. Lightweight JSON export/import with community gallery | MEDIUM | Theme = JSON blob of CSS variables; upload to gallery; preview before install |
| Theme preview before applying | VS Code lets you preview themes in the editor live before committing | LOW | Apply theme to CSS variables temporarily; revert on cancel |
| Command collections (curated bundles) | Share a set of related commands as a bundle (e.g., "Docker cleanup scripts", "Git workflow shortcuts"). Warp Drive has Notebooks; Pieces has collections | MEDIUM | Collection = named group of command references; shareable as a unit |
| Execution safety warnings on import | When importing shared commands, scan for dangerous patterns (rm -rf, sudo, etc.) and warn user. Pieces scans for secrets; Cmdex should scan for risk | LOW | Regex-based pattern matching on script content before import |
| Font customization (editor + UI fonts) | VS Code and Warp both allow font changes; developers care deeply about fonts | LOW | CSS variable for font-family; persist in settings |
| Layout density options (compact/comfortable/spacious) | VS Code and JetBrains offer density settings; power users want compact | LOW | Three density presets adjusting padding/margins via CSS variables |

### Anti-Features (Commonly Requested, Often Problematic)

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|-----------------|-------------|
| Real-time collaboration / live co-editing | Teams want to edit together like Google Docs | Enormous complexity (OT/CRDT for scripts, presence, cursors); Cmdex is personal tool | Async sharing via links + import; workspace sync is eventual, not real-time |
| Team/organization management with roles | Enterprise users ask for admin controls | Scope creep into B2B SaaS territory; adds auth complexity, billing, permissions | Keep workspaces personal; sharing is link-based, not permission-based |
| Full terminal emulator in app | Users want to run commands and see full terminal output | Interactive shells need PTY, ANSI rendering, resize handling -- enormous effort, already out of scope | Keep current streaming output for non-interactive scripts; "Open in Terminal" for interactive needs |
| Email/password authentication | Some users prefer email login | OAuth-only is simpler, more secure, no password storage/reset flows | Google + GitHub OAuth covers >95% of developer users |
| Automatic command versioning/history | Track every edit as a version | Database bloat; complex UI for diffing versions; rarely needed for short scripts | Execution history already exists; Git-based workflows handle version control externally |
| Snippet-as-a-service API | Let external tools query your commands via API | Security surface area; maintenance burden; niche use case | Export commands as JSON/YAML for external tool consumption |
| Plugin/extension system | Users want to extend functionality | Massive engineering effort for plugin API, sandboxing, lifecycle management | Ship good defaults; accept feature requests; theme marketplace covers customization desire |
| Drag-and-drop between workspaces | Move commands between workspaces visually | Complex DnD implementation for marginal benefit over context menu | Right-click > "Move to workspace" context menu |

## Feature Dependencies

```
[OAuth Authentication]
    |
    +--requires--> [Cloud Sync Infrastructure]
    |                  |
    |                  +--requires--> [Sync Conflict Resolution]
    |                  |
    |                  +--enables--> [Cross-device Sync]
    |
    +--requires--> [Command Sharing]
    |                  |
    |                  +--enables--> [Public Command Gallery]
    |                  |
    |                  +--enables--> [Command Collections]
    |
    +--requires--> [Theme Marketplace]

[Workspace Management] --independent-- (no cloud dependency)
    |
    +--enhances--> [Cloud Sync] (workspace-aware sync)

[UI/UX Overhaul] --independent-- (no cloud dependency)
    |
    +--should-precede--> [All other features] (cleaner base for new UI)

[Theme Customization] --independent-- (local-only first)
    |
    +--enhances--> [Theme Marketplace] (requires customization to exist)

[Light/Dark Mode] --enhances--> [Theme Customization]
```

### Dependency Notes

- **OAuth requires Cloud Infrastructure:** Cannot authenticate without a backend; build backend first, then auth, then sync/sharing
- **UI/UX Overhaul should precede feature work:** Adding workspaces and sync UI to a cluttered layout compounds the problem; simplify first
- **Workspace Management is independent:** Pure local feature; no cloud dependency; can ship before cloud features
- **Theme Customization before Marketplace:** Must be able to create/apply themes locally before sharing them
- **Gallery requires Sharing:** Gallery is a browsable collection of shared commands; sharing infrastructure must exist first
- **Command Collections require Sharing:** Collections are bundles of shared commands

## MVP Definition

### Launch With (v1 - Premium Features)

- [ ] UI/UX overhaul (responsive layout, reduced modals, animations) -- must-do before adding complexity
- [ ] Workspace management (CRUD, sidebar switcher, keyboard shortcuts) -- high value, pure local, low dependency
- [ ] Theme customization (color picker, light/dark mode, 5-10 built-in themes, font/density) -- high perceived value, moderate effort
- [ ] OAuth authentication (Google + GitHub via Cloudflare Workers) -- gate for all cloud features
- [ ] Cloud sync (background, offline-first, selective) -- core value proposition for "premium"
- [ ] Command sharing via links (generate link, view without account, one-click import) -- viral growth mechanism

### Add After Validation (v1.x)

- [ ] Public command gallery -- requires sharing adoption; add when there are commands to browse
- [ ] Theme marketplace -- requires theme customization adoption; add when users create themes
- [ ] Command collections (shareable bundles) -- requires sharing infrastructure + user demand signal
- [ ] Workspace-aware selective sync -- refinement once basic sync is proven stable
- [ ] Execution safety warnings on shared command import -- important but not blocking

### Future Consideration (v2+)

- [ ] Community features on gallery (upvotes, comments, fork counts) -- requires active community
- [ ] Curated/featured commands in gallery -- editorial effort, needs scale
- [ ] Theme creation wizard (visual builder) -- luxury feature after marketplace exists

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority |
|---------|------------|---------------------|----------|
| UI/UX overhaul | HIGH | MEDIUM | P1 |
| Workspace management | HIGH | MEDIUM | P1 |
| Theme customization + built-in themes | HIGH | LOW-MEDIUM | P1 |
| Light/dark mode + OS sync | HIGH | LOW | P1 |
| OAuth authentication | HIGH | MEDIUM | P1 |
| Cloud sync (offline-first) | HIGH | HIGH | P1 |
| Command sharing via links | HIGH | MEDIUM | P1 |
| Shared command web viewer | MEDIUM | LOW | P1 |
| Font + density customization | MEDIUM | LOW | P2 |
| Sync status indicator | MEDIUM | LOW | P2 |
| Public command gallery | HIGH | HIGH | P2 |
| Theme marketplace | MEDIUM | MEDIUM | P2 |
| Command collections | MEDIUM | MEDIUM | P2 |
| Workspace-aware sync | MEDIUM | MEDIUM | P2 |
| Import safety warnings | MEDIUM | LOW | P2 |
| Gallery community features | LOW | HIGH | P3 |
| Theme creation wizard | LOW | MEDIUM | P3 |

## Competitor Feature Analysis

| Feature | Raycast | Warp Terminal | Cacher | Pieces | massCode | Cmdex (Plan) |
|---------|---------|---------------|--------|--------|----------|--------------|
| Workspaces/Projects | Extensions organize by context | Warp Drive folders | Team libraries + labels | Collections | Multi-level folders | Named workspaces with sidebar switcher |
| Cloud Sync | Pro feature, auto-sync all Macs | Built-in, real-time | Cloud-native (no local) | Pieces OS + cloud | File-based (iCloud/Dropbox/Git) | Offline-first SQLite + Cloudflare D1 |
| Sharing | Shared snippets (team only) | Drive links, public notebooks | Team library + URL sharing | Enriched links, no-account view | No built-in sharing | Public links, no-account view, one-click import |
| Public Gallery | Snippet Explorer (curated) | No | No | No | No | Browsable gallery with search and categories |
| Theme Customization | Full theme editor + marketplace | Preset themes + custom | Minimal (dark/light) | System theme only | No theming | Full color/font/density customization |
| Theme Sharing | Yes (Pro) | No | No | No | No | Theme marketplace (create, export, share) |
| Variable Templates | Snippet placeholders | Workflow parameters | No | No | No | Full {{var}} system with CEL defaults and presets |
| Command Execution | Script commands (limited) | Full terminal | No | No | No | Direct execution + streaming output + terminal launch |
| Offline Support | Full (local-first) | Partial (needs account) | No (cloud-only) | Yes (Pieces OS local) | Full (local files) | Full (SQLite local, sync is additive) |

**Cmdex's unique combination:** Variable template execution + workspaces + offline-first sync + public sharing gallery. No single competitor combines all four. Raycast is closest but lacks execution and public gallery. Warp has execution but is a terminal, not a command organizer. Cacher has sharing but no execution or offline support.

## Sources

- [Raycast Cloud Sync](https://manual.raycast.com/cloud-sync) - Cloud sync feature details and scope
- [Raycast Shared Snippets](https://manual.raycast.com/raycast-for-teams-beta/shared-snippets) - Team sharing model
- [Warp Drive overview](https://docs.warp.dev/knowledge-and-collaboration/warp-drive) - Workspace and sharing features
- [Warp Terminal themes](https://docs.warp.dev/terminal/appearance/themes) - Theme customization approach
- [Cacher](https://www.cacher.io/) - Team snippet sharing and organization
- [Pieces for Developers](https://pieces.app/features/drive/share-code-snippets) - Enriched snippet sharing with cloud
- [massCode](https://masscode.io/) - Open-source local-first snippet manager with file-based sync
- [VS Code Color Themes](https://code.visualstudio.com/docs/configure/themes) - Theme marketplace model
- [SQLite Sync (CRDT-based)](https://github.com/sqliteai/sqlite-sync/) - Offline-first sync patterns for SQLite
- [Offline-first frontend apps in 2025](https://blog.logrocket.com/offline-first-frontend-apps-2025-indexeddb-sqlite/) - Sync architecture patterns

---
*Feature research for: Cmdex v2 Premium Features (Workspaces, Cloud Sync, Sharing, Theming)*
*Researched: 2026-04-08*
