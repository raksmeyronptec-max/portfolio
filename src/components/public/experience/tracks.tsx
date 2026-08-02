import { Icon, type IconName } from "@/components/ui/icon";
import { Reveal } from "@/components/motion/reveal";
import type { Dictionary } from "@/i18n/messages/en";
import type { ExperienceView } from "@/lib/content/experience-view";
import type { ExperienceTrack } from "@/lib/content/experience-taxonomy";
import { trackMark } from "./marks";

/**
 * The two practices, side by side, with the sentence that joins them.
 *
 * ── Why the evidence lists are not written here ────────────────────────────
 * Each panel lists the skills that its own entries actually carry, read off the
 * CMS tags. Hand-writing them would produce a page that claims a capability the
 * timeline underneath does not evidence — the exact failure this section exists
 * to prevent — and would drift the first time a tag changed.
 *
 * ── Why the connector is a rule ────────────────────────────────────────────
 * Same reasoning as the homepage's `DualIdentity`: a bridge, an axis or an
 * animated formula all put meaning into decoration a screen reader cannot
 * reach, and all of them collapse into noise at 320px. A hairline joining two
 * columns says the same thing, survives forced-colors mode, and costs nothing.
 *
 * Renders nothing when only one track has entries. With no duality there is
 * nothing to draw, and an empty second panel would be worse than no section.
 */

const TRACK_ICONS: Record<ExperienceTrack, IconName> = {
  education: "graduation",
  product: "layers",
};

/** Skills per panel. Enough to characterise the practice, not a tag dump. */
const EVIDENCE_LIMIT = 6;

export function ExperienceTracks({
  t,
  views,
  headingId,
}: {
  t: Dictionary;
  views: ExperienceView[];
  headingId: string;
}) {
  const panels = (["education", "product"] as const).map((track) => {
    const entries = views.filter((view) => view.track === track);

    // First-seen order, which is the CMS's own tag order within the page's
    // chronological entry order — the earliest role's priorities lead.
    const seen = new Set<string>();
    const evidence: string[] = [];
    for (const entry of entries) {
      for (const tag of entry.tags) {
        if (seen.has(tag.key)) continue;
        seen.add(tag.key);
        evidence.push(tag.label);
        if (evidence.length >= EVIDENCE_LIMIT) break;
      }
      if (evidence.length >= EVIDENCE_LIMIT) break;
    }

    return {
      track,
      entryCount: entries.length,
      label: t.experience.tracks[track].label,
      statement: t.experience.tracks[track].statement,
      evidence,
    };
  });

  if (panels.some((panel) => panel.entryCount === 0)) return null;

  return (
    <section aria-labelledby={headingId} className="bg-surface-muted">
      <div className="container-content section-y">
        <Reveal className="flex max-w-[46ch] flex-col gap-4">
          <p className="flex items-center gap-2.5 text-eyebrow font-semibold uppercase text-accent-subtle-foreground">
            <span aria-hidden="true" className="h-px w-8 bg-accent" />
            {t.experience.tracks.eyebrow}
          </p>
          <h2 id={headingId} className="text-h2">
            {t.experience.tracks.heading}
          </h2>
        </Reveal>

        <div className="relative mt-10 grid gap-8 md:grid-cols-2 md:gap-14">
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-y-0 left-1/2 hidden w-px -translate-x-1/2 bg-gradient-to-b from-transparent via-border-strong to-transparent md:block"
          />

          {panels.map((panel, index) => (
            <Reveal key={panel.track} delay={index * 90}>
              <div className="flex h-full flex-col gap-5">
                <div className="flex items-start gap-3.5">
                  <span
                    aria-hidden="true"
                    className="experience-chip inline-flex size-11 shrink-0 items-center justify-center rounded-(--radius-lg) border"
                    style={{ "--mark-color": trackMark(panel.track) } as object}
                  >
                    <Icon name={TRACK_ICONS[panel.track]} size={20} />
                  </span>

                  <div className="flex flex-col gap-1">
                    <h3
                      className="experience-mark text-h4 font-semibold"
                      style={
                        { "--mark-color": trackMark(panel.track) } as object
                      }
                    >
                      {panel.label}
                    </h3>
                    <p className="max-w-[42ch] text-body text-foreground-muted">
                      {panel.statement}
                    </p>
                  </div>
                </div>

                {panel.evidence.length > 0 ? (
                  <div className="flex flex-col gap-2.5 border-s-2 border-border ps-4">
                    <p className="text-eyebrow font-semibold uppercase text-foreground-subtle">
                      {t.experience.tracks.evidence}
                    </p>
                    <ul className="flex flex-wrap gap-x-2 gap-y-1.5">
                      {panel.evidence.map((label) => (
                        <li
                          key={label}
                          className="text-small text-foreground-muted after:ms-2 after:text-foreground-subtle after:content-['·'] last:after:content-none"
                        >
                          {label}
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}
              </div>
            </Reveal>
          ))}
        </div>

        {/* ── The principle that joins them ─────────────────────────────── */}
        <Reveal delay={180} className="mt-12">
          <blockquote className="relative mx-auto max-w-[54ch] rounded-(--radius-xl) border border-border bg-surface px-6 py-8 text-center sm:px-10">
            <span
              aria-hidden="true"
              className="mx-auto mb-5 block h-px w-12"
              style={{ background: "var(--experience-connection)" }}
            />
            <p className="text-h4 font-medium leading-relaxed text-balance text-foreground">
              {t.experience.tracks.connection}
            </p>
          </blockquote>
        </Reveal>
      </div>
    </section>
  );
}
