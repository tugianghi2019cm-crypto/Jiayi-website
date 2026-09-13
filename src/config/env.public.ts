/**
 * Public-safe configuration boundary.
 *
 * This is an EXPLICIT ALLOWLIST — it never spreads or copies
 * `process.env`, and it never re-exports anything from the private
 * secret groups (database, storage, translation, VAPID private key,
 * Google client secret).
 *
 * This module still imports `getCoreConfig` from the server-only
 * loader, which means it inherits the server-only build boundary: it
 * cannot be bundled into a Client Component either. That's
 * intentional for this task — `getPublicConfig()` is meant to be
 * called in a Server Component (or route handler) and its plain,
 * already-filtered result passed explicitly as props to any Client
 * Component that needs it. No `NEXT_PUBLIC_*` variables or client
 * config endpoint are introduced in this task.
 */

import "server-only";

import { getCoreConfig } from "./env.server";
import type { AppEnv } from "./env.schema";

export interface PublicConfig {
  appEnv: AppEnv;
  /** Only present when GOOGLE_CLIENT_ID is actually configured. */
  googleClientId?: string;
  /** Only present when VAPID_PUBLIC_KEY is actually configured. */
  vapidPublicKey?: string;
}

export function getPublicConfig(): PublicConfig {
  const core = getCoreConfig();

  const config: PublicConfig = {
    appEnv: core.APP_ENV,
  };

  // GOOGLE_CLIENT_ID and VAPID_PUBLIC_KEY are both classified
  // PUBLIC SAFE (see README), so they are read directly here rather
  // than through getGoogleConfig()/getPushConfig() — that would
  // wrongly require their full secret groups (client secret, private
  // key, subject) to be present just to expose an id nobody has
  // configured yet.
  if (process.env.GOOGLE_CLIENT_ID) {
    config.googleClientId = process.env.GOOGLE_CLIENT_ID;
  }
  if (process.env.VAPID_PUBLIC_KEY) {
    config.vapidPublicKey = process.env.VAPID_PUBLIC_KEY;
  }

  return config;
}
