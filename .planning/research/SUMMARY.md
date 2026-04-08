# Project Research Summary

**Project:** Cmdex v2 — Cloud Sync, Sharing, Workspaces, and Theming
**Domain:** Desktop developer productivity tool (CLI command manager with cloud layer)
**Researched:** 2026-04-08
**Confidence:** MEDIUM-HIGH

## Executive Summary

Cmdex v2 is a premium feature expansion of an existing local-first desktop app (Wails v2 + Go + React + SQLite). The research covers four domains — cloud backend, workspaces, sharing, and theming — with a clear verdict: build on Cloudflare's ecosystem (Workers + D1 + R2 + KV), use Arctic for OAuth with the PKCE loopback pattern, implement last-write-wins delta sync (not CRDT), and extend the existing CSS variable system for theming. None of these require foreign paradigms: each extends what Cmdex already does rather than replacing it.

The recommended build order is strict: local features first (workspaces, theme engine), then cloud infrastructure, then authentication, then sync, then sharing. This ordering reflects hard dependency chains. Auth cannot work without the cloud backend; sync cannot work without auth and schema columns that must be added before data is written; sharing without security review of script imports is a remote code execution vector. Shortcutting this order produces compounding technical debt or security holes that cannot be fixed post-launch.

The top risk is behavioral, not technical: the existing App.tsx is already 1,317 lines and db.go is 1,173 lines. Adding cloud state, auth state, sync status, and workspace context without refactoring first will create an unmaintainable god component. The research is unambiguous: refactor before cloud feature work begins. The UI/UX overhaul and code refactor phases are prerequisites, not nice-to-haves.

## Key Findings

### Recommended Stack

The cloud backend should be a Cloudflare Workers project (`cloud/` directory in the repo). Hono v4 is the de facto framework for Workers — Cloudflare itself recommends it. Drizzle ORM handles type-safe D1 queries with schema-as-code migrations. Arctic v3 (same author as the now-deprecated Lucia) handles OAuth with Google and GitHub providers. jose v5 handles JWT on the Workers runtime (jsonwebtoken and other Node.js-based libraries will not run on Workers). nanoid generates URL-friendly share codes.

For the desktop Go side: no new framework is needed. New Go files (workspace.go, auth.go, sync.go, cloud.go, theme.go) extend the existing flat package structure. Token storage uses `zalando/go-keyring` for OS keychain access — never SQLite or config files. The theme engine requires no new libraries: it extends the existing CSS custom property system already in style.css.

**Core technologies:**
- **Hono v4**: Cloudflare Workers API framework — official recommendation, Web Standards-based, Express-like DX
- **Cloudflare D1**: Serverless SQLite-compatible DB — schema familiarity with local SQLite, 10GB per DB limit
- **Cloudflare R2**: Object storage for themes and shared bundles — zero egress fees, S3-compatible
- **Cloudflare KV**: Session tokens and rate limiting cache — fast, TTL-based, not for relational data
- **Drizzle ORM v0.44**: Type-safe D1 queries with auto-generated migrations via drizzle-kit
- **Arctic v3.7**: Lightweight OAuth 2.0 client — runtime-agnostic, Google + GitHub providers built-in
- **jose v5**: JWT creation/verification — Workers-compatible (no Node.js crypto dependency)
- **zalando/go-keyring**: Cross-platform OS keychain access — macOS Keychain, Windows Credential Manager, Linux Secret Service
- **CSS custom properties (native)**: Theme runtime application — extends existing style.css system with zero overhead

### Expected Features

Research confirms the following feature landscape against competitors (Raycast, Warp, Cacher, Pieces, massCode):

**Must have (table stakes):**
- Named workspaces with sidebar switcher and keyboard shortcuts — every workspace tool provides this
- OAuth authentication (Google + GitHub) — standard for dev tools; no email/password needed
- Background cloud sync that is offline-first — users expect set-and-forget; SQLite stays source of truth
- Sync status indicator — users need confidence data is synced
- Share command via link; view shared command without an account — friction kills sharing adoption
- One-click import of shared command including variable definitions and presets
- Light and dark mode with OS sync — table stakes for any desktop app in 2026
- 5-10 built-in themes (Catppuccin, Dracula, Nord, Solarized, One Dark) — bare minimum shipped
- Responsive layout adapting to window resize — current layout is rigid

**Should have (competitive differentiators):**
- Public command gallery with search and categories — no competitor in the command-execution space does this well
- Theme marketplace (create, export, share JSON themes) — VS Code's theme marketplace is hugely popular; no command tool has one
- Workspace-aware selective sync (some workspaces local-only for sensitive commands)
- Command collections (shareable bundles, e.g., "Docker cleanup scripts")
- Execution safety warnings when importing shared commands (scan for `rm -rf`, `sudo`, `env()` exfiltration)
- Font and layout density customization (compact/comfortable/spacious)
- Theme preview before applying (live preview, revert on cancel)

**Defer to v2+:**
- Gallery community features (upvotes, comments, fork counts) — needs active community first
- Theme creation wizard (visual builder) — luxury after marketplace exists
- Real-time collaboration — enormous CRDT/OT complexity; Cmdex is a personal tool
- Plugin/extension system — massive engineering investment

**Do not build:**
- Team/org management with roles — scope creep into B2B SaaS
- Email/password authentication — OAuth covers >95% of developer users
- Full terminal emulator — already ruled out of scope

### Architecture Approach

The system divides cleanly into two deployables: the existing Wails desktop app extended with Go modules, and a new `cloud/` Cloudflare Workers project. The desktop Go backend orchestrates everything — it holds OAuth tokens in the OS keychain, runs the sync engine, and exposes all new functionality to the React frontend via Wails bindings, exactly as the existing codebase works. The cloud layer is stateless Workers with D1/R2/KV bindings; it never communicates directly with the frontend.

**Major components:**
1. **Workspace Manager** (`workspace.go`) — CRUD for workspaces; filter commands/categories by workspace_id; workspace is a filter column, not a separate database
2. **Theme Store** (`theme.go` + frontend ThemeEngine) — Load/save/export/import theme JSON; apply CSS variables via `document.documentElement.style.setProperty()`
3. **Cloud Infrastructure** (`cloud/` Workers project) — Hono router + D1 schema + R2 bucket + KV namespace; prerequisite for all cloud features
4. **Auth Manager** (`auth.go`) — OAuth PKCE loopback flow; store JWT in OS keychain; Worker proxy holds client secrets (never in binary)
5. **Sync Engine** (`sync.go`) — Local change tracking via sync_log table; delta push/pull; last-write-wins conflict resolution; soft deletes (tombstones)
6. **Cloud Client** (`cloud.go`) — HTTPS client to CF Workers with JWT auth header, retry with exponential backoff
7. **Share/Gallery Endpoints** (CF Worker `routes/share.ts`) — Generate share links, serve public gallery, handle import

**Key patterns:**
- Workspace as filter (nullable workspace_id FK), not separate database — simple migration, cross-workspace queries work
- OAuth via loopback server + system browser (not Wails WebView — documented limitation) + Worker proxy for secrets
- Delta sync with sync_log outbox — O(changes) bandwidth, not O(total data)
- Theme as JSON document of CSS variable values — portable, no build step, instant hot-swap

### Critical Pitfalls

1. **Shared bash scripts execute arbitrary code on importer's machine** — The `env()` CEL function becomes a secret exfiltration vector in shared commands. Sanitize/strip CEL expressions at export time. Require mandatory script preview + security warning dialog before import. Add a `source` field distinguishing local vs. imported commands. Design this before building the sharing API.

2. **Sync conflicts causing silent data loss and ghost data** — Naive LWW without tombstones causes deleted items to reappear. The `version`, `updated_at`, and `deleted_at` columns must exist before any sync code is written. Implement soft deletes for all syncable entities (commands, categories, presets, tags).

3. **OAuth tokens stored in plaintext** — Wails has no built-in secure storage. The path of least resistance (SQLite/config file) is exploitable by any local process including an imported script. Use `zalando/go-keyring` from day one. Store only the refresh token in keychain; access token stays in memory only.

4. **OAuth redirect broken in Wails WebView** — Wails v2 WebView cannot reliably handle OAuth redirects (documented in wailsapp/wails#392 and #2229). Use `runtime.BrowserOpenURL` to open the OAuth URL in the system browser. Use `127.0.0.1` (not `localhost` — RFC 9700) as the loopback redirect URI. Always use PKCE.

5. **App.tsx becomes a 3,000-line god component** — Adding auth state, sync status, workspace context, and theme state to the existing 1,317-line App.tsx without refactoring first makes every future change risky. Refactor into domain hooks (`useAuth`, `useSync`, `useWorkspaces`, `useTheme`, `useCommands`, `useTabs`) before cloud features begin.

## Implications for Roadmap

Based on the combined research, 7 phases emerge from dependency analysis and pitfall prevention:

### Phase 1: Foundations — UI/UX Overhaul + Code Refactor
**Rationale:** Two independent but urgent prerequisites. The UI is cluttered and rigid. The codebase has god-component issues. Both must be resolved before adding cloud complexity. This phase costs nothing in user-facing features but prevents enormous pain later.
**Delivers:** Responsive layout, reduced modal usage, smooth transitions, consistent spacing. App.tsx split into domain hooks. CommandDetail.tsx and db.go modularized.
**Addresses:** UI/UX overhaul (FEATURES.md P1), code maintainability prerequisite
**Avoids:** Pitfall 5 (god component), Pitfall 6 (UI breaks muscle memory) — inventory all existing keyboard shortcuts before changing anything

### Phase 2: Local Power Features — Workspaces + Theming
**Rationale:** Both features are independent of cloud infrastructure. They provide high user value and can ship while cloud backend is being designed. They establish the schema patterns (workspace_id FK, theme storage) that sync will build on.
**Delivers:** Named workspaces with sidebar switcher and keyboard shortcuts. Theme customization with 5-10 built-in themes, light/dark mode with OS sync, font and density options. Local theme export/import as .cmdex-theme JSON files.
**Addresses:** Workspace management (FEATURES.md P1), theme customization (FEATURES.md P1), light/dark mode (FEATURES.md P1)
**Uses:** CSS custom properties + Tailwind v4 (STACK.md); workspace-as-filter pattern (ARCHITECTURE.md)
**Avoids:** Anti-pattern of workspace as separate database; theme requiring app restart

### Phase 3: Cloud Infrastructure
**Rationale:** Every cloud feature (auth, sync, sharing, gallery) depends on the Cloudflare Workers project existing. This phase builds the foundation — no user-facing features yet, but the backend all subsequent phases require.
**Delivers:** Deployed Cloudflare Worker with Hono router. D1 schema (users, sync_state, shared_commands, themes). R2 bucket. KV namespace. Auth middleware. CORS. Local dev with wrangler.
**Uses:** Hono v4, Drizzle ORM v0.44, Wrangler, Cloudflare D1/R2/KV (STACK.md); cloud/ directory structure (ARCHITECTURE.md)
**Research flag:** Needs `/gsd-research-phase` — D1 schema design (per-user vs. shared database decision must be made here; affects all future phases), Drizzle migration patterns for D1

### Phase 4: Authentication
**Rationale:** Auth is the gate for all cloud features. It must be built on Phase 3's cloud infrastructure. Token security must be correct from the start — retrofitting secure storage is painful and risky. Prototype the full flow including token refresh before any feature depends on it.
**Delivers:** Google and GitHub OAuth via PKCE loopback pattern. JWT issued by Worker (client secret never in binary). Tokens in OS keychain via `zalando/go-keyring`. Silent refresh on startup. Frontend auth UI (sign-in, user avatar, sign-out).
**Uses:** Arctic v3.7, jose v5, zalando/go-keyring (STACK.md); Auth Manager + loopback flow (ARCHITECTURE.md)
**Avoids:** Pitfall 3 (plaintext token storage), Pitfall 4 (OAuth broken in WebView) — use `runtime.BrowserOpenURL`, `127.0.0.1` not `localhost`, always PKCE

### Phase 5: Cloud Sync
**Rationale:** Requires auth for user identity. Requires schema columns (version, updated_at, deleted_at, sync_log) that must exist before any mutation code is written. This is the core premium value proposition.
**Delivers:** Delta sync with sync_log outbox. Background sync (periodic + on-save + manual). Offline-first (SQLite stays source of truth). Selective sync toggle per data type. Conflict resolution (LWW with tombstones for all entity types). Sync status indicator. Workspace-aware sync settings.
**Uses:** Custom sync protocol, delta-based (STACK.md); Sync Engine + push/pull flow (ARCHITECTURE.md)
**Avoids:** Pitfall 2 (sync data loss) — tombstones required for commands, categories, presets, tags; full resync fallback. Never sync entire database, only deltas.
**Research flag:** Needs `/gsd-research-phase` — conflict resolution edge cases for all entity types; D1 write throughput limits under concurrent sync load

### Phase 6: Command Sharing + Gallery
**Rationale:** Requires auth for user identity and share link ownership. Security review of the import flow is non-negotiable and must be designed before any code is written. The public gallery requires sharing infrastructure to exist first.
**Delivers:** Share command via link (generate slug, short URL). Public shared command viewer (no account required, Open Graph tags). One-click import with variable definitions and presets preserved. Execution safety warnings on import (CEL env() stripping, dangerous pattern scanning). Public gallery with search, categories. Rate limiting on link generation.
**Uses:** nanoid, R2 presigned URLs (STACK.md); Share + Gallery endpoints (ARCHITECTURE.md)
**Avoids:** Pitfall 1 (arbitrary code execution via shared commands) — mandatory preview + security dialog before import; CEL `env()` stripped at export time; `source` field on imported commands

### Phase 7: Marketplaces + Polish (v1.x)
**Rationale:** These features require adoption signals to be valuable. Theme marketplace needs users who have created themes (Phase 2) and a sharing infrastructure (Phase 6). Command collections are refinements once basic sharing is proven.
**Delivers:** Theme marketplace (upload, browse, preview before apply, one-click install). Command collections (shareable bundles). Gallery pagination and KV caching (5-min TTL). Import safety scanning enhancements.
**Addresses:** Theme marketplace (FEATURES.md P2), command collections (FEATURES.md P2), gallery performance

### Phase Ordering Rationale

- **Local before cloud:** Workspaces and theming ship independently, establishing schema patterns that sync uses. Users get immediate value while cloud backend is being built.
- **Infrastructure before auth:** The Worker project must be deployed before OAuth endpoints can exist.
- **Auth before sync:** Sync requires a user identity (JWT) to associate synced data with D1 rows.
- **Schema before sync logic:** The version, updated_at, deleted_at, and sync_log columns must exist before any mutation code is written.
- **Sharing security designed before sharing code:** CEL sanitization, preview gate, and source field must be specified in Phase 6's design document before implementation.
- **Refactor before cloud:** Adding cloud state to unrestructured App.tsx creates a 3,000-line god component that blocks all future development.

### Research Flags

Phases likely needing deeper research during planning:
- **Phase 3 (Cloud Infrastructure):** D1 per-user vs. shared database architecture; Drizzle migration patterns for D1; wrangler.toml binding configuration for D1 + R2 + KV together
- **Phase 5 (Cloud Sync):** Concurrent sync load testing against D1 single-thread limits; field-level merge semantics for all syncable entity types; sync queue persistence across app crashes

Phases with standard patterns (skip research-phase):
- **Phase 1 (Foundations):** React hook extraction patterns are well-documented; no novel technology
- **Phase 2 (Workspaces + Theming):** Workspace-as-filter is a standard SQLite pattern; CSS variable theming already partially in place
- **Phase 4 (Auth):** PKCE loopback pattern is well-documented for desktop apps; Arctic v3 has clear docs for Google + GitHub

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | Hono, Drizzle, Arctic, jose all verified against official docs. PKCE loopback pattern confirmed by multiple sources. CSS variable theming extends existing implementation. |
| Features | MEDIUM-HIGH | Competitor analysis covers Raycast, Warp, Cacher, Pieces, massCode. Feature prioritization is well-grounded. Anti-features analysis is opinionated but well-reasoned. |
| Architecture | MEDIUM | Component boundaries and data flows are clear. D1 scaling thresholds are estimates based on documented limits, not load tests. Per-user vs. shared D1 decision is marked as requiring deeper design. |
| Pitfalls | HIGH | OAuth pitfalls verified against Wails GitHub issues and RFC 9700. Token storage pitfall is unambiguous. Security pitfall (CEL + shared scripts) is specific to Cmdex's design and high-severity. D1 limits from official Cloudflare docs. |

**Overall confidence:** MEDIUM-HIGH

### Gaps to Address

- **D1 per-user vs. shared database:** Research recommends per-user D1 for private data with a shared D1 for the gallery. The exact schema split and migration path need to be specified in Phase 3's design document before any D1 code is written. This decision cannot be reversed cheaply.
- **Sync conflict resolution for all entity types:** Research covers commands in detail but handwaves conflict resolution for categories, variable_presets, tags, and workspaces. Each needs explicit merge semantics before sync implementation.
- **`aws4fetch` vs `@aws-sdk/s3-request-presigner` for R2 in Workers:** ARCHITECTURE.md says to use `aws4fetch`; STACK.md says to use `@aws-sdk/s3-request-presigner`. This conflict needs resolution before Phase 6/7 implementation.
- **No automated tests:** Zero test coverage means manual test checklists for each phase's critical paths must be created before implementation begins, especially for sync conflict scenarios.
- **OAuth `127.0.0.1` vs `localhost` with providers:** Google is deprecating localhost aliases per RFC 9700. GitHub's current policy should be verified at implementation time.

## Sources

### Primary (HIGH confidence)
- [Hono - Cloudflare Workers](https://hono.dev/docs/getting-started/cloudflare-workers) — framework setup and middleware patterns
- [Cloudflare D1 docs](https://developers.cloudflare.com/d1/) — capabilities, limits, Worker binding API
- [Drizzle ORM - Cloudflare D1](https://orm.drizzle.team/docs/connect-cloudflare-d1) — D1 driver integration
- [Arctic v3 documentation](https://arcticjs.dev/) — OAuth client, Google + GitHub providers
- [R2 presigned URLs docs](https://developers.cloudflare.com/r2/api/s3/presigned-urls/) — upload/download pattern
- [Google OAuth for native apps](https://developers.google.com/identity/protocols/oauth2/native-app) — PKCE loopback pattern
- [RFC 9700 - OAuth 2.0 Security Best Practices](https://datatracker.ietf.org/doc/rfc9700/) — 127.0.0.1 vs localhost, PKCE requirements
- [Cloudflare D1 Limits](https://developers.cloudflare.com/d1/platform/limits/) — single-thread constraints, query limits
- [zalando/go-keyring](https://github.com/zalando/go-keyring) — cross-platform OS keychain

### Secondary (MEDIUM confidence)
- [Wails OAuth Discussion #2229](https://github.com/wailsapp/wails/discussions/2229) — OAuth flow patterns in Wails WebView
- [Wails OAuth Issue #392](https://github.com/wailsapp/wails/issues/392) — recommended callback approach
- [Offline-first SQLite sync patterns](https://blog.logrocket.com/offline-first-frontend-apps-2025-indexeddb-sqlite/) — sync architecture
- [Raycast Cloud Sync](https://manual.raycast.com/cloud-sync) — competitor feature reference
- [Warp Drive overview](https://docs.warp.dev/knowledge-and-collaboration/warp-drive) — competitor workspace/sharing model
- [Pieces for Developers](https://pieces.app/features/drive/share-code-snippets) — competitor sharing model
- [massCode](https://masscode.io/) — local-first competitor reference
- [R2 Presigned URLs with Hono](https://lirantal.com/blog/cloudflare-r2-presigned-url-uploads-hono) — implementation reference

### Tertiary (LOW confidence)
- [Auth.js D1 adapter](https://authjs.dev/getting-started/adapters/d1) — noted but not recommended (SSR-focused)
- [Cloudflare Workers OAuth Provider Library](https://github.com/cloudflare/workers-oauth-provider) — reviewed but not adopted

---
*Research completed: 2026-04-08*
*Ready for roadmap: yes*
