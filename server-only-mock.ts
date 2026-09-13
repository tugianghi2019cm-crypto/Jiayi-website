// Test-only stub for the `server-only` marker package.
//
// `server-only`'s real implementation throws unconditionally unless
// the bundler resolves it under Next.js's `react-server` condition
// (which only exists inside Next's own build graph). Vitest runs in
// plain Node, so without this alias every test importing
// `src/config/env.server.ts` (or anything that imports it) would
// fail immediately on the `import "server-only"` line — even though
// the code under test is not being bundled for the browser.
//
// This stub does nothing: it exists only so the marker import is a
// no-op during tests. It does not weaken the real protection, which
// is enforced by Next.js's own bundler at build time (see
// next.config.ts / the App Router build) — this file is never part
// of the production build; see vitest.config.ts's `resolve.alias`,
// which only applies to the test runner.
export {};
