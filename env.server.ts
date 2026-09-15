/**
 * Server-only environment loader.
 *
 * This module may read `process.env` and may handle secrets. It must
 * NEVER be imported from a Client Component — the `server-only`
 * import below makes that a build-time error if it ever happens.
 *
 * Design rules:
 * - `getCoreConfig()` validates the two values every environment
 *   needs (APP_ENV, APP_BASE_URL). Call it wherever the app needs to
 *   know its deployment environment or canonical URL.
 * - `getDatabaseConfig()` is called by the canonical Prisma client
 *   boundary (`src/server/db.ts`) the first time database access is
 *   actually used — not eagerly at module load, so an app that never
 *   touches the database is unaffected by a missing `DATABASE_URL`.
 * - Every other `getXConfig()` (Google, storage, translation, push)
 *   validates one feature/integration group on demand and is NOT
 *   called anywhere yet — those features aren't implemented. Because
 *   nothing calls them, an unset `GOOGLE_CLIENT_ID`, `VAPID_*`, etc.
 *   cannot break the build or any unrelated route.
 * - Nothing here is memoized: each call re-reads `process.env` and
 *   re-validates. Config values are tiny and validation is cheap, so
 *   this keeps behavior predictable (in particular, in tests) instead
 *   of risking stale cached values.
 * - Validation errors state which group and which variable failed,
 *   and never include the actual (potentially secret) value.
 */

import "server-only";

import type { ZodError } from "zod";

import {
  coreConfigSchema,
  databaseConfigSchema,
  googleConfigSchema,
  pushConfigSchema,
  storageConfigSchema,
  translationConfigSchema,
  type CoreConfig,
  type DatabaseConfig,
  type GoogleConfig,
  type PushConfig,
  type StorageConfig,
  type TranslationConfig,
} from "./env.schema";

function formatValidationError(group: string, error: ZodError): Error {
  const details = error.issues
    .map((issue) => `${issue.path.join(".") || "value"}: ${issue.message}`)
    .join("; ");
  return new Error(`${group} configuration invalid: ${details}`);
}

/** Core application config. Required in every environment. */
export function getCoreConfig(): CoreConfig {
  const result = coreConfigSchema.safeParse({
    APP_ENV: process.env.APP_ENV,
    APP_BASE_URL: process.env.APP_BASE_URL,
  });
  if (!result.success) {
    throw formatValidationError("Core application", result.error);
  }
  return result.data;
}

/**
 * Database config contract. Called by the canonical Prisma client
 * boundary (`src/server/db.ts`) when the database module is first
 * used — not at module import time, preserving feature-aware lazy
 * validation. DATABASE_URL's value is never included in the thrown
 * error.
 */
export function getDatabaseConfig(): DatabaseConfig {
  const result = databaseConfigSchema.safeParse({
    DATABASE_URL: process.env.DATABASE_URL,
  });
  if (!result.success) {
    throw formatValidationError("Database", result.error);
  }
  return result.data;
}

/**
 * Google Identity config contract. NOT called anywhere yet — a future
 * AUTH task will call this once login is implemented.
 */
export function getGoogleConfig(): GoogleConfig {
  const result = googleConfigSchema.safeParse({
    GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID,
    GOOGLE_CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET,
  });
  if (!result.success) {
    throw formatValidationError("Google Identity", result.error);
  }
  return result.data;
}

/**
 * Object storage config contract (vendor-neutral). NOT called
 * anywhere yet — a future task will call this once a provider is
 * chosen and upload/signed-URL support is implemented.
 */
export function getStorageConfig(): StorageConfig {
  const result = storageConfigSchema.safeParse({
    STORAGE_PROVIDER: process.env.STORAGE_PROVIDER,
    STORAGE_ENDPOINT: process.env.STORAGE_ENDPOINT,
    STORAGE_REGION: process.env.STORAGE_REGION,
    STORAGE_BUCKET: process.env.STORAGE_BUCKET,
    STORAGE_ACCESS_KEY_ID: process.env.STORAGE_ACCESS_KEY_ID,
    STORAGE_SECRET_ACCESS_KEY: process.env.STORAGE_SECRET_ACCESS_KEY,
  });
  if (!result.success) {
    throw formatValidationError("Object storage", result.error);
  }
  return result.data;
}

/**
 * Translation provider config contract (vendor-neutral). NOT called
 * anywhere yet — I18N-002 will call this once translation execution
 * is implemented.
 */
export function getTranslationConfig(): TranslationConfig {
  const result = translationConfigSchema.safeParse({
    TRANSLATION_PROVIDER: process.env.TRANSLATION_PROVIDER,
    TRANSLATION_API_KEY: process.env.TRANSLATION_API_KEY,
  });
  if (!result.success) {
    throw formatValidationError("Translation provider", result.error);
  }
  return result.data;
}

/**
 * Web Push / VAPID config contract. NOT called anywhere yet — later
 * PUSH tasks will call this once Web Push is implemented. No keys are
 * generated or validated for correctness beyond shape here.
 */
export function getPushConfig(): PushConfig {
  const result = pushConfigSchema.safeParse({
    VAPID_PUBLIC_KEY: process.env.VAPID_PUBLIC_KEY,
    VAPID_PRIVATE_KEY: process.env.VAPID_PRIVATE_KEY,
    VAPID_SUBJECT: process.env.VAPID_SUBJECT,
  });
  if (!result.success) {
    throw formatValidationError("Web Push (VAPID)", result.error);
  }
  return result.data;
}
