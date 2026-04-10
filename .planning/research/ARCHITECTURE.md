# Architecture Research

**Domain:** Desktop app cloud integration (sync, sharing, workspaces, theming)
**Researched:** 2026-04-08
**Confidence:** MEDIUM

## System Overview

```
Desktop (Wails v2)
===================================================================================
  Frontend (React + TypeScript)
  +-----------+  +-----------+  +----------+  +----------+  +-----------+
  | Workspace |  | Sync      |  | Auth     |  | Share    |  | Theme     |
  | Switcher  |  | Status UI |  | Flow UI  |  | Dialog   |  | Engine    |
  +-----+-----+  +-----+-----+  +----+-----+  +----+-----+  +-----+-----+
        |               |              |              |              |
  ------+---------------+--------------+--------------+--------------+------
  Wails Bindings (auto-generated TypeScript <-> Go)
  ------+---------------+--------------+--------------+--------------+------
        |               |              |              |              |
  Go Backend
  +-----------+  +-----------+  +----------+  +----------+  +-----------+
  | Workspace |  | Sync      |  | Auth     |  | Cloud    |  | Theme     |
  | Manager   |  | Engine    |  | Manager  |  | Client   |  | Store     |
  +-----------+  +-----+-----+  +----+-----+  +----+-----+  +-----------+
                       |              |              |
                       v              v              v
                  Local SQLite   Keychain/      HTTPS to CF
                  (all data)     Credential      Workers
                                 Store
===================================================================================

Cloud (Cloudflare)
===================================================================================
  Cloudflare Workers (API Gateway)
  +-----------+  +-----------+  +----------+  +----------+
  | Auth      |  | Sync      |  | Share    |  | Theme    |
  | Endpoints |  | Endpoints |  | Endpoints|  | Endpoints|
  +-----------+  +-----------+  +----------+  +----------+
        |               |              |              |
  ------+---------------+--------------+--------------+------
  Cloudflare Services
  +----------------+  +----------------+  +----------------+
  |  D1 (SQLite)   |  |  R2 (Storage)  |  |  KV (Cache)    |
  |  User data     |  |  Theme files   |  |  Session tokens |
  |  Shared cmds   |  |  Shared assets |  |  Rate limits    |
  |  Sync state    |  |                |  |                |
  +----------------+  +----------------+  +----------------+
===================================================================================
```

### Component Responsibilities

| Component | Responsibility | Location |
|-----------|----------------|----------|
| **Workspace Manager** | CRUD for workspaces, filter commands/categories by active workspace | Go: new `workspace.go` |
| **Sync Engine** | Track local changes, push/pull deltas, conflict resolution (LWW) | Go: new `sync.go` |
| **Auth Manager** | OAuth PKCE flow, token storage, refresh, session lifecycle | Go: new `auth.go` |
| **Cloud Client** | HTTP client to Cloudflare Workers API, request signing, retry | Go: new `cloud.go` |
| **Theme Store** | Load/save/export/import theme JSON, apply CSS variables | Go: `theme.go` + frontend `ThemeEngine` |
| **Auth Endpoints** | OAuth callback proxy for Google/GitHub, JWT issuance | CF Worker: `src/routes/auth.ts` |
| **Sync Endpoints** | Accept change deltas, merge into D1, return remote changes | CF Worker: `src/routes/sync.ts` |
| **Share Endpoints** | Generate share links, serve public gallery, import shared items | CF Worker: `src/routes/share.ts` |
| **Theme Endpoints** | Upload/download themes, gallery listing, metadata | CF Worker: `src/routes/themes.ts` |

## Recommended Project Structure

### Go Backend Additions

```
(repo root)
├── app.go                  # Existing facade - add workspace/sync/auth method bindings
├── db.go                   # Existing - add workspace tables, sync tracking columns
├── models.go               # Existing - add Workspace, SyncMeta, Theme, ShareLink models
├── workspace.go            # NEW: Workspace CRUD, active workspace filtering
├── auth.go                 # NEW: OAuth PKCE flow, token management
├── sync.go                 # NEW: Change tracking, delta computation, conflict resolution
├── cloud.go                # NEW: HTTP client to CF Workers, auth header injection
└── theme.go                # NEW: Theme model operations, import/export
```

### Cloudflare Worker (new `cloud/` directory)

```
cloud/
├── wrangler.toml           # D1 binding, R2 binding, KV binding, env vars
├── package.json
├── tsconfig.json
├── src/
│   ├── index.ts            # Router entry (Hono recommended)
│   ├── middleware/
│   │   ├── auth.ts         # JWT verification, rate limiting
│   │   └── cors.ts         # CORS for desktop app requests
│   ├── routes/
│   │   ├── auth.ts         # OAuth proxy: /auth/google, /auth/github, /auth/callback
│   │   ├── sync.ts         # /sync/push, /sync/pull, /sync/status
│   │   ├── share.ts        # /share/create, /share/:id, /gallery/search
│   │   └── themes.ts       # /themes/upload, /themes/:id, /themes/gallery
│   ├── db/
│   │   ├── schema.sql      # D1 schema: users, synced data, shares, themes
│   │   └── queries.ts      # Typed D1 query helpers
│   └── lib/
│       ├── jwt.ts          # JWT sign/verify using Web Crypto API
│       ├── oauth.ts        # Google/GitHub OAuth token exchange
│       └── sync.ts         # Server-side merge logic
└── migrations/             # D1 migration files
    └── 0001_initial.sql
```

### Structure Rationale

- **Go files stay flat in `package main`:** Matches existing codebase convention. Adding a `pkg/` structure would be premature given the single-package pattern already established.
- **`cloud/` as separate directory:** The Cloudflare Worker is a separate deployable. It has its own `package.json`, `tsconfig.json`, and `wrangler.toml`. It does not share code with the frontend.
- **Hono as Worker router:** Lightweight, Cloudflare-native, TypeScript-first. Better DX than raw `fetch` handler for multi-route APIs.

## Architectural Patterns

### Pattern 1: OAuth PKCE via Loopback Server + Worker Proxy

**What:** Desktop app starts ephemeral HTTP server on `127.0.0.1:{random_port}`, opens system browser to Worker's `/auth/google` or `/auth/github` endpoint. Worker redirects to provider with Worker's callback URL. After user consents, provider redirects to Worker, Worker exchanges code for tokens (using server-side client secret), then redirects browser to `http://127.0.0.1:{port}/callback?token={jwt}`. Go catches the JWT, stores it securely, shuts down loopback server.

**Why this approach:** Wails v2 webview does not support popup windows or cookie-based OAuth flows reliably (documented limitation). The loopback pattern is Google's officially recommended approach for native/desktop apps. The Worker proxy holds the OAuth client secret server-side, so no secrets are embedded in the desktop binary.

**Trade-offs:**
- PRO: No secrets in desktop app. Standard OAuth pattern. Works across all platforms.
- CON: Requires system browser launch (brief UX interruption). Loopback server adds complexity.

**Flow:**
```
User clicks "Sign in with Google"
  -> Go starts HTTP server on 127.0.0.1:49152+
  -> Go opens system browser to https://api.cmdex.dev/auth/google?redirect_port={port}
  -> Worker redirects to Google OAuth with PKCE
  -> User consents in browser
  -> Google redirects to Worker callback
  -> Worker exchanges code for tokens, creates/finds user in D1, issues JWT
  -> Worker redirects browser to http://127.0.0.1:{port}/callback?token={jwt}
  -> Go receives JWT, stores in OS keychain, shuts down HTTP server
  -> Frontend refreshes auth state via Wails binding
```

### Pattern 2: Last-Write-Wins Sync with Change Tracking

**What:** Each syncable row in local SQLite gets `updated_at` (timestamp) and `sync_version` (monotonic counter) columns. A `sync_log` table tracks which rows changed since last successful sync. On sync: push local changes with timestamps, server merges using LWW (latest `updated_at` wins per field), returns remote changes. Client applies remote changes to local DB.

**Why LWW over CRDTs:** Cmdex commands are authored by a single user across devices. There is no multi-user concurrent editing. LWW is sufficient and dramatically simpler than CRDT-based sync (no cr-sqlite dependency, no schema constraints). The failure mode (last save wins) matches user mental model.

**Trade-offs:**
- PRO: Simple to implement. No external sync library. Predictable behavior.
- CON: Simultaneous edits on two offline devices: last sync wins, other edit lost. Acceptable for single-user scenario.

**Key design decisions:**
- Soft deletes (`deleted_at` column) so deletions sync correctly
- `sync_version` is a local monotonic counter, not a global clock
- Server assigns authoritative `updated_at` on merge to prevent clock skew issues
- Full resync fallback if sync state becomes corrupted

### Pattern 3: Workspace as Filter, Not Partition

**What:** Workspace is a new entity. Commands gain a nullable `workspace_id` foreign key. The active workspace filters the UI (sidebar, search, tabs). Commands with `workspace_id = NULL` appear in all workspaces (global commands). Workspaces do NOT create separate databases or tables.

**Why filter, not partition:** Keeps the data model simple. Users can move commands between workspaces. Global commands (not workspace-specific) are a natural concept. Avoids the complexity of multiple SQLite databases or schema duplication.

**Trade-offs:**
- PRO: Simple migration (add column + table). Commands can be global or workspace-scoped. Easy to implement.
- CON: All commands in one table regardless of workspace count. Not a concern at desktop scale.

**Schema addition:**
```sql
CREATE TABLE workspaces (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    icon TEXT,
    color TEXT,
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    deleted_at DATETIME
);

ALTER TABLE commands ADD COLUMN workspace_id TEXT REFERENCES workspaces(id) ON DELETE SET NULL;
ALTER TABLE categories ADD COLUMN workspace_id TEXT REFERENCES workspaces(id) ON DELETE SET NULL;
```

### Pattern 4: Theme as JSON Document + CSS Variable Injection

**What:** A theme is a JSON document defining CSS variable values (colors, fonts, spacing, border radii). The theme engine reads the JSON and sets CSS custom properties on `:root`. Themes are stored locally in SQLite and optionally synced/shared via cloud.

**Why JSON + CSS variables:** Cmdex already uses CSS variables for theming (`--bg-primary`, `--accent-primary`, etc. in `style.css`). Extending this to a full theme document is natural. JSON is portable, easy to validate, and works for export/import/share.

**Theme document structure:**
```json
{
    "id": "uuid",
    "name": "Monokai Dark",
    "author": "username",
    "version": 1,
    "colors": {
        "bg-primary": "#272822",
        "bg-secondary": "#1e1f1c",
        "accent-primary": "#a6e22e",
        "accent-hover": "#b8f340",
        "text-primary": "#f8f8f2",
        "text-secondary": "#75715e"
    },
    "fonts": {
        "ui": "Inter, sans-serif",
        "mono": "JetBrains Mono, monospace"
    },
    "density": "comfortable"
}
```

**Trade-offs:**
- PRO: Works with existing CSS variable system. Easy to create, export, share. No build step.
- CON: Limited to what CSS variables expose. Complex layout changes need new variables added first.

## Data Flow

### Sync Flow (Push/Pull)

```
Trigger: User action, periodic timer, or manual "Sync Now"
    |
    v
Go Sync Engine
    |-- Query sync_log for rows changed since last_sync_version
    |-- Build delta payload: [{table, id, fields, updated_at, deleted_at}]
    |-- POST to CF Worker /sync/push with JWT auth header
    |
    v
CF Worker /sync/push
    |-- Verify JWT
    |-- For each row in delta:
    |     Compare updated_at with D1 row
    |     If local is newer -> update D1
    |     If remote is newer -> add to response "conflicts"
    |-- Query D1 for rows updated since client's last_pull_version
    |-- Return {applied: [...], conflicts: [...], remote_changes: [...], new_pull_version}
    |
    v
Go Sync Engine
    |-- Apply remote_changes to local SQLite (upsert)
    |-- For conflicts: server version wins (LWW), update local
    |-- Update last_sync_version and last_pull_version in local metadata
    |-- Emit Wails event "sync-complete" to frontend
    |
    v
Frontend
    |-- On "sync-complete" event, refresh data from Go bindings
    |-- Update sync status indicator
```

### Auth Flow

```
User clicks "Sign In"
    |
    v
Frontend calls Go AuthManager.StartOAuth("google"|"github")
    |
    v
Go AuthManager
    |-- Generate random port, PKCE code_verifier + code_challenge
    |-- Start HTTP server on 127.0.0.1:{port}
    |-- Open system browser to https://api.cmdex.dev/auth/{provider}?
    |     redirect_port={port}&code_challenge={challenge}
    |
    v
CF Worker /auth/{provider}
    |-- Store code_challenge in KV (keyed by state param, 5 min TTL)
    |-- Redirect to Google/GitHub OAuth authorize URL
    |
    v
User consents in browser -> Provider redirects to Worker callback
    |
    v
CF Worker /auth/callback
    |-- Exchange code for provider tokens (using server-side client_secret)
    |-- Fetch user profile from provider API
    |-- Upsert user in D1
    |-- Issue JWT (signed with Worker secret, contains user_id, expires 30d)
    |-- Redirect to http://127.0.0.1:{port}/callback?token={jwt}
    |
    v
Go loopback server receives callback
    |-- Extract JWT from query params
    |-- Store JWT in OS keychain (macOS Keychain, Windows Credential Manager, Linux Secret Service)
    |-- Shut down loopback server
    |-- Update auth state, emit "auth-complete" Wails event
    |
    v
Frontend updates UI: show user avatar, enable sync/share features
```

### Share Flow

```
User clicks "Share Command"
    |
    v
Frontend calls Go CloudClient.ShareCommand(commandID)
    |
    v
Go CloudClient
    |-- Load command + variables + presets from local DB
    |-- POST to CF Worker /share/create with JWT + command payload
    |
    v
CF Worker /share/create
    |-- Verify JWT
    |-- Store command snapshot in D1 (shared_commands table)
    |-- Generate short share ID
    |-- Return share URL: https://cmdex.dev/s/{shareId}
    |
    v
Go returns share URL to frontend -> user copies link

---

Recipient opens link (or browses gallery)
    |
    v
CF Worker /share/{id} or /gallery/search
    |-- Return command data as JSON
    |
    v
Recipient's Cmdex app -> "Import" button
    |-- POST share ID to Go backend
    |-- Go fetches from CF Worker /share/{id}
    |-- Go inserts command into local SQLite (new ID, current workspace)
```

### State Management Additions

```
App.tsx (existing centralized state)
    |
    +-- authState: {isAuthenticated, user, syncing}
    +-- activeWorkspaceId: string | null (null = all workspaces)
    +-- syncStatus: {lastSync, pending, error}
    +-- activeTheme: Theme
    |
    +-- New Wails event subscriptions:
         "sync-complete" -> refresh commands/categories
         "auth-complete" -> update authState
         "sync-error" -> show notification
```

## Scaling Considerations

| Scale | Architecture Adjustments |
|-------|--------------------------|
| 0-1k users | Single D1 database, single Worker. KV for sessions. This handles it easily. |
| 1k-100k users | D1 read replicas (built-in to D1). R2 for theme assets. Add Cloudflare Queue for async gallery indexing. |
| 100k+ users | Shard D1 by user (multiple databases). Durable Objects for per-user sync coordination. Cache gallery with KV. |

### Scaling Priorities

1. **First bottleneck: D1 write throughput.** D1 is single-writer SQLite under the hood. Sync pushes from many users hit writes. Mitigation: batch writes, use D1 Sessions API for sequential consistency, defer non-critical writes to Queues.
2. **Second bottleneck: Gallery search.** Full-text search across all shared commands. Mitigation: use D1 FTS or pre-compute search indexes into KV.

## Anti-Patterns

### Anti-Pattern 1: Syncing the Entire Database

**What people do:** Dump the whole SQLite DB and upload/download it on each sync.
**Why it's wrong:** Bandwidth waste, loses offline changes, creates race conditions with concurrent device syncs, O(n) transfer for O(1) changes.
**Do this instead:** Track changes incrementally with a sync log. Push/pull only deltas (changed rows since last sync). This is O(changes) not O(total data).

### Anti-Pattern 2: Storing OAuth Tokens in SQLite or Config Files

**What people do:** Save access tokens and refresh tokens in the app's SQLite database or a JSON config file.
**Why it's wrong:** SQLite DB is readable by any process with file access. Config files are plain text. Tokens grant access to user's cloud data.
**Do this instead:** Use the OS credential store (macOS Keychain, Windows Credential Manager, Linux Secret Service via D-Bus). Go library `github.com/zalando/go-keyring` provides cross-platform access.

### Anti-Pattern 3: Embedding OAuth Client Secrets in Desktop Binary

**What people do:** Include the Google/GitHub OAuth client secret in the Go source code or config.
**Why it's wrong:** Desktop binaries can be decompiled. Client secrets are extractable. Bad actors can impersonate your app.
**Do this instead:** Use the Worker proxy pattern. The Worker holds the client secret as an environment variable. The desktop app never sees it. Desktop app only handles the JWT issued by your own Worker.

### Anti-Pattern 4: Real-Time Sync via WebSockets from Desktop

**What people do:** Maintain a persistent WebSocket connection from the desktop app to the server for instant sync.
**Why it's wrong:** Desktop apps sleep, hibernate, lose network. WebSocket reconnection logic is complex. Wails v2 has no built-in WebSocket support. Cloudflare Workers have limited WebSocket capabilities (Durable Objects required). Overkill for single-user command sync.
**Do this instead:** Periodic pull (every 5 minutes when app is active) + push on save + manual "Sync Now" button. Simple, reliable, sufficient for the use case.

### Anti-Pattern 5: Workspace as Separate SQLite Database

**What people do:** Create one SQLite file per workspace for "isolation."
**Why it's wrong:** Cross-workspace queries become impossible. Moving commands between workspaces requires cross-database operations. Sync complexity multiplies by N workspaces. Schema migrations must run on N databases.
**Do this instead:** Single database, workspace_id as a filter column. Simple, queryable, one migration path.

## Integration Points

### External Services

| Service | Integration Pattern | Notes |
|---------|---------------------|-------|
| Google OAuth | Worker proxy; desktop opens browser to Worker URL | Use PKCE. Client secret stays in Worker env. |
| GitHub OAuth | Worker proxy; same pattern as Google | GitHub requires server-side code exchange (no implicit flow). |
| Cloudflare D1 | Worker binding (not HTTP API) | D1 REST API has rate limits; always access via Worker binding. |
| Cloudflare R2 | Worker binding for writes; presigned URLs for reads | Use `aws4fetch` for presigned URLs in Workers. Do NOT use official AWS SDK. |
| Cloudflare KV | Worker binding | Session tokens (short TTL), OAuth state params, rate limit counters. |

### Internal Boundaries

| Boundary | Communication | Notes |
|----------|---------------|-------|
| Frontend <-> Go | Wails bindings (sync, type-safe) | All new features exposed via `App` struct methods, same as existing pattern. |
| Go <-> Local SQLite | Direct SQL via `modernc.org/sqlite` | Add workspace/sync columns via schema migration. |
| Go <-> CF Workers | HTTPS REST calls from `cloud.go` | JWT in Authorization header. Retry with exponential backoff. |
| Go <-> OS Keychain | `go-keyring` library | Store JWT, not OAuth tokens. Worker issues JWT. |
| CF Worker <-> D1/R2/KV | Cloudflare bindings (in-process, no network hop) | Define in `wrangler.toml`. |

## Build Order (Dependencies Between Components)

The following order reflects technical dependencies -- each layer requires the previous:

1. **Workspace Manager** (no cloud dependency)
   - Schema migration: `workspaces` table + `workspace_id` columns
   - Go CRUD methods + workspace filtering in existing queries
   - Frontend: workspace switcher in sidebar
   - Can ship as local-only feature immediately

2. **Theme Engine** (no cloud dependency)
   - Theme JSON model + local storage in SQLite
   - CSS variable injection in frontend
   - Theme editor UI, export/import as JSON files
   - Can ship as local-only feature immediately

3. **Cloud Infrastructure** (prerequisite for everything cloud)
   - Set up Cloudflare Worker project with Hono router
   - D1 schema (users, sync state)
   - KV namespace for sessions
   - R2 bucket for assets
   - CORS and auth middleware

4. **Auth System** (requires cloud infrastructure)
   - Worker OAuth proxy endpoints (Google + GitHub)
   - Go loopback OAuth flow + keychain storage
   - Frontend auth UI (sign in button, user menu)

5. **Sync Engine** (requires auth + workspaces)
   - Local change tracking (sync_log table, updated_at columns)
   - Push/pull delta endpoints in Worker
   - Go sync orchestration (periodic + on-save + manual)
   - Conflict resolution (LWW)
   - Frontend sync status indicator

6. **Command Sharing** (requires auth + sync for user identity)
   - Share endpoint in Worker + D1 storage for shared commands
   - Share link generation + import flow
   - Public gallery browse/search endpoints

7. **Theme Marketplace** (requires auth + theme engine + R2)
   - Theme upload to R2 via Worker
   - Theme gallery browsing
   - Theme import from gallery

## Sources

- [Cloudflare D1 Worker Binding API](https://developers.cloudflare.com/d1/worker-api/)
- [Build an API to access D1](https://developers.cloudflare.com/d1/tutorials/build-an-api-to-access-d1/)
- [Cloudflare R2 Presigned URLs](https://developers.cloudflare.com/r2/api/s3/presigned-urls/)
- [Google OAuth 2.0 for Native Apps](https://developers.google.com/identity/protocols/oauth2/native-app)
- [Wails OAuth Discussion #2229](https://github.com/wailsapp/wails/discussions/2229)
- [Wails OAuth Issue #392](https://github.com/wailsapp/wails/issues/392)
- [Cloudflare Workers OAuth Provider Library](https://github.com/cloudflare/workers-oauth-provider)
- [GitHub OAuth via Cloudflare Worker](https://github.com/gr2m/cloudflare-worker-github-oauth-login)
- [Google OAuth with Cloudflare Workers](https://github.com/jazcarate/cloudflare-worker-google-oauth)
- [SQLite Sync CRDT-based approach](https://github.com/sqliteai/sqlite-sync/)
- [cr-sqlite for multi-writer replication](https://github.com/vlcn-io/cr-sqlite)
- [Cloudflare Workers Best Practices 2026](https://developers.cloudflare.com/changelog/post/2026-02-15-workers-best-practices/)
- [R2 Presigned URLs with Hono](https://lirantal.com/blog/cloudflare-r2-presigned-url-uploads-hono)

---
*Architecture research for: Cmdex v2 cloud integration*
*Researched: 2026-04-08*
