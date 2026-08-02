import Link from "next/link";

import { Icon, type IconName } from "@/components/ui/icon";
import { Reveal } from "@/components/motion/reveal";
import { type Dictionary } from "@/i18n/dictionary";
import { localePath, type Locale } from "@/i18n/config";
import { langAttribute } from "@/lib/content/translation";
import type { ProjectCardData } from "@/lib/data/projects";
import type { ExperienceEntry } from "@/lib/data/cv";
import type { PublicationSummary } from "@/lib/content/publication";
import { cn } from "@/lib/utils/cn";

/* ═══════════════════════════════════════════════════════════════════════════
   Education-to-product system map.

   ── What it is for ─────────────────────────────────────────────────────────
   Every other section is evidence of an output: a product, a book, a role.
   None of them answers the question an employer or an institution actually has
   — *why would a teacher-trainee be the right person to build our software?*
   The answer is the process, and this is the only section that shows it: a
   classroom problem becomes research, becomes design, becomes a system, and
   the evidence for each stage is a real row from the CMS.

   ── Why it is a list, not a diagram ────────────────────────────────────────
   The brief asks for a system diagram and simultaneously warns against a
   graphic that hides essential information. Those pull in opposite directions,
   so the resolution is that the *content* is an ordered list — a numbered
   `<ol>` of stages, each with a heading and real linked evidence, complete
   with CSS off and linear for a screen reader — and the diagram is the rail
   and connectors painted over it, all `aria-hidden`. Nothing in the decoration
   carries meaning the list does not.

   Stages with no evidence still render. The process is the claim; a stage
   without a linked example is simply a stage the CMS has nothing to point at
   yet, and hiding it would misrepresent the sequence.

   ── Where the evidence comes from ──────────────────────────────────────────
   Nothing here is authored. Teaching stages cite published `experiences`,
   product stages cite published `projects`, and the knowledge stage cites
   published `publications`. If a table is empty the stage keeps its
   description and drops its examples.
   ═══════════════════════════════════════════════════════════════════════════ */

type Evidence = { key: string; label: string; href: string; lang?: string };

type Stage = {
  key: "teaching" | "problems" | "design" | "engineering" | "access";
  icon: IconName;
  evidence: Evidence[];
};

export function SystemMap({
  locale,
  t,
  experiences,
  projects,
  publications,
}: {
  locale: Locale;
  t: Dictionary;
  experiences: ExperienceEntry[];
  projects: ProjectCardData[];
  publications: PublicationSummary[];
}) {
  const experienceEvidence = experiences.slice(0, 3).map((entry) => ({
    key: entry.id,
    label: entry.roleTitle,
    href: localePath(locale, "experience"),
    lang: langAttribute(locale, entry.contentLocale),
  }));

  const projectEvidence = projects.slice(0, 3).map((project) => ({
    key: project.id,
    label: project.title,
    href: localePath(locale, `projects/${project.slug}`),
    lang: langAttribute(locale, project.contentLocale),
  }));

  const publicationEvidence = publications.slice(0, 2).map((publication) => ({
    key: publication.id,
    label: publication.title,
    href: localePath(locale, `publications/${publication.slug}`),
    lang: langAttribute(locale, publication.contentLocale),
  }));

  const stages: Stage[] = [
    { key: "teaching", icon: "graduation", evidence: experienceEvidence },
    { key: "problems", icon: "lightbulb", evidence: [] },
    { key: "design", icon: "target", evidence: projectEvidence.slice(0, 2) },
    { key: "engineering", icon: "code", evidence: projectEvidence },
    { key: "access", icon: "book", evidence: publicationEvidence },
  ];

  return (
    <section aria-labelledby="system-map-heading" className="bg-background">
      <div className="container-content section-y">
        <Reveal className="flex max-w-[54ch] flex-col gap-4">
          <p className="flex items-center gap-2.5 text-eyebrow font-semibold uppercase text-accent-subtle-foreground">
            <span aria-hidden="true" className="h-px w-8 bg-accent" />
            {t.home.systemMap.eyebrow}
          </p>

          <h2 id="system-map-heading" className="text-h2">
            {t.home.systemMap.heading}
          </h2>

          <p className="text-body-lg text-foreground-muted">
            {t.home.systemMap.body}
          </p>
        </Reveal>

        {/* The rail sits behind the list and is drawn only from `sm` up: at
            320px a vertical rule plus an indent costs more width than it
            explains. */}
        <ol className="relative mt-12 flex flex-col gap-6">
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-y-6 left-5 hidden w-px bg-gradient-to-b from-transparent via-border-strong to-transparent sm:block"
          />

          {stages.map((stage, index) => {
            const stageText = t.home.systemMap.stages[stage.key];
            return (
              <li key={stage.key} className="relative">
                <Reveal delay={index * 70}>
                  <div className="flex flex-col gap-3 sm:flex-row sm:gap-6">
                    {/* Marker. The numeral is decorative — the stage's own
                        heading beside it is the information. */}
                    <span
                      aria-hidden="true"
                      className={cn(
                        "relative z-10 inline-flex size-10 shrink-0 items-center justify-center",
                        "rounded-(--radius-full) border border-border-strong bg-surface",
                        "text-small font-bold tabular-nums text-primary",
                      )}
                    >
                      {String(index + 1).padStart(2, "0")}
                    </span>

                    <div className="flex flex-1 flex-col gap-2 pb-2">
                      <h3 className="flex items-center gap-2.5 text-h4 font-semibold">
                        <Icon
                          name={stage.icon}
                          size={18}
                          aria-hidden
                          className="text-accent"
                        />
                        {stageText.title}
                      </h3>

                      <p className="max-w-[62ch] text-small text-foreground-muted">
                        {stageText.body}
                      </p>

                      {stage.evidence.length > 0 ? (
                        <ul className="mt-1 flex flex-wrap gap-2">
                          {stage.evidence.map((item) => (
                            <li key={item.key}>
                              <Link
                                href={item.href}
                                lang={item.lang}
                                className={cn(
                                  "inline-flex min-h-9 items-center rounded-(--radius-full) border border-border",
                                  "bg-surface px-3 text-[0.8125rem] text-foreground-muted",
                                  "transition-colors duration-200",
                                  "hover:border-border-interactive hover:text-foreground",
                                )}
                              >
                                {item.label}
                              </Link>
                            </li>
                          ))}
                        </ul>
                      ) : null}
                    </div>
                  </div>
                </Reveal>
              </li>
            );
          })}
        </ol>
      </div>
    </section>
  );
}
