import { NextResponse } from "next/server";

import { getCoreConfig } from "@/config/env.server";

/**
 * Lightweight health/diagnostic endpoint.
 *
 * Distinguishes the Jiayi *application* environment (`APP_ENV`, e.g.
 * "staging") from the Node.js *runtime* environment (`NODE_ENV`,
 * e.g. "production") — the two are independent and a staging
 * deployment legitimately runs with `NODE_ENV=production`.
 *
 * This must never expose secrets, credentials, or full environment
 * dumps. If core configuration is invalid or missing, this returns a
 * clear, non-secret error message rather than crashing unhandled.
 */
export function GET() {
  try {
    const core = getCoreConfig();
    return NextResponse.json(
      {
        status: "ok",
        appEnvironment: core.APP_ENV,
        runtimeEnvironment: process.env.NODE_ENV ?? "development",
      },
      { status: 200 },
    );
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unknown configuration error";
    return NextResponse.json({ status: "error", message }, { status: 500 });
  }
}
