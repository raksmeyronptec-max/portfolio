"use client";

import Image from "next/image";
import { useId, useRef, useState } from "react";

import { Icon } from "@/components/ui/icon";
import { interpolate } from "@/i18n/dictionary";
import type { Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/messages/en";
import type { JourneyMediaItem } from "@/lib/content/journey";
import { trackEvent } from "@/lib/analytics/track";
import { cn } from "@/lib/utils/cn";

/**
 * Poster-first video.
 *
 * ── Why a facade rather than an iframe ─────────────────────────────────────
 * An embedded player is not a video — it is a third-party application. Rendering
 * the iframe on page load means every visitor who scrolls past a story silently
 * fetches several hundred kilobytes from a video platform and, on YouTube's
 * standard domain, hands it a cookie. None of that has anything to do with
 * reading the page.
 *
 * So nothing is requested until someone presses Play:
 *   · the poster is a normal optimised image from our own media library;
 *   · the iframe is created only in response to the click;
 *   · the privacy note says, before the click, what the click will do.
 *
 * This is also what keeps the page's Core Web Vitals unaffected by video: the
 * poster is a fixed-ratio image, so there is no layout shift and no third-party
 * script in the critical path.
 *
 * ── Never autoplay ─────────────────────────────────────────────────────────
 * `autoplay=1` is deliberately absent from the embed URL. Loading the player *is*
 * the user's action; a video that starts talking on its own is hostile to anyone
 * using a screen reader, anyone in a quiet room, and anyone on a metered
 * connection. The consequence is one extra click after Play, which is the correct
 * trade.
 *
 * ── Unrecognised hosts ─────────────────────────────────────────────────────
 * `parseVideoUrl` only produces an embed URL for YouTube and Vimeo. Anything else
 * renders the poster as an outbound link instead. A page that will frame whatever
 * URL an admin pastes is a page that will eventually frame something hostile, and
 * making it work would require opening the site's CSP `frame-src` to `*`.
 */

const PROVIDER_LABELS: Record<"youtube" | "vimeo" | "other", string> = {
  youtube: "YouTube",
  vimeo: "Vimeo",
  other: "the hosting site",
};

export function JourneyVideo({
  locale,
  t,
  item,
  entrySlug,
  aspect = "16/9",
  priority = false,
}: {
  locale: Locale;
  t: Dictionary;
  item: JourneyMediaItem;
  entrySlug: string;
  aspect?: "16/9" | "4/3";
  priority?: boolean;
}) {
  const [playing, setPlaying] = useState(false);
  const [transcriptOpen, setTranscriptOpen] = useState(false);
  const frameRef = useRef<HTMLIFrameElement>(null);
  const transcriptId = useId();

  const video = item.video;
  if (!video) return null;

  const providerLabel: string = PROVIDER_LABELS[video.provider];
  const title = video.title || item.alt || t.journey.video.playShort;

  const play = () => {
    setPlaying(true);
    void trackEvent({
      name: "journey_video_play",
      locale,
      entityType: "journey",
      entitySlug: entrySlug,
      // The provider, not the URL. An unlisted video's URL is exactly the kind of
      // thing an analytics table must not accumulate.
      properties: { provider: video.provider },
    });
  };

  return (
    <figure className="flex flex-col gap-2">
      <div
        className={cn(
          "relative w-full overflow-hidden rounded-(--radius-lg)",
          "border border-border bg-surface-muted",
          aspect === "16/9" ? "aspect-video" : "aspect-[4/3]",
        )}
      >
        {playing && video.embedUrl ? (
          <iframe
            ref={frameRef}
            src={video.embedUrl}
            title={title}
            /*
              `allow` is a deliberate allowlist, not the copy-pasted default.
              Notably absent: `autoplay` (see the header) and `camera`,
              `microphone`, `geolocation` — a video player has no business asking
              for any of them, and the permissions policy is the place to say so.
            */
            allow="accelerometer; encrypted-media; picture-in-picture; fullscreen"
            allowFullScreen
            // The player is a separate origin; sandboxing it beyond this breaks
            // fullscreen and DRM playback without adding a real guarantee.
            referrerPolicy="strict-origin-when-cross-origin"
            loading="lazy"
            className="absolute inset-0 size-full border-0"
          />
        ) : (
          <>
            <Image
              src={item.src}
              alt={
                item.alt ||
                interpolate(t.journey.video.posterAlt, { title })
              }
              fill
              sizes="(min-width: 1024px) 720px, 100vw"
              loading={priority ? "eager" : "lazy"}
              priority={priority}
              placeholder={item.blurDataURL ? "blur" : undefined}
              blurDataURL={item.blurDataURL ?? undefined}
              style={
                item.objectPosition ? { objectPosition: item.objectPosition } : undefined
              }
              className="object-cover"
            />

            {/* A scrim, so a white play button stays legible on a bright poster. */}
            <span
              aria-hidden="true"
              className="absolute inset-0 bg-gradient-to-t from-black/55 via-black/10 to-transparent"
            />

            {video.embedUrl ? (
              <button
                type="button"
                onClick={play}
                aria-label={interpolate(t.journey.video.play, { title })}
                className={cn(
                  "group absolute inset-0 flex items-center justify-center",
                  "focus-visible:outline-2 focus-visible:outline-offset-[-4px] focus-visible:outline-white",
                )}
              >
                <span
                  aria-hidden="true"
                  className={cn(
                    // 64px: comfortably past the 44px touch-target minimum, and
                    // the one control on the poster so it can afford the size.
                    "flex size-16 items-center justify-center rounded-(--radius-full)",
                    "bg-white/95 text-black shadow-(--shadow-lg) backdrop-blur-sm",
                    "transition-transform duration-200 group-hover:scale-105",
                    "motion-reduce:transition-none motion-reduce:group-hover:scale-100",
                  )}
                >
                  {/* A triangle, nudged right so it reads as centred optically. */}
                  <svg
                    width="26"
                    height="26"
                    viewBox="0 0 24 24"
                    fill="currentColor"
                    className="ml-[3px]"
                  >
                    <path d="M8 5.5v13l11-6.5z" />
                  </svg>
                </span>
              </button>
            ) : (
              /*
                Unrecognised host: an outbound link over the whole poster rather
                than a play button that cannot play. `noopener noreferrer` for the
                same reasons OutboundLink applies them.
              */
              <a
                href={video.url}
                target="_blank"
                rel="noopener noreferrer"
                onClick={play}
                className={cn(
                  "group absolute inset-0 flex items-center justify-center",
                  "focus-visible:outline-2 focus-visible:outline-offset-[-4px] focus-visible:outline-white",
                )}
              >
                <span className="sr-only">
                  {interpolate(t.journey.video.watchOn, { provider: providerLabel })}
                </span>
                <span
                  aria-hidden="true"
                  className={cn(
                    "inline-flex min-h-11 items-center gap-2 rounded-(--radius-full)",
                    "bg-white/95 px-4 text-small font-semibold text-black shadow-(--shadow-lg)",
                    "transition-transform duration-200 group-hover:scale-105",
                    "motion-reduce:transition-none motion-reduce:group-hover:scale-100",
                  )}
                >
                  <Icon name="externalLink" size={16} />
                  {interpolate(t.journey.video.watchOn, { provider: providerLabel })}
                </span>
              </a>
            )}

            {video.durationLabel ? (
              <span
                aria-hidden="true"
                className={cn(
                  "absolute right-3 bottom-3 rounded-(--radius-full)",
                  "bg-black/70 px-2 py-0.5 font-mono text-[0.75rem] text-white tabular-nums",
                )}
              >
                {video.durationLabel}
              </span>
            ) : null}
          </>
        )}
      </div>

      <figcaption className="flex flex-col gap-1.5">
        {video.title ? (
          <p className="text-small font-medium leading-relaxed">{video.title}</p>
        ) : null}

        {item.caption ? (
          <p className="max-w-[62ch] text-[0.8125rem] leading-relaxed text-foreground-muted">
            {item.caption}
          </p>
        ) : null}

        {/*
          The privacy note, shown only while the facade is up — once the player is
          loaded, saying "playing this will load the video" is stale advice.
        */}
        {!playing ? (
          <p className="text-[0.75rem] leading-relaxed text-foreground-subtle">
            {video.embedUrl
              ? interpolate(t.journey.video.privacyNote, { provider: providerLabel })
              : t.journey.video.externalOnly}
          </p>
        ) : null}

        {video.transcript ? (
          <div className="pt-1">
            <button
              type="button"
              onClick={() => setTranscriptOpen((open) => !open)}
              aria-expanded={transcriptOpen}
              aria-controls={transcriptId}
              className={cn(
                "inline-flex min-h-11 items-center gap-1.5 text-small font-medium",
                "text-foreground-muted underline decoration-border-strong underline-offset-4",
                "transition-colors hover:text-foreground hover:decoration-current",
                "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--ring)",
              )}
            >
              <Icon name={transcriptOpen ? "chevronUp" : "chevronDown"} size={15} />
              {transcriptOpen
                ? t.journey.video.hideTranscript
                : t.journey.video.showTranscript}
            </button>

            {/*
              Rendered in the DOM only when open. A transcript can be thousands of
              words; keeping a hidden copy in every story would bloat the HTML for
              the majority of visitors who never open one.
            */}
            {transcriptOpen ? (
              <div
                id={transcriptId}
                className={cn(
                  "mt-3 max-h-96 overflow-y-auto rounded-(--radius-md)",
                  "border border-border bg-surface-muted p-4",
                )}
              >
                <h3 className="sr-only">{t.journey.video.transcript}</h3>
                {/*
                  `whitespace-pre-line` preserves the paragraph breaks the admin
                  typed without needing a markdown renderer — and without
                  `dangerouslySetInnerHTML`, which `react/no-danger` forbids here.
                */}
                <p className="whitespace-pre-line text-[0.8125rem] leading-relaxed text-foreground-muted">
                  {video.transcript}
                </p>
              </div>
            ) : null}
          </div>
        ) : null}
      </figcaption>
    </figure>
  );
}
