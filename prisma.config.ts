import { existsSync } from "node:fs";

import { defineConfig, env } from "prisma/config";

// Prisma's CLI does not auto-load .env.local the way Next.js does,
// so load it explicitly here for local development. In CI and other
// deployment environments, real environment variables are provided
// directly by the platform (see .github/workflows/ci.yml) and no
// .env.local file exists, so this is a no-op there.
if (existsSync(".env.local")) {
  process.loadEnvFile(".env.local");
} else if (existsSync(".env")) {
  process.loadEnvFile(".env");
}

// Prisma ORM v7 moved the datasource connection URL out of
// schema.prisma and into this config file. This file is read only by
// the Prisma CLI (generate/validate/migrate) — it is never imported
// by application code, and DATABASE_URL is still read from the
// server-only environment loader (src/config/env.server.ts) at
// application runtime. See src/server/db.ts for how the running
// application constructs its PrismaClient via a driver adapter.
export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    url: env("DATABASE_URL"),
  },
});
