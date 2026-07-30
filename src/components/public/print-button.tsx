"use client";

import { useSyncExternalStore } from "react";

import { Button } from "@/components/ui/button";

/**
 * Print trigger for the resume page.
 *
 * Renders nothing until hydrated: `window.print()` does not exist during SSR, and
 * a print button is meaningless without JavaScript, so offering one that silently
 * does nothing would be worse than not offering it. The page itself is fully
 * print-styled via `@media print`, so Cmd/Ctrl+P works regardless.
 *
 * Hydration is detected with `useSyncExternalStore` rather than a
 * `setState(true)` in an effect. Both work, but this one expresses the actual
 * intent — "the server and the client have different answers to this question" —
 * and avoids the extra render pass that setting state from an effect causes.
 */

/** Nothing ever changes after hydration, so the subscription is a no-op. */
const subscribe = () => () => {};
const getClientSnapshot = () => true;
const getServerSnapshot = () => false;

export function PrintButton({ label }: { label: string }) {
  const hydrated = useSyncExternalStore(
    subscribe,
    getClientSnapshot,
    getServerSnapshot,
  );

  if (!hydrated) return null;

  return (
    <Button variant="outline" iconStart="print" onClick={() => window.print()}>
      {label}
    </Button>
  );
}
