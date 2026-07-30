/**
 * Stub for the `server-only` package.
 *
 * `server-only` deliberately throws at import time outside a server context, which is
 * exactly what makes it useful in the app — and exactly what breaks a unit test that
 * imports a server module to test its pure helpers.
 *
 * Aliasing it to this empty module in vitest.config.ts lets the tests import, for
 * example, `lib/auth/guards.ts` in order to exercise `safeInternalPath`. The real
 * boundary is still enforced where it matters: `next build` fails if a Client
 * Component reaches a server-only module, which it did catch during this build.
 */
export {};
