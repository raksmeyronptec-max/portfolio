"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { Icon, type IconName } from "@/components/ui/icon";
import { cn } from "@/lib/utils/cn";

/**
 * Copy-to-clipboard control for the email address and the page link.
 *
 * ── Why the confirmation is a live region and not a tooltip ────────────────
 * A tooltip confirms to a pointer only. The result of pressing this button has
 * to reach a screen-reader user too, and it must not steal focus mid-task — so
 * the confirmation is text in a polite live region beside the button, which
 * announces on change and is also simply visible.
 *
 * ── Failure is a real state, not a silent one ──────────────────────────────
 * `navigator.clipboard` needs a secure context and can be refused by
 * permission policy. Both cases are caught and reported with a message that
 * tells the reader where the value actually is, because a button that appears
 * to do nothing is worse than one that says it could not.
 */
export function CopyButton({
  value,
  label,
  copiedLabel,
  failedLabel,
  icon = "copy",
  className,
}: {
  value: string;
  /** Accessible name — the control is icon-only at small sizes. */
  label: string;
  copiedLabel: string;
  failedLabel: string;
  icon?: IconName;
  className?: string;
}) {
  const [state, setState] = useState<"idle" | "copied" | "failed">("idle");
  const timer = useRef<number | null>(null);

  // Clearing on unmount stops a state update landing after navigation.
  useEffect(
    () => () => {
      if (timer.current !== null) window.clearTimeout(timer.current);
    },
    [],
  );

  const copy = useCallback(async () => {
    try {
      if (!navigator.clipboard) throw new Error("no clipboard");
      await navigator.clipboard.writeText(value);
      setState("copied");
    } catch {
      setState("failed");
    }

    if (timer.current !== null) window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setState("idle"), 2600);
  }, [value]);

  return (
    <span className={cn("inline-flex items-center gap-2", className)}>
      <button
        type="button"
        onClick={copy}
        aria-label={label}
        className={cn(
          "inline-flex size-9 items-center justify-center rounded-(--radius-md)",
          "border border-border text-foreground-muted transition-colors",
          "hover:border-border-interactive hover:text-foreground",
          "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--ring)",
        )}
      >
        <Icon name={state === "copied" ? "check" : icon} size={15} />
      </button>

      {/*
        Announced politely, and rendered as text rather than a tooltip. Empty
        while idle so nothing is announced on mount.
      */}
      <span
        aria-live="polite"
        className={cn(
          "text-[0.8125rem]",
          state === "failed" ? "text-danger-foreground" : "text-foreground-subtle",
        )}
      >
        {state === "copied" ? copiedLabel : state === "failed" ? failedLabel : ""}
      </span>
    </span>
  );
}
