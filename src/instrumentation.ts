/**
 * Server error reporting.
 *
 * Why this exists
 *   A production build replaces every server error with "An error occurred in
 *   the Server Components render. The specific message is omitted in production
 *   builds" plus an opaque digest. That is the right default — the message can
 *   name internal paths — but it left a real crash on /admin/profile with no way
 *   to identify it: the digest appears in the browser, the message appears in the
 *   platform log, and nothing printed both, so the two could not be joined.
 *
 *   `onRequestError` runs for every server-side error and receives both. Logging
 *   them on one line makes the reference shown on the admin error page
 *   searchable in the deployment log.
 *
 * What it deliberately does not do
 *   It does not send anything anywhere, and it does not change what the browser
 *   receives. The digest stays the only thing a client sees.
 */

export async function register() {
  // Nothing to initialise. `onRequestError` below is the whole point of the file,
  // but Next requires `register` to exist for the module to be loaded at all.
}

type ErrorRequest = {
  path: string;
  method: string;
};

type ErrorContext = {
  routerKind: string;
  routePath: string;
  routeType: string;
};

export async function onRequestError(
  error: unknown,
  request: ErrorRequest,
  context: ErrorContext,
): Promise<void> {
  const digest =
    typeof error === "object" && error !== null && "digest" in error
      ? String((error as { digest?: unknown }).digest)
      : "(no digest)";

  const message = error instanceof Error ? error.message : String(error);

  /*
   * One line, digest first, because that is the string being searched for —
   * it is what the admin error page puts in front of the person reporting the
   * problem.
   */
  console.error(
    `[server-error] digest=${digest} ${request.method} ${request.path} ` +
      `(${context.routerKind}/${context.routeType} ${context.routePath}): ${message}`,
  );

  if (error instanceof Error && error.stack) {
    console.error(error.stack);
  }
}
