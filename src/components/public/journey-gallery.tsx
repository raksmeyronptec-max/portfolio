"use client";

import Image from "next/image";
import { useCallback, useEffect, useId, useRef, useState } from "react";

import { Icon } from "@/components/ui/icon";
import { JourneyVideo } from "./journey-video";
import { interpolate } from "@/i18n/dictionary";
import { localeMeta, type Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/messages/en";
import type { JourneyMediaItem } from "@/lib/content/journey";
import { trackEvent } from "@/lib/analytics/track";
import { cn } from "@/lib/utils/cn";

/**
 * The journey story gallery.
 *
 * ── What this deliberately is not ──────────────────────────────────────────
 * Not a masonry wall, not a carousel, and not an autoplaying slideshow. A story
 * page is an editorial piece; the photographs illustrate prose that has already
 * been written. So the gallery is a calm grid at reading width, and everything
 * full-size sits behind a deliberate action.
 *
 * ── Why the lightbox is here rather than from a library ────────────────────
 * It is built on the native `<dialog>` element, exactly as `ui/dialog.tsx` and
 * the experience lightbox are, which is what supplies the focus trap,
 * Escape-to-close, the top layer, inert background content and focus restoration.
 * A third-party gallery would have to be audited for all five, and most fail at
 * least one.
 *
 * ── Videos ─────────────────────────────────────────────────────────────────
 * A video in the gallery renders its poster with a play affordance and opens
 * *in place* rather than in the lightbox. Putting a third-party iframe inside a
 * modal dialog means the focus trap has to reason about a document it does not
 * control — the player's own controls are in another browsing context — and the
 * result is a keyboard user who can tab into the video and not back out. Playing
 * inline keeps the page's focus order intact and the whole thing debuggable.
 *
 * ── Loading ────────────────────────────────────────────────────────────────
 * The grid renders the `card` derivative and the lightbox renders `preview`, so
 * opening the gallery is the first time the larger file is fetched at all.
 * Nothing full-resolution is loaded on page render.
 */

export function JourneyGallery({
  locale,
  t,
  items,
  entryLabel,
  entrySlug,
}: {
  locale: Locale;
  t: Dictionary;
  items: JourneyMediaItem[];
  /** Announced with the photo count so a screen reader knows which story. */
  entryLabel: string;
  entrySlug: string;
}) {
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

  if (items.length === 0) return null;

  /*
   * The lightbox navigates photographs only.
   *
   * A video cannot be shown in it (see the header), so including one in the
   * sequence would produce a "Photo 3 of 7" that lands on a blank stage. The
   * indices below are therefore into `photos`, and videos are rendered in the
   * grid at their own position but open inline.
   */
  const photos = items.filter((item) => item.kind === "photo");

  const openLightbox = (photoIndex: number) => {
    setLightboxIndex(photoIndex);
    void trackEvent({
      name: "journey_gallery_open",
      locale,
      entityType: "journey",
      entitySlug: entrySlug,
      properties: { position: photoIndex + 1 },
    });
  };

  return (
    <div className="flex flex-col gap-4">
      <ul
        className={cn(
          "grid list-none grid-cols-1 gap-3 p-0",
          // One column on the narrowest phones so a classroom photograph is
          // still legible; two from 480px; three once there is room for them to
          // stay above thumbnail size.
          "min-[480px]:grid-cols-2 lg:grid-cols-3",
        )}
      >
        {items.map((item) => {
          if (item.kind === "video") {
            return (
              <li key={item.id} className="min-[480px]:col-span-2">
                <JourneyVideo
                  locale={locale}
                  t={t}
                  item={item}
                  entrySlug={entrySlug}
                  aspect="16/9"
                />
              </li>
            );
          }

          const photoIndex = photos.indexOf(item);

          return (
            <li key={item.id}>
              <figure className="flex h-full flex-col gap-2">
                <button
                  type="button"
                  onClick={() => openLightbox(photoIndex)}
                  aria-label={interpolate(t.journey.gallery.openItem, {
                    caption: item.caption ?? (item.alt || entryLabel),
                  })}
                  className={cn(
                    "group relative block w-full overflow-hidden rounded-(--radius-lg)",
                    "aspect-[4/3] border border-border bg-surface-muted",
                    "transition-shadow hover:shadow-(--shadow-md)",
                    "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--ring)",
                  )}
                >
                  <Image
                    src={item.src}
                    alt={item.alt}
                    fill
                    /*
                      Three columns at 1024px inside the content container is
                      roughly a 300px slot; two columns on a tablet is about
                      45vw. Overstating this would have the browser fetch the
                      1600px preview for a 300px box.
                    */
                    sizes="(min-width: 1024px) 320px, (min-width: 480px) 45vw, 100vw"
                    loading="lazy"
                    placeholder={item.blurDataURL ? "blur" : undefined}
                    blurDataURL={item.blurDataURL ?? undefined}
                    style={
                      item.objectPosition
                        ? { objectPosition: item.objectPosition }
                        : undefined
                    }
                    className={cn(
                      "object-cover",
                      // Restrained: a 1.5% scale, and none at all under reduced
                      // motion.
                      "transition-transform duration-500 group-hover:scale-[1.015]",
                      "motion-reduce:transition-none motion-reduce:group-hover:scale-100",
                    )}
                  />
                </button>

                {item.caption || item.location || item.photoDate ? (
                  <MediaMeta locale={locale} item={item} />
                ) : null}
              </figure>
            </li>
          );
        })}
      </ul>

      {photos.length > 1 ? (
        <div>
          <button
            type="button"
            onClick={() => openLightbox(0)}
            className={cn(
              "inline-flex min-h-11 items-center gap-1.5 text-small font-medium",
              "text-foreground-muted underline decoration-border-strong underline-offset-4",
              "transition-colors hover:text-foreground hover:decoration-current",
              "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--ring)",
            )}
          >
            <Icon name="image" size={15} />
            {t.journey.gallery.viewAll}
          </button>
        </div>
      ) : null}

      <GalleryLightbox
        locale={locale}
        t={t}
        photos={photos}
        index={lightboxIndex}
        onIndexChange={setLightboxIndex}
        entryLabel={entryLabel}
        entrySlug={entrySlug}
      />
    </div>
  );
}

// ── Caption block ───────────────────────────────────────────────────────────

/**
 * `figcaption` with the caption first and the metadata after it.
 *
 * Semantic `figure`/`figcaption` rather than a styled `div`: it is what
 * associates the text with the image for assistive technology, and it is what
 * search engines read as an image description.
 */
export function MediaMeta({
  locale,
  item,
  className,
}: {
  locale: Locale;
  item: JourneyMediaItem;
  className?: string;
}) {
  const meta = [
    item.location,
    item.photoDate
      ? new Intl.DateTimeFormat(localeMeta[locale].intlLocale, {
          year: "numeric",
          month: "long",
        }).format(new Date(item.photoDate))
      : null,
    item.credit,
  ].filter(Boolean);

  return (
    <figcaption className={cn("flex flex-col gap-1", className)}>
      {item.caption ? (
        /*
          `leading-relaxed` rather than the tighter default, and no negative
          tracking. Khmer script has tall ascenders and stacked subscript
          consonants that collide at English line heights, and letter-spacing
          applied to Khmer breaks the shaping of a cluster outright.
        */
        <p className="max-w-[62ch] text-[0.8125rem] leading-relaxed text-foreground-muted">
          {item.caption}
        </p>
      ) : null}

      {meta.length > 0 ? (
        <p className="flex flex-wrap items-center gap-x-2 text-[0.75rem] text-foreground-subtle">
          {meta.map((entry, index) => (
            <span key={entry} className="inline-flex items-center gap-1.5">
              {index > 0 ? <span aria-hidden="true">·</span> : null}
              {entry}
            </span>
          ))}
        </p>
      ) : null}
    </figcaption>
  );
}

// ── Lightbox ────────────────────────────────────────────────────────────────

function GalleryLightbox({
  locale,
  t,
  photos,
  index,
  onIndexChange,
  entryLabel,
  entrySlug,
}: {
  locale: Locale;
  t: Dictionary;
  photos: JourneyMediaItem[];
  index: number | null;
  onIndexChange: (index: number | null) => void;
  entryLabel: string;
  entrySlug: string;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleId = useId();

  const open = index !== null;
  const current = index === null ? null : photos[index];
  const count = photos.length;

  const close = useCallback(() => onIndexChange(null), [onIndexChange]);

  const step = useCallback(
    (delta: number) => {
      if (index === null) return;
      const next = (index + delta + count) % count;
      onIndexChange(next);
      void trackEvent({
        name: "journey_photo_view",
        locale,
        entityType: "journey",
        entitySlug: entrySlug,
        // The position only. Never a photograph id, never a caption — this
        // answers "does anyone reach the end of a story" and nothing else.
        properties: { position: next + 1, total: count },
      });
    },
    [count, entrySlug, index, locale, onIndexChange],
  );

  // Drive the native element from state, matching ui/dialog.tsx.
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (open && !dialog.open) dialog.showModal();
    else if (!open && dialog.open) dialog.close();
  }, [open]);

  // Body scroll lock while open.
  useEffect(() => {
    if (!open) return;

    const { body } = document;
    const previousOverflow = body.style.overflow;
    const previousPadding = body.style.paddingRight;
    const scrollbar = window.innerWidth - document.documentElement.clientWidth;

    body.style.overflow = "hidden";
    if (scrollbar > 0) body.style.paddingRight = `${scrollbar}px`;

    return () => {
      body.style.overflow = previousOverflow;
      body.style.paddingRight = previousPadding;
    };
  }, [open]);

  /*
   * Arrow-key navigation.
   *
   * Escape is NOT handled here — the platform fires `cancel` on the dialog for
   * it, which is already wired below. Adding a second handler would close the
   * dialog twice and fight the browser.
   *
   * Left/Right map to previous/next in both locales. Khmer is left-to-right (see
   * `localeMeta`), so there is no RTL inversion to make; if an RTL locale is ever
   * added, this is the line that has to change.
   */
  useEffect(() => {
    if (!open) return;

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "ArrowRight") {
        event.preventDefault();
        step(1);
      } else if (event.key === "ArrowLeft") {
        event.preventDefault();
        step(-1);
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, step]);

  if (count === 0) return null;

  const position = interpolate(t.journey.gallery.position, {
    current: (index ?? 0) + 1,
    total: count,
  });

  return (
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
      onClick={(event) => {
        // Clicks on the backdrop land on the dialog itself; clicks inside the
        // panel do not.
        if (event.target === dialogRef.current) close();
      }}
      className={cn(
        // `hidden` restores display:none while closed — see the note in
        // ui/dialog.tsx; without it the closed dialog swallows page clicks.
        "hidden backdrop:bg-black/85 backdrop:backdrop-blur-[2px]",
        "fixed inset-0 m-0 h-full max-h-none w-full max-w-none bg-transparent p-0",
        "open:flex open:flex-col",
      )}
    >
      <h2 id={titleId} className="sr-only">
        {interpolate(t.journey.gallery.title, { entry: entryLabel })}
      </h2>

      {/*
        The live region announcing "Photo 2 of 5 — caption".

        `aria-live="polite"` on a separate element rather than on the image:
        moving between photographs does not move focus, so without this a screen
        reader user pressing Next hears nothing at all.
      */}
      <p aria-live="polite" className="sr-only">
        {current ? `${position} — ${current.caption ?? current.alt}` : ""}
      </p>

      {/* ── Toolbar ─────────────────────────────────────────────────────── */}
      <div className="flex shrink-0 items-center justify-between gap-4 px-4 py-3 text-white sm:px-6">
        <p className="font-mono text-[0.8125rem] text-white/80" aria-hidden="true">
          {position}
        </p>

        <button
          type="button"
          onClick={close}
          aria-label={t.journey.gallery.close}
          className={cn(
            "inline-flex size-11 items-center justify-center rounded-(--radius-full)",
            "bg-white/10 text-white transition-colors hover:bg-white/20",
            "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white",
          )}
        >
          <Icon name="close" size={20} />
        </button>
      </div>

      {/* ── Stage ───────────────────────────────────────────────────────── */}
      {/*
        `items-stretch`, NOT `items-center`.

        The figure below sizes the box that `next/image` fills. Centring the row's
        items makes the figure shrink to its own content — the caption — so the
        image's container resolves to 0px high and the photograph does not render
        at all, while every control around it still does. The previous/next
        buttons take `self-center` instead, which is where the centring was
        actually wanted.
      */}
      <div className="flex min-h-0 flex-1 items-stretch gap-2 px-2 sm:px-4">
        {count > 1 ? (
          <LightboxControl
            icon="chevronLeft"
            label={t.journey.gallery.previous}
            onClick={() => step(-1)}
          />
        ) : null}

        <figure className="flex min-h-0 flex-1 flex-col items-center justify-center gap-3">
          {current ? (
            <>
              <div className="relative flex min-h-0 w-full flex-1 items-center justify-center">
                {/*
                  The preview derivative, loaded only now — the grid used the
                  card size, so opening the gallery is the first time the larger
                  file is fetched.

                  `fill` with `object-contain` inside a flexed box: a portrait
                  and a landscape photograph both fit the viewport without
                  cropping and without either overflowing it.
                */}
                <Image
                  key={current.id}
                  src={current.fullSrc}
                  alt={current.alt}
                  fill
                  sizes="100vw"
                  priority
                  className="object-contain"
                />
              </div>

              {current.caption || current.location || current.photoDate ? (
                <div className="w-full max-w-3xl shrink-0 pb-2 text-center">
                  <MediaMeta
                    locale={locale}
                    item={current}
                    className="items-center [&_p]:text-white/80"
                  />
                </div>
              ) : null}
            </>
          ) : null}
        </figure>

        {count > 1 ? (
          <LightboxControl
            icon="chevronRight"
            label={t.journey.gallery.next}
            onClick={() => step(1)}
          />
        ) : null}
      </div>

      {/* ── Filmstrip ───────────────────────────────────────────────────── */}
      {count > 1 ? (
        <ul
          aria-label={t.journey.gallery.thumbnails}
          className="flex shrink-0 justify-start gap-2 overflow-x-auto px-4 py-4 sm:justify-center"
        >
          {photos.map((photo, photoIndex) => (
            <li key={photo.id}>
              <button
                type="button"
                onClick={() => onIndexChange(photoIndex)}
                aria-label={interpolate(t.journey.gallery.position, {
                  current: photoIndex + 1,
                  total: count,
                })}
                aria-current={photoIndex === index ? "true" : undefined}
                className={cn(
                  "relative block size-12 shrink-0 overflow-hidden rounded-(--radius-sm) sm:size-14",
                  "border-2 transition-opacity",
                  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white",
                  photoIndex === index
                    ? "border-white opacity-100"
                    : "border-transparent opacity-55 hover:opacity-90",
                )}
              >
                <Image
                  src={photo.thumbnailSrc}
                  alt=""
                  fill
                  sizes="56px"
                  className="object-cover"
                />
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </dialog>
  );
}

/**
 * Previous/next control.
 *
 * 44px minimum on every viewport, and always visible — never hover-revealed. A
 * hover-only control is unreachable by touch and by keyboard-only users, which is
 * exactly the failure mode most image galleries ship with.
 */
function LightboxControl({
  icon,
  label,
  onClick,
}: {
  icon: "chevronLeft" | "chevronRight";
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className={cn(
        "inline-flex size-11 shrink-0 self-center items-center justify-center rounded-(--radius-full)",
        "bg-white/10 text-white transition-colors hover:bg-white/20",
        "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white",
      )}
    >
      <Icon name={icon} size={22} />
    </button>
  );
}
