"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";

import { Icon } from "@/components/ui/icon";
import { interpolate } from "@/i18n/dictionary";
import type { Dictionary } from "@/i18n/messages/en";
import { cn } from "@/lib/utils/cn";

/**
 * Full-screen viewer for a credential document.
 *
 * A credential is a document, and a document that cannot be read at full size is
 * a picture of a document. The detail page shows the preview inside a 4:3 box;
 * this is how a visitor actually reads the seal, the issuing office and the
 * signature line.
 *
 * ── What it is built on, and why not a library ─────────────────────────────
 * The native `<dialog>` element, exactly as `ui/dialog.tsx` is. From the
 * platform: a real focus trap, Escape-to-close, the top layer, `aria-modal`
 * semantics with the background inert, and focus restored to the invoking
 * element on close. A third-party image viewer would have to be audited for all
 * five, and most fail at least one — usually focus restoration.
 *
 * ── What it deliberately does not do ───────────────────────────────────────
 * No right-click blocking, no transparent overlay over the image, no
 * "screenshot protection". None of those protect a document that has already
 * been sent to the browser; they only break the browser's own features for
 * people using them legitimately, and they imply a guarantee this cannot make.
 * The actual protection is upstream: the image here is the redacted copy, and
 * the unredacted original is in a private bucket with no public URL.
 *
 * No automatic full-screen and no automatic download either — both are things a
 * page does *to* someone rather than for them.
 */

const ZOOM_MIN = 1;
const ZOOM_MAX = 4;
const ZOOM_STEP = 0.5;

export function CredentialDocumentViewer({
  src,
  alt,
  title,
  t,
}: {
  /**
   * Always the redacted public preview. The private original's id is not even
   * selected by the public query, so there is no path by which its URL could
   * reach this component.
   */
  src: string;
  alt: string;
  title: string;
  t: Dictionary;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const statusId = useId();

  const [open, setOpen] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const dragRef = useRef<{ x: number; y: number; ox: number; oy: number } | null>(null);

  const reset = useCallback(() => {
    setZoom(1);
    setOffset({ x: 0, y: 0 });
  }, []);

  const close = useCallback(() => {
    setOpen(false);
    // Reset on close rather than on open: reopening should show the document
    // whole, and doing it here means the transition out is never animated from
    // a half-panned position.
    reset();
  }, [reset]);

  const changeZoom = useCallback((next: number) => {
    const clamped = Math.min(Math.max(next, ZOOM_MIN), ZOOM_MAX);
    setZoom(clamped);
    // Back to centre once the document fits again, so it cannot be left
    // scrolled off-screen with no visible way back.
    if (clamped === 1) setOffset({ x: 0, y: 0 });
  }, []);

  // Drive the native element from state.
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    else if (!open && dialog.open) dialog.close();
  }, [open]);

  // Body scroll lock, with scrollbar compensation so the page does not shift.
  useEffect(() => {
    if (!open) return;
    const { body } = document;
    const prevOverflow = body.style.overflow;
    const prevPadding = body.style.paddingRight;
    const scrollbar = window.innerWidth - document.documentElement.clientWidth;
    body.style.overflow = "hidden";
    if (scrollbar > 0) body.style.paddingRight = `${scrollbar}px`;
    return () => {
      body.style.overflow = prevOverflow;
      body.style.paddingRight = prevPadding;
    };
  }, [open]);

  /*
   * Keyboard control.
   *
   * Escape is absent on purpose — the platform fires `cancel` on the dialog for
   * it and that is already wired below. Handling it here too would close twice
   * and fight the browser.
   *
   * Arrow keys pan only while zoomed in; at 1× they are left alone so they keep
   * their normal meaning.
   */
  useEffect(() => {
    if (!open) return;

    function onKeyDown(event: KeyboardEvent) {
      const pan = 60;

      switch (event.key) {
        case "+":
        case "=":
          event.preventDefault();
          changeZoom(zoom + ZOOM_STEP);
          break;
        case "-":
        case "_":
          event.preventDefault();
          changeZoom(zoom - ZOOM_STEP);
          break;
        case "0":
          event.preventDefault();
          reset();
          break;
        case "ArrowLeft":
          if (zoom === 1) break;
          event.preventDefault();
          setOffset((o) => ({ ...o, x: o.x + pan }));
          break;
        case "ArrowRight":
          if (zoom === 1) break;
          event.preventDefault();
          setOffset((o) => ({ ...o, x: o.x - pan }));
          break;
        case "ArrowUp":
          if (zoom === 1) break;
          event.preventDefault();
          setOffset((o) => ({ ...o, y: o.y + pan }));
          break;
        case "ArrowDown":
          if (zoom === 1) break;
          event.preventDefault();
          setOffset((o) => ({ ...o, y: o.y - pan }));
          break;
        default:
          break;
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, zoom, changeZoom, reset]);

  const percent = Math.round(zoom * 100);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={cn(
          "inline-flex min-h-11 items-center gap-2 rounded-(--radius-md)",
          "border border-border-strong bg-surface px-4 text-small font-medium",
          "transition-colors hover:bg-surface-muted",
          "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--ring)",
        )}
      >
        <Icon name="search" size={16} aria-hidden="true" />
        {t.certificates.viewer.open}
      </button>

      <dialog
        ref={dialogRef}
        aria-labelledby={titleId}
        onCancel={(event) => {
          event.preventDefault();
          close();
        }}
        onClose={() => {
          if (open) close();
        }}
        className={cn(
          /*
           * `hidden` is load-bearing. A closed <dialog> is display:none only
           * because the UA stylesheet says so, and any display utility of ours
           * overrides it — leaving an invisible full-viewport layer that
           * swallows every click on the page behind it. See ui/dialog.tsx,
           * where exactly that bug was found.
           */
          "hidden backdrop:bg-black/85 backdrop:backdrop-blur-[2px]",
          "fixed inset-0 m-0 h-full max-h-none w-full max-w-none bg-transparent p-0",
          "open:flex open:flex-col",
        )}
      >
        <h2 id={titleId} className="sr-only">
          {interpolate(t.certificates.viewer.title, { title })}
        </h2>

        {/* Announced on change, so a screen-reader user knows the zoom altered
            even though focus never left the button they pressed. */}
        <p id={statusId} aria-live="polite" className="sr-only">
          {interpolate(t.certificates.viewer.level, { percent })}
        </p>

        {/* ── Toolbar ─────────────────────────────────────────────────────── */}
        <div className="flex shrink-0 flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <div className="flex items-center gap-2">
            <ViewerButton
              icon="minus"
              label={t.certificates.viewer.zoomOut}
              onClick={() => changeZoom(zoom - ZOOM_STEP)}
              disabled={zoom <= ZOOM_MIN}
            />
            <span
              aria-hidden="true"
              className="min-w-[4ch] text-center font-mono text-[0.8125rem] text-white/80"
            >
              {percent}%
            </span>
            <ViewerButton
              icon="plus"
              label={t.certificates.viewer.zoomIn}
              onClick={() => changeZoom(zoom + ZOOM_STEP)}
              disabled={zoom >= ZOOM_MAX}
            />
            <ViewerButton
              icon="refresh"
              label={t.certificates.viewer.fit}
              onClick={reset}
              disabled={zoom === 1 && offset.x === 0 && offset.y === 0}
            />
          </div>

          <ViewerButton
            icon="close"
            label={t.certificates.viewer.close}
            onClick={close}
          />
        </div>

        {/* ── Stage ───────────────────────────────────────────────────────── */}
        <div
          ref={stageRef}
          className="flex min-h-0 flex-1 items-center justify-center overflow-hidden px-2 pb-2 sm:px-6 sm:pb-6"
          onPointerDown={(event) => {
            if (zoom === 1) return;
            dragRef.current = {
              x: event.clientX,
              y: event.clientY,
              ox: offset.x,
              oy: offset.y,
            };
            event.currentTarget.setPointerCapture(event.pointerId);
          }}
          onPointerMove={(event) => {
            const drag = dragRef.current;
            if (!drag) return;
            setOffset({
              x: drag.ox + (event.clientX - drag.x),
              y: drag.oy + (event.clientY - drag.y),
            });
          }}
          onPointerUp={() => {
            dragRef.current = null;
          }}
          onPointerCancel={() => {
            dragRef.current = null;
          }}
          style={{ cursor: zoom > 1 ? "grab" : undefined }}
        >
          {/*
            A plain <img>, not next/image. The optimiser serves fixed-width
            variants, and the whole point here is scaling one image smoothly
            between 1× and 4× — a `fill` image inside a transformed box fights
            that. This is a single already-optimised WebP derivative that the
            page has usually fetched by the time the viewer opens.
          */}
          {/* eslint-disable-next-line @next/next/no-img-element -- see above */}
          <img
            src={src}
            alt={alt}
            draggable={false}
            className={cn(
              "max-h-full max-w-full object-contain select-none",
              // No transition while dragging: the offset updates every pointer
              // move, and animating each one turns a drag into a lag.
              "motion-safe:transition-transform motion-safe:duration-150",
            )}
            style={{
              transform: `translate(${offset.x}px, ${offset.y}px) scale(${zoom})`,
            }}
          />
        </div>

        {zoom > 1 ? (
          <p className="shrink-0 px-4 pb-3 text-center text-[0.75rem] text-white/60 sm:px-6">
            {t.certificates.viewer.panHint}
          </p>
        ) : null}
      </dialog>
    </>
  );
}

/** Toolbar control. 44px minimum, always visible, never hover-revealed. */
function ViewerButton({
  icon,
  label,
  onClick,
  disabled = false,
}: {
  icon: "plus" | "minus" | "refresh" | "close";
  label: string;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      className={cn(
        "inline-flex size-11 items-center justify-center rounded-(--radius-full)",
        "bg-white/10 text-white transition-colors hover:bg-white/20",
        "disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-white/10",
        "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white",
      )}
    >
      <Icon name={icon} size={19} aria-hidden="true" />
    </button>
  );
}
