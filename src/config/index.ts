/**
 * Barrel export for the configuration module.
 *
 * Intentionally exports only schema/type definitions and the
 * public-safe config accessor. Server-secret loaders
 * (`getCoreConfig`, `getDatabaseConfig`, `getGoogleConfig`,
 * `getStorageConfig`, `getTranslationConfig`, `getPushConfig`) are
 * NOT re-exported here — import them directly from `./env.server` so
 * the server-only boundary stays visible at the call site instead of
 * being hidden behind a generic barrel import.
 *
 * Note: because `getPublicConfig` itself depends on the server-only
 * loader, importing this barrel still carries the server-only
 * restriction. There is currently no part of this config contract
 * that is safe to import into a Client Component directly — public
 * values must be read on the server and passed down explicitly as
 * props.
 */

export {
  APP_ENVIRONMENTS,
  coreConfigSchema,
  databaseConfigSchema,
  googleConfigSchema,
  pushConfigSchema,
  storageConfigSchema,
  translationConfigSchema,
} from "./env.schema";

export type {
  AppEnv,
  CoreConfig,
  DatabaseConfig,
  GoogleConfig,
  PushConfig,
  StorageConfig,
  TranslationConfig,
} from "./env.schema";

export { getPublicConfig } from "./env.public";
export type { PublicConfig } from "./env.public";
