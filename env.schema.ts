/**
 * Environment/configuration schemas.
 *
 * This module contains ONLY schema definitions and pure validation
 * logic — no `process.env` access, no secrets, no side effects. It is
 * safe to import from anywhere (server or client) because it never
 * reads or exposes actual configuration values.
 *
 * Actual configuration values are read and validated in
 * `env.server.ts` (secrets allowed, server-only) and exposed
 * selectively via `env.public.ts` (explicit allowlist).
 */

import { z } from "zod";

// ---------------------------------------------------------------------------
// Core application config
// ---------------------------------------------------------------------------

/**
 * The Jiayi *deployment* environment. This is a distinct concept from
 * Node's `NODE_ENV` runtime environment and must never be inferred
 * from it — a staging deployment legitimately runs with
 * `NODE_ENV=production` and `APP_ENV=staging` at the same time.
 */
export const APP_ENVIRONMENTS = [
  "development",
  "staging",
  "production",
  "test",
] as const;

export type AppEnv = (typeof APP_ENVIRONMENTS)[number];

const appEnvSchema = z.enum(APP_ENVIRONMENTS);

/**
 * Canonical application base URL. Must be an absolute http(s) URL.
 * Whether HTTP is acceptable depends on APP_ENV (local/test allow
 * HTTP; staging/production require HTTPS), so that part of the check
 * lives in `coreConfigSchema`'s cross-field refinement below, not
 * here. This schema only checks the value's own shape.
 */
const appBaseUrlSchema = z
  .string()
  .min(1, "APP_BASE_URL is required")
  .superRefine((value, ctx) => {
    let parsed: URL;
    try {
      parsed = new URL(value);
    } catch {
      ctx.addIssue({
        code: "custom",
        message: "APP_BASE_URL must be an absolute http:// or https:// URL",
      });
      return;
    }
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      ctx.addIssue({
        code: "custom",
        message: "APP_BASE_URL must use the http or https protocol",
      });
    }
  });

// Deployment environments where APP_BASE_URL must use HTTPS. No
// hostname is ever hard-coded or required — only the protocol.
const HTTPS_REQUIRED_ENVIRONMENTS: readonly AppEnv[] = [
  "staging",
  "production",
];

export const coreConfigSchema = z
  .object({
    APP_ENV: appEnvSchema,
    APP_BASE_URL: appBaseUrlSchema,
  })
  .superRefine((data, ctx) => {
    if (!HTTPS_REQUIRED_ENVIRONMENTS.includes(data.APP_ENV)) {
      return;
    }
    // APP_BASE_URL's own shape has already been validated above, so
    // this parse is expected to succeed; guard it anyway rather than
    // assume.
    let parsed: URL;
    try {
      parsed = new URL(data.APP_BASE_URL);
    } catch {
      return;
    }
    if (parsed.protocol !== "https:") {
      ctx.addIssue({
        code: "custom",
        path: ["APP_BASE_URL"],
        message: `APP_BASE_URL must use https:// when APP_ENV is "${data.APP_ENV}"`,
      });
    }
  });

export type CoreConfig = z.infer<typeof coreConfigSchema>;

// ---------------------------------------------------------------------------
// Database (DB-001)
// ---------------------------------------------------------------------------

const POSTGRES_PROTOCOLS = ["postgresql:", "postgres:"];

const databaseUrlSchema = z
  .string()
  .min(1, "DATABASE_URL is required")
  .superRefine((value, ctx) => {
    let parsed: URL;
    try {
      parsed = new URL(value);
    } catch {
      ctx.addIssue({
        code: "custom",
        message:
          "DATABASE_URL must be a valid postgresql:// connection URL",
      });
      return;
    }
    if (!POSTGRES_PROTOCOLS.includes(parsed.protocol)) {
      ctx.addIssue({
        code: "custom",
        message: "DATABASE_URL must use the postgresql:// protocol",
      });
    }
  });

export const databaseConfigSchema = z.object({
  DATABASE_URL: databaseUrlSchema,
});

export type DatabaseConfig = z.infer<typeof databaseConfigSchema>;

// ---------------------------------------------------------------------------
// Google Identity (contract only — a future AUTH task implements login)
// ---------------------------------------------------------------------------

export const googleConfigSchema = z.object({
  GOOGLE_CLIENT_ID: z.string().min(1, "GOOGLE_CLIENT_ID is required"),
  // Only required once a feature that actually needs it is enabled;
  // not required for the configuration contract itself.
  GOOGLE_CLIENT_SECRET: z.string().min(1).optional(),
});

export type GoogleConfig = z.infer<typeof googleConfigSchema>;

// ---------------------------------------------------------------------------
// Object storage (contract only — vendor-neutral, no vendor chosen)
// ---------------------------------------------------------------------------

export const storageConfigSchema = z.object({
  STORAGE_PROVIDER: z.string().min(1, "STORAGE_PROVIDER is required"),
  STORAGE_ENDPOINT: z.string().min(1, "STORAGE_ENDPOINT is required"),
  STORAGE_REGION: z.string().min(1, "STORAGE_REGION is required"),
  STORAGE_BUCKET: z.string().min(1, "STORAGE_BUCKET is required"),
  STORAGE_ACCESS_KEY_ID: z.string().min(1, "STORAGE_ACCESS_KEY_ID is required"),
  STORAGE_SECRET_ACCESS_KEY: z
    .string()
    .min(1, "STORAGE_SECRET_ACCESS_KEY is required"),
});

export type StorageConfig = z.infer<typeof storageConfigSchema>;

// ---------------------------------------------------------------------------
// Translation provider (contract only — vendor-neutral, no vendor chosen)
// ---------------------------------------------------------------------------

export const translationConfigSchema = z.object({
  TRANSLATION_PROVIDER: z.string().min(1, "TRANSLATION_PROVIDER is required"),
  TRANSLATION_API_KEY: z.string().min(1, "TRANSLATION_API_KEY is required"),
});

export type TranslationConfig = z.infer<typeof translationConfigSchema>;

// ---------------------------------------------------------------------------
// Web Push / VAPID (contract only — standards-based, no keys generated here)
// ---------------------------------------------------------------------------

const vapidSubjectSchema = z
  .string()
  .min(1, "VAPID_SUBJECT is required")
  .refine(
    (value) => value.startsWith("mailto:") || value.startsWith("https://"),
    { message: "VAPID_SUBJECT must start with mailto: or https://" },
  );

export const pushConfigSchema = z.object({
  VAPID_PUBLIC_KEY: z.string().min(1, "VAPID_PUBLIC_KEY is required"),
  VAPID_PRIVATE_KEY: z.string().min(1, "VAPID_PRIVATE_KEY is required"),
  VAPID_SUBJECT: vapidSubjectSchema,
});

export type PushConfig = z.infer<typeof pushConfigSchema>;
