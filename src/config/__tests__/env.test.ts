import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  getCoreConfig,
  getDatabaseConfig,
  getGoogleConfig,
  getPushConfig,
  getStorageConfig,
  getTranslationConfig,
} from "../env.server";
import { getPublicConfig } from "../env.public";

// Variable names that must NEVER be exposed through the public config
// contract. Used by the regression test (TEST-07) below.
const PRIVATE_ONLY_KEYS = [
  "DATABASE_URL",
  "GOOGLE_CLIENT_SECRET",
  "STORAGE_ACCESS_KEY_ID",
  "STORAGE_SECRET_ACCESS_KEY",
  "TRANSLATION_API_KEY",
  "VAPID_PRIVATE_KEY",
];

// All env vars this module set touches, so every test starts from a
// clean slate regardless of what the previous test configured.
const MANAGED_KEYS = [
  "APP_ENV",
  "APP_BASE_URL",
  "DATABASE_URL",
  "GOOGLE_CLIENT_ID",
  "GOOGLE_CLIENT_SECRET",
  "STORAGE_PROVIDER",
  "STORAGE_ENDPOINT",
  "STORAGE_REGION",
  "STORAGE_BUCKET",
  "STORAGE_ACCESS_KEY_ID",
  "STORAGE_SECRET_ACCESS_KEY",
  "TRANSLATION_PROVIDER",
  "TRANSLATION_API_KEY",
  "VAPID_PUBLIC_KEY",
  "VAPID_PRIVATE_KEY",
  "VAPID_SUBJECT",
];

const ORIGINAL_VALUES: Record<string, string | undefined> = {};

beforeEach(() => {
  for (const key of MANAGED_KEYS) {
    ORIGINAL_VALUES[key] = process.env[key];
    delete process.env[key];
  }
});

afterEach(() => {
  for (const key of MANAGED_KEYS) {
    const original = ORIGINAL_VALUES[key];
    if (original === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = original;
    }
  }
});

describe("TEST-01 — APP_ENV valid values", () => {
  it.each(["development", "staging", "production", "test"] as const)(
    "accepts APP_ENV=%s",
    (value) => {
      process.env.APP_ENV = value;
      // Use a base URL that satisfies the HTTPS-by-environment policy
      // (covered on its own in TEST-02b) so this test is only
      // exercising APP_ENV acceptance, not the URL/protocol rule.
      process.env.APP_BASE_URL =
        value === "staging" || value === "production"
          ? "https://example.com"
          : "http://localhost:3000";
      expect(() => getCoreConfig()).not.toThrow();
      expect(getCoreConfig().APP_ENV).toBe(value);
    },
  );

  it("rejects an unknown APP_ENV value", () => {
    process.env.APP_ENV = "not-a-real-environment";
    process.env.APP_BASE_URL = "http://localhost:3000";
    expect(() => getCoreConfig()).toThrow(/Core application configuration invalid/);
  });
});

describe("TEST-02 — APP_BASE_URL validation", () => {
  it("accepts http://localhost:3000", () => {
    process.env.APP_ENV = "development";
    process.env.APP_BASE_URL = "http://localhost:3000";
    expect(() => getCoreConfig()).not.toThrow();
  });

  it("accepts https://example.com", () => {
    process.env.APP_ENV = "staging";
    process.env.APP_BASE_URL = "https://example.com";
    expect(() => getCoreConfig()).not.toThrow();
  });

  it.each(["abc", "localhost", "ftp://example.com"])(
    "rejects malformed value %s",
    (value) => {
      process.env.APP_ENV = "development";
      process.env.APP_BASE_URL = value;
      expect(() => getCoreConfig()).toThrow(/Core application configuration invalid/);
    },
  );
});

describe("TEST-02b — HTTPS required for staging/production", () => {
  it("rejects APP_ENV=staging with http://example.com", () => {
    process.env.APP_ENV = "staging";
    process.env.APP_BASE_URL = "http://example.com";
    expect(() => getCoreConfig()).toThrow(
      /APP_BASE_URL must use https:\/\/ when APP_ENV is "staging"/,
    );
  });

  it("rejects APP_ENV=production with http://example.com", () => {
    process.env.APP_ENV = "production";
    process.env.APP_BASE_URL = "http://example.com";
    expect(() => getCoreConfig()).toThrow(
      /APP_BASE_URL must use https:\/\/ when APP_ENV is "production"/,
    );
  });

  it("accepts APP_ENV=staging with https://example.com", () => {
    process.env.APP_ENV = "staging";
    process.env.APP_BASE_URL = "https://example.com";
    expect(() => getCoreConfig()).not.toThrow();
  });

  it("accepts APP_ENV=production with https://example.com", () => {
    process.env.APP_ENV = "production";
    process.env.APP_BASE_URL = "https://example.com";
    expect(() => getCoreConfig()).not.toThrow();
  });

  it("still accepts APP_ENV=development with http://localhost:3000", () => {
    process.env.APP_ENV = "development";
    process.env.APP_BASE_URL = "http://localhost:3000";
    expect(() => getCoreConfig()).not.toThrow();
  });

  it("still accepts APP_ENV=test with http://localhost:3000", () => {
    process.env.APP_ENV = "test";
    process.env.APP_BASE_URL = "http://localhost:3000";
    expect(() => getCoreConfig()).not.toThrow();
  });
});

describe("TEST-03 — optional future feature groups", () => {
  it("loads core config and public config with only APP_ENV/APP_BASE_URL set", () => {
    process.env.APP_ENV = "development";
    process.env.APP_BASE_URL = "http://localhost:3000";

    // No DATABASE_URL, GOOGLE_CLIENT_ID, STORAGE_*, TRANSLATION_*, or
    // VAPID_* set at all.
    expect(() => getCoreConfig()).not.toThrow();
    expect(() => getPublicConfig()).not.toThrow();

    const publicConfig = getPublicConfig();
    expect(publicConfig.appEnv).toBe("development");
    expect(publicConfig.googleClientId).toBeUndefined();
    expect(publicConfig.vapidPublicKey).toBeUndefined();
  });
});

describe("TEST-04 — database config failure", () => {
  it("fails clearly when DATABASE_URL is missing", () => {
    expect(() => getDatabaseConfig()).toThrow(/Database configuration invalid/);
    expect(() => getDatabaseConfig()).toThrow(/DATABASE_URL/);
  });

  it("succeeds when DATABASE_URL is present", () => {
    process.env.DATABASE_URL = "postgres://user:pass@localhost:5432/example";
    expect(() => getDatabaseConfig()).not.toThrow();
  });
});

describe("TEST-05 — push config failure", () => {
  it("fails when VAPID values are incomplete", () => {
    process.env.VAPID_PUBLIC_KEY = "fake-public-key";
    // VAPID_PRIVATE_KEY and VAPID_SUBJECT intentionally left unset.
    let thrown: unknown;
    try {
      getPushConfig();
    } catch (error) {
      thrown = error;
    }
    expect(thrown).toBeInstanceOf(Error);
    const message = (thrown as Error).message;
    expect(message).toMatch(/Web Push \(VAPID\) configuration invalid/);
    // The error must not leak the one secret-shaped value that *was*
    // configured.
    expect(message).not.toContain("fake-public-key");
  });

  it("fails when VAPID_SUBJECT has the wrong shape", () => {
    process.env.VAPID_PUBLIC_KEY = "fake-public-key";
    process.env.VAPID_PRIVATE_KEY = "fake-private-key";
    process.env.VAPID_SUBJECT = "not-a-valid-subject";
    expect(() => getPushConfig()).toThrow(/VAPID_SUBJECT/);
  });

  it("succeeds when all VAPID values are present and valid", () => {
    process.env.VAPID_PUBLIC_KEY = "fake-public-key";
    process.env.VAPID_PRIVATE_KEY = "fake-private-key";
    process.env.VAPID_SUBJECT = "mailto:ops@example.com";
    expect(() => getPushConfig()).not.toThrow();
  });
});

describe("TEST-06 — public/private split", () => {
  it("never includes private keys in the public config object", () => {
    process.env.APP_ENV = "development";
    process.env.APP_BASE_URL = "http://localhost:3000";
    process.env.DATABASE_URL = "postgres://user:super-secret-pw@localhost/db";
    process.env.GOOGLE_CLIENT_SECRET = "fake-google-secret";
    process.env.STORAGE_ACCESS_KEY_ID = "fake-access-key-id";
    process.env.STORAGE_SECRET_ACCESS_KEY = "fake-secret-access-key";
    process.env.TRANSLATION_API_KEY = "fake-translation-key";
    process.env.VAPID_PRIVATE_KEY = "fake-vapid-private-key";

    const publicConfig = getPublicConfig();
    const serialized = JSON.stringify(publicConfig);

    for (const key of PRIVATE_ONLY_KEYS) {
      expect(Object.keys(publicConfig)).not.toContain(key);
      expect(serialized).not.toContain(process.env[key] as string);
    }
  });
});

describe("TEST-07 — secret leak regression", () => {
  it("only ever exposes the documented public-safe key set", () => {
    process.env.APP_ENV = "development";
    process.env.APP_BASE_URL = "http://localhost:3000";
    process.env.GOOGLE_CLIENT_ID = "fake-client-id";
    process.env.VAPID_PUBLIC_KEY = "fake-vapid-public-key";

    const allowedKeys = ["appEnv", "googleClientId", "vapidPublicKey"];
    const publicConfig = getPublicConfig();

    for (const key of Object.keys(publicConfig)) {
      expect(allowedKeys).toContain(key);
    }
    for (const key of PRIVATE_ONLY_KEYS) {
      expect(allowedKeys).not.toContain(key);
    }
  });
});

describe("TEST-08 — validation error redaction", () => {
  it("never echoes a configured secret value in a validation error", () => {
    process.env.GOOGLE_CLIENT_SECRET = "super-secret-google-value";
    // GOOGLE_CLIENT_ID intentionally left unset to force a failure.
    let thrown: unknown;
    try {
      getGoogleConfig();
    } catch (error) {
      thrown = error;
    }
    expect(thrown).toBeInstanceOf(Error);
    expect((thrown as Error).message).not.toContain(
      "super-secret-google-value",
    );
  });

  it("never echoes a configured secret value from an unrelated group", () => {
    process.env.STORAGE_ACCESS_KEY_ID = "super-secret-storage-value";
    // Other STORAGE_* values intentionally left unset to force a failure.
    let thrown: unknown;
    try {
      getStorageConfig();
    } catch (error) {
      thrown = error;
    }
    expect(thrown).toBeInstanceOf(Error);
    expect((thrown as Error).message).not.toContain(
      "super-secret-storage-value",
    );
  });

  it("never echoes a configured secret value for translation config", () => {
    process.env.TRANSLATION_API_KEY = "super-secret-translation-value";
    let thrown: unknown;
    try {
      getTranslationConfig();
    } catch (error) {
      thrown = error;
    }
    expect(thrown).toBeInstanceOf(Error);
    expect((thrown as Error).message).not.toContain(
      "super-secret-translation-value",
    );
  });
});
