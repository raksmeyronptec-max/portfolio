"use client";

import Image from "next/image";
import { useCallback, useEffect, useId, useRef, useState } from "react";

import { Button, IconButton } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { trackEvent } from "@/lib/analytics/track";
import { getDictionary, interpolate } from "@/i18n/dictionary";
import type { Locale } from "@/i18n/config";
import type { PublicationSamplePage } from "@/lib/content/publication";
import { cn } from "@/lib/utils/cn";

/**
 * The publication reader: sample pages, and the inline document behind them.
 *
 * ── Nothing loads until somebody asks ──────────────────────────────────────
 * The sample-page images are `loading="lazy"` and the first one is the only
 * eager fetch. The PDF iframe does not exist in the DOM at all until the reader
 * opens it — `src` is not merely blank, the element is not rendered — so a
 * visitor who never opens it pays nothing, which is the whole of section 25's
 * "do not preload full PDFs".
 *
 * ── Why the document is an iframe and not a canvas ─────────────────────────
 * Zoom, page navigation, keyboard control, text selection, find-in-page and
 * screen-reader support already exist in every browser's built-in PDF viewer, in
 * the user's own language. Reimplementing them on top of PDF.js would ship
 * ~350 KB to produce a less accessible result. The controls this component
 * provides are the ones the browser cannot: opening, closing and full screen.
 *
 * ── Focus and Escape ───────────────────────────────────────────────────────
 * An iframe swallows keystrokes — once focus is inside the PDF viewer, this
 * component's `keydown` handler never fires, so Escape would not close the
 * reader. That is why the close button is outside the frame, is focused when the
 * reader opens, and why the hint text tells the reader where Escape works.
 * Pretending to trap focus inside a cross-document boundary would be worse than
 * being honest about it.
 */
export function PublicationReader({
  slug,
  locale,
  samplePages,
  canPreviewDocument,
  previewPolicy,
  previewPageLimit,
  totalPages,
}: {
  slug: string;
  locale: Locale;
  samplePages: PublicationSamplePage[];
  /** True when the inline document preview is permitted by policy. */
  canPreviewDocument: boolean;
  previewPolicy: "none" | "sample_pages" | "first_pages" | "full";
  previewPageLimit: number | null;
  totalPages: number | null;
}) {
  const t = getDictionary(locale);
  const dialogId = useId();

  const [open, setOpen] = useState(false);
  const [activeSample, setActiveSample] = useState(0);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const previouslyFocused = useRef<HTMLElement | null>(null);

  const openReader = useCallback(() => {
    previouslyFocused.current = document.activeElement as HTMLElement | null;
    setOpen(true);
    void trackEvent({
      name: "publication_preview_open",
      entityType: "publication",
      entitySlug: slug,
      locale,
      properties: { policy: previewPolicy },
    });
  }, [slug, locale, previewPolicy]);

  const closeReader = useCallback(() => {
    setOpen(false);
    // Return focus to whatever opened the reader, or the page loses the user's
    // place entirely — the single most common keyboard-navigation failure in a
    // dialog.
    previouslyFocused.current?.focus();
  }, []);

  useEffect(() => {
    if (!open) return;

    closeButtonRef.current?.focus();

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") closeReader();
    };

    document.addEventListener("keydown", onKeyDown);
    // The page behind a full-screen reader must not scroll under it.
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [open, closeReader]);

  // ── Sample-page navigation ────────────────────────────────────────────────
  const goToSample = useCallback(
    (index: number) => {
      if (samplePages.length === 0) return;
      const next = Math.max(0, Math.min(index, samplePages.length - 1));
      setActiveSample(next);
      void trackEvent({
        name: "publication_sample_page_view",
        entityType: "publication",
        entitySlug: slug,
        locale,
        // The position, never a per-reader trail. The useful signal is whether
        // anybody gets past page two.
        properties: { position: next + 1 },
      });
    },
    [samplePages.length, slug, locale],
  );

  const onGalleryKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === "ArrowRight") {
      event.preventDefault();
      goToSample(activeSample + 1);
    } else if (event.key === "ArrowLeft") {
      event.preventDefault();
      goToSample(activeSample - 1);
    }
  };

  const policyNote =
    previewPolicy === "first_pages"
      ? interpolate(t.publications.previewFirstPages, {
          count: previewPageLimit ?? 5,
        })
      : previewPolicy === "full"
        ? t.publications.previewFull
        : t.publications.previewSampleOnly;

  const current = samplePages[activeSample];

  return (
    <div className="flex flex-col gap-4">
      {/* ── Sample pages ──────────────────────────────────────────────────── */}
      {samplePages.length > 0 ? (
        <div className="flex flex-col gap-3">
          <div
            role="group"
            aria-roledescription="carousel"
            aria-label={t.publications.samplePagesHeading}
            tabIndex={0}
            onKeyDown={onGalleryKeyDown}
            className="relative overflow-hidden rounded-(--radius-lg) border border-border bg-surface-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
          >
            {current ? (
              <figure className="m-0">
                <div className="relative mx-auto aspect-[3/4] w-full max-w-xl">
                  <Image
                    src={current.image.src}
                    alt={current.image.alt}
                    fill
                    sizes="(min-width: 768px) 36rem, 92vw"
                    className="object-contain"
                    // Only the first sample is eager; the rest arrive as the
                    // reader moves through them.
                    priority={activeSample === 0}
                    placeholder={current.image.blurDataURL ? "blur" : "empty"}
                    blurDataURL={current.image.blurDataURL ?? undefined}
                  />
                </div>

                <figcaption className="flex flex-wrap items-center justify-between gap-2 border-t border-border px-3 py-2 text-small leading-khmer text-foreground-muted">
                  <span>
                    {current.pageNumber
                      ? interpolate(t.publications.samplePageOf, {
                          page: current.pageNumber,
                        })
                      : null}
                  </span>
                  {current.caption ? (
                    <span className="min-w-0 flex-1 text-right">{current.caption}</span>
                  ) : null}
                </figcaption>
              </figure>
            ) : null}
          </div>

          {samplePages.length > 1 ? (
            <div className="flex items-center justify-between gap-3">
              <IconButton
                label={t.publications.previewPreviousPage}
                icon="chevronLeft"
                onClick={() => goToSample(activeSample - 1)}
                disabled={activeSample === 0}
              />

              {/*
               * Announced politely rather than assertively: a reader stepping
               * through pages wants the position after the image, not
               * interrupting whatever they were hearing.
               */}
              <p aria-live="polite" className="text-small tabular-nums text-foreground-muted">
                {interpolate(t.publications.previewPageOf, {
                  page: activeSample + 1,
                  total: samplePages.length,
                })}
              </p>

              <IconButton
                label={t.publications.previewNextPage}
                icon="chevronRight"
                onClick={() => goToSample(activeSample + 1)}
                disabled={activeSample === samplePages.length - 1}
              />
            </div>
          ) : null}
        </div>
      ) : null}

      {/* ── Open the document ─────────────────────────────────────────────── */}
      {canPreviewDocument ? (
        <div className="flex flex-wrap items-center gap-3">
          <Button type="button" onClick={openReader} aria-haspopup="dialog">
            <Icon name="book" size={16} />
            {t.publications.openPreview}
          </Button>
          <p className="text-small leading-khmer text-foreground-muted">{policyNote}</p>
        </div>
      ) : samplePages.length > 0 ? (
        <p className="text-small leading-khmer text-foreground-muted">
          {t.publications.previewSampleOnly}
        </p>
      ) : null}

      {/* ── The reader ────────────────────────────────────────────────────── */}
      {open ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby={`${dialogId}-title`}
          className="fixed inset-0 z-50 flex flex-col bg-[color-mix(in_oklab,var(--color-background)_92%,black)]"
        >
          <div className="flex items-center justify-between gap-3 border-b border-border px-3 py-2">
            <h2 id={`${dialogId}-title`} className="text-small font-semibold text-foreground">
              {t.publications.previewHeading}
              {totalPages ? (
                <span className="ml-2 font-normal text-foreground-muted">
                  {interpolate(t.publications.pageCountPlural, { count: totalPages })}
                </span>
              ) : null}
            </h2>

            {/*
              * A plain button rather than `<Button>`: this one needs a ref so it
              * can take focus when the reader opens, and `Button` does not
              * forward one. Styling is copied from the secondary variant rather
              * than the component being changed — a ref-forwarding refactor of a
              * shared primitive does not belong in this feature.
              */}
            <button
              ref={closeButtonRef}
              type="button"
              onClick={closeReader}
              className="inline-flex min-h-11 items-center gap-2 rounded-(--radius-md) border border-border bg-surface px-3.5 text-small font-medium text-foreground transition-colors hover:bg-surface-muted"
            >
              <Icon name="close" size={16} />
              {t.publications.closePreview}
            </button>
          </div>

          {/*
           * `title` is required, not decorative: it is the accessible name of
           * the frame, and without it a screen reader announces "frame" and
           * nothing else.
           *
           * `sandbox` is set here as well as on the response. The response
           * header is the one that counts — a `sandbox` attribute can be removed
           * by anything with DOM access — but stating it on both means a
           * misconfigured deployment that drops the header still lands closed.
           */}
          <iframe
            title={t.publications.previewHeading}
            src={`/api/publications/${encodeURIComponent(slug)}/preview`}
            sandbox=""
            className="min-h-0 flex-1 border-0 bg-surface"
          />

          <p className="border-t border-border px-3 py-2 text-[0.75rem] leading-khmer text-foreground-subtle">
            {t.publications.previewKeyboardHint}
          </p>
        </div>
      ) : null}
    </div>
  );
}

/**
 * The sample-page gallery on its own, for pages that want the images without the
 * reader controls.
 */
export function PublicationSampleGallery({
  samplePages,
  locale,
  className,
}: {
  samplePages: PublicationSamplePage[];
  locale: Locale;
  className?: string;
}) {
  const t = getDictionary(locale);
  if (samplePages.length === 0) return null;

  return (
    <ul className={cn("grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4", className)}>
      {samplePages.map((page) => (
        <li key={page.id}>
          <figure className="m-0 flex flex-col gap-1.5">
            <div className="relative aspect-[3/4] overflow-hidden rounded-(--radius-md) border border-border bg-surface-muted">
              <Image
                src={page.image.src}
                alt={page.image.alt}
                fill
                sizes="(min-width: 1024px) 20vw, (min-width: 640px) 30vw, 45vw"
                className="object-contain"
                loading="lazy"
                placeholder={page.image.blurDataURL ? "blur" : "empty"}
                blurDataURL={page.image.blurDataURL ?? undefined}
              />
            </div>
            <figcaption className="text-[0.75rem] leading-khmer text-foreground-subtle">
              {page.pageNumber
                ? interpolate(t.publications.samplePageOf, { page: page.pageNumber })
                : null}
              {page.caption ? ` — ${page.caption}` : null}
            </figcaption>
          </figure>
        </li>
      ))}
    </ul>
  );
}
