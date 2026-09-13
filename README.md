# Jiayi Website

Project foundation for the Jiayi Website.

- `FND-001` established the project structure, build tooling, and a
  minimal health-check surface.
- `FND-002` added a typed, validated environment/configuration
  contract (this is what most of this README now documents).

No Jiayi product features (auth, database, translation, storage,
push, ordering, admin, etc.) are implemented yet — this repository is
still infrastructure only.

## Requirements

- Node.js 20.9 or later
- npm (bundled with Node.js)

## Local Setup

```bash
npm install
cp .env.example .env.local   # then fill in APP_ENV and APP_BASE_URL
npm run dev
```

The app runs at `http://localhost:3000`.

- `/` — temporary placeholder confirming the foundation is running.
- `/api/health` — health/diagnostic endpoint. Returns
  `{"status":"ok","appEnvironment":"...","runtimeEnvironment":"..."}`
  on success, or a 500 with a safe (non-secret) error message if core
  configuration is missing/invalid.

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
- Every other group (`getDatabaseConfig`, `getGoogleConfig`,
  `getStorageConfig`, `getTranslationConfig`, `getPushConfig`) is
  validated only when a future feature actually calls it. None of
  them are called anywhere yet, so an unset `DATABASE_URL`,
  `GOOGLE_CLIENT_ID`, etc. cannot break the build or any unrelated
  route today.
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
| `DATABASE_URL` | PostgreSQL connection string | **Server secret** | `DB-001` connects to PostgreSQL |
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
automated quality gate for this repository.

- **Runs on:** every `push` and every `pull_request`, on any branch
  (the repository hasn't fixed a branch-naming/protection strategy
  yet, so this isn't narrowed to e.g. `main` yet).
- **Node version:** Node 20 (the latest available 20.x release),
  matching the project's `>=20.9.0` engine contract from FND-001.
- **Steps, in order:** checkout → set up Node (with npm's dependency
  cache) → `npm ci` → `npm run lint` → `npm run typecheck` → `npm
  test` → `npm run build`. Any failing step fails the whole job; none
  of them use `continue-on-error`.
- **Environment:** only the non-secret core values `APP_ENV=test` and
  `APP_BASE_URL=http://localhost:3000` are set. No database, Google,
  storage, translation, or VAPID credentials are required or
  referenced — consistent with FND-002's feature-aware validation.
- **Permissions:** `contents: read` only — the workflow cannot
  deploy, create releases, write packages, or open issues/PRs.
- **Caching:** only npm's own dependency cache (via
  `actions/setup-node`'s built-in `cache: npm`, keyed off
  `package-lock.json`). No secrets, `.env` files, or build output are
  ever cached.
- **Does NOT deploy.** This workflow only proves the code is
  installable, lint-clean, type-safe, passes its tests, and builds.
  It never deploys to Hostinger or anywhere else.
- **Database/migration validation is deferred.** `DB-001` has not
  been implemented yet, so there is no migration/schema validation
  step. A real one will be added once `DB-001` defines the migration
  contract — this workflow deliberately does not add a placeholder
  step that always "passes," since that would be a false green gate.

To reproduce the CI gate locally before pushing:

```bash
npm ci
npm run check
```

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
src/
├── app/        # Next.js App Router routes
├── components/ # Shared UI components (future tasks)
├── features/   # Feature-specific modules (future tasks)
├── lib/        # Shared utilities (future tasks)
├── server/     # Server-only code (future tasks)
├── types/      # Shared TypeScript types (future tasks)
└── config/     # Typed environment/configuration contract (env.schema.ts,
                # env.server.ts, env.public.ts, index.ts) — see above
```
