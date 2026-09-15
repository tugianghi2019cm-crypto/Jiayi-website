/**
 * Canonical Prisma client boundary.
 *
 * This is the ONLY place in the application that should construct a
 * `PrismaClient`. Application code elsewhere should call
 * `getPrismaClient()` from here rather than constructing its own
 * client.
 *
 * Server-only: this module reads database configuration (a secret)
 * and must never be bundled into a Client Component.
 *
 * Connection: Prisma ORM v7 connects via an explicit driver adapter
 * rather than a `url` embedded in schema.prisma (see
 * prisma/schema.prisma and prisma.config.ts for the CLI side of this
 * same change). `@prisma/adapter-pg` is constructed directly from our
 * own validated `DATABASE_URL`.
 *
 * Lazy validation: the client is NOT constructed at module import
 * time. `getDatabaseConfig()` (and therefore any DATABASE_URL
 * validation error) only runs the first time `getPrismaClient()` is
 * actually called — consistent with FND-002's feature-aware
 * validation principle. Simply importing this module never requires
 * DATABASE_URL to be set.
 *
 * Dev hot-reload: Next.js dev mode re-evaluates modules on every
 * change, which would otherwise create a new PrismaClient (and a new
 * underlying connection pool) on every reload. The standard fix is to
 * stash the client on `globalThis` in development only, so hot reload
 * reuses the existing instance. Production always gets a fresh,
 * single instance per process (cached in module scope, not
 * `globalThis`).
 */

import "server-only";

import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";

import { getDatabaseConfig } from "@/config/env.server";

declare global {
  var __jiayiPrismaClient: PrismaClient | undefined;
}

let cachedClient: PrismaClient | undefined;

function createPrismaClient(): PrismaClient {
  const { DATABASE_URL } = getDatabaseConfig();
  const adapter = new PrismaPg(DATABASE_URL);
  return new PrismaClient({ adapter });
}

/**
 * Returns the canonical singleton PrismaClient, constructing it (and
 * validating DATABASE_URL) on first call. Throws the same actionable,
 * secret-free error as `getDatabaseConfig()` if DATABASE_URL is
 * missing or invalid.
 */
export function getPrismaClient(): PrismaClient {
  if (globalThis.__jiayiPrismaClient) {
    return globalThis.__jiayiPrismaClient;
  }
  if (cachedClient) {
    return cachedClient;
  }

  cachedClient = createPrismaClient();

  if (process.env.NODE_ENV !== "production") {
    globalThis.__jiayiPrismaClient = cachedClient;
  }

  return cachedClient;
}

/**
 * Minimal database connectivity check for development/tests and
 * internal diagnostics. Deliberately NOT exposed through the public
 * `/api/health` endpoint (see DB-001 task scope) — callers get only a
 * boolean and a redacted message, never connection details.
 *
 * Never includes DATABASE_URL, credentials, hostnames, or raw Prisma
 * error details in its return value — this covers both a missing/
 * invalid DATABASE_URL (a config error) and a real connection failure
 * (a Prisma/network error), collapsing both into the same generic,
 * safe result.
 */
export async function checkDatabaseConnection(): Promise<
  { ok: true } | { ok: false; message: string }
> {
  try {
    const prisma = getPrismaClient();
    await prisma.$queryRaw`SELECT 1`;
    return { ok: true };
  } catch {
    return {
      ok: false,
      message: "Database connectivity check failed.",
    };
  }
}
