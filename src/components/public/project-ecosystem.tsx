import Link from "next/link";

import { Icon } from "@/components/ui/icon";
import { Reveal } from "@/components/motion/reveal";
import { OutboundLink } from "@/components/public/outbound-link";
import { type Dictionary } from "@/i18n/dictionary";
import { localePath, type Locale } from "@/i18n/config";
import { langAttribute } from "@/lib/content/translation";
import type { ProjectCardData } from "@/lib/data/projects";
import { cn } from "@/lib/utils/cn";

/* ═══════════════════════════════════════════════════════════════════════════
   Project ecosystem.

   The problem this solves
     Listed as three cards, KruSmart, PTEC Digital Library and PTEC Storage read
     as three unrelated side projects. They are not: one is the teacher-facing
     application, one is the academic content it draws on, and one is the file
     infrastructure underneath both. Saying so is the difference between "has
     shipped three things" and "has designed a system".

   Why it is a list and not a canvas
     The brief asks for a connected node diagram on desktop, and warns against a
     decorative graphic that hides essential information. So the markup is an
     ordered list of three articles — readable with CSS off, linear for a screen
     reader, every link reachable by keyboard. The layer rail and the connectors
     are `aria-hidden` decoration painted on top of it, and they carry no text
     that is not already in the list.

     There is no hover-only content anywhere here: hover raises a card, and that
     is all it does.

   Where the words come from
     Names, summaries and URLs are the CMS project rows. The only strings this
     file adds are the three layer labels, which describe position in the stack
     rather than making any claim about a platform.
   ═══════════════════════════════════════════════════════════════════════════ */

/*
 * A note on how the layer label is chosen, because the obvious approach is
 * wrong.
 *
 * The first version labelled the three rows "Teaching", "Content" and
 * "Infrastructure" by position. That produced "Teaching — PTEC Digital
 * Library" and "Content — KruSmart", which is backwards: the library is the
 * repository and KruSmart is the teacher-facing app. Position in a featured
 * list is the owner's ranking, not a statement about what a product is, and
 * treating one as the other put a false claim on the page.
 *
 * The label is therefore the project's own primary category from the CMS. It
 * cannot go stale, it cannot contradict the project page, and re-ordering the
 * featured list can no longer relabel a product.
 */

export function ProjectEcosystem({
  projects,
  locale,
  t,
}: {
  projects: ProjectCardData[];
  locale: Locale;
  t: Dictionary;
}) {
  // A relationship diagram needs a relationship.
  if (projects.length < 2) return null;

  return (
    <section aria-labelledby="ecosystem-heading" className="bg-background">
      <div className="container-content section-y">
        <Reveal className="flex max-w-[54ch] flex-col gap-4">
          <p className="flex items-center gap-2.5 text-eyebrow font-semibold uppercase text-accent-subtle-foreground">
            <span aria-hidden="true" className="h-px w-8 bg-accent" />
            {t.home.ecosystem.eyebrow}
          </p>

          <h2 id="ecosystem-heading" className="text-h2">
            {t.home.ecosystem.heading}
          </h2>

          <p className="text-body-lg text-foreground-muted">
            {t.home.ecosystem.body}
          </p>
        </Reveal>

        <ol className="mt-12 flex flex-col gap-4">
          {projects.map((project, index) => {
            const layerLabel = project.categories[0]?.name ?? null;
            const contentLang = langAttribute(locale, project.contentLocale);
            const isLast = index === projects.length - 1;

            return (
              <li key={project.id} className="relative">
                <Reveal delay={index * 70}>
                  <article
                    className={cn(
                      "group relative grid gap-x-6 gap-y-4 rounded-(--radius-xl) border border-border",
                      "bg-surface p-6 transition-all duration-200",
                      "hover:border-border-interactive hover:shadow-md",
                      "sm:grid-cols-[auto_1fr_auto] sm:items-center",
                    )}
                  >
                    {/* ── Layer marker ─────────────────────────────────────
                        The numeral is decoration; the layer label beside it is
                        real text, because "Infrastructure" is the information
                        and a "03" is not. */}
                    <div className="flex items-center gap-3 sm:flex-col sm:items-start sm:gap-1.5">
                      <span
                        aria-hidden="true"
                        className="inline-flex size-10 items-center justify-center rounded-(--radius-full) border border-border-strong bg-surface-muted text-small font-bold tabular-nums text-foreground-muted transition-colors duration-200 group-hover:border-primary group-hover:text-primary"
                      >
                        {String(index + 1).padStart(2, "0")}
                      </span>
                      {layerLabel ? (
                        <span
                          className="text-eyebrow font-semibold uppercase tracking-wide text-foreground-subtle sm:w-24"
                          lang={contentLang}
                        >
                          {layerLabel}
                        </span>
                      ) : null}
                    </div>

                    <div className="flex flex-col gap-1.5">
                      <h3 className="text-h4 font-semibold" lang={contentLang}>
                        <Link
                          href={localePath(locale, `projects/${project.slug}`)}
                          /* The whole card is the hit area, but the anchor is
                             still just the title — so the accessible name is
                             the project name, not the entire paragraph. */
                          className="after:absolute after:inset-0 after:rounded-(--radius-xl) hover:text-primary"
                        >
                          {project.title}
                        </Link>
                      </h3>

                      {project.summary ? (
                        <p
                          className="max-w-[60ch] text-small text-foreground-muted"
                          lang={contentLang}
                        >
                          {project.summary}
                        </p>
                      ) : null}
                    </div>

                    {/* Sits above the title's overlay so it stays clickable. */}
                    {project.liveUrl ? (
                      <OutboundLink
                        href={project.liveUrl}
                        newTabHint={t.a11y.opensInNewTab}
                        event={{
                          name: "project_live_link_click",
                          locale,
                          properties: { slug: project.slug, url: project.liveUrl },
                        }}
                        className="relative z-10 inline-flex min-h-11 items-center gap-2 self-start rounded-(--radius-full) border border-border px-4 text-small font-medium text-foreground-muted transition-colors duration-200 hover:border-border-interactive hover:text-foreground sm:self-center"
                      >
                        <Icon name="externalLink" size={15} aria-hidden />
                        {t.home.ecosystem.visit}
                        <span className="sr-only"> — {project.title}</span>
                      </OutboundLink>
                    ) : null}
                  </article>
                </Reveal>

                {/* ── Connector ────────────────────────────────────────────
                    Pure decoration between the cards, drawn only where there
                    is a next card to point at. It repeats no information: the
                    order is already the list's order. */}
                {!isLast ? (
                  <div
                    aria-hidden="true"
                    className="pointer-events-none flex h-4 items-center justify-center sm:justify-start sm:pl-11"
                  >
                    <span className="h-full w-px bg-gradient-to-b from-border-strong to-border" />
                  </div>
                ) : null}
              </li>
            );
          })}
        </ol>
      </div>
    </section>
  );
}
