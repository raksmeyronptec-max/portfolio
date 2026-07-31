"use client";

import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { Notice } from "@/components/ui/states";
import { useToast } from "@/components/ui/toast";
import { createOriginalSignedUrl } from "@/lib/actions/certificates";

/**
 * Owner-only viewer for a private certificate original.
 *
 * The whole point of this component is that it does *not* embed the file. It
 * requests a 60-second signed URL on demand, shows a countdown, and opens it in a
 * new tab. Rendering the scan inline would put it in the page's DOM, in the
 * browser cache and potentially in a screenshot — for a document that may carry a
 * national ID number, that is the wrong default.
 *
 * Every request is authorised server-side (owner role) and written to the audit log
 * before the URL is returned, so "who looked at this scan, and when" is answerable.
 */
export function OriginalViewer({ certificateId }: { certificateId: string }) {
  const toast = useToast();
  const [state, setState] = useState<
    | { kind: "idle" }
    | { kind: "loading" }
    | { kind: "ready"; url: string; filename: string; secondsLeft: number }
  >({ kind: "idle" });

  /*
   * Countdown, and discard the URL when it expires so a stale link is never
   * clickable.
   *
   * Expiry is handled inside the timer callback rather than in the effect body:
   * a synchronous setState there would queue an extra render on every tick.
   */
  useEffect(() => {
    if (state.kind !== "ready") return;

    const timer = window.setTimeout(() => {
      setState((current) => {
        if (current.kind !== "ready") return current;
        return current.secondsLeft <= 1
          ? { kind: "idle" }
          : { ...current, secondsLeft: current.secondsLeft - 1 };
      });
    }, 1000);

    return () => window.clearTimeout(timer);
  }, [state]);

  async function request() {
    setState({ kind: "loading" });

    const result = await createOriginalSignedUrl(certificateId);

    if (!result.ok) {
      setState({ kind: "idle" });
      toast.show({
        tone: "error",
        title: "Could not open the original",
        description:
          result.code === "forbidden"
            ? "Only the site owner can open private originals."
            : result.code === "not_found"
              ? "No original scan is attached to this credential."
              : result.detail ?? "Please try again.",
      });
      return;
    }

    setState({
      kind: "ready",
      url: result.data.url,
      filename: result.data.filename,
      secondsLeft: result.data.expiresInSeconds,
    });
  }

  return (
    <div className="flex flex-col gap-2 rounded-(--radius-md) border border-border bg-surface-muted/40 p-3">
      <p className="flex items-center gap-2 text-[0.8125rem] font-medium">
        <Icon name="lock" size={15} />
        Private original
      </p>

      {state.kind === "ready" ? (
        <div className="flex flex-col gap-2">
          <Notice tone="warning" icon="clock">
            <p aria-live="polite">
              Link expires in {state.secondsLeft}s. Access has been logged.
            </p>
          </Notice>

          <a
            href={state.url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-(--radius-md) bg-primary px-4 text-small font-medium text-primary-foreground hover:bg-primary-hover"
          >
            <Icon name="externalLink" size={16} />
            Open {state.filename}
            <span className="sr-only"> (opens in a new tab)</span>
          </a>
        </div>
      ) : (
        <>
          <p className="text-[0.8125rem] text-foreground-muted">
            Opens in a new tab through a 60-second signed link. Never embedded on this
            page, and every access is recorded in the audit log.
          </p>
          <Button
            variant="outline"
            size="sm"
            iconStart="eye"
            loading={state.kind === "loading"}
            onClick={request}
          >
            Request access
          </Button>
        </>
      )}
    </div>
  );
}
