# Jiayi Website

Project foundation for the Jiayi Website.

- `FND-001` established the project structure, build tooling, and a
  minimal health-check surface.
- `FND-002` added a typed, validated environment/configuration
  contract.
- `FND-003` added the GitHub Actions CI quality gate.
- `DB-001` added the PostgreSQL + Prisma database foundation (this is
  what the new Database section below documents) — connection,
  migration mechanism, and generated client only. No business tables
  exist yet.

No Jiayi product features (auth, business data, translation, storage,
push, ordering, admin, etc.) are implemented yet — this repository is
still infrastructure only.

## Requirements

- Node.js 22.12 or later (raised from 20.19 during DB-001 correction —
  see "Node engine requirement" below for why)
- npm (bundled with Node.js)
- PostgreSQL (for actual database work — not required to build, lint,
  typecheck, or run the app without touching the database)

### Node engine requirement

Although `prisma`/`@prisma/client` 7.10.0's own declared range
(`^20.19 || ^22.12 || >=24.0`) nominally allows Node 20.19+, two of
this project's actual installed dependencies do not support Node 20
at all:

- `prisma` depends on `@prisma/dev@0.24.17` (the package that
  implements `prisma.config.ts` loading — see Database section below)
  which depends on `@prisma/streams-local@0.1.11`, whose own
  `package.json` declares `"engines": {"node": ">=22.0.0"}`.
- `vitest@5.0.0` declares `"engines": {"node": "^22.12.0 || ^24.0.0 ||
  >=26.0.0"}` — Node 20 is not in its supported range at all.

Running on Node 20 produced real failures in GitHub Actions
(`prisma.config.ts` failed to resolve `DATABASE_URL` even though it
was correctly set), consistent with the `prisma.config.ts`-loading
code path depending on `@prisma/dev`'s Node ≥22 requirement. Node
22.12+ satisfies every installed dependency's declared engine range
with no conflicts.

## Local Setup

```bash
npm install
cp .env.example .env.local   # then fill in APP_ENV, APP_BASE_URL, and DATABASE_URL if using the database
npm run dev
```

The app runs at `http://localhost:3000`.

- `/` — temporary placeholder confirming the foundation is running.
- `/api/health` — health/diagnostic endpoint. Returns
  `{"status":"ok","appEnvironment":"...","runtimeEnvironment":"..."}`
  on success, or a 500 with a safe (non-secret) error message if core
  configuration is missing/invalid. Unchanged by DB-001 — it does not
  report database status (see Database section).

## Environment & Configuration Contract

The app distinguishes two independent concepts:

- **`NODE_ENV`** — the Node.js/Next.js *runtime* environment
  (`development` / `production` / `test`). This is set by the tooling
  itself; the app never redefines it.
- **`APP_ENV`** — the Jiayi *deployment* environment
  (`development` / `staging` / `production` / `test`), set explicitly
  by us. A staging deployment legitimately runs with
  `NODE_ENV=production` and `APP_ENV=staging` at the same time — one
  is never inferred from the other.

`APP_BASE_URL` must always be an absolute `http://` or `https://`
URL, and `getCoreConfig()` enforces a cross-field rule between the
two core values: when `APP_ENV` is `staging` or `production`,
`APP_BASE_URL` **must** use `https://` — plain HTTP is rejected with
an actionable error. `development` and `test` may use plain HTTP
(e.g. `http://localhost:3000`). No specific hostname or domain is
ever required — only the protocol, and only for those two
environments.

Configuration lives in `src/config/`:

| File | Purpose |
|---|---|
| `env.schema.ts` | Zod schemas and types only. No `process.env` access, no secrets. Safe to import anywhere. |
| `env.server.ts` | Reads `process.env`, may handle secrets. Marked `server-only` — a build-time error if ever imported into a Client Component. Exports one `getXConfig()` function per group. |
| `env.public.ts` | Explicit allowlist of browser-safe values, built from `env.server.ts`. Never spreads `process.env`. Also inherits the server-only restriction (see note below). |
| `index.ts` | Barrel export of schema/types and `getPublicConfig`. Server-secret loaders are intentionally **not** re-exported here — import them directly from `env.server.ts`. |

**Validation behavior:**

- `getCoreConfig()` (APP_ENV, APP_BASE_URL) is required in every
  environment and is called by `/api/health`.
- `getDatabaseConfig()` is called by `src/server/db.ts`'s
  `getPrismaClient()` the first time database access is actually
  used — not eagerly — so an app that never touches the database is
  unaffected by a missing `DATABASE_URL` (see Database section
  below).
- Every other group (`getGoogleConfig`, `getStorageConfig`,
  `getTranslationConfig`, `getPushConfig`) is validated only when a
  future feature actually calls it. None of them are called anywhere
  yet, so an unset `GOOGLE_CLIENT_ID`, etc. cannot break the build or
  any unrelated route today.
- A missing/invalid group throws an `Error` naming the group and the
  offending variable(s) — e.g. `Database configuration invalid:
  DATABASE_URL is required.` Actual secret values are never included
  in an error message, logged, or returned by any route.
- Nothing is memoized — each call re-reads `process.env`, so
  validation always reflects the current environment.

**Public/private split:** `getPublicConfig()` currently returns at
most `{ appEnv, googleClientId?, vapidPublicKey? }` — only the fields
that are both classified public-safe *and* actually configured.
Nothing from the database, storage, translation, or VAPID-private-key
groups, nor `GOOGLE_CLIENT_SECRET`, can ever appear there; this is
enforced by an explicit allowlist and covered by automated regression
tests (see Tests below), not by a naming convention.

No `NEXT_PUBLIC_*` variables are introduced in this task. If a value
is ever needed directly in browser JavaScript, it should be passed
explicitly as a prop from a Server Component calling
`getPublicConfig()` — not read from `process.env` in client code.

### Configuration variables

| Variable | Purpose | Classification | Required when |
|---|---|---|---|
| `APP_ENV` | Jiayi deployment environment | Server config | Always |
| `APP_BASE_URL` | Canonical absolute app URL | Server config | Always |
| `DATABASE_URL` | PostgreSQL connection string | **Server secret** | Whenever database access is actually used (`getPrismaClient()` in `src/server/db.ts`) |
| `GOOGLE_CLIENT_ID` | Google Identity client id | Public safe | A future AUTH task calls `getGoogleConfig()` |
| `GOOGLE_CLIENT_SECRET` | Google Identity client secret | **Server secret** | Only if that AUTH flow needs it |
| `STORAGE_PROVIDER` | Object storage vendor identifier | Server config | A future task calls `getStorageConfig()` |
| `STORAGE_ENDPOINT` | Object storage endpoint | Server config | same |
| `STORAGE_REGION` | Object storage region | Server config | same |
| `STORAGE_BUCKET` | Object storage bucket name | Server config | same |
| `STORAGE_ACCESS_KEY_ID` | Object storage access key id | **Server secret** | same |
| `STORAGE_SECRET_ACCESS_KEY` | Object storage secret key | **Server secret** | same |
| `TRANSLATION_PROVIDER` | Translation vendor identifier | Server config | `I18N-002` calls `getTranslationConfig()` |
| `TRANSLATION_API_KEY` | Translation vendor API key | **Server secret** | same |
| `VAPID_PUBLIC_KEY` | Web Push VAPID public key | Public safe | A future PUSH task calls `getPushConfig()` |
| `VAPID_PRIVATE_KEY` | Web Push VAPID private key | **Server secret** | same |
| `VAPID_SUBJECT` | Web Push contact (mailto: or https:) | Server config | same |

None of the feature-group variables are configured or required by
this task — the table above documents the contract future tasks will
depend on.

### Local

```bash
APP_ENV=development
APP_BASE_URL=http://localhost:3000
```

Everything else stays unset locally until its task is implemented.

### Staging (Hostinger)

The staging deployment must have these set as real Hostinger
Environment Variables — never committed to source:

```bash
APP_ENV=staging
APP_BASE_URL=<the current staging URL>
```

### Production (future)

```bash
APP_ENV=production
APP_BASE_URL=<future production domain — not decided yet>
```

### Test

Automated tests run with `APP_ENV=test` semantics where relevant and
never call a real external provider (Google, PostgreSQL, storage,
translation, or Web Push).

## Quality Checks

```bash
npm run lint       # ESLint
npm run typecheck  # TypeScript, no emit
npm test           # Vitest — config contract & public/private boundary tests
npm run build      # Production build
npm run check      # Runs all four above, in order, stopping at the first failure
```

All four individual checks (and `npm run check`, which simply chains
them) must pass before a change is considered complete.

## Continuous Integration

A GitHub Actions workflow at `.github/workflows/ci.yml` is the
automated quality gate for this repository, with two independent jobs.

### `quality` job

- **Runs on:** every `push` and every `pull_request`, on any branch
  (the repository hasn't fixed a branch-naming/protection strategy
  yet, so this isn't narrowed to e.g. `main` yet).
- **Node version:** Node 22 (the latest available 22.x release),
  matching the project's `>=22.12.0` engine contract (see Requirements
  above for why this is 22, not 20).
- **Steps, in order:** checkout → set up Node (with npm's dependency
  cache) → `npm ci` → `npm run lint` → `npm run typecheck` → `npm
  test` → `npm run build`. Any failing step fails the whole job; none
  of them use `continue-on-error`.
- **Environment:** the non-secret core values `APP_ENV=test` and
  `APP_BASE_URL=http://localhost:3000`, plus a syntactically-valid but
  entirely non-functional `DATABASE_URL` (points at a hostname that
  doesn't exist) — `npm ci`'s `postinstall` runs `prisma generate`,
  which needs a resolvable, valid-shaped `postgresql://` value to load
  its config but never actually connects to it. No Google, storage,
  translation, or VAPID credentials are required or referenced,
  consistent with FND-002's feature-aware validation. **This job never
  touches a real database** — see the separate job below for that.

### `db-verification` job

- **Purpose:** proves the Prisma + PostgreSQL mechanism itself works
  — config loads, the datasource resolves, the client generates, and
  Prisma Migrate can execute — without making the ordinary quality
  checks depend on a live database.
- **Database:** a disposable `postgres:16` GitHub Actions service
  container, created fresh for this job and destroyed when it ends.
  Credentials (`ci`/`ci`) are non-secret placeholders with no access
  outside the job — never Jiayi staging/production data.
- **Steps:** checkout → set up Node → `npm ci` → `npm run db:validate`
  (`prisma validate`) → `npm run db:generate` (`prisma generate`) →
  `npm run db:migrate:deploy` (`prisma migrate deploy`).
- Does not deploy anything and does not contact Hostinger.

### Both jobs

- **Permissions:** `contents: read` only — the workflow cannot
  deploy, create releases, write packages, or open issues/PRs.
- **Caching:** only npm's own dependency cache (via
  `actions/setup-node`'s built-in `cache: npm`, keyed off
  `package-lock.json`). No secrets, `.env` files, or build output are
  ever cached.
- **Does NOT deploy.** Neither job deploys to Hostinger or anywhere
  else — this workflow only proves the code is installable,
  lint-clean, type-safe, tested, builds, and (in `db-verification`)
  that the database mechanism works.

To reproduce the `quality` job locally before pushing:

```bash
npm ci
npm run check
```

To reproduce `db-verification` locally, point `DATABASE_URL` at your
own disposable PostgreSQL instance and run:

```bash
npm run db:validate
npm run db:generate
npm run db:migrate:deploy
```

## Database (PostgreSQL + Prisma)

DB-001 establishes the database foundation only: connection
configuration, the Prisma ORM/migration mechanism, and a generated
client. It intentionally defines zero business tables — those belong
to later tasks.

- **`DATABASE_URL`** — server secret, must be a `postgresql://` or
  `postgres://` connection URL. See the Environment & Configuration
  Contract section above for its classification.
- **`prisma/schema.prisma`** — the Prisma schema. As of Prisma ORM v7,
  the connection URL does **not** live here — only `provider =
  "postgresql"`.
- **`prisma.config.ts`** — read only by the Prisma CLI
  (`generate`/`validate`/`migrate`), never by application code. Holds
  the datasource URL (via `env("DATABASE_URL")`) and the migrations
  path. Auto-loads `.env.local` (falling back to `.env`) for local
  development, since Prisma's CLI doesn't do that the way Next.js
  does; in CI/deployment, real environment variables are provided by
  the platform directly and no `.env.local` file exists.
- **`src/server/db.ts`** — the one canonical place that constructs a
  `PrismaClient`. Application code should call `getPrismaClient()`
  from here rather than constructing its own client. Connects via
  `@prisma/adapter-pg` (a driver adapter), which Prisma ORM v7
  requires instead of a schema-embedded URL. The client is
  constructed lazily — importing this module does **not** require
  `DATABASE_URL` to be set; only actually calling `getPrismaClient()`
  (or `checkDatabaseConnection()`) does, consistent with FND-002's
  feature-aware validation. `checkDatabaseConnection()` is an internal
  helper for development/tests/diagnostics — it is deliberately not
  exposed through `/api/health` and never returns connection details,
  credentials, or raw Prisma error text, whether the failure was a
  missing/invalid `DATABASE_URL` or a real connection error.
- **`prisma/migrations/`** — version-controlled migration history.
  Currently empty (see its own README) because the schema has zero
  models; the first real migration will be created by `npm run
  db:migrate:dev` once a later task adds actual models.

### Database scripts

```bash
npm run db:generate       # Regenerate the Prisma client from schema.prisma
npm run db:validate       # Validate schema.prisma without touching a database
npm run db:migrate:dev    # Create/apply a migration in development
npm run db:migrate:deploy # Apply existing migrations (deployment)
```

`npm run db:generate` also runs automatically after `npm install`/`npm
ci` (via `postinstall`) so the generated client is always present.
This does **not** connect to a live database — it only needs
`DATABASE_URL` to be a syntactically valid `postgresql://` value (see
the CI workflow, which sets a non-functional placeholder for exactly
this reason).

## Deployment

The app builds to a standard Next.js production build (`npm run
build` followed by `npm run start`) and is suitable for any
Node.js-compatible staging host. Configure the host to:

1. Run `npm ci` (or equivalent) to install dependencies.
2. Set `APP_ENV` and `APP_BASE_URL` as real environment variables on
   the host (see Staging section above) — never commit them.
3. Run `npm run build`.
4. Start the app with `npm run start`, exposing the port the host
   assigns via the `PORT` environment variable.
5. Verify the deployment with `GET /api/health`, which should return
   HTTP 200 and a body containing `"status":"ok"`, with
   `appEnvironment` matching the deployment (e.g. `"staging"`)
   regardless of what `runtimeEnvironment` (`NODE_ENV`) reports.

No production credentials or domain-specific configuration are
included in this repository.

## Project Structure

```text
prisma/
├── schema.prisma       # Prisma schema (zero models — see Database section)
└── migrations/         # Version-controlled migration history (currently empty)
prisma.config.ts        # Prisma CLI config (datasource URL, migrations path)
src/
├── app/        # Next.js App Router routes
├── components/ # Shared UI components (future tasks)
├── features/   # Feature-specific modules (future tasks)
├── lib/        # Shared utilities (future tasks)
├── server/     # Server-only code — db.ts is the canonical Prisma client boundary
├── types/      # Shared TypeScript types (future tasks)
└── config/     # Typed environment/configuration contract (env.schema.ts,
                # env.server.ts, env.public.ts, index.ts) — see above
```
