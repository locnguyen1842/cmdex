# Stack Research

**Domain:** Cloud sync, OAuth, sharing, and theming additions to a Wails v2 desktop app
**Researched:** 2026-04-08
**Confidence:** MEDIUM-HIGH

## Recommended Stack

### Cloud Backend (Cloudflare)

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| Hono | ^4.12 | API framework on Workers | The de facto framework for Cloudflare Workers. Ultra-lightweight, built on Web Standards, first-class Workers support. Cloudflare's own docs recommend it. Express-like DX with middleware, routing, Zod validation via `@hono/zod-validator`. |
| Cloudflare D1 | (managed) | Cloud database | SQLite-compatible serverless DB in the Cloudflare ecosystem. Schema familiarity with existing local SQLite. 10GB per DB limit is fine for per-user command storage. |
| Cloudflare R2 | (managed) | File/theme storage | S3-compatible object storage for exported themes, shared command bundles. Presigned URLs for direct upload/download without proxying through Workers. Zero egress fees. |
| Cloudflare KV | (managed) | Session/cache storage | Fast key-value for JWT refresh tokens, rate limiting counters, short-lived cache. Not for relational data. |
| Drizzle ORM | ^0.44 | Type-safe D1 queries | Best TypeScript ORM for D1. Schema-as-code with auto-migration generation via `drizzle-kit`. Batch API support for D1's transaction model. Lightweight (no heavy runtime). |
| Wrangler | latest | CF dev/deploy CLI | Required for local D1 dev, Workers deployment, R2 management. Install as devDependency in a `cloud/` workspace. |

### Authentication

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| Arctic | ^3.7 | OAuth 2.0 client library | Lightweight (no framework lock-in), fully typed, runtime-agnostic. Built-in Google and GitHub providers. Only does authorization code flow -- exactly what we need. No bloated auth framework overhead. |
| jose | ^5.x | JWT creation/verification | Standards-compliant JOSE/JWT library. Works in Workers runtime (no Node.js crypto dependency). For issuing and verifying access/refresh tokens after OAuth code exchange. |

**OAuth flow for desktop (PKCE + localhost):**
The Go backend starts a temporary local HTTP server on a random localhost port. The app opens the system browser to the OAuth provider with PKCE `code_challenge`. After user authorizes, provider redirects to `http://localhost:{port}/callback`. Go server captures the `code`, exchanges it (with `code_verifier`) for tokens via the Cloudflare Worker API, then shuts down the local server. This is the standard pattern for desktop OAuth -- avoids custom URL schemes which are unreliable cross-platform.

**Why NOT these alternatives:**
| Avoid | Why | Use Instead |
|-------|-----|-------------|
| Auth0 / Clerk / Supabase Auth | External dependency, cost at scale, overkill for 2-provider OAuth | Arctic + custom JWT on Workers |
| Lucia Auth | Deprecated by its creator (pilcrow) in late 2024, now in maintenance mode | Arctic (same author's recommended replacement) |
| Passport.js | Node.js-only, heavy, doesn't run on Workers | Arctic |
| Cookie-based sessions | Wails webview has cookie limitations; desktop apps should use token-based auth | JWT with secure local storage |

### Sync Layer

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| Custom sync protocol | n/a | Local SQLite <-> D1 sync | No off-the-shelf library handles local-modernc-sqlite to D1 sync. Build a timestamp-based sync with change tracking. Simpler than CRDT for this use case (single-user, no concurrent multi-device editing). |

**Sync architecture:**
- Add `updated_at` (ms timestamp) and `sync_version` columns to local SQLite tables
- Add `deleted_at` (nullable timestamp) for soft deletes (tombstones)
- Track local changes in a `sync_queue` table (operation, table, record_id, timestamp)
- On sync: push local changes since last sync, pull remote changes since last sync
- Conflict resolution: **last-write-wins** by `updated_at` -- adequate for single-user multi-device
- Sync endpoint on Workers receives/sends change batches as JSON
- Go backend handles the sync orchestration; frontend triggers sync via bound Go methods

**Why NOT CRDT:**
CRDTs (cr-sqlite, etc.) add significant complexity. Cmdex is single-user -- conflicts only arise from the same user on different devices, making last-write-wins perfectly acceptable. CRDTs solve multi-user concurrent editing, which is explicitly out of scope.

### Sharing & Gallery

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| nanoid | ^5.x | Short shareable IDs | URL-friendly, 21-char IDs. 60% faster and 4x smaller than UUID. Use for share links (`/s/{nanoid}`). Go backend already uses `google/uuid` for local IDs; nanoid is for public-facing share codes only. |
| R2 presigned URLs | (CF API) | Direct theme/bundle upload | Client uploads theme files directly to R2 via presigned PUT URLs generated by Workers. No file proxying through the API. |

### Theming System

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| CSS custom properties | (native) | Runtime theme application | Already in use (`--bg-primary`, `--accent-primary`, etc. in `style.css`). Extend the existing CSS variable system rather than introducing a theming library. Zero runtime cost, instant updates, no React re-renders. |
| Tailwind v4 | ^4.2 (existing) | Utility classes referencing CSS vars | Tailwind v4's CSS-first config natively supports CSS variables. Theme tokens map to `--color-*` variables consumed by utilities. No plugin needed. |

**Theme format:** JSON schema defining color tokens, font preferences, and density settings. Exported/imported as `.cmdex-theme` files (JSON). Stored in R2 for the marketplace. Applied by setting CSS variables on `:root` at runtime.

**Why NOT these alternatives:**
| Avoid | Why | Use Instead |
|-------|-----|-------------|
| styled-components / Emotion | Runtime CSS-in-JS adds bundle size and complexity; Tailwind already handles styling | CSS variables + Tailwind |
| Theme UI / Chakra theming | Brings its own component library; conflicts with existing shadcn/ui setup | Native CSS variables |
| React context for theme values | Causes re-renders; CSS variables update without React involvement | `document.documentElement.style.setProperty()` |

### Supporting Libraries

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| @hono/zod-validator | ^0.4 | Request validation middleware | Every API endpoint that accepts user input |
| zod | ^3.23 | Schema validation (shared) | Define schemas once, use in Workers API and potentially frontend validation |
| @aws-sdk/client-s3 / @aws-sdk/s3-request-presigner | ^3.x | R2 presigned URL generation | When generating upload/download URLs for themes and shared command bundles. R2 is S3-compatible; use the official AWS SDK subset. |

### Development Tools

| Tool | Purpose | Notes |
|------|---------|-------|
| wrangler | Local D1/Workers dev | `wrangler dev` for local API; `wrangler d1 migrations` for schema |
| drizzle-kit | DB migration management | `drizzle-kit generate` creates SQL migrations from schema changes; `drizzle-kit push` for rapid local dev |
| miniflare | Workers local runtime | Bundled with wrangler; powers `wrangler dev --local` |

## Project Structure Addition

```
cloud/                        # New Cloudflare Workers project
  src/
    index.ts                  # Hono app entry
    routes/
      auth.ts                 # OAuth endpoints (login, callback, token refresh)
      sync.ts                 # Sync push/pull endpoints  
      share.ts                # Share link creation, resolution
      gallery.ts              # Public gallery browse/search
      themes.ts               # Theme CRUD, marketplace
    middleware/
      auth.ts                 # JWT verification middleware
      rateLimit.ts            # Rate limiting via KV
    db/
      schema.ts               # Drizzle schema definitions
      migrations/             # Generated SQL migrations
    lib/
      oauth.ts                # Arctic provider setup
      jwt.ts                  # Token creation/verification with jose
      sync.ts                 # Sync logic (diff, merge, conflict resolution)
  wrangler.toml               # D1, R2, KV bindings
  drizzle.config.ts
  package.json
```

## Installation

```bash
# Cloud project setup (in cloud/ directory)
pnpm init
pnpm add hono arctic jose drizzle-orm zod @hono/zod-validator nanoid
pnpm add -D wrangler drizzle-kit @cloudflare/workers-types typescript

# R2 presigned URLs (only if generating presigned URLs in Workers)
pnpm add @aws-sdk/client-s3 @aws-sdk/s3-request-presigner
```

No new frontend dependencies needed for theming (CSS variables are native). The frontend will call new Go-bound methods that handle sync/auth orchestration.

## Alternatives Considered

| Recommended | Alternative | When to Use Alternative |
|-------------|-------------|-------------------------|
| Hono | itty-router | Only if you need absolute minimal bundle size and don't need middleware |
| Drizzle ORM | Raw D1 SQL via `env.DB.prepare()` | If you have < 5 tables and don't need migrations tooling |
| Arctic | oslo/oauth2 | If you need lower-level OAuth control (Arctic uses oslo internally) |
| Custom sync | Electric SQL / cr-sqlite | If requirements change to multi-user real-time collaboration |
| JWT tokens | Cloudflare Access | If you want zero-code auth but lose control over the flow and provider customization |
| nanoid | cuid2 | If you need sortable IDs (cuid2 is monotonic); nanoid is shorter and faster for share codes |
| jose | jsonwebtoken | Never on Workers -- jsonwebtoken requires Node.js crypto. jose is the Workers-compatible choice. |

## What NOT to Use

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| Prisma | Heavy runtime, poor Workers support, slow cold starts on edge | Drizzle ORM |
| Express.js | Node.js only, doesn't run on Workers | Hono |
| Lucia Auth | Deprecated (maintenance-only since late 2024) | Arctic + custom session logic |
| jsonwebtoken (npm) | Requires Node.js `crypto` module, incompatible with Workers runtime | jose |
| Firebase / Supabase | External platforms outside Cloudflare; adds vendor dependency and cost | Cloudflare D1 + Workers + R2 |
| cookie-session | Wails WebView has known cookie handling issues; unreliable for desktop auth | JWT stored in Go-managed secure storage |
| cr-sqlite / Electric SQL | CRDT overhead unnecessary for single-user sync; adds schema complexity | Custom last-write-wins sync |
| next-themes | Designed for Next.js SSR; irrelevant in a Wails/SPA context | CSS variables set via JS |

## Version Compatibility

| Package | Compatible With | Notes |
|---------|-----------------|-------|
| hono@4.12 | wrangler@latest, @cloudflare/workers-types | First-class Workers support; test with `wrangler dev` |
| drizzle-orm@0.44 | D1 via `drizzle-orm/d1` driver | Use `drizzle-kit@0.31+` for migration generation |
| arctic@3.7 | Workers runtime (Fetch API based) | Runtime-agnostic; works anywhere with `fetch` |
| jose@5.x | Workers runtime | Pure JS, no Node.js dependencies |
| zod@3.23 | hono via @hono/zod-validator | Shared schemas between frontend validation and API |
| nanoid@5.x | Workers + browser + Node | ESM-only in v5; ensure `"type": "module"` in package.json |

## Confidence Assessment

| Area | Confidence | Reason |
|------|------------|--------|
| Hono + Workers | HIGH | Official Cloudflare recommendation, extensive docs, verified via multiple sources |
| Drizzle + D1 | HIGH | Official D1 integration documented, active maintenance, batch API support confirmed |
| Arctic for OAuth | HIGH | Verified v3 docs, confirmed Google + GitHub providers, runtime-agnostic |
| PKCE localhost pattern | HIGH | Standard OAuth pattern for desktop apps, well-documented across providers |
| jose for JWT on Workers | HIGH | Verified Workers-compatible, widely used in edge environments |
| Custom sync protocol | MEDIUM | Pattern is well-established, but implementation details need phase-specific design |
| R2 presigned URLs | HIGH | Official Cloudflare docs, S3-compatible, multiple implementation guides available |
| CSS variable theming | HIGH | Already partially implemented in Cmdex; extending existing pattern |

## Sources

- [Hono - Cloudflare Workers getting started](https://hono.dev/docs/getting-started/cloudflare-workers) -- framework setup, verified HIGH
- [Hono best practices](https://hono.dev/docs/guides/best-practices) -- middleware patterns, verified HIGH
- [Cloudflare D1 docs](https://developers.cloudflare.com/d1/) -- D1 capabilities and limits, verified HIGH
- [Drizzle ORM - Cloudflare D1](https://orm.drizzle.team/docs/connect-cloudflare-d1) -- D1 driver integration, verified HIGH
- [Arctic v3 documentation](https://arcticjs.dev/) -- OAuth client library, verified HIGH
- [Arctic Google provider](https://arcticjs.dev/providers/google) -- Google OAuth setup, verified HIGH
- [R2 presigned URLs docs](https://developers.cloudflare.com/r2/api/s3/presigned-urls/) -- upload/download pattern, verified HIGH
- [Wails OAuth discussion #2229](https://github.com/wailsapp/wails/discussions/2229) -- OAuth flow patterns in Wails, MEDIUM
- [Wails OAuth issue #392](https://github.com/wailsapp/wails/issues/392) -- Recommended callback approach, MEDIUM
- [PKCE flow explanation](https://auth0.com/docs/get-started/authentication-and-authorization-flow/authorization-code-flow-with-pkce) -- Desktop PKCE pattern, verified HIGH
- [Auth.js D1 adapter](https://authjs.dev/getting-started/adapters/d1) -- Noted but not recommended (Auth.js is SSR-focused), LOW
- [Building APIs with CF Workers and Hono](https://luisdavidgd.github.io/blog/2025-08-22-api-with-cloudflare-workers-and-hono/) -- Real-world patterns, MEDIUM
- [Hono + R2 presigned uploads guide](https://lirantal.com/blog/cloudflare-r2-presigned-url-uploads-hono) -- Implementation reference, MEDIUM

---
*Stack research for: Cmdex v2 cloud sync, sharing, and theming*
*Researched: 2026-04-08*
