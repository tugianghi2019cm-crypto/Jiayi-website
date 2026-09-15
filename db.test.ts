import { afterEach, beforeEach, describe, expect, it } from "vitest";

// These tests exercise the *failure* paths only. They must never
// require a live PostgreSQL database, since ordinary `npm test` runs
// in CI without one (see DB-001 task scope, section 10). Live
// connectivity against a real database was verified manually — see
// the DB-001 completion report's "Live PostgreSQL Verification"
// section — not here, so this suite stays safe to run anywhere.

const MANAGED_KEYS = ["APP_ENV", "APP_BASE_URL", "DATABASE_URL"];
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

describe("TEST-DB-02 — missing DATABASE_URL fails safely when DB access is requested", () => {
  it("getPrismaClient() throws a controlled, actionable error", async () => {
    const { getPrismaClient } = await import("../db");
    expect(() => getPrismaClient()).toThrow(/Database configuration invalid/);
    expect(() => getPrismaClient()).toThrow(/DATABASE_URL/);
  });

  it("checkDatabaseConnection() returns a safe, generic failure — never throws", async () => {
    const { checkDatabaseConnection } = await import("../db");
    const result = await checkDatabaseConnection();
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.message).toBe("Database connectivity check failed.");
      expect(result.message).not.toContain("DATABASE_URL");
      expect(result.message).not.toContain("postgres");
    }
  });
});

describe("TEST-DB-04 — checkDatabaseConnection never leaks a configured secret", () => {
  it("returns a generic message even when DATABASE_URL looks secret-bearing but is malformed", async () => {
    process.env.DATABASE_URL =
      "not-a-valid-url-but-super-secret-db-password-12345";
    const { checkDatabaseConnection } = await import("../db");
    const result = await checkDatabaseConnection();
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.message).not.toContain("super-secret-db-password-12345");
      expect(result.message).toBe("Database connectivity check failed.");
    }
  });
});
