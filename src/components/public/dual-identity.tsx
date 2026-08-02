import Link from "next/link";

import { Icon } from "@/components/ui/icon";
import { Reveal } from "@/components/motion/reveal";
import { interpolate, type Dictionary } from "@/i18n/dictionary";
import { localePath, type Locale } from "@/i18n/config";
import type { CapabilityGroup } from "@/lib/data/cv";
import type { OwnerProfile, SiteSettings } from "@/lib/data/site";

/* ═══════════════════════════════════════════════════════════════════════════
   Dual professional identity.

   What it is for
     Every other section on this page is evidence of one half of the work. This
     is the one that says why the two halves belong to the same person — that
     the classroom is where the requirements come from, and the engineering is
     what makes them exist. Without it the site reads as a teacher who also
     codes, which undersells both.

   Where the words come from
     The two columns are the CMS's own capability groups and skills, not a
     hand-written list: adding a skill in the admin puts it here. The centre
     statement is the owner's biography — `profile.bio`, falling back to
     `settings.positioning` and then to the dictionary — so nothing on this page
     claims anything the owner has not written about themselves.

   Why the connector is a rule and not a diagram
     A bridge, a coordinate axis or a formula-to-interface animation were all
     candidates. All of them put meaning into decoration that a screen reader
     cannot reach, and at 320px they collapse into noise. A single hairline that
     joins two columns says the same thing, survives forced-colors mode, and
     costs nothing to render.
   ═══════════════════════════════════════════════════════════════════════════ */

/**
 * Which capability groups belong on which side.
 *
 * Slugs are the CMS's, matched case-insensitively. Anything unrecognised falls
 * to the product side rather than being dropped, so a group added later shows
 * up somewhere visible instead of silently disappearing — and the split is
 * checked below so a mis-slugged group cannot leave a column empty.
 */
const EDUCATION_SLUGS = new Set(["education", "academic-systems"]);

export function DualIdentity({
  locale,
  t,
  groups,
  settings,
  profile,
}: {
  locale: Locale;
  t: Dictionary;
  groups: CapabilityGroup[];
  settings: SiteSettings;
  profile: OwnerProfile | null;
}) {
  const educationGroups = groups.filter((group) =>
    EDUCATION_SLUGS.has(group.slug.toLowerCase()),
  );
  const productGroups = groups.filter(
    (group) => !EDUCATION_SLUGS.has(group.slug.toLowerCase()),
  );

  // With everything on one side there is no duality to draw. The About preview
  // that follows still carries the story, so this simply steps aside.
  if (educationGroups.length === 0 || productGroups.length === 0) return null;

  const statement = profile?.bio ?? settings.positioning ?? t.home.about.body;

  const columns = [
    {
      key: "education",
      label: t.home.dualIdentity.educationLabel,
      caption: t.home.dualIdentity.educationCaption,
      icon: "graduation" as const,
      groups: educationGroups,
    },
    {
      key: "product",
      label: t.home.dualIdentity.productLabel,
      caption: t.home.dualIdentity.productCaption,
      icon: "layers" as const,
      groups: productGroups,
    },
  ];

  return (
    <section aria-labelledby="dual-identity-heading" className="bg-surface-muted">
      <div className="container-content section-y">
        <Reveal className="flex max-w-[52ch] flex-col gap-4">
          <p className="flex items-center gap-2.5 text-eyebrow font-semibold uppercase text-accent-subtle-foreground">
            <span aria-hidden="true" className="h-px w-8 bg-accent" />
            {t.home.dualIdentity.eyebrow}
          </p>

          <h2 id="dual-identity-heading" className="text-h2">
            {t.home.dualIdentity.heading}
          </h2>
        </Reveal>

        {/* ── The two practices ────────────────────────────────────────────
            One column each at every width; they stack on mobile with the
            connector rotating from vertical to horizontal. No hover, no
            hidden content — the whole point is that both are readable at
            once. */}
        <div className="relative mt-12 grid gap-8 md:grid-cols-2 md:gap-14">
          {/* Connector. Decorative: the relationship is stated in prose below. */}
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-y-0 left-1/2 hidden w-px -translate-x-1/2 bg-gradient-to-b from-transparent via-border-strong to-transparent md:block"
          />

          {columns.map((column, index) => (
            <Reveal key={column.key} delay={index * 90}>
              <div className="flex flex-col gap-5">
                <div className="flex items-center gap-3">
                  <span
                    aria-hidden="true"
                    className="inline-flex size-11 shrink-0 items-center justify-center rounded-(--radius-lg) border border-border bg-surface text-primary"
                  >
                    <Icon name={column.icon} size={20} />
                  </span>
                  <div className="flex flex-col">
                    <h3 className="text-h4 font-semibold">{column.label}</h3>
                    <p className="text-small text-foreground-muted">
                      {column.caption}
                    </p>
                  </div>
                </div>

                {/*
                  Group names and descriptions, not the individual skills.

                  The Capabilities section further down already lists every
                  skill with the projects that evidence it. Repeating those
                  chips here would make two sections that look the same and say
                  the same thing; what this one adds is the *shape* of each
                  practice, which is exactly what a group description is.
                */}
                <ul className="flex flex-col gap-4">
                  {column.groups.map((group) => (
                    <li
                      key={group.id}
                      className="flex flex-col gap-1 border-l-2 border-border pl-4"
                    >
                      <h4 className="text-body font-semibold text-foreground">
                        {group.name}
                      </h4>
                      {group.description ? (
                        <p className="text-small text-foreground-muted">
                          {group.description}
                        </p>
                      ) : null}
                      <p className="text-[0.8125rem] text-foreground-subtle">
                        {interpolate(t.home.dualIdentity.skillCount, {
                          count: String(group.skills.length),
                        })}
                      </p>
                    </li>
                  ))}
                </ul>
              </div>
            </Reveal>
          ))}
        </div>

        {/* ── The principle that joins them ─────────────────────────────── */}
        <Reveal delay={180} className="mt-12">
          <blockquote className="relative mx-auto max-w-[58ch] rounded-(--radius-xl) border border-border bg-surface px-6 py-8 text-center sm:px-10">
            {/* A rule rather than a quotation-mark glyph: the typographic mark
                differs between Latin and Khmer and would need a second asset to
                be right in both. */}
            <span
              aria-hidden="true"
              className="mx-auto mb-5 block h-px w-12 bg-accent"
            />
            <p className="text-h4 font-medium leading-relaxed text-foreground text-balance">
              {statement}
            </p>
          </blockquote>
        </Reveal>

        <Reveal delay={220} className="mt-8 flex justify-center">
          <Link
            href={localePath(locale, "about")}
            className="group inline-flex items-center gap-2 text-body font-semibold text-primary"
          >
            {t.home.about.readMore}
            <Icon name="arrowRight" size={17} className="travel" />
          </Link>
        </Reveal>
      </div>
    </section>
  );
}
