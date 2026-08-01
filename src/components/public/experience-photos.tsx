"use client";

import Image from "next/image";
import { useCallback, useEffect, useId, useRef, useState } from "react";

import { Icon } from "@/components/ui/icon";
import { interpolate } from "@/i18n/dictionary";
import { localeMeta, type Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/messages/en";
import type { ExperiencePhoto } from "@/lib/content/experience-media";
import { cn } from "@/lib/utils/cn";

/**
 * Experience photographs: an editorial figure plus an optional gallery.
 *
 * ── What this deliberately is not ──────────────────────────────────────────
 * Not a masonry wall, not a carousel, and not a photo feed. The Experience page
 * is professional evidence and the prose is the evidence; a photograph
 * corroborates it. So there is exactly one image at reading size, a restrained
 * strip of thumbnails when more exist, and everything else is behind a
 * deliberate action.
 *
 * ── Progressive disclosure ─────────────────────────────────────────────────
 *   0 photos   nothing renders. No placeholder, no "no photos" text — an entry
 *              without photographs is complete, not deficient.
 *   1 photo    one figure with its caption.
 *   2–4        one figure, plus the rest as thumbnails.
 *   5+         one figure, three thumbnails, and a "+N" control that opens the
 *              gallery at the first unshown photo.
 *
 * ── Why the lightbox is here rather than in a library ──────────────────────
 * It is built on the native `<dialog>` element, exactly as `ui/dialog.tsx` is,
 * which is what supplies the focus trap, Escape-to-close, the top layer, inert
 * background content and focus restoration. A third-party gallery would have to
 * be audited for all five, and most fail at least one.
 */

const INLINE_THUMBNAIL_LIMIT = 3;

export function ExperiencePhotos({
  locale,
  t,
  cover,
  gallery,
  /** Announced with the photo count so a screen reader knows which entry. */
  entryLabel,
}: {
  locale: Locale;
  t: Dictionary;
  cover: ExperiencePhoto | null;
  gallery: ExperiencePhoto[];
  entryLabel: string;
}) {
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

  if (!cover) return null;

  const all = [cover, ...gallery];
  const inlineThumbnails = gallery.slice(0, INLINE_THUMBNAIL_LIMIT);
  const hiddenCount = gallery.length - inlineThumbnails.length;

  return (
    <div className="flex flex-col gap-3 pt-1">
      {/* ── Featured image ──────────────────────────────────────────────── */}
      <figure className="flex flex-col gap-2">
        <button
          type="button"
          onClick={() => setLightboxIndex(0)}
          aria-label={interpolate(t.experience.photos.openPhoto, {
            caption: cover.caption ?? (cover.alt || entryLabel),
          })}
          className={cn(
            "group relative block w-full overflow-hidden rounded-(--radius-lg)",
            "aspect-[16/10] border border-border bg-surface-muted",
            "transition-shadow hover:shadow-(--shadow-md)",
            "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--ring)",
          )}
        >
          <Image
            src={cover.src}
            alt={cover.alt}
            fill
            /*
              The figure occupies the timeline's content column: full width on
              mobile, and capped by the container on desktop. Overstating this
              would have the browser fetch the 1600px preview for a 600px slot.
            */
            sizes="(min-width: 1024px) 640px, (min-width: 640px) 60vw, 100vw"
            loading="lazy"
            placeholder={cover.blurDataURL ? "blur" : undefined}
            blurDataURL={cover.blurDataURL ?? undefined}
            style={
              cover.objectPosition
                ? { objectPosition: cover.objectPosition }
                : undefined
            }
            className={cn(
              "object-cover",
              // Restrained: a 1.5% scale, and none at all under reduced motion.
              "transition-transform duration-500 group-hover:scale-[1.015]",
              "motion-reduce:transition-none motion-reduce:group-hover:scale-100",
            )}
          />

          {gallery.length > 0 ? (
            <span
              aria-hidden="true"
              className={cn(
                "absolute right-3 bottom-3 inline-flex items-center gap-1.5",
                "rounded-(--radius-full) bg-black/60 px-2.5 py-1",
                "text-[0.75rem] font-medium text-white backdrop-blur-sm",
              )}
            >
              <Icon name="image" size={13} />
              {all.length}
            </span>
          ) : null}
        </button>

        {cover.caption || cover.location || cover.photoDate ? (
          <PhotoMeta locale={locale} photo={cover} />
        ) : null}
      </figure>

      {/* ── Supporting thumbnails ───────────────────────────────────────── */}
      {inlineThumbnails.length > 0 ? (
        <ul className="flex flex-wrap gap-2">
          {inlineThumbnails.map((photo, index) => (
            <li key={photo.id}>
              <button
                type="button"
                onClick={() => setLightboxIndex(index + 1)}
                aria-label={interpolate(t.experience.photos.openPhoto, {
                  caption: photo.caption ?? (photo.alt || entryLabel),
                })}
                className={cn(
                  "relative block size-16 overflow-hidden rounded-(--radius-md) sm:size-20",
                  "border border-border bg-surface-muted transition-colors",
                  "hover:border-border-interactive",
                  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--ring)",
                )}
              >
                <Image
                  src={photo.thumbnailSrc}
                  alt=""
                  fill
                  sizes="80px"
                  loading="lazy"
                  className="object-cover"
                />
              </button>
            </li>
          ))}

          {hiddenCount > 0 ? (
            <li>
              <button
                type="button"
                onClick={() => setLightboxIndex(INLINE_THUMBNAIL_LIMIT + 1)}
                className={cn(
                  "flex size-16 flex-col items-center justify-center gap-0.5 sm:size-20",
                  "rounded-(--radius-md) border border-dashed border-border-strong",
                  "text-[0.75rem] font-semibold text-foreground-muted transition-colors",
                  "hover:border-border-interactive hover:bg-surface-muted",
                  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--ring)",
                )}
              >
                <span aria-hidden="true">+{hiddenCount}</span>
                <span className="sr-only">{t.experience.photos.viewAll}</span>
              </button>
            </li>
          ) : null}
        </ul>
      ) : null}

      {/*
        A text control in addition to the thumbnails.

        The thumbnails are buttons and are perfectly reachable, but "View all
        photos" states the affordance in words — which is what a screen-reader
        user scanning by control name, and anyone who does not read a small
        square as clickable, actually needs.
      */}
      {gallery.length > 0 ? (
        <div>
          <button
            type="button"
            onClick={() => setLightboxIndex(0)}
            className={cn(
              "inline-flex min-h-11 items-center gap-1.5 text-small font-medium",
              "text-foreground-muted underline decoration-border-strong underline-offset-4",
              "transition-colors hover:text-foreground hover:decoration-current",
              "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--ring)",
            )}
          >
            <Icon name="image" size={15} />
            {gallery.length + 1 > 2
              ? t.experience.photos.viewAll
              : t.experience.photos.view}
          </button>
        </div>
      ) : null}

      <PhotoLightbox
        locale={locale}
        t={t}
        photos={all}
        index={lightboxIndex}
        onIndexChange={setLightboxIndex}
        entryLabel={entryLabel}
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
function PhotoMeta({
  locale,
  photo,
  className,
}: {
  locale: Locale;
  photo: ExperiencePhoto;
  className?: string;
}) {
  const meta = [
    photo.location,
    photo.photoDate
      ? new Intl.DateTimeFormat(localeMeta[locale].intlLocale, {
          year: "numeric",
          month: "long",
        }).format(new Date(photo.photoDate))
      : null,
    photo.credit,
  ].filter(Boolean);

  return (
    <figcaption className={cn("flex flex-col gap-1", className)}>
      {photo.caption ? (
        /*
          `leading-relaxed` rather than the tighter default, and no negative
          tracking. Khmer script has tall ascenders and stacked subscript
          consonants that collide at English line heights, and letter-spacing
          applied to Khmer breaks the shaping of a cluster outright.
        */
        <p className="max-w-[62ch] text-[0.8125rem] leading-relaxed text-foreground-muted">
          {photo.caption}
        </p>
      ) : null}

      {meta.length > 0 ? (
        <p className="flex flex-wrap items-center gap-x-2 text-[0.75rem] text-foreground-subtle">
          {meta.map((item, index) => (
            <span key={item} className="inline-flex items-center gap-1.5">
              {index > 0 ? <span aria-hidden="true">·</span> : null}
              {item}
            </span>
          ))}
        </p>
      ) : null}
    </figcaption>
  );
}

// ── Lightbox ────────────────────────────────────────────────────────────────

function PhotoLightbox({
  locale,
  t,
  photos,
  index,
  onIndexChange,
  entryLabel,
}: {
  locale: Locale;
  t: Dictionary;
  photos: ExperiencePhoto[];
  index: number | null;
  onIndexChange: (index: number | null) => void;
  entryLabel: string;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const statusId = useId();

  const open = index !== null;
  const current = index === null ? null : photos[index];
  const count = photos.length;

  const close = useCallback(() => onIndexChange(null), [onIndexChange]);

  const step = useCallback(
    (delta: number) => {
      onIndexChange(index === null ? null : (index + delta + count) % count);
    },
    [count, index, onIndexChange],
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
   * Left/Right are mapped to previous/next in both locales. Khmer is
   * left-to-right (see `localeMeta`), so there is no RTL inversion to make; if
   * an RTL locale is ever added this is the line that has to change.
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

  const position = interpolate(t.experience.photos.position, {
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
        "hidden backdrop:bg-black/80 backdrop:backdrop-blur-[2px]",
        "fixed inset-0 m-0 h-full max-h-none w-full max-w-none bg-transparent p-0",
        "open:flex open:flex-col",
      )}
    >
      <h2 id={titleId} className="sr-only">
        {interpolate(t.experience.photos.galleryTitle, { entry: entryLabel })}
      </h2>

      {/*
        The live region announcing "Photo 2 of 5 — caption".

        `aria-live="polite"` on a separate element rather than on the image:
        moving between photos does not move focus, so without this a screen
        reader user pressing Next hears nothing at all.
      */}
      <p id={statusId} aria-live="polite" className="sr-only">
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
          aria-label={t.experience.photos.close}
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
            label={t.experience.photos.previous}
            onClick={() => step(-1)}
          />
        ) : null}

        <figure className="flex min-h-0 flex-1 flex-col items-center justify-center gap-3">
          {current ? (
            <>
              <div className="relative flex min-h-0 w-full flex-1 items-center justify-center">
                {/*
                  The preview derivative, loaded only now — the inline figure
                  used the card size, so opening the gallery is the first time
                  the larger file is fetched at all.

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
                  <PhotoMeta
                    locale={locale}
                    photo={current}
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
            label={t.experience.photos.next}
            onClick={() => step(1)}
          />
        ) : null}
      </div>

      {/* ── Filmstrip ───────────────────────────────────────────────────── */}
      {count > 1 ? (
        <ul className="flex shrink-0 justify-center gap-2 overflow-x-auto px-4 py-4">
          {photos.map((photo, photoIndex) => (
            <li key={photo.id}>
              <button
                type="button"
                onClick={() => onIndexChange(photoIndex)}
                aria-label={interpolate(t.experience.photos.position, {
                  current: photoIndex + 1,
                  total: count,
                })}
                aria-current={photoIndex === index ? "true" : undefined}
                className={cn(
                  "relative block size-12 overflow-hidden rounded-(--radius-sm) sm:size-14",
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
 * 44px minimum on every viewport, and always visible — never hover-revealed.
 * A hover-only control is unreachable by touch and by keyboard-only users, which
 * is exactly the failure mode most image galleries ship with.
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
