# Migrations

No migrations exist yet. `prisma/schema.prisma` intentionally has zero
models (DB-001 is infrastructure foundation only — see that task's
scope), so there is nothing yet to migrate.

The first real migration will be created the normal way, once a later
task adds actual models to `schema.prisma`:

```bash
npm run db:migrate:dev
```

This will create a timestamped subdirectory here containing the
generated SQL, and a `migration_lock.toml` recording the provider
(`postgresql`). Do not hand-write migration files — always generate
them via the command above so they stay in sync with the schema and
Prisma's own migration history tracking.
