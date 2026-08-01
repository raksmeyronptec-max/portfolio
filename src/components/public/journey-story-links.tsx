import Link from "next/link";

import { Icon } from "@/components/ui/icon";
import { interpolate } from "@/i18n/dictionary";
import { localePath, type Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/messages/en";
import type { LinkedJourneyStory } from "@/lib/data/journey";
import { cn } from "@/lib/utils/cn";

/**
 * "From my journey" — links from an Experience, Education or Certificate entry
 * to the stories that evidence it.
 *
 * ── What this is not ───────────────────────────────────────────────────────
 * Not a gallery. Sections 16 and 17 of the brief are explicit: the Experience
 * page stays professional evidence, and the full collection lives on the Journey
 * detail page. So this renders a link and a count, never thumbnails — the
 * Experience page already carries its own curated cover and up to three preview
 * images through `ExperiencePhotos`, and duplicating the gallery underneath would
 * be exactly the "every gallery image on the Experience page" the brief rules
 * out.
 *
 * ── A Server Component ─────────────────────────────────────────────────────
 * No interactivity, so no `"use client"`. It renders inside pages that are
 * already server-rendered and adds nothing to the client bundle.
 *
 * Renders nothing when there are no linked stories. An entry without one is
 * complete, not deficient — no placeholder, no "no stories" line, no reserved
 * space.
 */
export function JourneyStoryLinks({
  locale,
  t,
  stories,
  className,
}: {
  locale: Locale;
  t: Dictionary;
  stories: LinkedJourneyStory[] | undefined;
  className?: string;
}) {
  if (!stories || stories.length === 0) return null;

  return (
    <div className={cn("flex flex-col gap-1.5 pt-1", className)}>
      {stories.map((story) => {
        const counts = [
          story.photoCount > 0
            ? interpolate(
                story.photoCount === 1 ? t.journey.photoCount : t.journey.photoCountPlural,
                { count: story.photoCount },
              )
            : null,
          story.videoCount > 0
            ? interpolate(
                story.videoCount === 1 ? t.journey.videoCount : t.journey.videoCountPlural,
                { count: story.videoCount },
              )
            : null,
        ].filter(Boolean);

        return (
          <Link
            key={story.slug}
            href={localePath(locale, `journey/${story.slug}`)}
            className={cn(
              "inline-flex min-h-11 w-fit max-w-full items-center gap-2 text-small font-medium",
              "underline decoration-border-strong underline-offset-4 transition-colors",
              "hover:decoration-current",
              "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--ring)",
            )}
          >
            <Icon name="mapPin" size={15} className="shrink-0 text-foreground-subtle" />

            <span className="truncate">{story.title}</span>

            {/*
              The counts are the affordance: "12 photos" tells the visitor what is
              behind the link, which a bare title does not. Marked aria-hidden
              because the link text already names the destination, and a screen
              reader announcing "Science Fair Activities, 12 photos, 1 video"
              buries the title it needs to hear.
            */}
            {counts.length > 0 ? (
              <span
                aria-hidden="true"
                className="shrink-0 text-[0.75rem] font-normal text-foreground-subtle"
              >
                · {counts.join(" · ")}
              </span>
            ) : null}
          </Link>
        );
      })}
    </div>
  );
}
