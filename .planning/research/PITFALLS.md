# Pitfalls Research

**Domain:** Desktop app (Wails v2 / Go / React) adding cloud sync, OAuth, sharing, and theming
**Researched:** 2026-04-08
**Confidence:** HIGH (D1 limits from official docs), MEDIUM (sync patterns, OAuth), MEDIUM (theming, UX)

## Critical Pitfalls

### Pitfall 1: Shared Commands Execute Arbitrary Code on the Importer's Machine

**What goes wrong:**
Cmdex commands are bash scripts. A "public gallery" or "share via link" feature means users import and run scripts authored by strangers. Unlike sharing a JSON config, sharing a bash script is equivalent to giving someone remote code execution on the importer's machine. The existing `env()` CEL function in variable defaults makes this worse -- a shared command with `env("AWS_SECRET_ACCESS_KEY")` as a default value silently exfiltrates secrets into the resolved preview before the user even clicks "Run."

**Why it happens:**
Developers focus on the sharing UX (links, gallery, import flow) and forget that the payload is executable code. The CEL `env()` function was safe when data was local-only, but becomes a data exfiltration vector once commands are shareable.

**How to avoid:**
- Sanitize or strip CEL expressions (`env()`, `now()`) from shared/imported commands, or replace them with static placeholder values at export time.
- Show a clear security warning before importing any shared command, displaying the full script body.
- Never auto-execute imported commands. Require the user to review and explicitly save first.
- Consider a "sandbox preview" that shows what the script would do without executing it.
- Add a `source` field to commands (local vs. imported) and show visual distinction.

**Warning signs:**
- No security review gate in the import flow mockups/specs.
- `env()` still present in imported command variable defaults.
- Gallery/import feature ships without a "view script before import" step.

**Phase to address:**
Cloud sync and sharing phase. Must be designed before the sharing API is built, not bolted on after.

---

### Pitfall 2: Sync Conflicts Cause Silent Data Loss

**What goes wrong:**
User edits the same command on two offline devices. Both sync. One version is silently overwritten. The user discovers their carefully edited script is gone -- no way to recover it. Alternatively, "ghost data" reappears: a deleted command resurfaces after sync because the deletion wasn't recorded as a tombstone.

**Why it happens:**
Naive "last-write-wins" based on timestamps is the default instinct. Developers skip tombstones for deletes because "why store something that's deleted?" The existing SQLite schema has no `deleted_at`, no `version` column, and no sync metadata. Adding sync to a schema not designed for it creates gaps.

**How to avoid:**
- Add `version` (monotonic counter), `updated_at`, and `deleted_at` (soft delete / tombstone) columns to `commands`, `categories`, `variable_presets` before building sync.
- Use a sync queue / outbox pattern: every local mutation enqueues a sync event. Sync processes the queue, not the current table state.
- For conflicts, use field-level merge (merge changed fields independently) rather than row-level replacement. If both devices changed the same field, prefer the version with the higher `version` counter.
- Keep a local conflict log. If a merge cannot be resolved automatically, surface it to the user rather than silently choosing.
- Never delete rows physically during sync -- always soft-delete with tombstones that propagate.

**Warning signs:**
- Schema migration plan does not include `version`, `deleted_at`, or sync metadata columns.
- Sync design doc says "last-write-wins" without addressing field-level conflicts.
- No integration test for "edit on device A, edit on device B, both sync" scenario.

**Phase to address:**
Must be designed in the cloud backend/sync architecture phase. Schema changes should happen early (before sync logic), since retrofitting tombstones to an existing sync system is painful.

---

### Pitfall 3: OAuth Token Storage in Plaintext on Disk

**What goes wrong:**
OAuth tokens (access + refresh) are stored in the SQLite database, a JSON file, or localStorage equivalent. On macOS/Linux/Windows, any process running as the same user can read these files. A malicious script (including one imported via the gallery -- see Pitfall 1) could exfiltrate tokens.

**Why it happens:**
Wails has no built-in secure credential storage. The path of least resistance is writing tokens to the app's SQLite database or a config file. Developers coming from web backgrounds think "localStorage is fine" without realizing desktop apps have different threat models.

**How to avoid:**
- Use `zalando/go-keyring` or `99designs/keyring` to store OAuth tokens in the OS keychain (macOS Keychain, Windows Credential Manager, Linux Secret Service/libsecret).
- Never store tokens in SQLite, JSON files, or any file readable by other processes.
- Store only the refresh token in the keychain. Keep the access token in memory only (it's short-lived).
- On app startup, check keychain for refresh token, exchange for new access token silently.

**Warning signs:**
- Token appears in `~/.cmdex/cmdex.db` or any file in the app's data directory.
- No dependency on a keyring/keychain library in `go.mod`.
- Token refresh logic is missing (relying on long-lived access tokens).

**Phase to address:**
OAuth/authentication phase. Must be the first thing built when adding auth, before any sync or sharing features depend on it.

---

### Pitfall 4: D1 Single-Thread Bottleneck Under Concurrent Sync

**What goes wrong:**
D1 processes queries sequentially per database. When multiple users sync simultaneously, each sync operation involves multiple queries (read current state, write changes, update metadata). At 100ms per query and 10 queries per sync, that's 1 second per user sync -- meaning the database can only handle ~1 sync/second. Gallery browsing adds read load on top.

**Why it happens:**
Developers see "SQLite in the cloud" and assume it scales like Postgres. D1's 10 GB cap and single-threaded execution are fundamental constraints, not temporary limitations. The 1,000-queries-per-Worker-invocation limit (paid plan) also means a complex sync operation could hit the ceiling.

**How to avoid:**
- Design sync to be minimal: send only changed rows (delta sync), not full state. Use the `version` column to request "changes since version X."
- Batch sync operations into single SQL statements where possible (batch INSERT with ON CONFLICT).
- Cache gallery/public command data in Workers KV or R2 (read-heavy, rarely changes) instead of querying D1 for every browse request.
- Consider per-user D1 databases for private data (D1 supports 50,000 databases per account on paid plan) with a shared D1 for the public gallery. This aligns with Cloudflare's recommended horizontal scaling pattern.
- Add request coalescing: if the same user triggers sync from multiple tabs/windows, deduplicate server-side.

**Warning signs:**
- Sync endpoint runs more than 5 queries per invocation.
- Gallery endpoint queries D1 on every page load without caching.
- No delta/incremental sync -- full state transfer on every sync.
- Load testing not performed before shipping sync.

**Phase to address:**
Cloud backend architecture phase. The per-user vs. shared database decision must be made before writing any D1 schema or Worker code.

---

### Pitfall 5: OAuth Redirect Flow Broken in Wails WebView

**What goes wrong:**
Wails v2 uses a platform WebView (WebKit on macOS, WebView2 on Windows). OAuth providers redirect to a callback URL after authentication. The WebView cannot handle `http://localhost:PORT` redirects naturally because it's not a real browser with address bar navigation. The redirect either fails silently, opens in an external browser but can't communicate back, or triggers a CORS/security error.

**Why it happens:**
Web OAuth assumes a browser. Desktop OAuth with embedded WebViews is a known pain point. Wails lacks built-in OAuth support, cookie handling, or popup window support (as noted in wailsapp/wails#392 and Discussion#2229).

**How to avoid:**
- Spin up a temporary Go HTTP server on a random localhost port during auth flow only.
- Open the OAuth URL in the system's default browser (not the Wails WebView) using `runtime.BrowserOpenURL`.
- Register `http://127.0.0.1` (not `localhost` -- providers are dropping localhost support per RFC 9700) as the redirect URI with Google/GitHub.
- The temporary server captures the auth code, exchanges it for tokens server-side, stores in keychain, and signals the Wails app via a channel.
- Shut down the temporary server immediately after token receipt.
- Always use PKCE (Proof Key for Code Exchange) -- essential for public clients (desktop apps have no client secret).

**Warning signs:**
- OAuth flow uses the Wails WebView instead of the system browser.
- Redirect URI uses `localhost` instead of `127.0.0.1`.
- PKCE not implemented (relying on client secret alone).
- Temporary HTTP server stays running after auth completes.

**Phase to address:**
OAuth/authentication phase. Prototype the full flow (including token refresh) before building any features that depend on auth.

---

### Pitfall 6: UI Overhaul Breaks Muscle Memory and Existing Workflows

**What goes wrong:**
The existing app has established UX patterns: tab-based editing, sidebar categories, command detail panel, keyboard shortcuts. A UI overhaul moves or removes elements users rely on. The command palette, shortcuts, and inline edit patterns (documented extensively in CLAUDE.md) are disrupted. Users who upgraded cannot find features they use daily.

**Why it happens:**
The PROJECT.md identifies UI as "cluttered" and wants simplification. Developers conflate "simplify" with "remove." Critical features get relocated without considering user muscle memory. The temptation to do a "big bang" redesign (change everything at once) is strong when there's a long list of UI complaints.

**How to avoid:**
- Map every existing keyboard shortcut and interaction pattern before changing anything. Test that each still works after the overhaul.
- Phase the UI changes: layout simplification first (reduce panels, improve spacing), then new features (workspaces, themes), then navigation changes.
- Keep the same keyboard shortcuts. If shortcuts must change, provide a migration period with both old and new working.
- Do not remove features during simplification. "Simplify" means fewer clicks to reach the same features, not fewer features.
- Since there are no automated tests (per CONCERNS.md), create manual test checklists for every existing workflow before the overhaul begins.

**Warning signs:**
- No inventory of existing keyboard shortcuts and workflows before redesign starts.
- PR changes more than 3 major interaction patterns simultaneously.
- Existing features become harder to reach (more clicks) after "simplification."
- No way for users to discover relocated features (no tooltips, no changelog).

**Phase to address:**
UI/UX overhaul phase. Should be the first phase -- stabilize and simplify the existing app before adding cloud features on top.

---

### Pitfall 7: Monolithic App.tsx Becomes Unmaintainable with Cloud State

**What goes wrong:**
App.tsx is already 1,317 lines managing local state (tabs, modals, commands, categories). Adding auth state, sync status, online/offline detection, workspace switching, theme state, and gallery browsing to the same component creates a 3,000+ line file that nobody can safely modify. Every cloud feature change risks breaking local features.

**Why it happens:**
The codebase concern is already documented in CONCERNS.md but not yet addressed. Developers add "just one more piece of state" to App.tsx because refactoring first feels like it slows down feature delivery.

**How to avoid:**
- Refactor App.tsx before adding any cloud features. Extract domain hooks: `useCommands`, `useTabs`, `useAuth`, `useSync`, `useTheme`, `useWorkspaces`.
- Use React Context for cross-cutting concerns (auth state, sync status, theme) instead of prop drilling from a god component.
- The refactor phase produces the same app behavior with better structure. Cloud features are added to the new structure.
- Similarly, split CommandDetail.tsx (1,294 lines) and db.go (1,173 lines) before adding sync and workspace queries.

**Warning signs:**
- App.tsx grows past 1,500 lines before cloud features begin.
- New cloud features are added as more methods/state in App.tsx instead of separate hooks/contexts.
- PR reviews for cloud features require understanding the full App.tsx to review safely.

**Phase to address:**
Refactoring phase, immediately after or concurrent with UI overhaul. Must complete before cloud feature development begins.

---

## Technical Debt Patterns

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| Full-state sync instead of delta | Simpler sync logic, no version tracking | O(n) bandwidth per sync, D1 query budget blown | Never -- even MVP sync should be delta-based given D1 limits |
| Storing tokens in SQLite | No new dependency, familiar pattern | Security vulnerability, token theft risk | Never -- keychain libraries are trivial to add |
| Adding cloud state to App.tsx | Ship faster, no refactor needed | Unmaintainable god component, every change is risky | Only for a throwaway prototype |
| Skipping soft-delete tombstones | Simpler delete logic | Ghost data after sync, data reappearance bugs | Never once sync exists |
| Single shared D1 for all users | Simpler deployment, one schema | Single-threaded bottleneck at ~100 concurrent syncs | Acceptable for beta with <50 users, must migrate before scale |

## Integration Gotchas

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| Cloudflare D1 | Using `ALTER COLUMN` (not supported -- same as local SQLite) | Table recreation pattern, same as existing `db.go` migrations |
| Cloudflare D1 | Large batch operations in single query | Batch in chunks of 1,000 rows; stay under 30-second query timeout |
| Cloudflare Workers | Assuming persistent state between requests | Workers are stateless; use D1/KV/R2 for all persistence |
| Google OAuth | Using `localhost` as redirect URI | Use `http://127.0.0.1:PORT` -- Google is deprecating localhost aliases |
| GitHub OAuth | Not handling the `state` parameter properly | Generate cryptographic random state, verify on callback to prevent CSRF |
| Wails Events | Using Wails events for sync status across components | Wails events are Go-to-frontend only; use React Context/state for frontend-to-frontend communication |
| R2 Storage | Treating R2 like a database (frequent small reads) | R2 is object storage; batch shared command metadata in D1, use R2 only for large exports/theme assets |

## Performance Traps

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| N+1 queries in sync endpoint | Sync takes 5+ seconds; D1 query count spikes | Batch-load relations; use JOINs or CTEs instead of per-row subqueries | >50 commands syncing |
| Full FTS rebuild on every sync | Sync completion takes 10+ seconds | Only rebuild FTS for changed rows; use INSERT/DELETE triggers (already in db.go pattern) | >200 synced commands |
| Theme CSS variable updates triggering full reflow | UI stutters when switching themes | Batch CSS variable changes in a single `requestAnimationFrame`; use `will-change` sparingly | >20 CSS variables changed simultaneously |
| Gallery loading all commands at once | Gallery page takes 3+ seconds to load | Paginate with cursor-based pagination; cache pages in Workers KV with 5-minute TTL | >500 shared commands in gallery |
| Sync on every keystroke | API rate limits hit; user experiences lag | Debounce sync to 30+ seconds after last edit; sync on blur/tab-close, not on change | Any real usage |

## Security Mistakes

| Mistake | Risk | Prevention |
|---------|------|------------|
| Importing shared commands without review | Remote code execution on user's machine | Mandatory script preview before import; security warning dialog |
| `env()` in shared command defaults | Environment variable exfiltration (AWS keys, tokens, etc.) | Strip/sanitize CEL expressions on export; block `env()` in imported commands |
| OAuth tokens in SQLite or config files | Token theft by any local process or malicious imported script | Use OS keychain via `zalando/go-keyring`; in-memory access tokens only |
| No PKCE in OAuth flow | Authorization code interception on localhost | Always use PKCE; it's required by RFC 9700 for public clients |
| Shared command gallery without content moderation | Malicious scripts distributed to all users | Report mechanism; automated scanning for known dangerous patterns (`rm -rf`, `curl | bash`, etc.) |
| Sync API without rate limiting | Denial of service; D1 query budget exhaustion | Per-user rate limits on Workers; exponential backoff in client |

## UX Pitfalls

| Pitfall | User Impact | Better Approach |
|---------|-------------|-----------------|
| Requiring sign-in to use local features | Users who don't want cloud features feel locked out | Auth is optional; all local features work without account; cloud features are additive |
| Sync conflicts shown as technical errors | Users don't understand "version conflict" messages | Show both versions side-by-side; let user pick or merge; use plain language |
| Theme changes require app restart | Users think theme system is broken | Hot-swap CSS variables; no restart needed; instant preview |
| Workspace switching loses unsaved tabs | User loses work when changing workspace context | Warn about dirty tabs; offer to save or stash; maintain per-workspace tab state |
| Gallery import adds command to wrong category | User confusion about where imported commands land | Import to an "Imported" category by default; let user choose during import |
| Offline indicator missing or subtle | User doesn't know why sync isn't working | Persistent, visible online/offline indicator in toolbar; queue indicator showing pending syncs |

## "Looks Done But Isn't" Checklist

- [ ] **OAuth:** Token refresh flow implemented and tested -- initial login works but tokens expire in 1 hour; without silent refresh the app "logs out" randomly
- [ ] **Sync:** Tombstone propagation for all entity types (commands, categories, presets, tags) -- missing even one causes ghost data
- [ ] **Sync:** Conflict resolution for all syncable fields, not just script content -- title, description, category assignment, variable definitions all need merge logic
- [ ] **Sharing:** Rate limiting on link generation -- without it, one user can generate thousands of share links exhausting D1 storage
- [ ] **Gallery:** Pagination on the server AND client -- server pagination without client-side virtual scrolling still crashes with many results
- [ ] **Themes:** Theme export includes all CSS variables -- partial exports create broken themes on import
- [ ] **Offline:** Sync queue survives app crash -- if queue is only in memory, a crash between mutation and sync loses the change
- [ ] **Workspaces:** Default workspace exists for ungrouped commands -- without it, existing commands before the workspace feature have no home

## Recovery Strategies

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| Data loss from sync conflict | HIGH | If no backup: lost forever. Prevention: keep local backup before each sync; D1 Time Travel (30 days on paid plan) for server-side recovery |
| Token stored in plaintext | MEDIUM | Rotate OAuth tokens immediately; migrate to keychain storage; notify affected users if tokens were exposed |
| Malicious shared command executed | HIGH | Cannot undo executed commands. Prevention only. Add import review gate and CEL sanitization |
| D1 bottleneck in production | MEDIUM | Add Workers KV caching layer; shard to per-user D1 databases; requires API refactor but no data loss |
| App.tsx becomes unmaintainable | MEDIUM | Stop feature work; extract hooks/contexts; 1-2 week refactor with high regression risk due to no tests |
| UI overhaul breaks workflows | LOW | Revert specific changes; gather user feedback; phase changes more gradually |

## Pitfall-to-Phase Mapping

| Pitfall | Prevention Phase | Verification |
|---------|------------------|--------------|
| Arbitrary code execution via sharing | Cloud sharing design phase | Security review of import flow; CEL sanitization tests |
| Sync data loss / ghost data | Sync architecture phase | Integration tests: dual-device conflict scenarios; tombstone propagation tests |
| Plaintext token storage | Auth implementation phase | Security audit: grep for tokens in SQLite/files; verify keychain usage |
| D1 bottleneck | Cloud backend architecture phase | Load test sync endpoint with 100 concurrent users before launch |
| OAuth redirect broken in WebView | Auth implementation phase | Manual test on macOS + Windows + Linux; test with Google and GitHub providers |
| UI breaks existing workflows | UI overhaul phase (first phase) | Workflow checklist tested before and after; keyboard shortcut inventory preserved |
| App.tsx unmaintainable | Refactoring phase (before cloud) | App.tsx under 500 lines; each domain has its own hook/context |
| `env()` leaks secrets via sharing | Cloud sharing design phase | Automated test: export command with `env()` default, verify it's stripped |

## Sources

- [Cloudflare D1 Limits (official docs)](https://developers.cloudflare.com/d1/platform/limits/)
- [Cloudflare Workers Limits (official docs)](https://developers.cloudflare.com/workers/platform/limits/)
- [Cloudflare D1 FAQs](https://developers.cloudflare.com/d1/reference/faq/)
- [Wails OAuth2 callback discussion (GitHub #392)](https://github.com/wailsapp/wails/issues/392)
- [Wails OAuth popup window discussion (#2229)](https://github.com/wailsapp/wails/discussions/2229)
- [RFC 9700 - OAuth 2.0 Security Best Practices (January 2025)](https://datatracker.ietf.org/doc/rfc9700/)
- [Auth0 PKCE documentation](https://auth0.com/docs/get-started/authentication-and-authorization-flow/authorization-code-flow-with-pkce)
- [Google OAuth for native/desktop apps](https://developers.google.com/identity/protocols/oauth2/native-app)
- [zalando/go-keyring (GitHub)](https://github.com/zalando/go-keyring)
- [99designs/keyring (GitHub)](https://github.com/99designs/keyring)
- [Offline-first SQLite sync patterns (LogRocket)](https://blog.logrocket.com/offline-first-frontend-apps-2025-indexeddb-sqlite/)
- [SQLite sync conflict resolution patterns (sqliteforum)](https://www.sqliteforum.com/p/building-offline-first-applications)
- [Legacy UI redesign pitfalls (XB Software)](https://xbsoftware.com/blog/legacy-app-ui-redesign-mistakes/)
- [Duende - 7 Common OAuth Security Pitfalls](https://duendesoftware.com/learn/7-common-security-pitfalls-oauth-2-0-implementations)
- [D1 scaling with caching strategy](https://zenn.dev/jphfa/articles/cloudflare-d1-three-tier-cache?locale=en)

---
*Pitfalls research for: Cmdex v2 cloud sync, OAuth, sharing, theming*
*Researched: 2026-04-08*
